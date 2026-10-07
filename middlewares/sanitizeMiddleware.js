const { BadRequestError } = require("../utils/appError");

// First key of a value (or of its nested objects) that MongoDB would read as an operator ($ne, $where ...)
// or, when dots are not allowed, as a path (a.b)
const findForbiddenKey = (value, allowDots) => {
  if (Array.isArray(value)) {
    for (const element of value) {
      const key = findForbiddenKey(element, allowDots);
      if (key) return key;
    }
    return null;
  }

  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      if (key.startsWith("$") || (!allowDots && key.includes("."))) return key;
      const nestedKey = findForbiddenKey(value[key], allowDots);
      if (nestedKey) return nestedKey;
    }
  }
  return null;
};

// Throw an error if a request body contains MongoDB operators, ex: { "userId": { "$in": [...] } }
// a value sent by a client is never an operator, so it cannot change the meaning of a query
const assertNoMongoOperators = (body) => {
  const key = findForbiddenKey(body, false);
  if (key) {
    throw new BadRequestError(`Invalid field name: ${key}`);
  }
};

exports.assertNoMongoOperators = assertNoMongoOperators;

// Refuse the JSON bodies and the query strings with MongoDB operators
// (the multipart bodies are read later by multer : the project controller checks them)
exports.rejectMongoOperators = (req, res, next) => {
  try {
    assertNoMongoOperators(req.body);
    const queryKey = findForbiddenKey(req.query, true);
    if (queryKey) {
      throw new BadRequestError(`Invalid field name: ${queryKey}`);
    }
    next();
  } catch (err) {
    next(err);
  }
};
