// Sum of the story points of the user stories (a missing value counts 0)
const sumStoryPoints = (userStories) =>
  userStories.reduce((total, userStory) => total + (userStory.storyPoints || 0), 0);

module.exports = sumStoryPoints;
