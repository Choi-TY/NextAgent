const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { analyzeTaskWithAI, updateLearningProfileFromEdit } = require('./services/analysisService');
const { rankTasks, categorizeByDifficulty } = require('./services/recommendationService');
const {
  addTask,
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
    bestTask: rankedTasks[0] || null
  });
});

app.post('/fatigue', async (req, res) => {
  const level = Math.max(1, Math.min(10, Number(req.body.level) || 5));
  await recordFatigue(level);
  res.redirect('/analysis');
});

app.get('/tasks/new', (req, res) => {
  res.render('add-task');
});

app.post('/tasks', async (req, res) => {
  const title = (req.body.title || '').trim();
  if (!title) {
    return res.status(400).send('Title is required');
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
    return res.status(404).send('Task not found');
  }

  const latestFatigue = await getLatestFatigue();
  const fatigueLevel = latestFatigue?.level || 5;
  const ranked = rankTasks([task], fatigueLevel)[0];

  res.render('task-detail', {
    task,
    fatigueLevel,
    recommendationReason: ranked?.recommendationReason || 'Not enough data yet.'
  });
});

app.post('/tasks/:id/edit-analysis', async (req, res) => {
  const task = await getTaskById(req.params.id);
  if (!task) {
    return res.status(404).send('Task not found');
  }

  const nextAnalysis = {
    difficulty: req.body.difficulty,
    estimatedMinutes: Math.max(10, Math.min(180, Number(req.body.estimatedMinutes) || 30)),
    focusLevel: req.body.focusLevel,
    focusRequired: req.body.focusLevel !== 'low',
    todaySuitabilityScore: Math.max(1, Math.min(100, Number(req.body.todaySuitabilityScore) || 50)),
    reason: (req.body.reason || '').trim() || task.currentAnalysis.reason,
    source: 'user-edited',
    agentFrameworkLoaded: task.currentAnalysis.agentFrameworkLoaded
  };

  const updatedTask = await updateTask(task.id, { currentAnalysis: nextAnalysis });
  if (!updatedTask) {
    return res.status(500).send('Could not update task');
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
    return res.status(404).send('Task not found');
  }

  await updateTask(task.id, {
    completed: true,
    completedAt: new Date().toISOString()
  });

  res.redirect('/weekly-record');
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
    console.log(`NextAgent MVP running on http://localhost:${port}`);
  });
}

module.exports = app;
