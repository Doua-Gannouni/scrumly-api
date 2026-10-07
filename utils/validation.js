const { BadRequestError } = require("./appError");

// How the data of a request is checked :
// 1. sanitizeMiddleware refuses the MongoDB operators ($ne, $where ...)
// 2. pickFields keeps only the fields that a request is allowed to change
// 3. the schemas of the models check the fields that are saved (required, format, enum ...)
// 4. the functions below check the other values of a request (login, list of ids, true / false ...)

// a text that is not empty
const requireText = (value, name) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new BadRequestError(`${name} is required.`);
  }
  return value;
};

// true or false
const requireBoolean = (value, name) => {
  if (typeof value !== "boolean") {
    throw new BadRequestError(`${name} must be true or false.`);
  }
  return value;
};

// a list that is not empty
const requireList = (value, name) => {
  if (!Array.isArray(value) || !value.length) {
    throw new BadRequestError(`Please provide the list of ${name}.`);
  }
  return value;
};

module.exports = { requireText, requireBoolean, requireList };
