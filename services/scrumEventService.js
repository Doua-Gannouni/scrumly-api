const ScrumEvent = require("../models/scrumEventModel");
const Sprint = require("../models/sprintModel");
const Enums = require("../constants/enums");
const ApiFeatures = require("../utils/apiFeatures");
const pickFields = require("../utils/pickFields");
const { BadRequestError, ConflictError } = require("../utils/appError");
const { startOfDay, dayOf } = require("../utils/dateUtils");

const MINUTE_IN_MS = 60 * 1000;
const EVENT_FIELDS = ["type", "title", "date", "durationMinutes", "notes", "improvements", "sprint"];

// Check the event : sprint of the project, date during the sprint,
// one Sprint Planning / Sprint Review / Sprint Retrospective per sprint, one Daily Scrum per day
// and the order of the events (Scrum Guide) : Sprint Planning initiates the Sprint,
// the Sprint Review is the second to last event and the Sprint Retrospective concludes the Sprint
const checkEvent = async (project, event) => {
  const sprint = await Sprint.findInProject(project._id, event.sprint);
  if (sprint.status === "Cancelled") {
    throw new ConflictError("Events cannot be planned for a cancelled sprint!");
  }

  // day of the event in the time zone of the users (an event at 00:30 in Tunis is on that day, not the day before)
  const eventDay = dayOf(event.date);
  if (eventDay < startOfDay(sprint.startDate) || eventDay > startOfDay(sprint.endDate)) {
    throw new BadRequestError("The event must take place during the sprint!");
  }

  if (event.type === "SprintPlanning" && eventDay.getTime() !== startOfDay(sprint.startDate).getTime()) {
    throw new BadRequestError(
      "The Sprint Planning initiates the Sprint : it must take place on the first day of the sprint!",
    );
  }

  const sameTypeEvents = await ScrumEvent.find({ sprint: sprint._id, type: event.type, _id: { $ne: event._id } });
  const duplicate =
    event.type === "DailyScrum"
      ? sameTypeEvents.find((otherEvent) => dayOf(otherEvent.date).getTime() === eventDay.getTime())
      : sameTypeEvents[0];
  if (duplicate) {
    throw new ConflictError(
      event.type === "DailyScrum"
        ? "A Daily Scrum already exists for this day!"
        : `A ${event.type} already exists for this sprint!`,
    );
  }

  // order of the events : Sprint Planning, Daily Scrums, Sprint Review, Sprint Retrospective
  const eventOrder = Enums.SCRUM_EVENT_TYPE_ENUM.indexOf(event.type);
  const eventStart = event.date.getTime();
  const eventEnd = eventStart + event.durationMinutes * MINUTE_IN_MS;

  const otherEvents = await ScrumEvent.find({ sprint: sprint._id, _id: { $ne: event._id } });
  for (const otherEvent of otherEvents) {
    const otherOrder = Enums.SCRUM_EVENT_TYPE_ENUM.indexOf(otherEvent.type);
    const otherStart = otherEvent.date.getTime();
    const otherEnd = otherStart + otherEvent.durationMinutes * MINUTE_IN_MS;

    if (otherOrder < eventOrder && otherEnd > eventStart) {
      throw new ConflictError(`The ${event.type} must take place after the ${otherEvent.type}!`);
    }
    if (otherOrder > eventOrder && eventEnd > otherStart) {
      throw new ConflictError(`The ${event.type} must take place before the ${otherEvent.type}!`);
    }
  }
};

// Create a Scrum event
exports.createEvent = async (project, body) => {
  const event = new ScrumEvent({
    ...pickFields(body, EVENT_FIELDS),
    project: project._id,
  });

  await event.validate();
  await checkEvent(project, event);
  return await event.save();
};

// Get all the events of the project (ex: ?sprint=<id>&type=DailyScrum)
exports.getAllEvents = async (project, query) => {
  const features = new ApiFeatures(ScrumEvent.find({ project: project._id }).populate("sprint", "name"), query, "date")
    .filter()
    .pagination()
    .sort();

  return await features.execute();
};

// Get an event by ID
exports.getEventById = async (project, id) => {
  const event = await ScrumEvent.findInProject(project._id, id);
  return await event.populate("sprint", "name goal startDate endDate");
};

// Update an event (ex: add the notes of the retrospective)
exports.updateEvent = async (project, id, body) => {
  const event = await ScrumEvent.findInProject(project._id, id);

  event.set(pickFields(body, EVENT_FIELDS));
  await event.validate();
  await checkEvent(project, event);
  return await event.save();
};

// Delete an event
exports.deleteEvent = async (project, id) => {
  const event = await ScrumEvent.findInProject(project._id, id);
  await event.deleteOne();
};
