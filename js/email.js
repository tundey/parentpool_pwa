// EMAIL stuff
window.sendReminder = async function(name, emailAddress) {
	alert('test');
	debugger;
	const subject = `Parent Pool Contribution Reminder`;
	const message = `Hello ${name},\n\nThis is a friendly reminder regarding your pending contribution for the current period.\n\nPlease log in to review your contributor dashboard or reach out if you have any questions.\n\nThank you for supporting the pool!`;
  
	const success = await sendEmailNotification(name, emailAddress, subject, message);
	
    if (success) {
      alert(`Reminder sent successfully to ${name} (${emailAddress})!`);
    } else {
      alert(`Failed to send reminder to ${name}. Please check logs.`);
    }

	console.log(name);
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