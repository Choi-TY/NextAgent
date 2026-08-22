function daysUntil(dateString) {
  if (!dateString) return 30;
  const due = new Date(dateString);
  const now = new Date();
  return Math.ceil((due - now) / 86400000);
}

function recommendationScore(task, fatigueLevel) {
  const analysis = task.currentAnalysis || task.aiAnalysis;
  const difficultyWeight = analysis.difficulty === 'hard' ? 3 : analysis.difficulty === 'medium' ? 2 : 1;
  const urgency = Math.max(0, 14 - daysUntil(task.dueDate));
  const suitability = Number(analysis.todaySuitabilityScore || 50);

  if (fatigueLevel >= 7) {
    return 100 - difficultyWeight * 18 + urgency + suitability * 0.2;
  }

  if (fatigueLevel <= 3) {
    return 20 + difficultyWeight * 20 + urgency * 2 + suitability * 0.3;
  }

  return 50 + difficultyWeight * 8 + urgency * 1.5 + suitability * 0.25;
}

function reasonForRanking(task, fatigueLevel) {
  const analysis = task.currentAnalysis || task.aiAnalysis;
  if (fatigueLevel >= 7) {
    return `High fatigue mode: prioritizing manageable tasks. ${analysis.difficulty} difficulty fits current energy.`;
  }
  if (fatigueLevel <= 3) {
    return `Low fatigue mode: prioritizing impact and challenge. ${analysis.difficulty} difficulty is a strong use of focus.`;
  }
  return `Balanced mode: combining urgency and effort. ${analysis.estimatedMinutes}m estimate keeps momentum.`;
}

function rankTasks(tasks, fatigueLevel = 5) {
  return tasks
    .filter((task) => !task.completed)
    .map((task) => ({
      ...task,
      recommendationScore: recommendationScore(task, fatigueLevel),
      recommendationReason: reasonForRanking(task, fatigueLevel)
    }))
    .sort((a, b) => b.recommendationScore - a.recommendationScore);
}

function categorizeByDifficulty(tasks) {
  return tasks.reduce(
    (acc, task) => {
      const difficulty = (task.currentAnalysis || task.aiAnalysis).difficulty || 'medium';
      if (!acc[difficulty]) acc[difficulty] = [];
      acc[difficulty].push(task);
      return acc;
    },
    { easy: [], medium: [], hard: [] }
  );
}

module.exports = {
  categorizeByDifficulty,
  rankTasks
};
