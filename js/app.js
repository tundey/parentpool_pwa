// js/app.js
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, db, doc, getDoc, getFunctions, httpsCallable } from './firebase-config.js';

let currentPoolData = null; // Globally cache pool data for dashboard modals/actions

document.addEventListener('DOMContentLoaded', () => {
  const loginModal = document.getElementById('login-modal');
  const mainContent = document.getElementById('main-content'); // Universal main container for all pages
  const googleLoginBtn = document.getElementById('google-login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const userEmailSpan = document.getElementById('user-email');
  const loginErrorMsg = document.getElementById('login-error-msg');

  // Monitor Auth State
  onAuthStateChanged(auth, async (user) => {
const userAvatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');
	
    if (user) {
      try {
        // Fetch whitelist and admin arrays securely from Firestore config
        const configDocRef = doc(db, 'config', 'settings');
        const configSnap = await getDoc(configDocRef);

        if (!configSnap.exists()) {
          throw new Error("System configuration not found.");
        }

        const configData = configSnap.data();
        const allowedEmails = configData.allowedEmails || [];
        const adminEmails = configData.adminEmails || [];

        // Check Whitelist
        if (allowedEmails.includes(user.email)) {
          if (loginModal) loginModal.classList.add('hidden');
          if (mainContent) mainContent.classList.remove('hidden'); // Universally reveals the page
          
		// Populate Profile Picture & Name
          if (userAvatar) {
            if (user.photoURL) {
              userAvatar.src = user.photoURL;
              userAvatar.classList.remove('hidden');
            } else {
              userAvatar.classList.add('hidden');
            }
          }

          if (userName) {
            // Fallback to email username if displayName isn't set by Google
            userName.textContent = user.displayName || user.email.split('@')[0];
          }		  

          // Fetch or sync page data from Firestore if needed
          await loadPageData();
		  
          // Automatically show/hide any element with the 'admin-only' class based on the admin array
          const isAdmin = adminEmails.includes(user.email);		  
          document.querySelectorAll('.admin-only').forEach(el => {
            if (isAdmin) {
              el.classList.remove('hidden');
            } else {
              el.classList.add('hidden');
            }
          });		  

        } else {
          // Unauthorized email
          await signOut(auth);
          if (mainContent) mainContent.classList.add('hidden');
          if (loginErrorMsg) {
            loginErrorMsg.textContent = `Access denied for ${user.email}. This account is not authorized.`;
            loginErrorMsg.classList.remove('hidden');
          }
          if (loginModal) loginModal.classList.remove('hidden');
        }
      } catch (error) {
        console.error("Error validating authentication:", error);
        await signOut(auth);
      }
    } else {
      // Not logged in -> Show Login Modal & Hide Content
      if (loginModal) loginModal.classList.remove('hidden');
      if (mainContent) mainContent.classList.add('hidden');
      document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
      if (userEmailSpan) userEmailSpan.textContent = '';
    }
  });

  // Handle Google Login Click
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
      try {
        if (loginErrorMsg) loginErrorMsg.classList.add('hidden');
        await signInWithPopup(auth, googleProvider);
      } catch (error) {
        console.error("Login failed:", error);
        if (loginErrorMsg) {
          loginErrorMsg.textContent = "Login failed. Please try again.";
          loginErrorMsg.classList.remove('hidden');
        }
      }
    });
  }

  // Handle Logout Click
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await signOut(auth);
    });
  }
});

// This runs automatically after successful authentication gating
async function loadPageData() {
  try {
    // 1. Fetch the single master pool document "main-pool"
    const poolDocRef = doc(db, 'pools', 'main-pool');
    const poolSnap = await getDoc(poolDocRef);

    if (!poolSnap.exists()) {
      console.warn('No "main-pool" document found in Firestore. Please import a backup dataset.');
      return;
    }

    const poolData = poolSnap.data();
	currentPoolData = poolData;
	updateFooterTimestamp(poolData);
	updateCashOnHand(poolData);
	updateLatestContributionMonth(poolData.Contributors);
	updateLatestDistributionMonth(poolData.Recipients);
	updateDelinquentBadge(poolData.Contributors);	
    
    // 2. Render Contributors and Recipients
    renderContributors(poolData.Contributors || []);
    renderRecipients(poolData.Recipients || []);

    console.log('Pool data loaded successfully for operating year:', poolData.Year);

  } catch (error) {
    console.error('Error loading pool data from Firestore:', error);
  }
}

function renderContributors(contributors) {
  const tbody = document.getElementById('contributors-table-body');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!contributors || contributors.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-4 px-4 text-center text-sm text-gray-500">No contributors found.</td>
      </tr>
    `;
    return;
  }

  contributors.forEach(contributor => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50 transition border-b border-gray-100';

    let lastTx = null;
    if (contributor.Transactions && contributor.Transactions.length > 0) {
      // Sort transactions descending by Timestamp
      const sortedTx = [...contributor.Transactions].sort((a, b) => {
        const timeA = new Date(a.Timestamp || a.DateRecorded || 0);
        const timeB = new Date(b.Timestamp || b.DateRecorded || 0);
        return timeB - timeA;
      });
      lastTx = sortedTx[0];
    }
	
    let effectiveMonthStr = '-';
    if (lastTx && lastTx.EffectiveMonth) {
      const dateObj = new Date(lastTx.EffectiveMonth);
      if (!isNaN(dateObj)) {
        effectiveMonthStr = dateObj.toLocaleDateString('en-US', { month: 'long' });
      }
    }

    let dateReceivedStr = '-';
    if (lastTx && lastTx.DateRecorded) {
      const dateObj = createLocalDateFromString(lastTx.DateRecorded);	  
      if (!isNaN(dateObj)) {
        dateReceivedStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    }

    const formattedAmount = lastTx && lastTx.Amount !== undefined 
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(lastTx.Amount) 
      : '-';

    const txMethod = lastTx ? (lastTx.Method || '-') : '-';
    const contributorId = contributor.Id || '';

    tr.innerHTML = `
      <td class="py-3 px-4 font-semibold text-pool-dark">${escapeHtml(contributor.Name)}</td>
      <td class="py-3 px-4 text-gray-600">${effectiveMonthStr}</td>
      <td class="py-3 px-4 text-gray-600">${dateReceivedStr}</td>
      <td class="py-3 px-4 font-bold text-pool-teal">${formattedAmount}</td>
      <td class="py-3 px-4 text-gray-600">${escapeHtml(txMethod)}</td>
      <td class="py-3 px-4 text-right space-x-1">
        <button onclick="viewContributorDetails('${escapeHtml(contributorId)}')" class="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg text-xs font-semibold transition">Details</button>
        <button onclick="addContribution('${escapeHtml(contributorId)}')" class="admin-only text-white bg-pool-teal hover:bg-teal-700 px-4 py-2 rounded-lg text-xs font-semibold transition shadow-sm">Add Contribution</button>
		<button onclick="sendReminderHelper('${contributor.Id}')" class="admin-only text-amber-700 bg-amber-50 hover:bg-amber-100 px-4 py-2 rounded-lg text-xs font-semibold transition">Send Reminder</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.sendReminderHelper = function(contributorId){	
	const contributor = currentPoolData.Contributors.find(c => c.Id === contributorId);	
	const summary = getContributorSummary(contributor);
	
	sendReminder(contributor.Name, contributor.EmailAddress, summary.nextContributionMonth, summary.lastContributionMonth, summary.lastContributionDate)
	
	return true;	
}

function renderRecipients(recipients) {
  const tbody = document.getElementById('recipients-table-body');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!recipients || recipients.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-4 px-4 text-center text-sm text-gray-500">No recipients found.</td>
      </tr>
    `;
    return;
  }

  recipients.forEach(recipient => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50 transition border-b border-gray-100';

    let lastTx = null;
    if (recipient.Transactions && recipient.Transactions.length > 0) {
      // Sort transactions descending by Timestamp
      const sortedTx = [...recipient.Transactions].sort((a, b) => {
        const timeA = new Date(a.Timestamp || a.DateRecorded || 0);
        const timeB = new Date(b.Timestamp || b.DateRecorded || 0);
        return timeB - timeA;
      });
      lastTx = sortedTx[0];
    }

    let effectiveMonthStr = '-';
    if (lastTx && lastTx.EffectiveMonth) {
      const dateObj = new Date(lastTx.EffectiveMonth);
      if (!isNaN(dateObj)) {
        effectiveMonthStr = dateObj.toLocaleDateString('en-US', { month: 'long' });
      }
    }

    let dateSentStr = '-';
    if (lastTx && lastTx.DateRecorded) {
      const dateObj = createLocalDateFromString(lastTx.DateRecorded);
      if (!isNaN(dateObj)) {
        dateSentStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    }

    const formattedAmount = lastTx && lastTx.Amount !== undefined 
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(lastTx.Amount) 
      : '-';

    const txMethod = lastTx ? (lastTx.Method || '-') : '-';
    const recipientId = recipient.Id || '';

    tr.innerHTML = `
      <td class="py-3 px-4 font-semibold text-pool-dark">${escapeHtml(recipient.Name)}</td>
      <td class="py-3 px-4 text-gray-600">${effectiveMonthStr}</td>
      <td class="py-3 px-4 text-gray-600">${dateSentStr}</td>
      <td class="py-3 px-4 font-bold text-pool-orange">${formattedAmount}</td>
      <td class="py-3 px-4 text-gray-600">${escapeHtml(txMethod)}</td>
      <td class="py-3 px-4 text-right space-x-1">
        <button onclick="viewRecipientDetails('${escapeHtml(recipientId)}')" class="text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg text-xs font-semibold transition">Details</button>
        <button onclick="sendAllowance('${escapeHtml(recipientId)}')" class="admin-only text-white px-4 py-2 bg-pool-orange hover:bg-orange-700 text-white rounded-xl text-xs font-semibold transition shadow-sm">Send Allowance</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Simple HTML escape helper
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


// Updates the centered footer timestamp from the master pool document data
function updateFooterTimestamp(poolData) {
  const footerElement = document.getElementById('last-updated-footer');
  if (!footerElement) return;

  if (poolData && poolData.LastUpdated) {
    const dateObj = new Date(poolData.LastUpdated);
    if (!isNaN(dateObj)) {
      const formattedDate = dateObj.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
      footerElement.textContent = `Last Updated: ${formattedDate}`;
    } else {
      footerElement.textContent = 'Last Updated: --';
    }
  } else {
    footerElement.textContent = 'Last Updated: --';
  }
}

function updateCashOnHand(poolData) {
  const cashEl = document.getElementById('kpi-cash');
  if (!cashEl) return;

  // Sum all contributor transaction amounts
  let totalContributions = 0;
  if (poolData && poolData.Contributors) {
    poolData.Contributors.forEach(contributor => {
      if (contributor.Transactions) {
        contributor.Transactions.forEach(tx => {
          totalContributions += Number(tx.Amount || 0);
        });
      }
    });
  }

  // Sum all recipient transaction amounts
  let totalDistributions = 0;
  if (poolData && poolData.Recipients) {
    poolData.Recipients.forEach(recipient => {
      if (recipient.Transactions) {
        recipient.Transactions.forEach(tx => {
          totalDistributions += Number(tx.Amount || 0);
        });
      }
    });
  }

  // Calculate net cash on hand
  const cashOnHand = totalContributions - totalDistributions;

  // Format as currency with no decimals
  const formattedCash = new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD', 
    maximumFractionDigits: 0 
  }).format(cashOnHand);

  // Update the KPI card element
  cashEl.textContent = formattedCash;
}

function updateDelinquentBadge(contributors) {
  const badgeEl = document.getElementById('delinquent-badge');
  if (!badgeEl) return;

  if (!contributors || contributors.length === 0) {
    badgeEl.textContent = '0';
    badgeEl.classList.add('hidden');
    return;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed (0 = Jan, 9 = Oct for October 2026)

  let delinquentCount = 0;

  contributors.forEach(contributor => {
    if (!contributor.Transactions || contributor.Transactions.length === 0) {
      delinquentCount++;
      return;
    }

    // Sort transactions descending by EffectiveMonth to find the latest one
    const sortedTx = [...contributor.Transactions].sort((a, b) => {
      return new Date(b.EffectiveMonth || 0) - new Date(a.EffectiveMonth || 0);
    });
    
    const lastTx = sortedTx[0];
    if (lastTx && lastTx.EffectiveMonth) {
      const txDate = new Date(lastTx.EffectiveMonth);
      const txYear = txDate.getFullYear();
      const txMonth = txDate.getMonth();

      // Check if their last effective payment month is behind the current month/year
      if (txYear < currentYear || (txYear === currentYear && txMonth < currentMonth)) {
        delinquentCount++;
      }
    } else {
      delinquentCount++;
    }
  });

  // Update badge display
  if (delinquentCount > 0) {
    badgeEl.textContent = delinquentCount;
    badgeEl.classList.remove('hidden');
  } else {
    badgeEl.textContent = '0';
    badgeEl.classList.add('hidden');
  }
}

function updateLatestContributionMonth(contributors) {
  const kpiEl = document.getElementById('kpi-contributions');
  if (!kpiEl) return;

  if (!contributors || contributors.length === 0) {
    kpiEl.textContent = '-';
    return;
  }

  let latestDate = null;

  // Iterate through all contributors and all of their transactions to find the most recent EffectiveMonth
  contributors.forEach(contributor => {
    if (contributor.Transactions && contributor.Transactions.length > 0) {
      contributor.Transactions.forEach(tx => {
        if (tx.EffectiveMonth) {
          const txDate = new Date(tx.EffectiveMonth);
          if (!isNaN(txDate)) {
            if (!latestDate || txDate > latestDate) {
              latestDate = txDate;
            }
          }
        }
      });
    }
  });

  // If a valid date was found, display the month name; otherwise fallback to '-'
  if (latestDate) {
    const monthName = latestDate.toLocaleDateString('en-US', { month: 'long' });
    kpiEl.textContent = monthName;
  } else {
    kpiEl.textContent = '-';
  }
}

function updateLatestDistributionMonth(recipients) {
  const kpiEl = document.getElementById('kpi-distributions');
  if (!kpiEl) return;

  if (!recipients || recipients.length === 0) {
    kpiEl.textContent = '-';
    return;
  }

  let latestDate = null;

  // Iterate through all recipients and their transactions to find the most recent EffectiveMonth
  recipients.forEach(recipient => {
    if (recipient.Transactions && recipient.Transactions.length > 0) {
      recipient.Transactions.forEach(tx => {
        if (tx.EffectiveMonth) {
          const txDate = new Date(tx.EffectiveMonth);
          if (!isNaN(txDate)) {
            if (!latestDate || txDate > latestDate) {
              latestDate = txDate;
            }
          }
        }
      });
    }
  });

  // Display the month name if found, otherwise fallback to '-'
  if (latestDate) {
    const monthName = latestDate.toLocaleDateString('en-US', { month: 'long' });
    kpiEl.textContent = monthName;
  } else {
    kpiEl.textContent = '-';
  }
}

import { updateDoc } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
//import { db } from "./js/firebase-config.js";

// 1. Open Modal & Populate Smart Defaults
window.addContribution = function(contributorId) {
  const contributor = currentPoolData.Contributors.find(c => c.Id === contributorId);
  if (!contributor) return;

  // Set Modal Header Title
  document.getElementById('add-contribution-title').textContent = `Add Contribution from ${contributor.Name}`;
  document.getElementById('add-contrib-contributor-id').value = contributor.Id;

  // Set Default Date to Today (YYYY-MM-DD format)
  const today = getLocalDateString();
  document.getElementById('add-contrib-date').value = today;

  // Default Amount (optional blank or standard default)
  document.getElementById('add-contrib-amount').value = '';
  document.getElementById('add-contrib-notes').value = '';

  // Smart Default 1: Method (Contributor's Preferred Method, fallback to Venmo)
  const methodSelect = document.getElementById('add-contrib-method');
  methodSelect.value = contributor.PreferredPaymentMethod || 'Venmo';

  // Smart Default 2: Month (Month after their latest transaction)
  const monthSelect = document.getElementById('add-contrib-month');
  let nextMonthName = new Date().toLocaleString('en-US', { month: 'long' }); // fallback to current month

  if (contributor.Transactions && contributor.Transactions.length > 0) {
    // Find latest transaction by timestamp/date
    const sortedTx = [...contributor.Transactions].sort((a, b) => {
      return new Date(b.Timestamp || b.DateRecorded || 0) - new Date(a.Timestamp || a.DateRecorded || 0);
    });
    
    const lastTx = sortedTx[0];
    if (lastTx && lastTx.EffectiveMonth) {
      const lastDate = new Date(lastTx.EffectiveMonth);
      if (!isNaN(lastDate)) {
        // Advance by 1 month
        lastDate.setMonth(lastDate.getMonth() + 1);
        nextMonthName = lastDate.toLocaleString('en-US', { month: 'long' });
      }
    }
  }
  monthSelect.value = nextMonthName;

  // Update Live Cash on Hand Display in footer
  updateModalCashOnHandDisplay();

  // Show Modal
  document.getElementById('add-contribution-modal').classList.remove('hidden');
};

window.closeAddContributionModal = function() {
  document.getElementById('add-contribution-modal').classList.add('hidden');
};

function updateModalCashOnHandDisplay() {
  const cohEl = document.getElementById('add-contrib-cash-on-hand');
  if (cohEl && typeof calculateCashOnHand === 'function') {
    cohEl.textContent = `Cash On Hand: $${calculateCashOnHand(currentPoolData)}`;
  }
}

// 2. Handle Form Submission
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('add-contribution-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const contributorId = document.getElementById('add-contrib-contributor-id').value;
      const monthStr = document.getElementById('add-contrib-month').value;
      const dateRecorded = document.getElementById('add-contrib-date').value;
      const amount = Number(document.getElementById('add-contrib-amount').value);
      const method = document.getElementById('add-contrib-method').value;
      const notes = document.getElementById('add-contrib-notes').value.trim();

      const contributorIndex = currentPoolData.Contributors.findIndex(c => c.Id === contributorId);
      if (contributorIndex === -1) return;
	  
	  // Convert month choice into a standard Date ISO string representation
      const effectiveMonthISO = getEffectiveMonthDateString(monthStr, dateRecorded);

      // Construct new transaction object
      const newTransaction = {
        Id: 'tx_' + Date.now(),
        EffectiveMonth: effectiveMonthISO, // e.g. "2026-08-01T00:00:00.000Z"
        DateRecorded: dateRecorded,
        Amount: amount,
        Method: method,
        Notes: notes,
        Timestamp: new Date().toISOString()
      };
	  
      // Ensure Transactions array exists
      if (!currentPoolData.Contributors[contributorIndex].Transactions) {
        currentPoolData.Contributors[contributorIndex].Transactions = [];
      }

      // Push to local array
      currentPoolData.Contributors[contributorIndex].Transactions.push(newTransaction);

      try {
        // Save back to Firestore
        const docRef = doc(db, "pools", "main-pool");
        await updateDoc(docRef, {
          Contributors: currentPoolData.Contributors,
          LastUpdated: new Date().toISOString()
        });

        // Close modal, refresh table and dashboard stats
        closeAddContributionModal();
        renderContributors(currentPoolData.Contributors);
        updateCashOnHand(currentPoolData);
        updateDelinquentBadge(currentPoolData.Contributors);
        updateLatestContributionMonth(currentPoolData.Contributors);
		
	  // Send confirmation Email
	  const contributor = currentPoolData.Contributors.find(c => c.Id === contributorId);
	  sendContributionConfirmation(contributor.Name, contributor.EmailAddress, amount, monthStr, dateRecorded);

      } catch (error) {
        console.error("Error adding contribution:", error);
        alert("Failed to save contribution. Please try again.");
      }
    });
  }
});

//import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
//import { db } from "./js/firebase-config.js";

// 1. Open Modal and Populate Contributor Transactions
window.viewContributorDetails = function(contributorId) {
  const contributor = currentPoolData.Contributors.find(c => c.Id === contributorId);
  if (!contributor) return;

  // Set Header Title (Name + Email)
  const emailDisplay = contributor.EmailAddress ? `(${contributor.EmailAddress})` : '';
  document.getElementById('details-modal-title').textContent = `${contributor.Name} ${emailDisplay}`;

  const tbody = document.getElementById('details-modal-tbody');
  tbody.innerHTML = '';

  const transactions = contributor.Transactions || [];

  if (transactions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-gray-500 text-sm">No transaction history found.</td></tr>`;
  } else {
    // Sort transactions descending by timestamp or date
    const sortedTx = [...transactions].sort((a, b) => {
      return new Date(b.Timestamp || b.DateRecorded || 0) - new Date(a.Timestamp || a.DateRecorded || 0);
    });

    sortedTx.forEach(tx => {
      // Parse Year and Month from EffectiveMonth or DateRecorded
      let yearStr = '-';
      let monthStr = '-';
      
      if (tx.EffectiveMonth) {
        // If EffectiveMonth is stored as a name like "August" or full date string
        const parsedDate = new Date(tx.EffectiveMonth);
        if (!isNaN(parsedDate)) {
          yearStr = parsedDate.getFullYear();
          monthStr = parsedDate.toLocaleDateString('en-US', { month: 'long' });
        } else {
          monthStr = tx.EffectiveMonth; // fallback if just stored as string
          if (tx.DateRecorded) {
            yearStr = new Date(tx.DateRecorded).getFullYear();
          }
        }
      }

      let dateReceivedStr = '-';
      if (tx.DateRecorded) {
        const d = createLocalDateFromString(tx.DateRecorded);
        if (!isNaN(d)) {
          dateReceivedStr = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        }
      }

      const formattedAmount = tx.Amount !== undefined 
        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(tx.Amount) 
        : '-';

      const tr = document.createElement('tr');
      tr.className = 'hover:bg-gray-50 transition border-b border-gray-100';
      tr.innerHTML = `
        <td class="py-3 px-4 text-gray-600">${yearStr}</td>
        <td class="py-3 px-4 font-semibold text-pool-dark">${monthStr}</td>
        <td class="py-3 px-4 font-bold text-pool-teal">${formattedAmount}</td>
        <td class="py-3 px-4 text-gray-600">${dateReceivedStr}</td>
        <td class="py-3 px-4 text-gray-600">${escapeHtml(tx.Method || '-')}</td>
        <td class="py-3 px-4 text-right">
          <button onclick="deleteContributorTransaction('${contributor.Id}', '${tx.Id}')" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-xs font-semibold transition shadow-sm">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Show modal
  document.getElementById('contributor-details-modal').classList.remove('hidden');
};

// 2. Close Modal
window.closeContributorDetailsModal = function() {
  document.getElementById('contributor-details-modal').classList.add('hidden');
};

// 3. Delete Transaction Handler
window.deleteContributorTransaction = async function(contributorId, transactionId) {
  if (!confirm("Are you sure you want to delete this transaction?")) return;

  const contributorIndex = currentPoolData.Contributors.findIndex(c => c.Id === contributorId);
  if (contributorIndex === -1) return;

  // Filter out the selected transaction
  currentPoolData.Contributors[contributorIndex].Transactions = currentPoolData.Contributors[contributorIndex].Transactions.filter(
    tx => tx.Id !== transactionId
  );

  try {
    // Save updated contributors array to Firestore
    const docRef = doc(db, "pools", "main-pool");
    await updateDoc(docRef, {
      Contributors: currentPoolData.Contributors,
      LastUpdated: new Date().toISOString()
    });

    // Refresh the details modal view and dashboard summary cards/tables
    viewContributorDetails(contributorId);
    renderContributors(currentPoolData.Contributors);
    updateCashOnHand(currentPoolData);
    updateDelinquentBadge(currentPoolData.Contributors);
    updateLatestContributionMonth(currentPoolData.Contributors);

  } catch (error) {
    console.error("Error deleting transaction:", error);
    alert("Failed to delete transaction. Please try again.");
  }
};

// Helper to construct a standard Date object/string for the first of the selected month
function getEffectiveMonthDateString(monthName, selectedDateRecorded) {
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  const monthIndex = monthNames.indexOf(monthName);
  
  // Use the year from the Date Recorded field, or fallback to current year
  let year = new Date().getFullYear();
  if (selectedDateRecorded) {
    const recDate = new Date(selectedDateRecorded);
    if (!isNaN(recDate)) {
      year = recDate.getFullYear();
    }
  }

  if (monthIndex !== -1) {
    // Create Date object set to 1st of that month at midnight local time
    const dateObj = new Date(year, monthIndex, 1);
    return dateObj.toISOString(); // e.g. "2026-08-01T00:00:00.000Z" (or corresponding local shift)
  }

  // Fallback to current date ISO string if unmapped
  return new Date().toISOString();
}


function createLocalDateFromString(dateStr) {
  // Works for "YYYY-MM-DD" or "YYYY-MM-DD HH:mm:ss"
  const [datePart, timePart] = dateStr.split(/[ T]/); 
  const [year, month, day] = datePart.split('-').map(Number);
  
  const hours = timePart ? Number(timePart.split(':')[0]) : 0;
  const minutes = timePart ? Number(timePart.split(':')[1]) : 0;
  const seconds = timePart ? Number(timePart.split(':')[2]) : 0;

  // Subtract 1 from month because JavaScript months are 0-11
  return new Date(year, month - 1, day, hours, minutes, seconds);
}

//import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
//import { db } from "./js/firebase-config.js";

// 1. Open Send Allowance Modal & Populate Smart Defaults
window.sendAllowance = function(recipientId) {
  const recipient = currentPoolData.Recipients.find(r => r.Id === recipientId);
  if (!recipient) return;

  // Set Modal Header Title
  document.getElementById('send-allowance-title').textContent = `Send Allowance to ${recipient.Name}`;
  document.getElementById('allowance-recipient-id').value = recipient.Id;

  // Set Default Date to Today (YYYY-MM-DD)
  const today = getLocalDateString();
  document.getElementById('allowance-date').value = today;

  document.getElementById('allowance-amount').value = '';
  document.getElementById('allowance-notes').value = '';

  // Smart Default 1: Preferred Payment Method (fallback to Zelle)
  const methodSelect = document.getElementById('allowance-method');
  methodSelect.value = recipient.PreferredPaymentMethod || 'Zelle';

  // Smart Default 2: Month (Month after their latest transaction)
  const monthSelect = document.getElementById('allowance-month');
  let nextMonthName = new Date().toLocaleString('en-US', { month: 'long' });

  if (recipient.Transactions && recipient.Transactions.length > 0) {
    const sortedTx = [...recipient.Transactions].sort((a, b) => {
      return new Date(b.Timestamp || b.DateRecorded || 0) - new Date(a.Timestamp || a.DateRecorded || 0);
    });
    
    const lastTx = sortedTx[0];
    if (lastTx && lastTx.EffectiveMonth) {
      const lastDate = new Date(lastTx.EffectiveMonth);
      if (!isNaN(lastDate)) {
        lastDate.setMonth(lastDate.getMonth() + 1);
        nextMonthName = lastDate.toLocaleString('en-US', { month: 'long' });
      }
    }
  }
  monthSelect.value = nextMonthName;

  // Update Live Cash on Hand Display in footer
  updateAllowanceCashOnHandDisplay();

  // Show Modal
  document.getElementById('send-allowance-modal').classList.remove('hidden');
};

window.closeSendAllowanceModal = function() {
  document.getElementById('send-allowance-modal').classList.add('hidden');
};

function updateAllowanceCashOnHandDisplay() {
  const cohEl = document.getElementById('allowance-cash-on-hand');
  if (cohEl && typeof calculateCashOnHand === 'function') {
    cohEl.textContent = `Cash On Hand: $${calculateCashOnHand(currentPoolData)}`;
  }
}

// 2. Handle Send Allowance Form Submission
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('send-allowance-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const recipientId = document.getElementById('allowance-recipient-id').value;
      const monthStr = document.getElementById('allowance-month').value;
      const dateRecorded = document.getElementById('allowance-date').value;
      const amount = Number(document.getElementById('allowance-amount').value);
      const method = document.getElementById('allowance-method').value;
      const notes = document.getElementById('allowance-notes').value.trim();

      const recipientIndex = currentPoolData.Recipients.findIndex(r => r.Id === recipientId);
      if (recipientIndex === -1) return;

      const effectiveMonthISO = getEffectiveMonthDateString(monthStr, dateRecorded);

      // Construct new distribution transaction object
      const newTransaction = {
        Id: 'tx_' + Date.now(),
        EffectiveMonth: effectiveMonthISO,
        DateRecorded: dateRecorded,
        Amount: amount,
        Method: method,
        Notes: notes,
        Timestamp: new Date().toISOString()
      };

      if (!currentPoolData.Recipients[recipientIndex].Transactions) {
        currentPoolData.Recipients[recipientIndex].Transactions = [];
      }

      currentPoolData.Recipients[recipientIndex].Transactions.push(newTransaction);

      try {
        // Save back to Firestore
        const docRef = doc(db, "pools", "main-pool");
        await updateDoc(docRef, {
          Recipients: currentPoolData.Recipients,
          LastUpdated: new Date().toISOString()
        });

        // Close modal and refresh UI/KPIs
        closeSendAllowanceModal();
        renderRecipients(currentPoolData.Recipients);
        updateCashOnHand(currentPoolData);
        updateLatestDistributionMonth(currentPoolData.Recipients);
		
		// Send email to contributors
		const recipient = currentPoolData.Recipients.find(r => r.Id === recipientId);
		currentPoolData.Contributors.forEach(contributor => { sendPaymentNotification(contributor.Name, contributor.EmailAddress, recipient.Name, monthStr, amount, dateRecorded); }
		);  

      } catch (error) {
        console.error("Error sending allowance:", error);
        alert("Failed to save allowance distribution. Please try again.");
      }
    });
  }
});

// 1. Open Recipient Details Modal & Populate Data
window.viewRecipientDetails = function(recipientId) {
  const recipient = currentPoolData.Recipients.find(r => r.Id === recipientId);
  if (!recipient) return;

  // Set Header Title (Name + Optional Email)
  const emailDisplay = recipient.EmailAddress ? `(${recipient.EmailAddress})` : '';
  document.getElementById('recipient-details-modal-title').textContent = `${recipient.Name} ${emailDisplay}`;

  const tbody = document.getElementById('recipient-details-modal-tbody');
  tbody.innerHTML = '';

  const transactions = recipient.Transactions || [];

  if (transactions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-gray-500 text-sm">No transaction history found.</td></tr>`;
  } else {
    // Sort transactions descending by timestamp or recorded date
    const sortedTx = [...transactions].sort((a, b) => {
      return new Date(b.Timestamp || b.DateRecorded || 0) - new Date(a.Timestamp || a.DateRecorded || 0);
    });

    sortedTx.forEach(tx => {
      let yearStr = '-';
      let monthStr = '-';
      
      if (tx.EffectiveMonth) {
        const parsedDate = new Date(tx.EffectiveMonth);
        if (!isNaN(parsedDate)) {
          yearStr = parsedDate.getFullYear();
          monthStr = parsedDate.toLocaleDateString('en-US', { month: 'long' });
        } else {
          monthStr = tx.EffectiveMonth;
          if (tx.DateRecorded) {
            yearStr = new Date(tx.DateRecorded).getFullYear();
          }
        }
      }

      let dateReceivedStr = '-';
      if (tx.DateRecorded) {
        const d = createLocalDateFromString(tx.DateRecorded);
        if (!isNaN(d)) {
          dateReceivedStr = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        }
      }

      const formattedAmount = tx.Amount !== undefined 
        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(tx.Amount) 
        : '-';

      const tr = document.createElement('tr');
      tr.className = 'hover:bg-gray-50 transition border-b border-gray-100';
      tr.innerHTML = `
        <td class="py-3 px-4 text-gray-600">${yearStr}</td>
        <td class="py-3 px-4 font-semibold text-pool-dark">${monthStr}</td>
        <td class="py-3 px-4 font-bold text-pool-orange">${formattedAmount}</td>
        <td class="py-3 px-4 text-gray-600">${dateReceivedStr}</td>
        <td class="py-3 px-4 text-gray-600">${escapeHtml(tx.Method || '-')}</td>
        <td class="py-3 px-4 text-right">
          <button onclick="deleteRecipientTransaction('${recipient.Id}', '${tx.Id}')" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-xs font-semibold transition shadow-sm">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Show Modal
  document.getElementById('recipient-details-modal').classList.remove('hidden');
};

// 2. Close Modal
window.closeRecipientDetailsModal = function() {
  document.getElementById('recipient-details-modal').classList.add('hidden');
};

// 3. Delete Recipient Transaction Handler
window.deleteRecipientTransaction = async function(recipientId, transactionId) {
  if (!confirm("Are you sure you want to delete this distribution record?")) return;

  const recipientIndex = currentPoolData.Recipients.findIndex(r => r.Id === recipientId);
  if (recipientIndex === -1) return;

  // Filter out the selected transaction
  currentPoolData.Recipients[recipientIndex].Transactions = currentPoolData.Recipients[recipientIndex].Transactions.filter(
    tx => tx.Id !== transactionId
  );

  try {
    // Save updated recipients array back to Firestore
    const docRef = doc(db, "pools", "main-pool");
    await updateDoc(docRef, {
      Recipients: currentPoolData.Recipients,
      LastUpdated: new Date().toISOString()
    });

    // Refresh modal, recipient table, and KPI metrics
    viewRecipientDetails(recipientId);
    renderRecipients(currentPoolData.Recipients);
    updateCashOnHand(currentPoolData);
    updateLatestDistributionMonth(currentPoolData.Recipients);

  } catch (error) {
    console.error("Error deleting transaction:", error);
    alert("Failed to delete distribution transaction. Please try again.");
  }
};


/**
 * Calculates contribution details for a given contributor.
 * 
 * @param {Object} contributor - The contributor object containing transactions/deposits.
 * @returns {Object} An object containing nextContributionMonth, lastContributionMonth, and lastContributionDate.
 */
export function getContributorSummary(contributor) {
  // Fallback to empty array if no transactions or deposits exist yet
  const records = contributor.Transactions || [];

  if (records.length === 0) {
    return {
      nextContributionMonth: "Pending",
      lastContributionMonth: "None",
      lastContributionDate: "N/A"
    };
  }

  // 1. Sort records chronologically (newest first) to find the most recent one
  const sortedRecords = [...records].sort((a, b) => {
    const dateA = parseDate(a.EffectiveMonth);
    const dateB = parseDate(b.EffectiveMonth);
    return dateB - dateA; // Descending order
  });

  const latestRecord = sortedRecords[0];
  const lastEffectiveDateObj = parseDate(latestRecord.EffectiveMonth);
  const lastDateObj = parseDate(latestRecord.DateRecorded);

  // 2. Format Last Contribution Date (e.g., "6-8-2026")
  const lastContributionDate = isNaN(lastDateObj.getTime()) ? "N/A" : `${lastDateObj.getMonth() + 1}-${lastDateObj.getDate()}-${lastDateObj.getFullYear()}`;

  // 3. Get Last Contribution Month Name (e.g., "May")
  const lastContributionMonth = isNaN(lastEffectiveDateObj.getTime()) ? "Unknown" : lastEffectiveDateObj.toLocaleString('default', { month: 'long' });

  // 4. Calculate Next Contribution Month (e.g., exactly 1 month after the last contribution)
  const nextDateObj = new Date(lastEffectiveDateObj);
  nextDateObj.setMonth(nextDateObj.getMonth() + 1);
  const nextContributionMonth = isNaN(nextDateObj.getTime()) ? "Unknown" : nextDateObj.toLocaleString('default', { month: 'long' });

  return {
    nextContributionMonth,
    lastContributionMonth,
    lastContributionDate
  };
}


