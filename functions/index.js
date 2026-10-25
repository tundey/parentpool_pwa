/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const logger = require("firebase-functions/logger");

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 5 });

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

 exports.helloWorld = onRequest((request, response) => {
   logger.info("Hello logs!", {structuredData: true});
   response.send("Hello from Firebase!");
 });

const { onCall } = require("firebase-functions/v2/https");
const { Resend } = require("resend");

exports.sendEmail = onCall({ secrets: ["RESEND_API_KEY"] }, async (request) => {
  if (!request.auth) {
    throw new Error("Unauthorized: Must be logged in to send emails.");
  }
  
  debugger;

  // Initialize Resend inside the handler where the secret is available
  const resend = new Resend(process.env.RESEND_API_KEY);

  const { name, emailAddress, subject, message } = request.data;

  if (!emailAddress || !subject || !message) {
    throw new Error("Missing required email fields.");
  }

  try {
    const data = await resend.emails.send({
      from: "ParentPool <onboarding@resend.dev>", // Or your verified domain
      to: name ? `${name} <${emailAddress}>` : emailAddress,
	  bcc: 'tundey@gmail.com',
      subject: subject,
      html: message,
    });

    logger.info("Email sent successfully:", data);
    return { success: true, data };
  } catch (error) {
    logger.error("Resend API error:", error);
    throw new Error("Failed to send email notification.");
  }
});