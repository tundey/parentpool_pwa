import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, db, doc, getDoc, getFunctions, httpsCallable } from './firebase-config.js';

// EMAIL stuff
window.sendReminder = async function(name, emailAddress, nextMonth, previousContributionMonth, previousContributionDate) {
	//debugger;
	const subject = `ParentPool: Contribution Reminder`;
	const message = `Hello ${name}, <p>Please send your contribution for ${nextMonth}. Your last contribution was received for ${previousContributionMonth} on ${formatFriendlyDate(previousContributionDate)}</p> <p>Thank you for supporting the parents! <br>ParentPool</p>`;
  
	const success = await sendEmailNotification(name, emailAddress, subject, message);
	
    if (success) {
      alert(`Reminder sent successfully to ${name} (${emailAddress})!`);
    } else {
      alert(`Failed to send reminder to ${name}. Please check logs.`);
    }
}

window.sendContributionConfirmation = async function(name, emailAddress, amount, month, dateReceived) {
	//debugger;
	
	const subject = 'ParentPool: Contribution Received';
	const message = `Hello ${name}, <p>Your contribution of ${formatMoney(amount)} for ${month} has been received on ${formatFriendlyDate(dateReceived)}.</p><p>Thank you for supporting the parents! <br>ParentPool</p>`
	
	const success = await sendEmailNotification(name, emailAddress, subject, message);
	
    if (success) {
      alert(`Confirmation sent successfully to ${name} (${emailAddress})!`);
    } else {
      alert(`Failed to send confirmation to ${name}. Please check logs.`);
    }	
}

window.sendPaymentNotification = async function(name, emailAddress, recipientName, month, amount, dateSent) {	
	//debugger;
	
	const subject = 'ParentPool: Allowance Sent';
	const message = `Hello ${name}, <p>${month}'s allowance of ${formatMoney(amount)} has been sent to ${recipientName} on ${formatFriendlyDate(dateSent)} </p><p>Thank you for supporting the parents! <br>ParentPool</p>`
	
	//console.log(`Sending payment notification to ${name}: ${message}`);
	
	const success = await sendEmailNotification(name, emailAddress, subject, message);
	
    if (success) {
      alert(`Payment notification sent successfully to ${name} (${emailAddress})!`);
    } else {
      alert(`Failed to send payment notification to ${name}. Please check logs.`);
    }	
}

/**
 * Calls the backend Firebase Cloud Function to send an email notification.
 * 
 * @param {string} name - Recipient's full name
 * @param {string} emailAddress - Recipient's email address
 * @param {string} subject - Email subject line
 * @param {string} message - Plain text or HTML body message
 * @returns {Promise<boolean>} - Resolves true if email sent successfully
 */
export async function sendEmailNotification(name, emailAddress, subject, message) {
  if (!emailAddress) {
    console.warn("sendEmailNotification: Missing target email address.");
    return false;
  }
  
  console.log(`Subject: ${subject}`)
  console.log(`Message: ${message}`)
  
  return true;

  try {
    const functions = getFunctions();
    const sendEmailFn = httpsCallable(functions, 'sendEmail');

    const response = await sendEmailFn({
      name,
      emailAddress,
      subject,
      message
    });

    console.log("Email sent successfully:", response.data);
    return true;
  } catch (error) {
    console.error("Error invoking sendEmail function:", error);
    return false;
  }
}