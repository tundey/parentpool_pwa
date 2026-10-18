// js/app.js
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, db, doc, getDoc } from './firebase-config.js';

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
      const dateObj = new Date(lastTx.DateRecorded);
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
        <button onclick="viewContributorDetails('${escapeHtml(contributorId)}')" class="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg text-xs font-semibold transition">Details</button>
        <button onclick="editContributorTransaction('${lastTx ? lastTx.Id : ''}')" class="admin-only text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded-lg text-xs font-semibold transition">Edit</button>
        <button onclick="addContribution('${escapeHtml(contributorId)}')" class="admin-only text-white bg-pool-teal hover:bg-teal-700 px-2.5 py-1 rounded-lg text-xs font-semibold transition shadow-sm">Add Contribution</button>
        <button onclick="sendReminder('${escapeHtml(contributorId)}')" class="admin-only text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg text-xs font-semibold transition">Send Reminder</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
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
      const dateObj = new Date(lastTx.DateRecorded);
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
        <button onclick="viewRecipientDetails('${escapeHtml(recipientId)}')" class="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg text-xs font-semibold transition">Details</button>
        <button onclick="editRecipientTransaction('${lastTx ? lastTx.Id : ''}')" class="admin-only text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded-lg text-xs font-semibold transition">Edit</button>
        <button onclick="sendAllowance('${escapeHtml(recipientId)}')" class="admin-only text-white bg-pool-teal hover:bg-teal-700 px-2.5 py-1 rounded-lg text-xs font-semibold transition shadow-sm">Send Allowance</button>
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