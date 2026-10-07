// Emails are saved in lowercase (see userModel) : Ali@x.com and ali@x.com are the same address
const normalizeEmail = (email) => email.trim().toLowerCase();

module.exports = normalizeEmail;
