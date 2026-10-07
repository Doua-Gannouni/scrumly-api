const scrumEventService = require("../services/scrumEventService");
const asyncHandler = require("../utils/asyncHandler");

// Create a Scrum event
exports.createEvent = asyncHandler(async (req, res) => {
  const event = await scrumEventService.createEvent(req.project, req.body);
  res.status(201).json({
    status: "success",
    message: "Event created successfully!",
    data: { event },
  });
});

// Get all the events of the project (ex: ?sprint=<id>&type=DailyScrum)
exports.getAllEvents = asyncHandler(async (req, res) => {
  const { docs: events, pagination } = await scrumEventService.getAllEvents(req.project, req.query);
  res.status(200).json({
    status: "success",
    results: events.length,
    pagination,
    message: "Events retrieved successfully!",
    data: { events },
  });
});

// Get an event by ID
exports.getEventById = asyncHandler(async (req, res) => {
  const event = await scrumEventService.getEventById(req.project, req.params.id);
  res.status(200).json({
    status: "success",
    message: "Event retrieved successfully!",
    data: { event },
  });
});

// Update an event (ex: add the notes of the retrospective)
exports.updateEvent = asyncHandler(async (req, res) => {
  const event = await scrumEventService.updateEvent(req.project, req.params.id, req.body);
  res.status(200).json({
    status: "success",
    message: "Event updated successfully!",
    data: { event },
  });
});

// Delete an event
exports.deleteEvent = asyncHandler(async (req, res) => {
  await scrumEventService.deleteEvent(req.project, req.params.id);
  res.status(200).json({
    status: "success",
    message: "Event deleted successfully!",
  });
});
