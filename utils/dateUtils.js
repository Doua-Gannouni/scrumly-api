const { config } = require("../config/config");

const DAY_IN_MS = 24 * 60 * 60 * 1000;

// The days are represented by their date at 00:00 UTC, like the project and sprint dates
// (a date "2026-10-06" sent by the client is saved as 2026-10-06T00:00:00.000Z)

// Day of a date saved without time (project and sprint dates)
const startOfDay = (date) => {
  const value = new Date(date);
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
};

// Day of a moment in the time zone of the users (the current time, the date of a Scrum event ...)
// ex: 2026-10-06 00:30 in Tunis is 2026-10-05 23:30 UTC, but for the users it is the day 2026-10-06
const dayOf = (moment) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: config.timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = {};
  formatter.formatToParts(new Date(moment)).forEach(({ type, value }) => {
    parts[type] = Number(value);
  });
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
};

// Current day in the time zone of the users
const today = () => dayOf(new Date());

// Day after the given date
const nextDay = (date) => new Date(startOfDay(date).getTime() + DAY_IN_MS);

// Date as YYYY-MM-DD
const formatDay = (date) => startOfDay(date).toISOString().slice(0, 10);

// Same day N months later, or the last day of that month when it does not exist (Jan 31 + 1 month = Feb 28)
const addMonths = (date, months) => {
  const day = startOfDay(date);
  const result = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + months, 1));
  const lastDayOfMonth = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day.getUTCDate(), lastDayOfMonth));
  return result;
};

module.exports = { DAY_IN_MS, startOfDay, dayOf, today, nextDay, formatDay, addMonths };
