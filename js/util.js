window.formatMoney = function(amount) {
	return amount !== undefined ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount) : '-';
}

/**
 * Helper utility to safely parse various date formats (Strings, JS Dates, Firebase Timestamps)
 */
window.parseDate = function(dateInput) {
  if (!dateInput) return new Date(0);
  
  // Handle Firestore Timestamps
  if (typeof dateInput.toDate === 'function') {
    return dateInput.toDate();
  }
  
  // Handle standard JS Date objects
  if (dateInput instanceof Date) {
    return dateInput;
  }
  
  // Handle string formats (e.g. "6-8-2026" or ISO strings)
  return new Date(dateInput);
}


/**
 * Parses a date input and formats it into a readable string with ordinal suffixes (e.g., "June 8th, 2026").
 * 
 * @param {string|Date|Object} dateInput - The date to format.
 * @returns {string} Formatted date string or "N/A".
 */
window.formatFriendlyDate = function(dateInput) {
if (!dateInput) return "N/A";

  let year, month, day;

  // 1. Handle Firestore Timestamps
  if (typeof dateInput.toDate === 'function') {
    const d = dateInput.toDate();
    year = d.getFullYear();
    month = d.getMonth();
    day = d.getDate();
  } 
  // 2. Handle standard JS Date objects (using local time values to avoid UTC offsets)
  else if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return "N/A";
    year = dateInput.getFullYear();
    month = dateInput.getMonth();
    day = dateInput.getDate();
  } 
  // 3. Handle string inputs (e.g., "6-8-2026", "2026-06-08", "06/08/2026")
  else if (typeof dateInput === 'string') {
    // Clean string and split by non-digit characters
    const parts = dateInput.trim().split(/[^0-9]+/);
    
    if (parts.length >= 3) {
      // Check if format is YYYY-MM-DD or MM-DD-YYYY
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1; // 0-indexed months
        day = parseInt(parts[2], 10);
      } else {
        // MM-DD-YYYY or M-D-YYYY
        month = parseInt(parts[0], 10) - 1;
        day = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
      }
    } else {
      // Fallback to standard parse if custom split fails
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return "N/A";
      year = d.getFullYear();
      month = d.getMonth();
      day = d.getDate();
    }
  } else {
    return "N/A";
  }

  if (isNaN(year) || isNaN(month) || isNaN(day)) return "N/A";

  // 4. Month names array
  const months = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];
  
  const monthName = months[month];

  // 5. Determine the correct ordinal suffix (st, nd, rd, th)
  const getOrdinalSuffix = (n) => {
    if (n > 3 && n < 21) return "th";
    switch (n % 10) {
      case 1: return "st";
      case 2: return "nd";
      case 3: return "rd";
      default: return "th";
    }
  };

  return `${monthName} ${day}${getOrdinalSuffix(day)}, ${year}`;
}

window.getLocalDateString = function() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}