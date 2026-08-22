const DIFFICULTY_LABELS = { easy: '쉬움', medium: '보통', hard: '어려움' };
const FOCUS_LABELS = { low: '낮음', medium: '보통', high: '높음' };

function labelDifficulty(level) {
  return DIFFICULTY_LABELS[level] || level;
}

function labelFocus(level) {
  return FOCUS_LABELS[level] || level;
}

module.exports = {
  DIFFICULTY_LABELS,
  FOCUS_LABELS,
  labelDifficulty,
  labelFocus
};
