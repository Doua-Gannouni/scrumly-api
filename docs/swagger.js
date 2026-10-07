const Enums = require("../constants/enums");

// OpenAPI specification of the API (served by swagger-ui-express on /api-docs)

const ERROR_RESPONSES = {
  400: "BadRequest",
  401: "Unauthorized",
  403: "Forbidden",
  404: "NotFound",
  409: "Conflict",
  429: "TooManyRequests",
};

// Path parameter
const pathParam = (name, description) => ({
  name,
  in: "path",
  required: true,
  description,
  schema: { type: "string" },
});

const projectId = pathParam("projectId", "Project ID");
const id = pathParam("id", "Resource ID");

// Query parameters of the lists (filters are also possible, ex: ?status=Done or ?priority[gte]=2)
const listParams = [
  { name: "page", in: "query", schema: { type: "integer", default: 1 } },
  { name: "limit", in: "query", schema: { type: "integer", default: 6, minimum: 1, maximum: 100 } },
  {
    name: "sort",
    in: "query",
    schema: { type: "string" },
    description: "Fields separated by commas, ex: -createdAt,name",
  },
];

// Schema of an object (OpenAPI does not allow an empty list of required fields)
const objectSchema = (properties, required = []) => ({
  type: "object",
  properties,
  ...(required.length ? { required } : {}),
});

// JSON request body
const jsonBody = (properties, required = []) => ({
  required: true,
  content: { "application/json": { schema: objectSchema(properties, required) } },
});

// Operation of a path
const operation = (
  tag,
  summary,
  {
    description,
    parameters = [],
    requestBody,
    status = 200,
    errors = [400, 401, 403, 404, 409],
    secured = true,
    responseContent,
  } = {},
) => ({
  tags: [tag],
  summary,
  description,
  parameters,
  requestBody,
  security: secured ? [{ bearerAuth: [] }] : [],
  responses: {
    [status]: responseContent
      ? { description: "Success", content: responseContent }
      : { $ref: "#/components/responses/Success" },
    ...Object.fromEntries(errors.map((code) => [code, { $ref: `#/components/responses/${ERROR_RESPONSES[code]}` }])),
  },
});

const PROJECT_READERS = "Scrum team of the project, client of the project or admin.";

// Fields of the project (multipart because of the images and files)
const projectBody = (required) => ({
  required: true,
  content: {
    "multipart/form-data": {
      schema: objectSchema(
        {
          name: { type: "string" },
          description: { type: "string" },
          startDate: { type: "string", format: "date" },
          endDate: { type: "string", format: "date" },
          budget: { type: "number" },
          priority: { type: "number" },
          status: { type: "string", enum: Enums.PROJECT_STATUS_ENUM },
          definitionOfDone: { type: "array", items: { type: "string" } },
          client: { type: "string", description: "ID of a user of type Client (read-only access)" },
          images: {
            type: "array",
            items: { type: "string", format: "binary" },
            description: "jpeg / png, 5 files max",
          },
          files: {
            type: "array",
            items: { type: "string", format: "binary" },
            description: "jpeg / png / pdf, 5 files max",
          },
        },
        required,
      ),
    },
  },
});

const userStoryProperties = {
  title: {
    type: "string",
    maxLength: 200,
    example: "As a customer I want to pay online",
    description: "As a... I want... (or En tant que... je veux...)",
  },
  description: { type: "string" },
  acceptanceCriteria: { type: "array", items: { type: "string" } },
  priority: {
    type: "integer",
    minimum: 1,
    description:
      "Position in the product backlog (1 = first), the other user stories move down. Last position by default.",
  },
  storyPoints: { type: "number", minimum: 0 },
};

const sprintProperties = {
  name: { type: "string", example: "Sprint 1" },
  description: { type: "string" },
  goal: { type: "string", description: "Sprint Goal (required to start the sprint)" },
  startDate: { type: "string", format: "date" },
  endDate: { type: "string", format: "date", description: "One month or less after the start date" },
};

const taskProperties = {
  name: { type: "string" },
  description: { type: "string" },
  estimatedHours: { type: "number" },
  status: { type: "string", enum: Enums.TASK_STATUS_ENUM },
  userStory: { type: "string", description: "User story ID" },
  assignedTo: { type: "string", description: "ID of a Developer of the team (or null)" },
};

const eventProperties = {
  type: { type: "string", enum: Enums.SCRUM_EVENT_TYPE_ENUM },
  title: { type: "string" },
  date: { type: "string", format: "date-time" },
  durationMinutes: {
    type: "integer",
    description: "Max: Sprint Planning 480, Daily Scrum 15, Sprint Review 240, Sprint Retrospective 180",
  },
  notes: { type: "string" },
  improvements: { type: "array", items: { type: "string" }, description: "Sprint Retrospective only" },
  sprint: { type: "string", description: "Sprint ID" },
};

// Response of GET /health (not the format of the other routes)
const healthResponse = (description, status, database) => ({
  description,
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          status: { type: "string", example: status },
          database: { type: "string", example: database },
        },
      },
    },
  },
});

const swaggerSpec = {
  openapi: "3.0.3",
  info: {
    title: "Scrumly API",
    version: "1.0.0",
    description:
      "Agile project management backend based on the Scrum Guide 2020.\n\n" +
      "1. Log in with `POST /auth/login` and copy the token.\n" +
      "2. Click **Authorize** and paste the token.\n\n" +
      "The Scrum roles (Product Owner, Scrum Master, Developer) are defined per project in the team. " +
      "The admin manages the platform (users, projects, teams) and has a read-only access to the projects.",
    contact: { name: "Doua Gannouni", url: "https://portfolio.doua-automation.xyz/" },
    license: { name: "MIT", url: "https://github.com/Doua-Gannouni/scrumly-api/blob/main/LICENSE" },
  },
  tags: [
    { name: "Server", description: "State of the API" },
    { name: "Auth", description: "Registration, login and password reset (rate limited)" },
    { name: "Users", description: "Users and registration requests" },
    { name: "Projects", description: "Projects (admin) and velocity" },
    { name: "Teams", description: "Scrum team of a project (managed by the admin)" },
    { name: "Members", description: "Members of the team of a project with their Scrum role (managed by the admin)" },
    { name: "Product Backlog", description: "Product backlog, Product Goal and exports" },
    { name: "User Stories", description: "User stories and their acceptance (Definition of Done)" },
    { name: "Sprints", description: "Sprints, Sprint Planning, burndown" },
    { name: "Tasks", description: "Tasks of the Sprint Backlog (Developers)" },
    { name: "Scrum Events", description: "Sprint Planning, Daily Scrum, Sprint Review, Sprint Retrospective" },
    { name: "Increments", description: "Increments (born when a user story meets the Definition of Done)" },
    { name: "Notifications", description: "Email notifications to the team" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      Success: {
        type: "object",
        properties: {
          status: { type: "string", example: "success" },
          message: { type: "string" },
          results: { type: "integer", description: "Lists only: number of items in this page" },
          pagination: { $ref: "#/components/schemas/Pagination" },
          data: {
            type: "object",
            description: "The resource under its name (ex: { sprint }) or the list (ex: { sprints })",
          },
        },
      },
      Pagination: {
        type: "object",
        description: "Lists only",
        properties: {
          page: { type: "integer", example: 1 },
          limit: { type: "integer", example: 6 },
          total: { type: "integer", description: "Number of items matching the filters", example: 14 },
          pages: { type: "integer", example: 3 },
        },
      },
      Error: {
        type: "object",
        properties: {
          status: { type: "string", example: "fail" },
          message: { type: "string" },
        },
      },
    },
    responses: {
      Success: {
        description: "Success",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Success" } } },
      },
      BadRequest: {
        description: "Invalid data (missing field, wrong value)",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      Unauthorized: {
        description: "Not logged in, invalid token or wrong credentials",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      Forbidden: {
        description: "The user does not have the required role",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      NotFound: {
        description: "Resource not found (also for a project in which the user has no role)",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      Conflict: {
        description:
          "The current state of the data prevents the action (Scrum rule, duplicate value, done project ...)",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      TooManyRequests: {
        description: "Too many requests (rate limit)",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
    },
  },
  paths: {
    // ---------- Server ----------
    "/health": {
      get: {
        tags: ["Server"],
        summary: "State of the API and of the database",
        description: "For the health checks of the hosting.",
        security: [],
        responses: {
          200: healthResponse("The database is connected", "ok", "connected"),
          503: healthResponse("The database is not connected", "error", "disconnected"),
        },
      },
    },

    // ---------- Auth ----------
    "/auth/register": {
      post: operation("Auth", "Register (waiting for the admin approval)", {
        secured: false,
        status: 201,
        errors: [400, 403, 409, 429],
        requestBody: jsonBody(
          {
            name: { type: "string" },
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
            type: { type: "string", enum: Enums.USER_TYPE_ENUM.filter((type) => type !== "Admin") },
          },
          ["name", "email", "password", "type"],
        ),
      }),
    },
    "/auth/login": {
      post: operation("Auth", "Log in and get a JWT token", {
        secured: false,
        errors: [400, 401, 403, 429],
        description: "10 failed attempts every 15 minutes per IP address.",
        requestBody: jsonBody(
          {
            email: { type: "string", format: "email", example: "admin@example.com" },
            password: { type: "string" },
          },
          ["email", "password"],
        ),
      }),
    },
    "/auth/forgot-password": {
      post: operation("Auth", "Send a password reset code by email", {
        secured: false,
        errors: [400, 429],
        requestBody: jsonBody({ email: { type: "string", format: "email" } }, ["email"]),
      }),
    },
    "/auth/reset-password/{token}": {
      post: operation("Auth", "Reset the password with the code received by email", {
        secured: false,
        errors: [400, 429],
        parameters: [pathParam("token", "Reset code received by email")],
        requestBody: jsonBody({ password: { type: "string", minLength: 8 } }, ["password"]),
      }),
    },

    // ---------- Users ----------
    "/users": {
      get: operation("Users", "List the users", { description: "Admin.", parameters: listParams }),
    },
    "/users/me": {
      get: operation("Users", "Profile of the logged-in user with their Scrum roles in the projects"),
    },
    "/users/me/password": {
      patch: operation("Users", "Change the password of the logged-in user", {
        description: "Returns a new token: the tokens created before (other devices) are no longer valid.",
        errors: [400, 401],
        requestBody: jsonBody(
          {
            currentPassword: { type: "string" },
            newPassword: { type: "string", minLength: 8 },
          },
          ["currentPassword", "newPassword"],
        ),
      }),
    },
    "/users/{id}": {
      delete: operation("Users", "Delete an account", {
        description:
          "Admin. The user leaves the Scrum teams, its tasks are no longer assigned and it is no longer the client of its projects.",
        parameters: [id],
      }),
    },
    "/users/{id}/deactivate": {
      patch: operation("Users", "Deactivate an account", {
        description: "Admin. The user is logged out at once.",
        parameters: [id],
      }),
    },
    "/users/{id}/activate": {
      patch: operation("Users", "Activate again a deactivated account", {
        description: "Admin. A registration request is handled with PATCH /users/{id}/registration.",
        parameters: [id],
      }),
    },
    "/users/registration-requests": {
      get: operation("Users", "List the registration requests", {
        description: "Admin. Ex: ?seen=false",
        parameters: listParams,
      }),
    },
    "/users/{id}/registration": {
      patch: operation("Users", "Accept or refuse the registration request of a user", {
        description:
          "Admin. accepted must be a boolean: true accepts, false refuses and deletes the account. Only for a pending request.",
        parameters: [id],
        requestBody: jsonBody({ accepted: { type: "boolean" } }, ["accepted"]),
      }),
    },

    // ---------- Projects ----------
    "/projects": {
      get: operation("Projects", "List the projects", {
        description:
          "The admin sees all the projects, the others see the projects of their teams and the projects where they are the client.",
        parameters: listParams,
      }),
      post: operation("Projects", "Create a project (and its product backlog)", {
        description: "Admin.",
        status: 201,
        requestBody: projectBody(["name", "startDate", "endDate"]),
      }),
    },
    "/projects/{projectId}": {
      get: operation("Projects", "Get a project with its team, sprints and increments", {
        description: PROJECT_READERS,
        parameters: [projectId],
      }),
      patch: operation("Projects", "Update a project", {
        description: "Admin. The sprints must stay inside the project dates.",
        parameters: [projectId],
        requestBody: projectBody([]),
      }),
      delete: operation("Projects", "Delete a project with all its data", {
        description: "Admin.",
        parameters: [projectId],
      }),
    },
    "/projects/{projectId}/velocity": {
      get: operation("Projects", "Velocity of the team (story points done per sprint)", {
        description: PROJECT_READERS,
        parameters: [projectId],
      }),
    },
    "/projects/{projectId}/files/{fileName}": {
      delete: operation("Projects", "Remove an image or a file from the project", {
        description: "Admin. The file is deleted.",
        parameters: [projectId, pathParam("fileName", "File name")],
      }),
      get: operation("Projects", "Download an image or a file of the project", {
        description: `${PROJECT_READERS} The file name is the last part of a path of the images / files of the project (uploads/<fileName>).`,
        parameters: [projectId, pathParam("fileName", "File name")],
        responseContent: {
          "image/png": { schema: { type: "string", format: "binary" } },
          "image/jpeg": { schema: { type: "string", format: "binary" } },
          "application/pdf": { schema: { type: "string", format: "binary" } },
        },
      }),
    },

    // ---------- Team ----------
    "/projects/{projectId}/team": {
      get: operation("Teams", "Get the team of the project with its members", {
        description: PROJECT_READERS,
        parameters: [projectId],
      }),
      post: operation("Teams", "Create the Scrum team of the project (one team per project)", {
        description: "Admin.",
        status: 201,
        parameters: [projectId],
        requestBody: jsonBody({ name: { type: "string" }, description: { type: "string" } }, ["name"]),
      }),
      patch: operation("Teams", "Update the team of the project", {
        description: "Admin.",
        parameters: [projectId],
        requestBody: jsonBody({ name: { type: "string" }, description: { type: "string" } }),
      }),
      delete: operation("Teams", "Delete the team of the project with its members", {
        description: "Admin.",
        parameters: [projectId],
      }),
    },

    // ---------- Members ----------
    "/projects/{projectId}/team/members": {
      get: operation("Members", "List the members of the team with their Scrum role", {
        description: PROJECT_READERS,
        parameters: [projectId],
      }),
      post: operation("Members", "Add a user to the team with a Scrum role", {
        description:
          "Admin. A team member account only. One Product Owner and one Scrum Master per team, 10 people or fewer (Scrum Guide 2020).",
        status: 201,
        parameters: [projectId],
        requestBody: jsonBody(
          {
            user: { type: "string", description: "User ID" },
            role: { type: "string", enum: Enums.ROLE_ENUM },
            description: { type: "string" },
          },
          ["user", "role"],
        ),
      }),
    },
    "/projects/{projectId}/team/members/{id}": {
      patch: operation("Members", "Change the role or the description of a member", {
        description: "Admin.",
        parameters: [projectId, id],
        requestBody: jsonBody({ role: { type: "string", enum: Enums.ROLE_ENUM }, description: { type: "string" } }),
      }),
      delete: operation("Members", "Remove a member from the team (and from their tasks)", {
        description: "Admin.",
        parameters: [projectId, id],
      }),
    },

    // ---------- Product Backlog ----------
    "/projects/{projectId}/backlog": {
      get: operation(
        "Product Backlog",
        "Product backlog: user stories not done and not in a sprint, ordered by priority",
        { description: PROJECT_READERS, parameters: [projectId] },
      ),
      patch: operation("Product Backlog", "Update the product backlog and the Product Goal", {
        description: "Product Owner. One Product Goal at a time: fulfill or abandon it before taking on the next one.",
        parameters: [projectId],
        requestBody: jsonBody({
          name: { type: "string" },
          description: { type: "string" },
          productGoal: { type: "string" },
        }),
      }),
    },
    "/projects/{projectId}/backlog/product-goal/fulfill": {
      post: operation("Product Backlog", "Mark the Product Goal as fulfilled", {
        description: "Product Owner.",
        parameters: [projectId],
      }),
    },
    "/projects/{projectId}/backlog/product-goal/abandon": {
      post: operation("Product Backlog", "Abandon the Product Goal", {
        description: "Product Owner.",
        parameters: [projectId],
      }),
    },
    "/projects/{projectId}/backlog/pdf": {
      get: operation("Product Backlog", "Export the product backlog as PDF", {
        description: PROJECT_READERS,
        parameters: [projectId],
        responseContent: { "application/pdf": { schema: { type: "string", format: "binary" } } },
      }),
    },
    "/projects/{projectId}/backlog/excel": {
      get: operation("Product Backlog", "Export the product backlog as Excel", {
        description: PROJECT_READERS,
        parameters: [projectId],
        responseContent: {
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
            schema: { type: "string", format: "binary" },
          },
        },
      }),
    },

    // ---------- User Stories ----------
    "/projects/{projectId}/user-stories": {
      get: operation("User Stories", "List the user stories (ex: ?sprint=<id>&status=Done)", {
        description: PROJECT_READERS,
        parameters: [projectId, ...listParams],
      }),
      post: operation("User Stories", "Create a user story", {
        description: "Product Owner. The status is managed by the tasks and the acceptance.",
        status: 201,
        parameters: [projectId],
        requestBody: jsonBody(userStoryProperties, ["title", "storyPoints"]),
      }),
    },
    "/projects/{projectId}/user-stories/{id}": {
      get: operation("User Stories", "Get a user story with its tasks", {
        description: PROJECT_READERS,
        parameters: [projectId, id],
      }),
      patch: operation("User Stories", "Update a user story (not done)", {
        description: "Product Owner.",
        parameters: [projectId, id],
        requestBody: jsonBody(userStoryProperties),
      }),
      delete: operation("User Stories", "Delete a user story (not in a sprint or an increment)", {
        description: "Product Owner.",
        parameters: [projectId, id],
      }),
    },
    "/projects/{projectId}/user-stories/{id}/accept": {
      post: operation("User Stories", "Accept a user story: Done and added to the increment", {
        description: "Product Owner. The user story must be in review (all its tasks done) in the sprint in progress.",
        parameters: [projectId, id],
        requestBody: jsonBody(
          {
            acceptanceCriteriaMet: { type: "boolean", example: true },
            definitionOfDoneMet: { type: "boolean", example: true },
          },
          ["acceptanceCriteriaMet", "definitionOfDoneMet"],
        ),
      }),
    },
    "/projects/{projectId}/user-stories/{id}/reject": {
      post: operation("User Stories", "Reject a user story in review (back in progress)", {
        description: "Product Owner.",
        parameters: [projectId, id],
      }),
    },

    // ---------- Sprints ----------
    "/projects/{projectId}/sprints": {
      get: operation("Sprints", "List the sprints", {
        description: PROJECT_READERS,
        parameters: [projectId, ...listParams],
      }),
      post: operation("Sprints", "Create a sprint", {
        description:
          "Scrum Master. One month or less, inside the project dates, starts the day after the previous sprint.",
        status: 201,
        parameters: [projectId],
        requestBody: jsonBody(sprintProperties, ["name", "startDate", "endDate"]),
      }),
    },
    "/projects/{projectId}/sprints/{id}": {
      get: operation("Sprints", "Get a sprint with its Sprint Backlog, events and increments", {
        description: PROJECT_READERS,
        parameters: [projectId, id],
      }),
      patch: operation("Sprints", "Update a sprint", {
        description: "Scrum Master. The Sprint Goal and the dates cannot change during the sprint.",
        parameters: [projectId, id],
        requestBody: jsonBody(sprintProperties),
      }),
      delete: operation("Sprints", "Delete the last planned sprint", {
        description: "Scrum Master.",
        parameters: [projectId, id],
      }),
    },
    "/projects/{projectId}/sprints/{id}/start": {
      post: operation("Sprints", "Start the sprint", {
        description:
          "Scrum Master. Needs a Sprint Goal, user stories, a complete Scrum team, no other sprint in progress, and today inside the sprint dates.",
        parameters: [projectId, id],
      }),
    },
    "/projects/{projectId}/sprints/{id}/complete": {
      post: operation("Sprints", "Complete the sprint (from its end date)", {
        description: "Scrum Master. The user stories not done go back to the product backlog.",
        parameters: [projectId, id],
      }),
    },
    "/projects/{projectId}/sprints/{id}/cancel": {
      post: operation("Sprints", "Cancel the sprint", {
        description: "Product Owner only (Scrum Guide). The following planned sprints move to stay consecutive.",
        parameters: [projectId, id],
      }),
    },
    "/projects/{projectId}/sprints/{id}/user-stories": {
      post: operation("Sprints", "Sprint Planning: select user stories of the product backlog", {
        description: "Developers or Product Owner.",
        parameters: [projectId, id],
        requestBody: jsonBody({ userStories: { type: "array", items: { type: "string" } } }, ["userStories"]),
      }),
    },
    "/projects/{projectId}/sprints/{id}/user-stories/{userStoryId}": {
      delete: operation("Sprints", "Remove a user story from the sprint", {
        description: "Developers or Product Owner.",
        parameters: [projectId, id, pathParam("userStoryId", "User story ID")],
      }),
    },
    "/projects/{projectId}/sprints/{id}/improvements": {
      post: operation("Sprints", "Add an improvement to the Sprint Backlog", {
        description: "Developers. The improvements of the previous Sprint Retrospective are added automatically.",
        status: 201,
        parameters: [projectId, id],
        requestBody: jsonBody({ description: { type: "string" } }, ["description"]),
      }),
    },
    "/projects/{projectId}/sprints/{id}/improvements/{improvementId}": {
      patch: operation("Sprints", "Update an improvement (ex: done)", {
        description: "Developers.",
        parameters: [projectId, id, pathParam("improvementId", "Improvement ID")],
        requestBody: jsonBody({ description: { type: "string" }, done: { type: "boolean" } }),
      }),
    },
    "/projects/{projectId}/sprints/{id}/burndown": {
      get: operation("Sprints", "Burndown chart of the sprint", {
        description: PROJECT_READERS,
        parameters: [projectId, id],
      }),
    },

    // ---------- Tasks ----------
    "/projects/{projectId}/tasks": {
      get: operation("Tasks", "List the tasks (ex: ?status=To do)", {
        description: "Scrum team or admin.",
        parameters: [projectId, ...listParams],
      }),
      post: operation("Tasks", "Create a task", {
        description:
          "Developers (the Sprint Backlog is a plan by and for the Developers). The user story must be selected in a sprint.",
        status: 201,
        parameters: [projectId],
        requestBody: jsonBody(taskProperties, ["name", "userStory"]),
      }),
    },
    "/projects/{projectId}/tasks/my-tasks": {
      get: operation("Tasks", "Tasks assigned to the logged-in developer", {
        description: "Developers.",
        parameters: [projectId, ...listParams],
      }),
    },
    "/projects/{projectId}/tasks/{id}": {
      get: operation("Tasks", "Get a task", { description: "Scrum team or admin.", parameters: [projectId, id] }),
      patch: operation("Tasks", "Update a task (the user story status follows)", {
        description: "Developers.",
        parameters: [projectId, id],
        requestBody: jsonBody(taskProperties),
      }),
      delete: operation("Tasks", "Delete a task", { description: "Developers.", parameters: [projectId, id] }),
    },

    // ---------- Scrum Events ----------
    "/projects/{projectId}/events": {
      get: operation("Scrum Events", "List the events (ex: ?sprint=<id>&type=DailyScrum)", {
        description: PROJECT_READERS,
        parameters: [projectId, ...listParams],
      }),
      post: operation("Scrum Events", "Create an event", {
        description:
          "Scrum Master. Sprint Planning on the first day, Daily Scrums, then Sprint Review, and the Sprint Retrospective concludes the sprint.",
        status: 201,
        parameters: [projectId],
        requestBody: jsonBody(eventProperties, ["type", "date", "durationMinutes", "sprint"]),
      }),
    },
    "/projects/{projectId}/events/{id}": {
      get: operation("Scrum Events", "Get an event", { description: PROJECT_READERS, parameters: [projectId, id] }),
      patch: operation("Scrum Events", "Update an event (ex: retrospective notes)", {
        description: "Scrum Master.",
        parameters: [projectId, id],
        requestBody: jsonBody(eventProperties),
      }),
      delete: operation("Scrum Events", "Delete an event", {
        description: "Scrum Master.",
        parameters: [projectId, id],
      }),
    },

    // ---------- Increments ----------
    "/projects/{projectId}/increments": {
      get: operation("Increments", "List the increments", {
        description: PROJECT_READERS,
        parameters: [projectId, ...listParams],
      }),
    },
    "/projects/{projectId}/increments/{id}": {
      get: operation("Increments", "Get an increment with its user stories", {
        description: PROJECT_READERS,
        parameters: [projectId, id],
      }),
      patch: operation("Increments", "Update the name or the description", {
        description: "Product Owner.",
        parameters: [projectId, id],
        requestBody: jsonBody({ name: { type: "string" }, description: { type: "string" } }),
      }),
    },
    "/projects/{projectId}/increments/{id}/deliver": {
      post: operation("Increments", "Deliver the increment to the stakeholders", {
        description: "Product Owner. The next accepted user stories form a new increment.",
        parameters: [projectId, id],
      }),
    },

    // ---------- Notifications ----------
    "/projects/{projectId}/notifications": {
      get: operation("Notifications", "List the notifications", {
        description: "Scrum Master or Product Owner.",
        parameters: [projectId, ...listParams],
      }),
      post: operation("Notifications", "Create and send an email notification", {
        description:
          "Scrum Master or Product Owner. The recipient must be a member of the Scrum team or the client of the project.",
        status: 201,
        parameters: [projectId],
        requestBody: jsonBody(
          {
            subject: { type: "string" },
            message: { type: "string" },
            recipient: { type: "string", format: "email" },
            priority: { type: "integer", description: "Optional, to sort the notifications (?sort=priority)" },
            sprint: { type: "string" },
          },
          ["subject", "recipient"],
        ),
      }),
    },
    "/projects/{projectId}/notifications/{id}": {
      get: operation("Notifications", "Get a notification", {
        description: "Scrum Master or Product Owner.",
        parameters: [projectId, id],
      }),
      delete: operation("Notifications", "Delete a notification", {
        description: "Scrum Master or Product Owner.",
        parameters: [projectId, id],
      }),
    },
    "/projects/{projectId}/notifications/{id}/resend": {
      post: operation("Notifications", "Send a notification again", {
        description:
          "Scrum Master or Product Owner. The email is sent in background: the sent field is updated once it is sent.",
        status: 202,
        parameters: [projectId, id],
      }),
    },
  },
};

module.exports = swaggerSpec;
