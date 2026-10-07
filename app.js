const express = require("express");
const mongoose = require("mongoose");
const helmet = require("helmet");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const authRouter = require("./routes/authRoutes");
const userRouter = require("./routes/userRoutes");
const projectRouter = require("./routes/projectRoutes");
const errorMiddleware = require("./middlewares/errorMiddleware");
const sanitizeMiddleware = require("./middlewares/sanitizeMiddleware");
const swaggerSpec = require("./docs/swagger");
const { config } = require("./config/config");

// Express application (the database connection and the server start are in server.js)
const app = express();

// behind a proxy (ex: Render), trust it to get the real IP address of the clients (rate limiting)
// on Render (the platform sets RENDER) there is one proxy : without this setting every client would have the
// IP address of the proxy, and 10 wrong passwords typed by anyone would block the login of everybody
if (config.trustProxy) {
  app.set("trust proxy", config.trustProxy);
}

// security headers (ex: X-Content-Type-Options, Content-Security-Policy, Strict-Transport-Security)
app.use(helmet());

// the web pages of other domains (ex: a front-end) can call the API only if their origin is in CORS_ORIGINS
// (list separated by commas, or * for every origin)
if (config.corsOrigins.length) {
  app.use(cors({ origin: config.corsOrigins.includes("*") ? "*" : config.corsOrigins }));
}

app.use(express.json());
app.use(sanitizeMiddleware.rejectMongoOperators);

// state of the API for the hosting (ex: health check of Render) : 503 when the database is not connected
app.get("/health", (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? "ok" : "error",
    database: databaseConnected ? "connected" : "disconnected",
  });
});

// documentation of the API (Swagger UI) and its OpenAPI specification
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: "Scrumly API" }));
app.get("/api-docs.json", (req, res) => res.json(swaggerSpec));

// the content of a project (team, backlog, sprints, files ...) is under /projects/:projectId
app.use("/auth", authRouter);
app.use("/users", userRouter);
app.use("/projects", projectRouter);

app.all("*", errorMiddleware.handleNotFound);
app.use(errorMiddleware.handleErrors);

module.exports = app;
