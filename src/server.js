require('dotenv').config();
const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { analyzeTaskWithAI, updateLearningProfileFromEdit } = require('./services/analysisService');
const { rankTasks, categorizeByDifficulty } = require('./services/recommendationService');
const { labelDifficulty, labelFocus } = require('./utils/labels');
const {
  addTask,
  deleteTask,
  getLatestFatigue,
  getLearningProfile,
  getTaskById,
  getWeeklyStats,
  listTasks,
  recordFatigue,
  updateLearningProfile,
  updateTask
} = require('./services/storage');

const app = express();
const port = process.env.PORT || 3000;

app.locals.difficultyLabel = labelDifficulty;
app.locals.focusLabel = labelFocus;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', async (req, res) => {
  const [tasks, latestFatigue] = await Promise.all([listTasks(), getLatestFatigue()]);
  const fatigueLevel = latestFatigue?.level || 5;
  const rankedTasks = rankTasks(tasks, fatigueLevel);

  res.render('home', {
    fatigueLevel,
    rankedTasks,
    bestTask: rankedTasks[0] || null,
    grouped: categorizeByDifficulty(rankedTasks)
  });
});

app.post('/fatigue', async (req, res) => {
  const level = Math.max(1, Math.min(10, Number(req.body.level) || 5));
  await recordFatigue(level);
  res.redirect('/');
});

app.get('/tasks/new', (req, res) => {
  res.render('add-task');
});

app.post('/tasks', async (req, res) => {
  const title = (req.body.title || '').trim();
  if (!title) {
    return res.status(400).send('제목은 필수 항목입니다.');
  }

  const task = {
    id: uuidv4(),
    title,
    dueDate: req.body.dueDate || null,
    memo: (req.body.memo || '').trim(),
    completed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const learningProfile = await getLearningProfile();
  const aiAnalysis = await analyzeTaskWithAI(task, learningProfile);

  await addTask({
    ...task,
    aiAnalysis,
    currentAnalysis: aiAnalysis
  });

  res.redirect('/analysis');
});

app.get('/tasks/:id', async (req, res) => {
  const task = await getTaskById(req.params.id);
  if (!task) {
    return res.status(404).send('작업을 찾을 수 없습니다.');
  }

  const latestFatigue = await getLatestFatigue();
  const fatigueLevel = latestFatigue?.level || 5;
  const ranked = rankTasks([task], fatigueLevel)[0];

  res.render('task-detail', {
    task,
    fatigueLevel,
    recommendationReason: ranked?.recommendationReason || '아직 추천 근거가 충분하지 않습니다.'
  });
});

app.post('/tasks/:id/edit-analysis', async (req, res) => {
  const task = await getTaskById(req.params.id);
  if (!task) {
    return res.status(404).send('작업을 찾을 수 없습니다.');
  }

  const allowedDifficulties = new Set(['easy', 'medium', 'hard']);
  const allowedFocusLevels = new Set(['low', 'medium', 'high']);
  const difficulty = String(req.body.difficulty || '');
  const focusLevel = String(req.body.focusLevel || '');

  if (!allowedDifficulties.has(difficulty) || !allowedFocusLevels.has(focusLevel)) {
    return res.status(400).send('유효하지 않은 난이도 또는 집중도 값입니다.');
  }

  const nextAnalysis = {
    difficulty,
    estimatedMinutes: Math.max(10, Math.min(180, Number(req.body.estimatedMinutes) || 30)),
    focusLevel,
    focusRequired: focusLevel !== 'low',
    todaySuitabilityScore: Math.max(1, Math.min(100, Number(req.body.todaySuitabilityScore) || 50)),
    reason: (req.body.reason || '').trim() || task.currentAnalysis.reason,
    source: 'user-edited',
    agentFrameworkLoaded: task.currentAnalysis.agentFrameworkLoaded
  };

  const updatedTask = await updateTask(task.id, { currentAnalysis: nextAnalysis });
  if (!updatedTask) {
    return res.status(500).send('작업을 업데이트할 수 없습니다.');
  }
  const profile = await getLearningProfile();
  const learned = updateLearningProfileFromEdit(profile, task.currentAnalysis, nextAnalysis);
  await updateLearningProfile(learned);

  console.log('[Learning] Profile updated after manual edit', learned);

  res.redirect(`/tasks/${updatedTask.id}`);
});

app.post('/tasks/:id/complete', async (req, res) => {
  const task = await getTaskById(req.params.id);
  if (!task) {
    return res.status(404).send('작업을 찾을 수 없습니다.');
  }

  await updateTask(task.id, {
    completed: true,
    completedAt: new Date().toISOString()
  });

  res.redirect('/weekly-record');
});

app.post('/tasks/:id/delete', async (req, res) => {
  const deleted = await deleteTask(req.params.id);
  if (!deleted) {
    return res.status(404).send('작업을 찾을 수 없습니다.');
  }
  res.redirect('/');
});

app.get('/analysis', async (req, res) => {
  const [tasks, latestFatigue] = await Promise.all([listTasks(), getLatestFatigue()]);
  const fatigueLevel = latestFatigue?.level || 5;
  const rankedTasks = rankTasks(tasks, fatigueLevel);

  res.render('analysis-result', {
    fatigueLevel,
    rankedTasks,
    grouped: categorizeByDifficulty(rankedTasks)
  });
});

app.get('/weekly-record', async (req, res) => {
  const stats = await getWeeklyStats();
  res.render('weekly-record', { stats });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`EasyStart running on http://localhost:${port}`);
  });
}

module.exports = app;
