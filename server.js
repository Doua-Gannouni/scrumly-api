const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const mongoose = require("mongoose");
const { config, validateConfig } = require("./config/config");

// The server does not start with a missing or invalid environment variable
const envErrors = validateConfig();
if (envErrors.length) {
  console.error(`Invalid environment variables (see .env.example):\n- ${envErrors.join("\n- ")}`);
  process.exit(1);
}

const app = require("./app");
const User = require("./models/userModel");

// Connect to the database, prepare it, then start the Express server
const start = async () => {
  await mongoose.connect(config.databaseUri);
  console.log("DB Connection secured!!!");

  // The transactions need a replica set (ex: MongoDB Atlas)
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== "isdbgrid") {
    console.log(
      "Warning: MongoDB is not a replica set, the transactions will fail (use MongoDB Atlas or a replica set)",
    );
  }

  // Create the indexes of the schemas : the unique ones guarantee rules (ex: one sprint in progress per project),
  // so the server does not start without them
  await Promise.all(Object.values(mongoose.models).map((model) => model.createIndexes()));

  // Create a default admin if needed
  await User.createDefaultAdmin();

  const server = app.listen(config.port, () => {
    console.log(`Server running on port: ${config.port}...`);
  });

  // stop cleanly (ex: SIGTERM sent by Render at each deploy) : the requests in progress end,
  // then the database connection is closed
  const shutdown = (signal) => {
    console.log(`${signal} received: closing the server...`);
    server.close(async () => {
      await mongoose.disconnect();
      console.log("Server closed");
      process.exit(0);
    });
    // do not wait more than 10 s for the open connections
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
};

start().catch((err) => {
  console.error("Error while starting the server:", err);
  process.exit(1);
});
