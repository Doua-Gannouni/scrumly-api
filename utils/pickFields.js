// Keep only the allowed fields sent in the request body (undefined fields are ignored)
const pickFields = (body, fields) => {
  const result = {};
  fields.forEach((field) => {
    if (body[field] !== undefined) {
      result[field] = body[field];
    }
  });
  return result;
};

module.exports = pickFields;
