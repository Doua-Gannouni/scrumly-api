// Limits of the Scrum Guide 2020 enforced by the API

// maximum duration in minutes of each Scrum event (one-month sprint)
const SCRUM_EVENT_MAX_DURATION = {
  SprintPlanning: 480,
  DailyScrum: 15,
  SprintReview: 240,
  SprintRetrospective: 180,
};

// maximum size of a Scrum team, Product Owner and Scrum Master included
const SCRUM_TEAM_MAX_SIZE = 10;

module.exports = { SCRUM_EVENT_MAX_DURATION, SCRUM_TEAM_MAX_SIZE };
