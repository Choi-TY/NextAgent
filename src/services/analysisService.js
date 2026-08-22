const difficultyScale = ['easy', 'medium', 'hard'];
const { labelDifficulty, labelFocus } = require('../utils/labels');

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function shiftDifficulty(difficulty, bias) {
  const index = difficultyScale.indexOf(difficulty);
  if (index === -1) return difficulty;
  const shifted = clamp(index + Math.round(bias), 0, difficultyScale.length - 1);
  return difficultyScale[shifted];
}

function heuristicAnalyze(task, learningProfile = {}) {
  const text = `${task.title || ''} ${task.memo || ''}`.toLowerCase();
  let difficulty = 'medium';

  if (/quick|simple|read|email|정리|확인/.test(text)) difficulty = 'easy';
  if (/design|plan|debug|fix|분석|설계/.test(text)) difficulty = 'medium';
  if (/architecture|migration|research|deep|구현|배포|통합/.test(text)) difficulty = 'hard';

  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const now = new Date();
  const daysToDue = dueDate ? Math.ceil((dueDate - now) / 86400000) : 7;

  const baseMinutes = difficulty === 'easy' ? 15 : difficulty === 'medium' ? 35 : 70;
  const urgencyBoost = daysToDue <= 1 ? 10 : daysToDue <= 3 ? 5 : 0;

  let estimatedMinutes = Math.round((baseMinutes + urgencyBoost) * (learningProfile.durationMultiplier || 1));
  estimatedMinutes = clamp(estimatedMinutes, 10, 180);

  difficulty = shiftDifficulty(difficulty, learningProfile.difficultyBias || 0);

  let focusLevel = difficulty === 'hard' ? 'high' : difficulty === 'easy' ? 'low' : 'medium';
  if ((learningProfile.focusBias || 0) > 0.4 && focusLevel !== 'high') {
    focusLevel = focusLevel === 'low' ? 'medium' : 'high';
  } else if ((learningProfile.focusBias || 0) < -0.4 && focusLevel !== 'low') {
    focusLevel = focusLevel === 'high' ? 'medium' : 'low';
  }

  const todaySuitabilityScore = clamp(
    100 - (difficulty === 'hard' ? 35 : difficulty === 'medium' ? 20 : 10) - Math.floor(estimatedMinutes / 8),
    10,
    95
  );
  return {
    difficulty,
    estimatedMinutes,
    focusLevel,
    focusRequired: focusLevel !== 'low',
    todaySuitabilityScore,
    reason: `${labelDifficulty(difficulty)} 난이도의 작업으로 예상 소요 시간은 ${estimatedMinutes}분이며, 집중도는 ${labelFocus(focusLevel)} 수준이 필요합니다.`
  };
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function sanitizePromptValue(value) {
  return String(value || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[{}<>`$]/g, '')
    .trim()
    .slice(0, 500);
}

async function analyzeTaskWithAI(task, learningProfile) {
  const fallback = heuristicAnalyze(task, learningProfile);
  let agentFrameworkLoaded = false;

  try {
    const agentFramework = await import('@microsoft/agents-hosting');
    if (agentFramework?.AgentApplication) {
      // Agent Framework package presence is verified for analysis pipeline integration.
      agentFrameworkLoaded = true;
    }
  } catch (error) {
    console.warn('[AI] Microsoft Agent Framework unavailable, using fallback analysis.', error.message);
  }

  try {
    const { createCopilotClient } = await import('@github/copilot-sdk');
    if (typeof createCopilotClient === 'function' && process.env.GITHUB_TOKEN) {
      const client = await createCopilotClient({ auth: { token: process.env.GITHUB_TOKEN } });
      const session = await client.createSession?.();
      const prompt = `Analyze this task as JSON with keys difficulty(easy|medium|hard), estimatedMinutes(number), focusLevel(low|medium|high), focusRequired(boolean), todaySuitabilityScore(1-100), reason(string). Task title: ${sanitizePromptValue(task.title)}. Due date: ${sanitizePromptValue(task.dueDate || 'none')}. Memo: ${sanitizePromptValue(task.memo || 'none')}.`;
      const response = await session?.run?.(prompt);
      const parsed = safeJsonParse(response?.completion || response?.outputText || '');
      if (parsed?.difficulty && parsed?.estimatedMinutes) {
        return {
          ...fallback,
          ...parsed,
          estimatedMinutes: clamp(Number(parsed.estimatedMinutes) || fallback.estimatedMinutes, 10, 180),
          todaySuitabilityScore: clamp(Number(parsed.todaySuitabilityScore) || fallback.todaySuitabilityScore, 1, 100),
          source: 'copilot-sdk',
          agentFrameworkLoaded
        };
      }
    }
  } catch (error) {
    console.warn('[AI] Copilot SDK inference failed, using fallback analysis.', error.message);
  }

  return {
    ...fallback,
    source: 'heuristic-fallback',
    agentFrameworkLoaded
  };
}

function updateLearningProfileFromEdit(learningProfile, before, after) {
  const next = { ...learningProfile };
  const beforeMinutes = Math.max(1, Number(before.estimatedMinutes) || 1);
  const afterMinutes = Math.max(1, Number(after.estimatedMinutes) || beforeMinutes);

  const ratio = afterMinutes / beforeMinutes;
  const previousCount = next.editCount || 0;
  const totalCount = previousCount + 1;

  next.durationMultiplier = ((next.durationMultiplier || 1) * previousCount + ratio) / totalCount;

  const difficultyDelta =
    (difficultyScale.indexOf(after.difficulty || 'medium') - difficultyScale.indexOf(before.difficulty || 'medium')) || 0;
  next.difficultyBias = ((next.difficultyBias || 0) * previousCount + difficultyDelta) / totalCount;

  const focusMap = { low: 0, medium: 1, high: 2 };
  const focusDelta = (focusMap[after.focusLevel || 'medium'] ?? 1) - (focusMap[before.focusLevel || 'medium'] ?? 1);
  next.focusBias = ((next.focusBias || 0) * previousCount + focusDelta) / totalCount;

  next.editCount = totalCount;

  return next;
}

module.exports = {
  analyzeTaskWithAI,
  heuristicAnalyze,
  updateLearningProfileFromEdit
};
