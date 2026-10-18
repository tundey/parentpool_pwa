document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('import-file-input');
  const startImportBtn = document.getElementById('btn-start-import');
  const errorMsg = document.getElementById('import-error-msg');

  if (startImportBtn) {
    startImportBtn.addEventListener('click', () => {
      // Clear previous error states
      errorMsg.classList.add('hidden');
      errorMsg.textContent = '';

      // Check if a file was selected
      if (!fileInput.files || fileInput.files.length === 0) {
        errorMsg.textContent = 'Please choose a .json backup file before starting the import.';
        errorMsg.classList.remove('hidden');
        return;
      }

      const selectedFile = fileInput.files[0];

      // Validate file extension
      if (!selectedFile.name.toLowerCase().endsWith('.json')) {
        errorMsg.textContent = 'Invalid file type. Please select a valid .json file.';
        errorMsg.classList.remove('hidden');
        return;
      }

      // Validation passed! (We will hook up the actual JSON parsing reader here later)
      console.log('File validated successfully:', selectedFile.name);
    });
  }
});


import { db, doc, setDoc } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('import-file-input');
  const startImportBtn = document.getElementById('btn-start-import');
  const errorMsg = document.getElementById('import-error-msg');

  if (startImportBtn) {
    startImportBtn.addEventListener('click', async () => {
      // Clear previous error states
      errorMsg.classList.add('hidden');
      errorMsg.textContent = '';

      // 1. Validation check
      if (!fileInput.files || fileInput.files.length === 0) {
        errorMsg.textContent = 'Please choose a .json backup file before starting the import.';
        errorMsg.classList.remove('hidden');
        return;
      }

      const selectedFile = fileInput.files[0];

      if (!selectedFile.name.toLowerCase().endsWith('.json')) {
        errorMsg.textContent = 'Invalid file type. Please select a valid .json file.';
        errorMsg.classList.remove('hidden');
        return;
      }

      // 2. Read and Parse File using FileReader
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const fileContent = e.target.result;
          const parsedData = JSON.parse(fileContent);

          // Basic schema verification
          if (!parsedData.Contributors || !parsedData.Recipients) {
            throw new Error('Invalid pool JSON structure. Missing Contributors or Recipients arrays.');
          }

          // 3. Store data in Firebase Firestore under the single master document "main-pool"
          const poolDocRef = doc(db, 'pools', 'main-pool');
          
          await setDoc(poolDocRef, {
            ...parsedData,
            ImportedAt: new Date().toISOString()
          });

          alert('Pool data successfully imported to "main-pool"!');
          fileInput.value = ''; // Reset file input

        } catch (parseError) {
          console.error('Import processing error:', parseError);
          errorMsg.textContent = `Failed to import file: ${parseError.message}`;
          errorMsg.classList.remove('hidden');
        }
      };

      reader.onerror = () => {
        errorMsg.textContent = 'Error reading the selected file. Please try again.';
        errorMsg.classList.remove('hidden');
      };

      reader.readAsText(selectedFile);
    });
  }
});

import { getDoc } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
  const exportBtn = document.getElementById('btn-export-data');

  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      try {
        // 1. Fetch the master pool document from Firestore
        // (Adjust the document ID if your setup uses a dynamic ID)
        const poolDocRef = doc(db, 'pools', 'main-pool');
        const poolSnap = await getDoc(poolDocRef);

        if (!poolSnap.exists()) {
          alert('No pool data found in the database to export.');
          return;
        }

        const poolData = poolSnap.data();

        // 2. Generate formatted timestamp: yyyy-mm-dd-hh-mm-ss (using hyphens for filesystem safety)
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');

        const filename = `pooldata-${year}-${month}-${day}-${hours}-${minutes}-${seconds}.json`;

        // 3. Create a downloadable JSON blob
        // Clean up internal metadata fields like ImportedAt if you prefer a pristine export schema matching your raw model
        delete poolData.ImportedAt; 

        const jsonString = JSON.stringify(poolData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // 4. Programmatically trigger browser download
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = filename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        
        // Clean up object URL and element
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);

      } catch (error) {
        console.error('Data export failed:', error);
        alert('Failed to export data: ' + error.message);
      }
    });
  }
});