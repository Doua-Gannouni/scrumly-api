const nodemailer = require("nodemailer");
const { config } = require("../config/config");

// Gmail account of the platform (do not block for minutes if the mail server cannot be reached)
const createTransporter = () =>
  nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: config.email.user,
      pass: config.email.password,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });

// Send an email : returns true if it is sent, false otherwise
// the emails are disabled when the email account is not configured (ex: hosting that blocks SMTP)
const sendEmail = async ({ toEmail, subject, text }) => {
  if (!config.email.user || !config.email.password) {
    console.log("Email not sent: EMAIL_USER and EMAIL_PASS are not configured");
    return false;
  }

  try {
    await createTransporter().sendMail({ from: config.email.user, to: toEmail, subject, text });
    console.log("Email sent successfully");
    return true;
  } catch (error) {
    console.error("Error while sending the email:", error);
    return false;
  }
};

// Send the email without making the request wait for the mail server (up to 10 s when it does not answer)
// onResult receives true if the email is sent, false otherwise
const sendEmailInBackground = (options, onResult = () => {}) => {
  sendEmail(options)
    .then(onResult)
    .catch((error) => console.error("Error after sending the email:", error));
};

module.exports = { sendEmailInBackground };
