const test = require('node:test');
const assert = require('node:assert/strict');
const { rankTasks } = require('../src/services/recommendationService');

function makeTask(title, difficulty) {
  return {
    id: title,
    title,
    dueDate: new Date(Date.now() + 2 * 86400000).toISOString(),
    completed: false,
    currentAnalysis: {
      difficulty,
      estimatedMinutes: difficulty === 'hard' ? 60 : 20,
      todaySuitabilityScore: 60
    }
  };
}

test('high fatigue prioritizes easier tasks', () => {
  const tasks = [makeTask('Hard task', 'hard'), makeTask('Easy task', 'easy')];
  const ranked = rankTasks(tasks, 9);
  assert.equal(ranked[0].title, 'Easy task');
});

test('low fatigue prioritizes harder tasks', () => {
  const tasks = [makeTask('Hard task', 'hard'), makeTask('Easy task', 'easy')];
  const ranked = rankTasks(tasks, 2);
  assert.equal(ranked[0].title, 'Hard task');
});
