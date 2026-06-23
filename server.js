// ================================================================
//  SERVER.JS – Complete AI Gym Trainer Backend
//  Handles: Telegram Bot, Webhook, API, Video Uploads
//  Deployed on Render: https://gym-apk-wicj.onrender.com
//  Mini App on Vercel: https://gym-apk-krk7.vercel.app
// ================================================================

require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const TelegramBot = require('node-telegram-bot-api');

// ─── Configuration ──────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
const STATIC_DIR = process.env.STATIC_DIR || path.join(__dirname, 'public');
const LOG_DIR = path.join(__dirname, 'logs');

// Ensure directories exist
[UPLOAD_DIR, STATIC_DIR, LOG_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ─── Express App ──────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// ─── Middleware ────────────────────────────────────────────────
app.use(helmet({ 
  contentSecurityPolicy: false, 
  crossOriginEmbedderPolicy: false 
}));
app.use(compression());
app.use(morgan('dev'));
app.use(cors({
  origin: [
    'https://gym-apk-krk7.vercel.app',
    'https://gym-apk-wicj.onrender.com',
    'http://localhost:3000'
  ],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(STATIC_DIR));

// ─── Rate Limiting ─────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 60000,
  max: 100,
  message: { error: 'Too many requests' }
});
app.use('/api/', limiter);

// ─── Multer for Video Uploads ─────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }
});

// ─── Telegram Bot ──────────────────────────────────────────────
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'YourGymBot';
const MINI_APP_URL = process.env.TELEGRAM_MINI_APP_URL || 'https://gym-apk-krk7.vercel.app';
const WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL || 'https://gym-apk-wicj.onrender.com/webhook';

let bot = null;
if (TOKEN) {
  bot = new TelegramBot(TOKEN, { polling: false });
  console.log('✅ Telegram Bot initialized');
} else {
  console.log('⚠️ TELEGRAM_BOT_TOKEN not set');
}

// ─── In-memory Data ────────────────────────────────────────────
const userSessions = new Map();
const workoutHistory = [];

// ─── Schedule ──────────────────────────────────────────────────
const SCHEDULE = {
  Monday:    { workout: 'Chest / Triceps', exercises: ['Push-up', 'Bicep Curl', 'Tricep Extension'] },
  Tuesday:   { workout: 'Back / Biceps', exercises: ['Bent-over Row', 'Deadlift', 'Bicep Curl'] },
  Wednesday: { workout: 'Legs / Shoulders', exercises: ['Squat', 'Lunge', 'Shoulder Press'] },
  Thursday:  { workout: 'Chest / Triceps', exercises: ['Push-up', 'Lateral Raise', 'Tricep Extension'] },
  Friday:    { workout: 'Back / Biceps', exercises: ['Bent-over Row', 'Deadlift', 'Bicep Curl'] },
  Saturday:  { workout: 'Core / Cardio', exercises: ['Plank', 'Crunch', 'Glute Bridge'] },
  Sunday:    { workout: 'Rest / Mobility', exercises: [] }
};

// ─── Exercise Library ──────────────────────────────────────────
const EXERCISES = [
  { id: 'PUSHUP', name: 'Push-up', icon: '💪', muscle: 'Chest' },
  { id: 'SQUAT', name: 'Squat', icon: '🦵', muscle: 'Legs' },
  { id: 'BICEP_CURL', name: 'Bicep Curl', icon: '💪', muscle: 'Biceps' },
  { id: 'SHOULDER_PRESS', name: 'Shoulder Press', icon: '🏋️', muscle: 'Shoulders' },
  { id: 'PLANK', name: 'Plank', icon: '🧘', muscle: 'Abs' },
  { id: 'LUNGE', name: 'Lunge', icon: '🚶', muscle: 'Legs' },
  { id: 'CRUNCH', name: 'Crunch', icon: '🔥', muscle: 'Abs' },
  { id: 'ROW', name: 'Bent-over Row', icon: '🔙', muscle: 'Back' },
  { id: 'DEADLIFT', name: 'Deadlift', icon: '🏋️', muscle: 'Back/Legs' },
  { id: 'LATERAL_RAISE', name: 'Lateral Raise', icon: '💪', muscle: 'Shoulders' },
  { id: 'TRICEP_EXTENSION', name: 'Tricep Extension', icon: '💪', muscle: 'Triceps' },
  { id: 'GLUTE_BRIDGE', name: 'Glute Bridge', icon: '🦵', muscle: 'Glutes' }
];

// ─── Helper Functions ──────────────────────────────────────────

function getTodaySchedule() {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  return {
    day: today,
    workout: SCHEDULE[today]?.workout || 'Full Body Workout',
    exercises: SCHEDULE[today]?.exercises || []
  };
}

function getWelcomeMessage(firstName = 'Athlete') {
  const today = getTodaySchedule();
  const exercises = today.exercises.map((ex, i) => `   ${i+1}. ${ex}`).join('\n');

  return `
🏋️ *WELCOME TO AI GYM TRAINER* 💪

Hey *${firstName}*! I'm your personal AI fitness coach. Let's crush your fitness goals together!

━━━━━━━━━━━━━━━━━━━━━

🌟 *What I Can Do For You:*

🎯 *Smart Workout Schedule*
   • Get your personalized weekly plan
   • Today's workout: *${today.workout}*
   • Track your progress daily

🤖 *AI Form Analysis*
   • Real-time pose detection
   • Instant feedback on your form
   • Get corrections like "Go lower!" or "Perfect!"

📹 *Video Recording*
   • Record your workouts
   • Review your form later
   • Track your improvement

━━━━━━━━━━━━━━━━━━━━━

📅 *Today's Schedule: ${today.day}*
📍 *Workout:* ${today.workout}
⏱️ *Duration:* 30-45 minutes

*Exercises:*
${exercises || '   • Rest day - take it easy! 😊'}

━━━━━━━━━━━━━━━━━━━━━

🚀 *Quick Start:*

1️⃣ Tap the *"Open Gym App"* button below
2️⃣ Select today's workout
3️⃣ Start exercising and get real-time feedback!

━━━━━━━━━━━━━━━━━━━━━

💡 *Pro Tips:*
• Use a well-lit room for better pose detection
• Wear contrasting colors for best results
• Start with warm-up exercises
• Stay hydrated! 💧

━━━━━━━━━━━━━━━━━━━━━

🏆 *Your Fitness Journey Starts Now!*

Tap the button below to open your AI-powered gym trainer. Let's make every rep count! 💪

🔥 *LET'S GO!* 🔥
  `;
}

function getMainKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🏋️ Open Gym App', web_app: { url: MINI_APP_URL } }
        ],
        [
          { text: '📅 Today\'s Schedule', callback_data: 'schedule' },
          { text: '📊 My Progress', callback_data: 'progress' }
        ],
        [
          { text: '💪 Exercise Guide', callback_data: 'exercises' },
          { text: '❓ Help', callback_data: 'help' }
        ],
        [
          { text: '🎯 Start Workout', web_app: { url: MINI_APP_URL } }
        ]
      ]
    }
  };
}

// ─── Telegram Bot Handlers ─────────────────────────────────────

if (bot) {
  // /start command
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name || 'Athlete';
    
    console.log(`👋 New user: ${firstName} (${chatId})`);
    
    userSessions.set(chatId, {
      firstName,
      username: msg.from.username,
      startDate: new Date().toISOString()
    });

    // Send welcome message
    bot.sendMessage(chatId, getWelcomeMessage(firstName), {
      parse_mode: 'Markdown',
      ...getMainKeyboard(),
      disable_web_page_preview: false
    });

    // Send quick start guide after 1 second
    setTimeout(() => {
      bot.sendMessage(chatId, `
⚡ *QUICK START GUIDE* ⚡

1️⃣ *Open Gym App* → Tap the button below
2️⃣ *Select Exercise* → Choose from the library
3️⃣ *Start Training* → Get real-time feedback!

*You've got this!* 💪
      `, {
        parse_mode: 'Markdown',
        ...getMainKeyboard()
      });
    }, 1000);
  });

  // /workout command
  bot.onText(/\/workout/, (msg) => {
    const chatId = msg.chat.id;
    const today = getTodaySchedule();
    const exercises = today.exercises.map((ex, i) => `   ${i+1}. ${ex}`).join('\n');

    bot.sendMessage(chatId, `
📅 *TODAY'S WORKOUT* 📅
━━━━━━━━━━━━━━━━━━━━━

📆 *${today.day}*
🏋️ *Workout:* ${today.workout}
⏱️ *Duration:* 30-45 minutes

*Exercises:*
${exercises || '   • Rest day - take it easy! 😊'}

━━━━━━━━━━━━━━━━━━━━━
💪 *Let's get started!*
    `, {
      parse_mode: 'Markdown',
      ...getMainKeyboard()
    });
  });

  // /exercises command
  bot.onText(/\/exercises/, (msg) => {
    const chatId = msg.chat.id;
    const guide = `
💪 *EXERCISE LIBRARY* 💪
━━━━━━━━━━━━━━━━━━━━━

*Chest & Triceps*
• 💪 Push-up – Chest
• 💪 Tricep Extension – Triceps

*Back & Biceps*
• 🔙 Bent-over Row – Back
• 💪 Bicep Curl – Biceps
• 🏋️ Deadlift – Back/Legs

*Legs & Shoulders*
• 🦵 Squat – Legs
• 🚶 Lunge – Legs
• 🏋️ Shoulder Press – Shoulders
• 💪 Lateral Raise – Shoulders

*Core & Abs*
• 🧘 Plank – Abs
• 🔥 Crunch – Abs
• 🦵 Glute Bridge – Glutes

━━━━━━━━━━━━━━━━━━━━━
Tap the button below to start exercising! 🏋️
    `;
    bot.sendMessage(chatId, guide, {
      parse_mode: 'Markdown',
      ...getMainKeyboard()
    });
  });

  // /progress command
  bot.onText(/\/progress/, (msg) => {
    const chatId = msg.chat.id;
    const userData = userSessions.get(chatId);
    const workoutsDone = Math.floor(Math.random() * 20) + 5;
    const streak = Math.floor(Math.random() * 7) + 1;

    bot.sendMessage(chatId, `
📊 *YOUR PROGRESS* 📊
━━━━━━━━━━━━━━━━━━━━━

👤 *${userData?.firstName || 'Athlete'}*

📅 *Started:* ${userData?.startDate ? new Date(userData.startDate).toLocaleDateString() : 'Today'}

🏆 *Workouts Completed:* ${workoutsDone}

🔥 *Current Streak:* ${streak} days

💪 *Total Exercises:* ${workoutsDone * 3}

━━━━━━━━━━━━━━━━━━━━━

📈 *Weekly Progress*
${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  .map(d => {
    const done = Math.random() > 0.3;
    return `• ${d}: ${done ? '✅' : '⏳'} ${done ? 'Completed' : 'Pending'}`;
  }).join('\n')}

━━━━━━━━━━━━━━━━━━━━━

*Keep going! You're doing great!* 🚀
    `, {
      parse_mode: 'Markdown',
      ...getMainKeyboard()
    });
  });

  // /help command
  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `
❓ *HOW TO USE AI GYM TRAINER* ❓

━━━━━━━━━━━━━━━━━━━━━

🎯 *Getting Started*
1. Tap *"Open Gym App"* to launch the trainer
2. Allow camera access when prompted
3. Select an exercise from the library
4. Start exercising!

━━━━━━━━━━━━━━━━━━━━━

🤖 *AI Features*
• *Live Form Analysis*: Get instant feedback
• *Angle Tracking*: See your joint angles
• *Video Recording*: Record and review

━━━━━━━━━━━━━━━━━━━━━

💡 *Tips for Best Results*
• Good lighting is essential
• Stand 2-3 meters from the camera
• Wear fitted clothing

━━━━━━━━━━━━━━━━━━━━━

*Ready to start? Tap the button below!* 🏋️
    `, {
      parse_mode: 'Markdown',
      ...getMainKeyboard()
    });
  });

  // Callback queries
  bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    switch (data) {
      case 'schedule':
        bot.emit('text', { chat: { id: chatId }, text: '/workout' });
        break;
      case 'progress':
        bot.emit('text', { chat: { id: chatId }, text: '/progress' });
        break;
      case 'exercises':
        bot.emit('text', { chat: { id: chatId }, text: '/exercises' });
        break;
      case 'help':
        bot.emit('text', { chat: { id: chatId }, text: '/help' });
        break;
      default:
        bot.answerCallbackQuery(callbackQuery.id, { text: 'Coming soon! 🚀' });
    }
    bot.answerCallbackQuery(callbackQuery.id);
  });

  console.log('✅ Bot handlers registered');
}

// ─── WEBHOOK ROUTE ─────────────────────────────────────────────
app.post('/webhook', (req, res) => {
  if (bot) {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  } else {
    res.status(500).json({ error: 'Bot not initialized' });
  }
});

// ─── API ROUTES ─────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    bot: !!bot,
    botUsername: process.env.TELEGRAM_BOT_USERNAME || 'Not configured',
    miniAppUrl: MINI_APP_URL,
    webhookUrl: WEBHOOK_URL
  });
});

// Get bot info
app.get('/api/bot/info', (req, res) => {
  res.json({
    username: process.env.TELEGRAM_BOT_USERNAME || 'Not configured',
    webhook: WEBHOOK_URL,
    miniAppUrl: MINI_APP_URL,
    status: bot ? 'online' : 'offline'
  });
});

// Get today's schedule
app.get('/api/schedule/today', (req, res) => {
  res.json(getTodaySchedule());
});

// Get full schedule
app.get('/api/schedule', (req, res) => {
  res.json({
    schedule: SCHEDULE,
    today: new Date().toLocaleDateString('en-US', { weekday: 'long' })
  });
});

// Get all exercises
app.get('/api/exercises', (req, res) => {
  res.json(EXERCISES);
});

// Get specific exercise
app.get('/api/exercises/:id', (req, res) => {
  const ex = EXERCISES.find(e => e.id === req.params.id);
  if (!ex) return res.status(404).json({ error: 'Exercise not found' });
  res.json(ex);
});

// Analyze form (mock)
app.post('/api/analyze', express.json({ limit: '10mb' }), (req, res) => {
  const { exercise } = req.body;
  const rand = Math.random();
  let feedback, correct, angle;

  if (rand < 0.25) {
    feedback = '⬇️ Go lower!';
    correct = false;
    angle = 155;
  } else if (rand < 0.5) {
    feedback = '⬆️ Push up!';
    correct = false;
    angle = 65;
  } else {
    feedback = '✅ Perfect!';
    correct = true;
    angle = 90;
  }

  res.json({
    feedback,
    correct,
    angle: Math.round(angle),
    exercise
  });
});

// Upload video
app.post('/api/upload', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video uploaded' });
  }

  const { exercise, sessionId, userId } = req.body;
  const metadata = {
    filename: req.file.filename,
    exercise: exercise || 'unknown',
    sessionId: sessionId || uuidv4(),
    userId: userId || 'anonymous',
    timestamp: new Date().toISOString(),
    size: req.file.size,
    url: `/uploads/${req.file.filename}`
  };

  const metaPath = req.file.path + '.meta.json';
  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
  workoutHistory.push(metadata);

  res.json({
    success: true,
    message: 'Video uploaded successfully',
    ...metadata
  });
});

// Get all videos
app.get('/api/videos', (req, res) => {
  fs.readdir(UPLOAD_DIR, (err, files) => {
    if (err) return res.status(500).json({ error: 'Failed to list videos' });

    const videos = files
      .filter(f => /\.(mp4|webm|mov|avi)$/i.test(f))
      .map(f => {
        const metaPath = path.join(UPLOAD_DIR, f + '.meta.json');
        let metadata = {};
        if (fs.existsSync(metaPath)) {
          try { metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch (e) {}
        }
        return {
          filename: f,
          url: `/uploads/${f}`,
          metadata,
          timestamp: fs.statSync(path.join(UPLOAD_DIR, f)).mtime
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);

    res.json(videos);
  });
});

// Get video by filename
app.get('/api/video/:filename', (req, res) => {
  const { filename } = req.params;
  const videoPath = path.join(UPLOAD_DIR, filename);

  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: 'Video not found' });
  }

  const metaPath = videoPath + '.meta.json';
  let metadata = {};
  if (fs.existsSync(metaPath)) {
    try { metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch (e) {}
  }

  res.json({
    filename,
    url: `/uploads/${filename}`,
    metadata
  });
});

// Delete video
app.delete('/api/video/:filename', (req, res) => {
  const { filename } = req.params;
  const videoPath = path.join(UPLOAD_DIR, filename);
  const metaPath = videoPath + '.meta.json';

  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: 'Video not found' });
  }

  try {
    fs.unlinkSync(videoPath);
    if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
    res.json({ success: true, message: 'Video deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

// Get workout history
app.get('/api/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const history = workoutHistory
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
  res.json(history);
});

// ─── Serve Static Files ────────────────────────────────────────
app.use('/uploads', express.static(UPLOAD_DIR));

// ─── Serve Mini App (for Render) ──────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── Error Handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// ─── Set Webhook on Startup ────────────────────────────────────
async function setWebhook() {
  if (!bot) return;
  try {
    await bot.setWebHook(WEBHOOK_URL);
    console.log(`✅ Webhook set to: ${WEBHOOK_URL}`);
    
    // Get webhook info
    const info = await bot.getWebHookInfo();
    console.log(`📡 Webhook info:`, info);
  } catch (err) {
    console.error('❌ Webhook error:', err.message);
  }
}

// ─── Start Server ──────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', async () => {
  console.log('\n========================================');
  console.log('🏋️ AI Gym Trainer Server');
  console.log('========================================');
  console.log(`🚀 Running on: http://localhost:${PORT}`);
  console.log(`📁 Uploads: ${UPLOAD_DIR}`);
  console.log(`🤖 Bot: @${process.env.TELEGRAM_BOT_USERNAME || 'Not configured'}`);
  console.log(`🌐 Mini App: ${MINI_APP_URL}`);
  console.log(`🔗 Webhook: ${WEBHOOK_URL}`);
  console.log(`📊 Exercises: ${EXERCISES.length}`);
  console.log(`📅 Schedule: ${Object.keys(SCHEDULE).length} days`);
  console.log('========================================\n');

  // Set webhook
  await setWebhook();
});

// ─── Cleanup ────────────────────────────────────────────────────
setInterval(() => {
  const now = Date.now();
  const maxAge = 30 * 24 * 60 * 60 * 1000;

  fs.readdir(UPLOAD_DIR, (err, files) => {
    if (err) return;
    files.forEach(file => {
      const filePath = path.join(UPLOAD_DIR, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        if (now - stats.mtimeMs > maxAge) {
          fs.unlink(filePath, () => {});
          const metaPath = filePath + '.meta.json';
          if (fs.existsSync(metaPath)) fs.unlink(metaPath, () => {});
        }
      });
    });
  });
}, 24 * 60 * 60 * 1000);

// ─── Graceful Shutdown ─────────────────────────────────────────
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('🛑 Shutting down...');
  server.close(() => process.exit(0));
});

module.exports = { app, server };
