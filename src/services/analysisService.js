const { OpenAI } = require('openai');
const difficultyScale = ['easy', 'medium', 'hard'];
const { labelDifficulty, labelFocus } = require('../utils/labels');

const GITHUB_MODELS_ENDPOINT = 'https://models.inference.ai.azure.com';
const GITHUB_MODELS_MODEL = 'gpt-4o-mini';

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
      agentFrameworkLoaded = true;
    }
  } catch (error) {
    console.warn('[AI] Microsoft Agent Framework unavailable.', error.message);
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.warn('[AI] GITHUB_TOKEN not set — using heuristic fallback.');
    return { ...fallback, source: 'heuristic-fallback', agentFrameworkLoaded };
  }

  try {
    const client = new OpenAI({
      baseURL: GITHUB_MODELS_ENDPOINT,
      apiKey: token
    });

    const systemPrompt =
      'You are a task analysis assistant. Respond ONLY with a JSON object, no markdown, no extra text.';
    const userPrompt =
      `Analyze this task and return a JSON object with exactly these keys:\n` +
      `- difficulty: "easy", "medium", or "hard"\n` +
      `- estimatedMinutes: integer between 10 and 180\n` +
      `- focusLevel: "low", "medium", or "high"\n` +
      `- focusRequired: boolean\n` +
      `- todaySuitabilityScore: integer between 1 and 100\n` +
      `- reason: a short Korean sentence explaining the assessment\n\n` +
      `Task title: ${sanitizePromptValue(task.title)}\n` +
      `Due date: ${sanitizePromptValue(task.dueDate || 'none')}\n` +
      `Memo: ${sanitizePromptValue(task.memo || 'none')}`;

    const response = await client.chat.completions.create({
      model: GITHUB_MODELS_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 300
    });

    const raw = response.choices?.[0]?.message?.content || '';
    const parsed = safeJsonParse(raw.replace(/```json|```/g, '').trim());

    if (
      parsed?.difficulty &&
      ['easy', 'medium', 'hard'].includes(parsed.difficulty) &&
      parsed?.estimatedMinutes
    ) {
      console.log('[AI] GitHub Models inference succeeded.');
      return {
        ...fallback,
        ...parsed,
        estimatedMinutes: clamp(Number(parsed.estimatedMinutes) || fallback.estimatedMinutes, 10, 180),
        todaySuitabilityScore: clamp(Number(parsed.todaySuitabilityScore) || fallback.todaySuitabilityScore, 1, 100),
        source: 'github-models',
        agentFrameworkLoaded
      };
    }
    console.warn('[AI] Unexpected response format from GitHub Models, using fallback.', raw.slice(0, 200));
  } catch (error) {
    console.warn('[AI] GitHub Models inference failed, using fallback.', error.message);
  }

  return { ...fallback, source: 'heuristic-fallback', agentFrameworkLoaded };
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
