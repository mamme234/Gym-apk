// ================================================================
//  SERVER.JS – Complete AI Gym Trainer
//  Features:
//  - Onboarding: weight, height, protein, calories
//  - Workout style selection (Push/Pull/Legs, Full Body, etc.)
//  - Personalized schedule with multiple exercises per day
//  - YouTube videos for each exercise
//  - Premium workouts unlocked by watching ads
//  - Motivational messages with user's photo
//  - Time preference: asks user what time they work out
//  - Telegram bot with welcome & reminder messages
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

let bot = null;
if (TOKEN && TOKEN !== 'your-bot-token-here' && TOKEN !== '7609348168:AAHcFz8LxKJfGqWnR8mN3pQvZx7YwCbTdE') {
  bot = new TelegramBot(TOKEN, { polling: true });
  console.log('✅ Telegram Bot initialized with polling');
} else {
  console.log('⚠️ TELEGRAM_BOT_TOKEN not set or invalid');
}

// ─── In-memory Database ─────────────────────────────────────────
const userProfiles = new Map(); // userId -> { weight, height, protein, calories, goal, style, workTime, createdAt }
const userSessions = new Map();
const userWorkTimes = new Map(); // userId -> { time: '10:00 PM', timezone: 'UTC+3' }

// ─── Workout Styles & Schedules ────────────────────────────────
const WORKOUT_STYLES = {
  push_pull_legs: {
    name: 'Push/Pull/Legs',
    schedule: {
      'Monday': { name: 'Push Day', exercises: ['BENCH_PRESS', 'SHOULDER_PRESS', 'TRICEP_EXTENSION', 'LATERAL_RAISE'] },
      'Tuesday': { name: 'Pull Day', exercises: ['DEADLIFT', 'ROW', 'BICEP_CURL', 'FACE_PULL'] },
      'Wednesday': { name: 'Legs Day', exercises: ['SQUAT', 'LUNGE', 'LEG_CURL', 'CALF_RAISE'] },
      'Thursday': { name: 'Push Day', exercises: ['PUSHUP', 'SHOULDER_PRESS', 'TRICEP_EXTENSION', 'LATERAL_RAISE'] },
      'Friday': { name: 'Pull Day', exercises: ['DEADLIFT', 'ROW', 'BICEP_CURL', 'FACE_PULL'] },
      'Saturday': { name: 'Legs Day', exercises: ['SQUAT', 'LUNGE', 'LEG_CURL', 'CALF_RAISE'] },
      'Sunday': { name: 'Rest Day', exercises: [] }
    }
  },
  full_body: {
    name: 'Full Body',
    schedule: {
      'Monday': { name: 'Full Body A', exercises: ['SQUAT', 'BENCH_PRESS', 'ROW', 'SHOULDER_PRESS', 'PLANK'] },
      'Tuesday': { name: 'Rest', exercises: [] },
      'Wednesday': { name: 'Full Body B', exercises: ['DEADLIFT', 'PUSHUP', 'LUNGE', 'BICEP_CURL', 'CRUNCH'] },
      'Thursday': { name: 'Rest', exercises: [] },
      'Friday': { name: 'Full Body C', exercises: ['SQUAT', 'ROW', 'SHOULDER_PRESS', 'TRICEP_EXTENSION', 'PLANK'] },
      'Saturday': { name: 'Rest', exercises: [] },
      'Sunday': { name: 'Rest', exercises: [] }
    }
  },
  upper_lower: {
    name: 'Upper/Lower',
    schedule: {
      'Monday': { name: 'Upper A', exercises: ['BENCH_PRESS', 'ROW', 'SHOULDER_PRESS', 'BICEP_CURL', 'TRICEP_EXTENSION'] },
      'Tuesday': { name: 'Lower A', exercises: ['SQUAT', 'LUNGE', 'LEG_CURL', 'CALF_RAISE'] },
      'Wednesday': { name: 'Rest', exercises: [] },
      'Thursday': { name: 'Upper B', exercises: ['PUSHUP', 'DEADLIFT', 'LATERAL_RAISE', 'BICEP_CURL', 'TRICEP_EXTENSION'] },
      'Friday': { name: 'Lower B', exercises: ['SQUAT', 'LUNGE', 'LEG_CURL', 'CALF_RAISE'] },
      'Saturday': { name: 'Rest', exercises: [] },
      'Sunday': { name: 'Rest', exercises: [] }
    }
  },
  bro_split: {
    name: 'Bro Split',
    schedule: {
      'Monday': { name: 'Chest Day', exercises: ['BENCH_PRESS', 'PUSHUP', 'CHEST_FLY', 'DIPS'] },
      'Tuesday': { name: 'Back Day', exercises: ['DEADLIFT', 'ROW', 'PULLUP', 'FACE_PULL'] },
      'Wednesday': { name: 'Shoulder Day', exercises: ['SHOULDER_PRESS', 'LATERAL_RAISE', 'FRONT_RAISE', 'REAR_FLY'] },
      'Thursday': { name: 'Leg Day', exercises: ['SQUAT', 'LUNGE', 'LEG_CURL', 'CALF_RAISE'] },
      'Friday': { name: 'Arm Day', exercises: ['BICEP_CURL', 'TRICEP_EXTENSION', 'HAMMER_CURL', 'SKULL_CRUSHER'] },
      'Saturday': { name: 'Core Day', exercises: ['PLANK', 'CRUNCH', 'RUSSIAN_TWIST', 'LEG_RAISE'] },
      'Sunday': { name: 'Rest Day', exercises: [] }
    }
  },
  custom: {
    name: 'Custom',
    schedule: {
      'Monday': { name: 'Custom Day 1', exercises: ['PUSHUP', 'SQUAT', 'ROW'] },
      'Tuesday': { name: 'Custom Day 2', exercises: ['PLANK', 'LUNGE', 'BICEP_CURL'] },
      'Wednesday': { name: 'Custom Day 3', exercises: ['DEADLIFT', 'SHOULDER_PRESS', 'CRUNCH'] },
      'Thursday': { name: 'Custom Day 4', exercises: ['PUSHUP', 'SQUAT', 'ROW'] },
      'Friday': { name: 'Custom Day 5', exercises: ['PLANK', 'LUNGE', 'BICEP_CURL'] },
      'Saturday': { name: 'Custom Day 6', exercises: ['DEADLIFT', 'SHOULDER_PRESS', 'CRUNCH'] },
      'Sunday': { name: 'Rest Day', exercises: [] }
    }
  }
};

// ─── Exercise Database ──────────────────────────────────────────
const EXERCISE_DB = {
  PUSHUP: { id: 'PUSHUP', name: 'Push-up', icon: '💪', demo: '🧍', muscle: 'Chest', desc: 'Keep back straight, lower chest to ground', tip: 'Keep elbows at 45°', defaultReps: 12, defaultSets: 3, videoUrl: 'https://www.youtube.com/embed/IODxDxX7oi4', premium: false },
  SQUAT: { id: 'SQUAT', name: 'Squat', icon: '🦵', demo: '🏋️', muscle: 'Legs', desc: 'Keep chest up, go to parallel', tip: 'Knees track over toes', defaultReps: 15, defaultSets: 3, videoUrl: 'https://www.youtube.com/embed/aclHkVaku9U', premium: false },
  BICEP_CURL: { id: 'BICEP_CURL', name: 'Bicep Curl', icon: '💪', demo: '🏋️', muscle: 'Biceps', desc: 'Curl up, squeeze bicep', tip: 'Elbows pinned to sides', defaultReps: 10, defaultSets: 3, videoUrl: 'https://www.youtube.com/embed/ykJmrZ5v0Oo', premium: false },
  SHOULDER_PRESS: { id: 'SHOULDER_PRESS', name: 'Shoulder Press', icon: '🏋️', demo: '🏋️', muscle: 'Shoulders', desc: 'Press overhead, core tight', tip: "Don't arch back", defaultReps: 10, defaultSets: 3, videoUrl: 'https://www.youtube.com/embed/qEwKCR5JCog', premium: false },
  PLANK: { id: 'PLANK', name: 'Plank', icon: '🧘', demo: '🧘', muscle: 'Abs', desc: 'Straight line from head to heels', tip: "Don't sag hips", defaultReps: 3, defaultSets: 3, videoUrl: 'https://www.youtube.com/embed/pSHjTRCQxIw', premium: false },
  LUNGE: { id: 'LUNGE', name: 'Lunge', icon: '🚶', demo: '🚶', muscle: 'Legs', desc: 'Front knee 90°, back knee hovers', tip: 'Keep torso upright', defaultReps: 12, defaultSets: 3, videoUrl: 'https://www.youtube.com/embed/QOVaHwm-Q6U', premium: false },
  CRUNCH: { id: 'CRUNCH', name: 'Crunch', icon: '🔥', demo: '🔥', muscle: 'Abs', desc: 'Curl shoulders off ground', tip: 'Keep neck relaxed', defaultReps: 20, defaultSets: 3, videoUrl: 'https://www.youtube.com/embed/Xyd_fa5zoEU', premium: false },
  ROW: { id: 'ROW', name: 'Bent-over Row', icon: '🔙', demo: '🔙', muscle: 'Back', desc: 'Pull elbows back, squeeze blades', tip: 'Keep back straight', defaultReps: 10, defaultSets: 3, videoUrl: 'https://www.youtube.com/embed/vT2GjY_Umpw', premium: false },
  DEADLIFT: { id: 'DEADLIFT', name: 'Deadlift', icon: '🏋️', demo: '🏋️', muscle: 'Back/Legs', desc: 'Hinge at hips, back straight', tip: 'Drive through heels', defaultReps: 8, defaultSets: 3, videoUrl: 'https://www.youtube.com/embed/r4MzxtBKyNE', premium: false },
  LATERAL_RAISE: { id: 'LATERAL_RAISE', name: 'Lateral Raise', icon: '💪', demo: '💪', muscle: 'Shoulders', desc: 'Raise arms to sides', tip: 'Slight bend in elbows', defaultReps: 12, defaultSets: 3, videoUrl: 'https://www.youtube.com/embed/3VcKaXpzqHw', premium: false },
  TRICEP_EXTENSION: { id: 'TRICEP_EXTENSION', name: 'Tricep Extension', icon: '💪', demo: '💪', muscle: 'Triceps', desc: 'Extend overhead, lower behind head', tip: 'Keep elbows pointing forward', defaultReps: 12, defaultSets: 3, videoUrl: 'https://www.youtube.com/embed/vB5OHsJ3EME', premium: false },
  GLUTE_BRIDGE: { id: 'GLUTE_BRIDGE', name: 'Glute Bridge', icon: '🦵', demo: '🦵', muscle: 'Glutes', desc: 'Lift hips up, squeeze glutes', tip: "Don't overextend lower back", defaultReps: 15, defaultSets: 3, videoUrl: 'https://www.youtube.com/embed/Zp26q4BYWHE', premium: false },
  // Premium exercises
  BENCH_PRESS: { id: 'BENCH_PRESS', name: 'Bench Press', icon: '🏋️', demo: '🏋️', muscle: 'Chest', desc: 'Lower bar to chest, press up', tip: 'Keep shoulders packed', defaultReps: 10, defaultSets: 4, videoUrl: 'https://www.youtube.com/embed/gRVjAtPip0Y', premium: true },
  PULLUP: { id: 'PULLUP', name: 'Pull-up', icon: '💪', demo: '🧍', muscle: 'Back', desc: 'Pull chin above bar, controlled descent', tip: 'Engage lats, don\'t swing', defaultReps: 8, defaultSets: 3, videoUrl: 'https://www.youtube.com/embed/eGo4IYlbE5g', premium: true },
  DIPS: { id: 'DIPS', name: 'Dips', icon: '💪', demo: '💪', muscle: 'Chest/Triceps', desc: 'Lower body until shoulders below elbows', tip: 'Lean forward for chest focus', defaultReps: 10, defaultSets: 3, videoUrl: 'https://www.youtube.com/embed/2z8JmcrW-As', premium: true },
  FACE_PULL: { id: 'FACE_PULL', name: 'Face Pull', icon: '🔙', demo: '🔙', muscle: 'Rear Delts', desc: 'Pull rope to face, squeeze shoulder blades', tip: 'Keep elbows high', defaultReps: 15, defaultSets: 3, videoUrl: 'https://www.youtube.com/embed/HZSTx1OmeDU', premium: true },
  LEG_CURL: { id: 'LEG_CURL', name: 'Leg Curl', icon: '🦵', demo: '🦵', muscle: 'Hamstrings', desc: 'Curl weight towards glutes', tip: 'Control the negative', defaultReps: 12, defaultSets: 3, videoUrl: 'https://www.youtube.com/embed/1Tq3Qd2u4t8', premium: true },
  CALF_RAISE: { id: 'CALF_RAISE', name: 'Calf Raise', icon: '🦵', demo: '🦵', muscle: 'Calves', desc: 'Rise onto toes, squeeze calves', tip: 'Full range of motion', defaultReps: 20, defaultSets: 3, videoUrl: 'https://www.youtube.com/embed/-M4-G8p8fmc', premium: true },
  CHEST_FLY: { id: 'CHEST_FLY', name: 'Chest Fly', icon: '💪', demo: '💪', muscle: 'Chest', desc: 'Open arms wide, squeeze together', tip: 'Keep a slight bend in elbows', defaultReps: 12, defaultSets: 3, videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true },
  FRONT_RAISE: { id: 'FRONT_RAISE', name: 'Front Raise', icon: '💪', demo: '💪', muscle: 'Shoulders', desc: 'Raise arms to shoulder height', tip: 'Control the movement', defaultReps: 12, defaultSets: 3, videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true },
  REAR_FLY: { id: 'REAR_FLY', name: 'Rear Delt Fly', icon: '💪', demo: '💪', muscle: 'Rear Delts', desc: 'Open arms back, squeeze shoulder blades', tip: 'Keep back straight', defaultReps: 15, defaultSets: 3, videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true },
  HAMMER_CURL: { id: 'HAMMER_CURL', name: 'Hammer Curl', icon: '💪', demo: '💪', muscle: 'Biceps/Brachialis', desc: 'Curl with neutral grip', tip: 'Keep elbows stable', defaultReps: 10, defaultSets: 3, videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true },
  SKULL_CRUSHER: { id: 'SKULL_CRUSHER', name: 'Skull Crusher', icon: '💪', demo: '💪', muscle: 'Triceps', desc: 'Lower bar to forehead, extend up', tip: 'Keep elbows fixed', defaultReps: 10, defaultSets: 3, videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true },
  RUSSIAN_TWIST: { id: 'RUSSIAN_TWIST', name: 'Russian Twist', icon: '🔥', demo: '🔥', muscle: 'Obliques', desc: 'Rotate torso side to side', tip: 'Keep core engaged', defaultReps: 20, defaultSets: 3, videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true },
  LEG_RAISE: { id: 'LEG_RAISE', name: 'Leg Raise', icon: '🔥', demo: '🔥', muscle: 'Lower Abs', desc: 'Raise legs to 90°, lower slowly', tip: 'Keep lower back pressed', defaultReps: 15, defaultSets: 3, videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true }
};

// ─── Helper Functions ──────────────────────────────────────────

function getExercisesForDay(day, style) {
  const styleData = WORKOUT_STYLES[style] || WORKOUT_STYLES.push_pull_legs;
  const dayData = styleData.schedule[day] || { name: 'Rest', exercises: [] };
  return dayData.exercises.map(id => {
    const ex = EXERCISE_DB[id];
    return ex ? { ...ex } : null;
  }).filter(Boolean);
}

function getTodayExercises(style) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  return getExercisesForDay(today, style);
}

function getStyleSchedule(style) {
  return WORKOUT_STYLES[style] || WORKOUT_STYLES.push_pull_legs;
}

// ─── Nutrition Calculator ──────────────────────────────────────
function calculateNutrition(weight, height, age, goal) {
  let bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  let maintenance = bmr * 1.55;
  let calories = maintenance;
  let protein = weight * 1.8;
  let carbs = weight * 3;
  let fats = weight * 0.8;

  if (goal === 'muscle_gain') {
    calories = maintenance + 300;
    protein = weight * 2.2;
    carbs = weight * 4;
  } else if (goal === 'weight_loss') {
    calories = maintenance - 500;
    protein = weight * 2.0;
    carbs = weight * 2;
    fats = weight * 0.6;
  } else if (goal === 'strength') {
    calories = maintenance + 100;
    protein = weight * 2.0;
    carbs = weight * 3.5;
  }

  return {
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fats: Math.round(fats),
    bmr: Math.round(bmr),
    maintenance: Math.round(maintenance)
  };
}

// ─── Motivational Messages with Photo ──────────────────────────
const MOTIVATIONAL_QUOTES = [
  "💪 Success is the sum of small efforts repeated day in and day out.",
  "🔥 The only bad workout is the one that didn't happen.",
  "🏋️ Your body can stand almost anything. It's your mind you have to convince.",
  "⭐ It's not about being the best. It's about being better than you were yesterday.",
  "🚀 The pain you feel today will be the strength you feel tomorrow.",
  "💯 Don't stop when you're tired. Stop when you're done.",
  "🏆 Champions are made in the gym, not on the field.",
  "🔥 Progress, not perfection. Keep showing up.",
  "💪 Strength does not come from physical capacity. It comes from an indomitable will.",
  "⭐ The difference between who you are and who you want to be is what you do."
];

// The photo you provided (embedded as base64 or URL)
// Using a gym motivation image URL
const MOTIVATION_IMAGE_URL = 'https://i.imgur.com/7a132fe4ce274ab9efe1a0b8bf9bec06.png';

function getMotivationalMessage(firstName = 'Athlete') {
  const quote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todayExercises = getTodayExercises('push_pull_legs');
  const exList = todayExercises.map(ex => `   ${ex.icon} ${ex.name} (${ex.defaultSets}×${ex.defaultReps})`).join('\n');

  return `
🏋️ *HEY ${firstName.toUpperCase()}!* 💪

${quote}

━━━━━━━━━━━━━━━━━━━━━

📅 *Today is ${today}*

Your workout for today:
${exList || '   • Rest day - take it easy! 😊'}

━━━━━━━━━━━━━━━━━━━━━

⏰ *What time do you work out?*

Reply with your preferred workout time:
Example: *10:00 PM* or *6:30 AM*

I'll remind you daily at that time! 🕐

━━━━━━━━━━━━━━━━━━━━━

💪 *YOU'VE GOT THIS!*

[${MOTIVATION_IMAGE_URL}]

*Tap the button below to start your workout!* 🏋️
  `;
}

function getTimeReminderMessage(firstName = 'Athlete', time = '8:00 PM') {
  const quote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
  return `
⏰ *WORKOUT TIME REMINDER* ⏰

Hey *${firstName}*! It's ${time} – time to crush your workout! 💪

${quote}

━━━━━━━━━━━━━━━━━━━━━

*Don't forget:*
• Warm up for 5-10 minutes
• Stay hydrated 💧
• Focus on form over weight
• Log your workout

━━━━━━━━━━━━━━━━━━━━━

[${MOTIVATION_IMAGE_URL}]

*LET'S GO!* 🔥

Tap the button below to start your workout! 🏋️
  `;
}

// ─── Bot Keyboard ──────────────────────────────────────────────
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
          { text: '⚙️ Change Style', callback_data: 'style' }
        ],
        [
          { text: '⏰ Set Workout Time', callback_data: 'set_time' },
          { text: '❓ Help', callback_data: 'help' }
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
      startDate: new Date().toISOString(),
      step: 'onboarding'
    });

    // Send motivational message with photo
    bot.sendPhoto(chatId, MOTIVATION_IMAGE_URL, {
      caption: getMotivationalMessage(firstName),
      parse_mode: 'Markdown',
      ...getMainKeyboard()
    });
  });

  // Handle workout time input
  bot.onText(/^(\d{1,2}:\d{2}\s*(AM|PM|am|pm))$/, (msg, match) => {
    const chatId = msg.chat.id;
    const time = match[1].toUpperCase();
    const firstName = msg.from.first_name || 'Athlete';

    userWorkTimes.set(chatId, { time, setAt: new Date().toISOString() });
    
    bot.sendMessage(chatId, `
✅ *Workout time set!* ⏰

I'll remind you every day at *${time}* to crush your workout! 💪

━━━━━━━━━━━━━━━━━━━━━

${MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]}

━━━━━━━━━━━━━━━━━━━━━

*Ready to start? Tap the button below!* 🏋️
    `, {
      parse_mode: 'Markdown',
      ...getMainKeyboard()
    });
  });

  // Handle free-text time input (e.g., "10pm", "6:30 am")
  bot.onText(/^(.+)$/, (msg, match) => {
    const chatId = msg.chat.id;
    const text = match[1].toLowerCase().trim();
    
    // Check if it's a time-related message
    const timeRegex = /(\d{1,2})\s*(?::\s*(\d{2}))?\s*(am|pm)?/i;
    const matchTime = text.match(timeRegex);
    
    if (matchTime && (text.includes('am') || text.includes('pm') || text.includes(':'))) {
      let hours = parseInt(matchTime[1]);
      const minutes = matchTime[2] ? parseInt(matchTime[2]) : 0;
      const meridiem = matchTime[3] ? matchTime[3].toUpperCase() : (hours >= 12 ? 'PM' : 'AM');
      
      if (meridiem === 'AM' && hours === 12) hours = 0;
      if (meridiem === 'PM' && hours < 12) hours += 12;
      
      const timeStr = `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${meridiem}`;
      userWorkTimes.set(chatId, { time: timeStr, setAt: new Date().toISOString() });
      
      const firstName = msg.from.first_name || 'Athlete';
      bot.sendMessage(chatId, `
✅ *Workout time set!* ⏰

I'll remind you every day at *${timeStr}* to crush your workout! 💪

━━━━━━━━━━━━━━━━━━━━━

${MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]}

━━━━━━━━━━━━━━━━━━━━━

*Ready to start? Tap the button below!* 🏋️
      `, {
        parse_mode: 'Markdown',
        ...getMainKeyboard()
      });
    }
  });

  // /schedule command
  bot.onText(/\/schedule/, (msg) => {
    const chatId = msg.chat.id;
    const style = userProfiles.get(chatId)?.style || 'push_pull_legs';
    const schedule = getStyleSchedule(style);
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    let message = `📅 *${schedule.name} SCHEDULE* 📅\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    days.forEach(day => {
      const exercises = getExercisesForDay(day, style);
      const exList = exercises.length > 0 
        ? exercises.map(ex => `   ${ex.icon} ${ex.name}`).join('\n')
        : '   • Rest day 😊';
      message += `*${day}:*\n${exList}\n\n`;
    });
    
    message += '━━━━━━━━━━━━━━━━━━━━━\n';
    message += '💡 Change your workout style in the menu!';
    
    bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      ...getMainKeyboard()
    });
  });

  // /progress command
  bot.onText(/\/progress/, (msg) => {
    const chatId = msg.chat.id;
    const profile = userProfiles.get(chatId);
    
    if (!profile) {
      bot.sendMessage(chatId, '⚠️ Please set up your profile first with /start');
      return;
    }
    
    const nutrition = calculateNutrition(profile.weight, profile.height, 30, profile.goal);
    const workTime = userWorkTimes.get(chatId);
    
    bot.sendMessage(chatId, `
📊 *YOUR PROGRESS* 📊
━━━━━━━━━━━━━━━━━━━━━

👤 *${userSessions.get(chatId)?.firstName || 'Athlete'}*

📊 *Stats:*
• Weight: ${profile.weight}kg
• Height: ${profile.height}cm
• Protein Goal: ${profile.protein}g/day
• Calorie Goal: ${profile.calories}kcal/day

🍽️ *Nutrition:*
• Calories: ${nutrition.calories} kcal
• Protein: ${nutrition.protein}g
• Carbs: ${nutrition.carbs}g
• Fats: ${nutrition.fats}g

⏰ *Workout Time:* ${workTime?.time || 'Not set'}

🏆 *Keep pushing forward!* 💪
    `, {
      parse_mode: 'Markdown',
      ...getMainKeyboard()
    });
  });

  // /exercises command
  bot.onText(/\/exercises/, (msg) => {
    const chatId = msg.chat.id;
    let message = '💪 *EXERCISE LIBRARY* 💪\n━━━━━━━━━━━━━━━━━━━━━\n\n';
    
    const categories = {
      'Chest': ['PUSHUP', 'BENCH_PRESS', 'CHEST_FLY', 'DIPS'],
      'Legs': ['SQUAT', 'LUNGE', 'LEG_CURL', 'CALF_RAISE', 'GLUTE_BRIDGE'],
      'Back': ['ROW', 'DEADLIFT', 'PULLUP', 'FACE_PULL'],
      'Shoulders': ['SHOULDER_PRESS', 'LATERAL_RAISE', 'FRONT_RAISE', 'REAR_FLY'],
      'Arms': ['BICEP_CURL', 'TRICEP_EXTENSION', 'HAMMER_CURL', 'SKULL_CRUSHER'],
      'Abs': ['PLANK', 'CRUNCH', 'RUSSIAN_TWIST', 'LEG_RAISE']
    };
    
    Object.keys(categories).forEach(cat => {
      message += `*${cat}*\n`;
      categories[cat].forEach(id => {
        const ex = EXERCISE_DB[id];
        if (ex) {
          const premium = ex.premium ? ' 🔒' : '';
          message += `   ${ex.icon} ${ex.name}${premium}\n`;
        }
      });
      message += '\n';
    });
    
    message += '━━━━━━━━━━━━━━━━━━━━━\n';
    message += '🔒 = Premium (watch ad to unlock)';
    
    bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      ...getMainKeyboard()
    });
  });

  // /style command
  bot.onText(/\/style/, (msg) => {
    const chatId = msg.chat.id;
    const styles = Object.keys(WORKOUT_STYLES);
    let message = '⚙️ *CHOOSE YOUR WORKOUT STYLE* ⚙️\n━━━━━━━━━━━━━━━━━━━━━\n\n';
    
    styles.forEach(key => {
      const style = WORKOUT_STYLES[key];
      message += `• ${style.name}\n`;
    });
    
    message += '\n━━━━━━━━━━━━━━━━━━━━━\n';
    message += 'Reply with the style name you want!';
    
    bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      ...getMainKeyboard()
    });
  });

  // Handle style selection
  bot.onText(/push|pull|full body|upper|lower|bro|custom/i, (msg, match) => {
    const chatId = msg.chat.id;
    const text = match[0].toLowerCase();
    
    let selectedStyle = 'push_pull_legs';
    if (text.includes('full')) selectedStyle = 'full_body';
    else if (text.includes('upper') || text.includes('lower')) selectedStyle = 'upper_lower';
    else if (text.includes('bro')) selectedStyle = 'bro_split';
    else if (text.includes('custom')) selectedStyle = 'custom';
    else if (text.includes('push') || text.includes('pull')) selectedStyle = 'push_pull_legs';
    
    // Save style
    let profile = userProfiles.get(chatId) || {};
    profile.style = selectedStyle;
    userProfiles.set(chatId, profile);
    
    const styleName = WORKOUT_STYLES[selectedStyle].name;
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const todayEx = getExercisesForDay(today, selectedStyle);
    const exList = todayEx.map(ex => `   ${ex.icon} ${ex.name} (${ex.defaultSets}×${ex.defaultReps})`).join('\n');
    
    bot.sendMessage(chatId, `
✅ *Style updated!* 🎉

📋 *${styleName}* selected

📅 *Today's Workout (${today}):*
${exList || '   • Rest day - take it easy! 😊'}

━━━━━━━━━━━━━━━━━━━━━

*Ready to crush it?* 💪
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

🎯 *Commands:*
/start - Welcome & set up profile
/schedule - View your workout schedule
/style - Change workout style
/progress - View your stats & progress
/exercises - See all exercises
/help - This help message

━━━━━━━━━━━━━━━━━━━━━

⏰ *Set Workout Time:*
Send a message like "10:00 PM" or "6:30 AM"
I'll remind you daily at that time!

━━━━━━━━━━━━━━━━━━━━━

🏋️ *Workout Styles:*
• Push/Pull/Legs (3-day split)
• Full Body (3x/week)
• Upper/Lower (4x/week)
• Bro Split (6-day)
• Custom (your own)

━━━━━━━━━━━━━━━━━━━━━

💡 *Tips:*
• Good lighting for camera
• Stand 2-3m away
• Wear fitted clothes

━━━━━━━━━━━━━━━━━━━━━

*Tap the button below to start!* 🏋️
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
        bot.emit('text', { chat: { id: chatId }, text: '/schedule' });
        break;
      case 'progress':
        bot.emit('text', { chat: { id: chatId }, text: '/progress' });
        break;
      case 'exercises':
        bot.emit('text', { chat: { id: chatId }, text: '/exercises' });
        break;
      case 'style':
        bot.emit('text', { chat: { id: chatId }, text: '/style' });
        break;
      case 'set_time':
        bot.sendMessage(chatId, `
⏰ *Set Your Workout Time*

Reply with your preferred workout time.
Examples: *10:00 PM* or *6:30 AM*

I'll remind you daily at that time! 🕐
        `, { parse_mode: 'Markdown' });
        break;
      case 'help':
        bot.emit('text', { chat: { id: chatId }, text: '/help' });
        break;
      default:
        bot.answerCallbackQuery(callbackQuery.id, { text: 'Coming soon! 🚀' });
    }
    bot.answerCallbackQuery(callbackQuery.id);
  });

  // ─── Reminder System ──────────────────────────────────────────
  // Check every minute for users who need reminders
  setInterval(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    userWorkTimes.forEach((data, chatId) => {
      if (!data.time) return;
      
      // Parse time like "10:00 PM"
      const timeParts = data.time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (!timeParts) return;
      
      let hours = parseInt(timeParts[1]);
      const minutes = parseInt(timeParts[2]);
      const meridiem = timeParts[3].toUpperCase();
      
      if (meridiem === 'AM' && hours === 12) hours = 0;
      if (meridiem === 'PM' && hours < 12) hours += 12;
      
      // Check if current time matches (within 2 minute window)
      const timeDiff = (currentHour * 60 + currentMinute) - (hours * 60 + minutes);
      if (Math.abs(timeDiff) <= 2) {
        const session = userSessions.get(chatId);
        const firstName = session?.firstName || 'Athlete';
        
        bot.sendPhoto(chatId, MOTIVATION_IMAGE_URL, {
          caption: getTimeReminderMessage(firstName, data.time),
          parse_mode: 'Markdown',
          ...getMainKeyboard()
        });
      }
    });
  }, 60000); // Check every minute

  console.log('✅ Bot handlers registered');
  console.log('⏰ Reminder system active');
  console.log(`📷 Motivation image: ${MOTIVATION_IMAGE_URL}`);
}

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
    users: userProfiles.size
  });
});

// Get motivation image URL
app.get('/api/motivation', (req, res) => {
  res.json({
    imageUrl: MOTIVATION_IMAGE_URL,
    quotes: MOTIVATIONAL_QUOTES
  });
});

// ─── User Profile Routes ──────────────────────────────────────

app.post('/api/profile', (req, res) => {
  const { userId, weight, height, protein, calories, goal, style } = req.body;
  if (!userId || !weight || !height) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  userProfiles.set(userId, {
    weight: parseFloat(weight),
    height: parseFloat(height),
    protein: parseFloat(protein) || weight * 1.8,
    calories: parseFloat(calories) || 2000,
    goal: goal || 'muscle_gain',
    style: style || 'push_pull_legs',
    createdAt: new Date().toISOString()
  });

  const nutrition = calculateNutrition(parseFloat(weight), parseFloat(height), 30, goal || 'muscle_gain');

  res.json({
    success: true,
    profile: userProfiles.get(userId),
    nutrition
  });
});

app.get('/api/profile/:userId', (req, res) => {
  const { userId } = req.params;
  const profile = userProfiles.get(userId);
  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }
  const nutrition = calculateNutrition(profile.weight, profile.height, 30, profile.goal);
  const workTime = userWorkTimes.get(userId);
  res.json({ profile, nutrition, workTime });
});

// ─── Schedule Routes ──────────────────────────────────────────

app.get('/api/schedule/today/:userId', (req, res) => {
  const { userId } = req.params;
  const profile = userProfiles.get(userId);
  const style = profile?.style || 'push_pull_legs';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const exercises = getExercisesForDay(today, style);
  res.json({ day: today, exercises });
});

app.get('/api/schedule/:userId', (req, res) => {
  const { userId } = req.params;
  const profile = userProfiles.get(userId);
  const style = profile?.style || 'push_pull_legs';
  const schedule = getStyleSchedule(style);
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const fullSchedule = {};
  days.forEach(day => {
    fullSchedule[day] = {
      name: schedule.schedule[day]?.name || 'Rest',
      exercises: getExercisesForDay(day, style)
    };
  });
  res.json({ style: schedule.name, schedule: fullSchedule });
});

app.post('/api/schedule/style', (req, res) => {
  const { userId, style } = req.body;
  if (!userId || !style) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const profile = userProfiles.get(userId) || {};
  profile.style = style;
  userProfiles.set(userId, profile);
  res.json({ success: true, style });
});

// ─── Exercise Routes ──────────────────────────────────────────

app.get('/api/exercises', (req, res) => {
  const exercises = Object.keys(EXERCISE_DB).map(key => ({
    id: key,
    ...EXERCISE_DB[key]
  }));
  res.json(exercises);
});

app.get('/api/exercises/:id', (req, res) => {
  const ex = EXERCISE_DB[req.params.id];
  if (!ex) {
    return res.status(404).json({ error: 'Exercise not found' });
  }
  res.json(ex);
});

// ─── Workout Time Routes ──────────────────────────────────────

app.post('/api/worktime', (req, res) => {
  const { userId, time } = req.body;
  if (!userId || !time) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  userWorkTimes.set(userId, { time, setAt: new Date().toISOString() });
  res.json({ success: true, time });
});

app.get('/api/worktime/:userId', (req, res) => {
  const { userId } = req.params;
  const workTime = userWorkTimes.get(userId);
  res.json({ workTime });
});

// ─── Video Upload ─────────────────────────────────────────────

app.post('/api/upload', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video uploaded' });
  }
  const { userId, exercise } = req.body;
  const metadata = {
    filename: req.file.filename,
    exercise: exercise || 'unknown',
    userId: userId || 'anonymous',
    timestamp: new Date().toISOString(),
    size: req.file.size,
    url: `/uploads/${req.file.filename}`
  };
  const metaPath = req.file.path + '.meta.json';
  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
  res.json({ success: true, message: 'Video uploaded', ...metadata });
});

// ─── Static Files ─────────────────────────────────────────────

app.use('/uploads', express.static(UPLOAD_DIR));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/tg', (req, res) => {
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

// ─── Start Server ──────────────────────────────────────────────

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n========================================');
  console.log('🏋️ AI Gym Trainer Server');
  console.log('========================================');
  console.log(`🚀 Running on: http://localhost:${PORT}`);
  console.log(`📁 Uploads: ${UPLOAD_DIR}`);
  console.log(`🤖 Bot: @${process.env.TELEGRAM_BOT_USERNAME || 'Not configured'}`);
  console.log(`🌐 Mini App: ${MINI_APP_URL}`);
  console.log(`📷 Motivation Image: ${MOTIVATION_IMAGE_URL}`);
  console.log(`📊 Exercises: ${Object.keys(EXERCISE_DB).length}`);
  console.log(`📅 Workout Styles: ${Object.keys(WORKOUT_STYLES).length}`);
  console.log('========================================\n');
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
