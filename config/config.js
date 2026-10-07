// Configuration of the API, read once from the environment variables.
// In local they come from the .env file (loaded by server.js),
// in production from the settings of the hosting. See .env.example.
const env = process.env;

const config = {
  port: Number(env.PORT) || 7000,
  // <db_password> in the connection string is replaced by DATABASE_PASSWORD
  databaseUri: (env.DATABASE || "").replace("<db_password>", env.DATABASE_PASSWORD),
  jwtSecret: env.JWT_SECRET_KEY,
  jwtExpiresIn: "1d",
  // default admin, created at the first start
  admin: { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD },
  // Gmail account that sends the emails (the emails are disabled when it is empty)
  email: { user: env.EMAIL_USER, password: env.EMAIL_PASS },
  // number of proxies in front of the API : 1 by default on Render (the platform sets RENDER)
  trustProxy: Number(env.TRUST_PROXY || (env.RENDER ? 1 : 0)),
  // origins of the web pages allowed to call the API (* = every origin)
  corsOrigins: (env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  // time zone of the users : it gives the current day (sprints, events)
  timezone: env.TIMEZONE || "UTC",
};

const isValidTimezone = (timezone) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch (err) {
    return false;
  }
};

// Problems of the environment variables : the server does not start with one of them
const validateConfig = (variables = env) => {
  const errors = [];

  ["DATABASE", "JWT_SECRET_KEY"].forEach((name) => {
    if (!variables[name]) {
      errors.push(`${name} is required`);
    }
  });

  if (variables.DATABASE && variables.DATABASE.includes("<db_password>") && !variables.DATABASE_PASSWORD) {
    errors.push("DATABASE_PASSWORD is required (DATABASE contains <db_password>)");
  }

  ["PORT", "TRUST_PROXY"].forEach((name) => {
    if (variables[name] && !Number.isInteger(Number(variables[name]))) {
      errors.push(`${name} must be an integer`);
    }
  });

  if (variables.TIMEZONE && !isValidTimezone(variables.TIMEZONE)) {
    errors.push("TIMEZONE must be a time zone name (ex: Africa/Tunis)");
  }

  return errors;
};

module.exports = { config, validateConfig };
