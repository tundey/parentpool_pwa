import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import { db } from "./firebase-config.js"; // Adjust path to your firebase config if needed

let currentPoolData = null; // Store fetched pool data globally in this module

// Intercept your initial fetch to cache the data object
async function initializeAdminPage() {
  try {
    const docRef = doc(db, "pools", "main-pool");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      currentPoolData = docSnap.data();
      renderAdminContributors(currentPoolData.Contributors);
      renderAdminRecipients(currentPoolData.Recipients);
    }
  } catch (error) {
    console.error("Error loading admin data:", error);
  }
}


// 1. Open Recipient Modal and Populate Fields
window.editPersonMetadata = function(type, id) {
  if (type === 'contributor') {
    // Contributor logic handled previously...
    const contributor = currentPoolData.Contributors.find(c => c.Id === id);
    if (!contributor) return;

    document.getElementById('edit-contributor-id').value = contributor.Id;
    document.getElementById('edit-contributor-name').value = contributor.Name || '';
    document.getElementById('edit-contributor-email').value = contributor.EmailAddress || '';
    document.getElementById('edit-contributor-phone').value = contributor.PhoneNumber || '';
    document.getElementById('edit-contributor-method').value = contributor.PreferredPaymentMethod || '';
    document.getElementById('edit-contributor-sort').value = contributor.SortOrder !== undefined ? contributor.SortOrder : '';
    document.getElementById('edit-email-error').classList.add('hidden');
    document.getElementById('edit-contributor-modal').classList.remove('hidden');

  } else if (type === 'recipient') {
    const recipient = currentPoolData.Recipients.find(r => r.Id === id);
    if (!recipient) return;

    document.getElementById('edit-recipient-id').value = recipient.Id;
    document.getElementById('edit-recipient-name').value = recipient.Name || '';
    document.getElementById('edit-recipient-email').value = recipient.EmailAddress || '';
    document.getElementById('edit-recipient-phone').value = recipient.PhoneNumber || '';
    document.getElementById('edit-recipient-method').value = recipient.PreferredPaymentMethod || '';
    document.getElementById('edit-recipient-sort').value = recipient.SortOrder !== undefined ? recipient.SortOrder : '';
    
    document.getElementById('edit-recipient-email-error').classList.add('hidden');
    document.getElementById('edit-recipient-modal').classList.remove('hidden');
  }
};

// 2. Close Modal
window.closeEditContributorModal = function() {
  document.getElementById('edit-contributor-modal').classList.add('hidden');
};

// 2. Close Recipient Modal
window.closeEditRecipientModal = function() {
  document.getElementById('edit-recipient-modal').classList.add('hidden');
};



// 3. Handle Form Submission with Email Validation and Firestore Save
document.addEventListener('DOMContentLoaded', () => {
  initializeAdminPage();

  const form = document.getElementById('edit-contributor-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = document.getElementById('edit-contributor-id').value;
      const emailInput = document.getElementById('edit-contributor-email').value.trim();
      const emailError = document.getElementById('edit-email-error');

      // Email validation regex (standard format check)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailInput !== '' && !emailRegex.test(emailInput)) {
        emailError.classList.remove('hidden');
        return; // Stop submission if invalid
      } else {
        emailError.classList.add('hidden');
      }

      // Find and update contributor object in local state array
      const index = currentPoolData.Contributors.findIndex(c => c.Id === id);
      if (index === -1) return;

      currentPoolData.Contributors[index].Name = document.getElementById('edit-contributor-name').value.trim();
      currentPoolData.Contributors[index].EmailAddress = emailInput;
      currentPoolData.Contributors[index].PhoneNumber = document.getElementById('edit-contributor-phone').value.trim();
      currentPoolData.Contributors[index].PreferredPaymentMethod = document.getElementById('edit-contributor-method').value.trim();
      
      const sortVal = document.getElementById('edit-contributor-sort').value;
      currentPoolData.Contributors[index].SortOrder = sortVal !== '' ? Number(sortVal) : 0;

      try {
        // Save updated array back to Firestore document
        const docRef = doc(db, "pools", "main-pool");
        await updateDoc(docRef, {
          Contributors: currentPoolData.Contributors,
          LastUpdated: new Date().toISOString()
        });

        // Close modal and re-render the admin table
        closeEditContributorModal();
        renderAdminContributors(currentPoolData.Contributors);

      } catch (error) {
        console.error("Error updating contributor metadata:", error);
        alert("Failed to save changes. Please try again.");
      }
    });
  }
});

// 3. Handle Recipient Form Submission
document.addEventListener('DOMContentLoaded', () => {
  const recipientForm = document.getElementById('edit-recipient-form');
  if (recipientForm) {
    recipientForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = document.getElementById('edit-recipient-id').value;
      const emailInput = document.getElementById('edit-recipient-email').value.trim();
      const emailError = document.getElementById('edit-recipient-email-error');

      // Email validation regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailInput !== '' && !emailRegex.test(emailInput)) {
        emailError.classList.remove('hidden');
        return;
      } else {
        emailError.classList.add('hidden');
      }

      const index = currentPoolData.Recipients.findIndex(r => r.Id === id);
      if (index === -1) return;

      currentPoolData.Recipients[index].Name = document.getElementById('edit-recipient-name').value.trim();
      currentPoolData.Recipients[index].EmailAddress = emailInput;
      currentPoolData.Recipients[index].PhoneNumber = document.getElementById('edit-recipient-phone').value.trim();
      currentPoolData.Recipients[index].PreferredPaymentMethod = document.getElementById('edit-recipient-method').value;
      
      const sortVal = document.getElementById('edit-recipient-sort').value;
      currentPoolData.Recipients[index].SortOrder = sortVal !== '' ? Number(sortVal) : 0;

      try {
        const docRef = doc(db, "pools", "main-pool");
        await updateDoc(docRef, {
          Recipients: currentPoolData.Recipients,
          LastUpdated: new Date().toISOString()
        });

        closeEditRecipientModal();
        renderAdminRecipients(currentPoolData.Recipients);

      } catch (error) {
        console.error("Error updating recipient metadata:", error);
        alert("Failed to save changes. Please try again.");
      }
    });
  }
});

// Render Admin Contributors List (Metadata & Edit only)
function renderAdminContributors(contributors) {
  const tbody = document.getElementById('admin-contributors-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!contributors || contributors.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-4 px-4 text-center text-sm text-gray-500">No contributors found.</td></tr>`;
    return;
  }

  const sorted = [...contributors].sort((a, b) => (a.SortOrder || 0) - (b.SortOrder || 0));

  sorted.forEach(c => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50 transition border-b border-gray-100';
    tr.innerHTML = `
      <td class="py-3 px-4 text-gray-500">${c.SortOrder !== undefined ? c.SortOrder : '-'}</td>
      <td class="py-3 px-4 font-semibold text-pool-dark">${escapeHtml(c.Name)}</td>
      <td class="py-3 px-4 text-gray-600">${escapeHtml(c.EmailAddress || '-')}</td>
      <td class="py-3 px-4 text-gray-600">${escapeHtml(c.PhoneNumber || '-')}</td>
      <td class="py-3 px-4 text-gray-600">${escapeHtml(c.PreferredPaymentMethod || '-')}</td>
      <td class="py-3 px-4 text-right space-x-1">
        <button onclick="editPersonMetadata('contributor', '${escapeHtml(c.Id)}')" class="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl text-xs font-semibold transition">Edit</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Render Admin Recipients List (Metadata & Edit only)
function renderAdminRecipients(recipients) {
  const tbody = document.getElementById('admin-recipients-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!recipients || recipients.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-4 px-4 text-center text-sm text-gray-500">No recipients found.</td></tr>`;
    return;
  }

  const sorted = [...recipients].sort((a, b) => (a.SortOrder || 0) - (b.SortOrder || 0));

  sorted.forEach(r => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50 transition border-b border-gray-100';
    tr.innerHTML = `
      <td class="py-3 px-4 text-gray-500">${r.SortOrder !== undefined ? r.SortOrder : '-'}</td>
      <td class="py-3 px-4 font-semibold text-pool-dark">${escapeHtml(r.Name)}</td>
      <td class="py-3 px-4 text-gray-600">${escapeHtml(r.EmailAddress || '-')}</td>
      <td class="py-3 px-4 text-gray-600">${escapeHtml(r.PhoneNumber || '-')}</td>
      <td class="py-3 px-4 text-gray-600">${escapeHtml(r.PreferredPaymentMethod || '-')}</td>
      <td class="py-3 px-4 text-right space-x-1">
        <button onclick="editPersonMetadata('recipient', '${escapeHtml(r.Id)}')" class="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl text-xs font-semibold transition">Edit</button>
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