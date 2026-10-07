const DEFAULT_LIMIT = 6;
// a client cannot get a whole collection in one request (ex: ?limit=1000000)
const MAX_LIMIT = 100;

// Filter, sort and paginate a list from the query string (ex: ?status=Done&sort=-priority&page=2&limit=10)
class ApiFeatures {
  constructor(query, queryStr, defaultSort = "-createdAt") {
    this.query = query;
    this.queryStr = queryStr;
    this.defaultSort = defaultSort;
  }
  filter() {
    const extraFields = ["page", "limit", "sort"];
    let queryObj = { ...this.queryStr };
    extraFields.forEach((element) => {
      delete queryObj[element];
    });
    // do not overwrite this.queryStr : it is still used by pagination() and sort()
    const filter = this.addOperators(queryObj);
    // the conditions set by the server (ex: project) cannot be overridden by the client
    this.query = this.query.find({ ...filter, ...this.query.getFilter() });
    return this;
  }
  // add $ before the comparison operators of the query string : ?priority[gte]=2 -> { priority: { $gte: 2 } }
  // (the other MongoDB operators, ex: $ne, are refused before by sanitizeMiddleware)
  addOperators(obj) {
    const operators = ["gt", "gte", "lt", "lte"];
    const result = {};
    Object.keys(obj).forEach((key) => {
      const value = obj[key];
      const newKey = operators.includes(key) ? `$${key}` : key;
      result[newKey] = value && typeof value === "object" && !Array.isArray(value) ? this.addOperators(value) : value;
    });
    return result;
  }
  pagination() {
    this.page = Math.max(parseInt(this.queryStr.page, 10) || 1, 1);
    this.limit = Math.min(Math.max(parseInt(this.queryStr.limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    this.query = this.query.skip((this.page - 1) * this.limit).limit(this.limit);
    return this;
  }
  sort() {
    if (this.queryStr.sort) {
      const sort = this.queryStr.sort.split(",").join(" ");
      this.query = this.query.sort(sort);
    } else {
      this.query = this.query.sort(this.defaultSort);
    }
    return this;
  }
  // Run the query and count all the matching documents : returns the page and its pagination details
  async execute() {
    const [docs, total] = await Promise.all([this.query, this.query.model.countDocuments(this.query.getFilter())]);
    return {
      docs,
      pagination: { page: this.page, limit: this.limit, total, pages: Math.ceil(total / this.limit) },
    };
  }
}
module.exports = ApiFeatures;
