const { labelDifficulty } = require('../utils/labels');

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
  const difficultyLabel = labelDifficulty(analysis.difficulty);
  if (fatigueLevel >= 7) {
    return `피로도가 높은 상태라 부담이 적은 작업을 우선 추천해요. 지금은 ${difficultyLabel} 난이도 작업이 적합합니다.`;
  }
  if (fatigueLevel <= 3) {
    return `피로도가 낮아 집중이 잘 되는 상태예요. 지금은 ${difficultyLabel} 난이도 작업에 도전하기 좋아요.`;
  }
  return `균형 모드로 긴급도와 소요 시간을 함께 고려했어요. 예상 ${analysis.estimatedMinutes}분 작업으로 흐름을 유지하기 좋습니다.`;
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
