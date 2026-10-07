// Allowed values of the enum fields of the models
const Enums = {
  PROJECT_STATUS_ENUM: ["In progress", "Done"],
  // "In review" : all the tasks are done, the Product Owner must check the Definition of Done
  USER_STORY_STATUS_ENUM: ["To do", "In progress", "In review", "Done"],
  TASK_STATUS_ENUM: ["To do", "In progress", "Done"],
  SPRINT_STATUS_ENUM: ["Planned", "In progress", "Done", "Cancelled"],
  PRODUCT_GOAL_STATUS_ENUM: ["Fulfilled", "Abandoned"],
  // Scrum role of a member in the team of a project
  ROLE_ENUM: ["ProductOwner", "ScrumMaster", "Developer"],
  // type of account : a team member gets a Scrum role per project (in the team), a client follows its projects
  USER_TYPE_ENUM: ["TeamMember", "Client", "Admin"],
  SYSTEM_NOTIFICATION_TYPE_ENUM: ["registration_request"],
  // in the order of the sprint : Sprint Planning, Daily Scrums, Sprint Review, Sprint Retrospective
  SCRUM_EVENT_TYPE_ENUM: ["SprintPlanning", "DailyScrum", "SprintReview", "SprintRetrospective"],
};

module.exports = Enums;
