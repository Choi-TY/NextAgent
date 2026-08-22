const test = require('node:test');
const assert = require('node:assert/strict');
const { updateLearningProfileFromEdit } = require('../src/services/analysisService');

test('manual edits update learning profile values', () => {
  const profile = {
    editCount: 0,
    durationMultiplier: 1,
    difficultyBias: 0,
    focusBias: 0
  };

  const before = { difficulty: 'easy', estimatedMinutes: 20, focusLevel: 'low' };
  const after = { difficulty: 'hard', estimatedMinutes: 60, focusLevel: 'high' };

  const next = updateLearningProfileFromEdit(profile, before, after);

  assert.equal(next.editCount, 1);
  assert.equal(next.durationMultiplier, 3);
  assert.ok(next.difficultyBias > 0);
  assert.ok(next.focusBias > 0);
});

test('focus bias tracks low focus edits correctly', () => {
  const profile = {
    editCount: 0,
    durationMultiplier: 1,
    difficultyBias: 0,
    focusBias: 0
  };

  const before = { difficulty: 'medium', estimatedMinutes: 30, focusLevel: 'high' };
  const after = { difficulty: 'medium', estimatedMinutes: 30, focusLevel: 'low' };

  const next = updateLearningProfileFromEdit(profile, before, after);

  assert.equal(next.focusBias, -2);
});
