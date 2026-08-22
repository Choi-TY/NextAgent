const fs = require('fs/promises');
const path = require('path');

const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, '../../data/app-data.json');
let writeQueue = Promise.resolve();

const defaultData = {
  tasks: [],
  fatigueLogs: [],
  learningProfile: {
    editCount: 0,
    durationMultiplier: 1,
    difficultyBias: 0,
    focusBias: 0
  }
};

async function ensureDataFile() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(defaultData, null, 2), 'utf8');
  }
}

async function loadData() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  return { ...defaultData, ...JSON.parse(raw) };
}

async function saveData(data) {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function queueWrite(work) {
  const next = writeQueue.then(
    () => work(),
    () => work()
  );
  writeQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

async function listTasks() {
  const data = await loadData();
  return data.tasks;
}

async function getTaskById(id) {
  const tasks = await listTasks();
  return tasks.find((task) => task.id === id);
}

async function addTask(task) {
  await queueWrite(async () => {
    const data = await loadData();
    data.tasks.push(task);
    await saveData(data);
  });
}

async function updateTask(id, updates) {
  return queueWrite(async () => {
    const data = await loadData();
    const index = data.tasks.findIndex((task) => task.id === id);
    if (index === -1) return null;
    data.tasks[index] = { ...data.tasks[index], ...updates, updatedAt: new Date().toISOString() };
    await saveData(data);
    return data.tasks[index];
  });
}

async function updateLearningProfile(learningProfile) {
  return queueWrite(async () => {
    const data = await loadData();
    data.learningProfile = { ...defaultData.learningProfile, ...learningProfile };
    await saveData(data);
    return data.learningProfile;
  });
}

async function recordFatigue(level) {
  await queueWrite(async () => {
    const data = await loadData();
    data.fatigueLogs.push({ level, recordedAt: new Date().toISOString() });
    await saveData(data);
  });
}

async function getLatestFatigue() {
  const data = await loadData();
  return data.fatigueLogs[data.fatigueLogs.length - 1] || null;
}

async function getWeeklyStats(referenceDate = new Date()) {
  const data = await loadData();
  const since = new Date(referenceDate);
  since.setDate(since.getDate() - 7);

  const weeklyTasks = data.tasks.filter((task) => new Date(task.createdAt) >= since);
  const completedTasks = weeklyTasks.filter((task) => task.completed);

  const completionRate = weeklyTasks.length === 0 ? 0 : Math.round((completedTasks.length / weeklyTasks.length) * 100);

  const fatigueBuckets = data.fatigueLogs
    .filter((log) => new Date(log.recordedAt) >= since)
    .reduce(
      (acc, log) => {
        if (log.level >= 7) acc.high += 1;
        else if (log.level <= 3) acc.low += 1;
        else acc.medium += 1;
        return acc;
      },
      { low: 0, medium: 0, high: 0 }
    );

  const overdue = data.tasks.filter((task) => !task.completed && task.dueDate && new Date(task.dueDate) < referenceDate);
  const postponedDifficulty = overdue.reduce(
    (acc, task) => {
      const difficulty = task.currentAnalysis?.difficulty || task.aiAnalysis?.difficulty || 'medium';
      acc[difficulty] = (acc[difficulty] || 0) + 1;
      return acc;
    },
    { easy: 0, medium: 0, hard: 0 }
  );

  return {
    completionRate,
    createdCount: weeklyTasks.length,
    completedCount: completedTasks.length,
    fatigueBuckets,
    postponedDifficulty
  };
}

async function getLearningProfile() {
  const data = await loadData();
  return { ...defaultData.learningProfile, ...(data.learningProfile || {}) };
}

module.exports = {
  addTask,
  getLatestFatigue,
  getLearningProfile,
  getTaskById,
  getWeeklyStats,
  listTasks,
  recordFatigue,
  updateLearningProfile,
  updateTask
};
