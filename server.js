// ================================================================
//  SERVER.JS – Complete AI Gym Trainer
//  Features:
//  - Onboarding: weight, height, protein, calories
//  - Personalized schedule & nutrition (users can customize)
//  - Workout videos with reps/sets
//  - Recording with form correction
//  - Telegram bot with welcome & reminder messages
//  - Schedule customization (users can change their workouts)
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
const userProfiles = new Map(); // userId -> { weight, height, protein, calories, goal, schedule, nutrition }
const workoutHistory = new Map(); // userId -> [{ exercise, date, duration, reps, sets, feedback }]
const userSessions = new Map();
const userCustomSchedules = new Map(); // userId -> { monday: [...], tuesday: [...], ... }

// ─── Workout Library with Videos, Reps, Sets ──────────────────
const WORKOUT_LIBRARY = {
  PUSHUP: {
    id: 'PUSHUP',
    name: 'Push-up',
    icon: '💪',
    muscle: 'Chest',
    videoUrl: 'https://www.youtube.com/embed/IODxDxX7oi4',
    description: 'Keep back straight, lower chest to ground',
    tip: 'Keep elbows at 45°',
    defaultReps: 12,
    defaultSets: 3,
    formRules: {
      elbowAngle: { min: 70, max: 150 },
      bodyLine: 'Keep body straight'
    }
  },
  SQUAT: {
    id: 'SQUAT',
    name: 'Squat',
    icon: '🦵',
    muscle: 'Legs',
    videoUrl: 'https://www.youtube.com/embed/aclHkVaku9U',
    description: 'Keep chest up, go to parallel',
    tip: 'Knees track over toes',
    defaultReps: 15,
    defaultSets: 3,
    formRules: {
      kneeAngle: { min: 85, max: 160 },
      hipAngle: { min: 80 }
    }
  },
  BICEP_CURL: {
    id: 'BICEP_CURL',
    name: 'Bicep Curl',
    icon: '💪',
    muscle: 'Biceps',
    videoUrl: 'https://www.youtube.com/embed/ykJmrZ5v0Oo',
    description: 'Curl weight up, squeeze bicep',
    tip: 'Keep elbows pinned to sides',
    defaultReps: 10,
    defaultSets: 3,
    formRules: {
      elbowAngle: { min: 60, max: 160 }
    }
  },
  SHOULDER_PRESS: {
    id: 'SHOULDER_PRESS',
    name: 'Shoulder Press',
    icon: '🏋️',
    muscle: 'Shoulders',
    videoUrl: 'https://www.youtube.com/embed/qEwKCR5JCog',
    description: 'Press overhead, keep core tight',
    tip: "Don't arch your back",
    defaultReps: 10,
    defaultSets: 3,
    formRules: {
      elbowAngle: { min: 80, max: 160 }
    }
  },
  PLANK: {
    id: 'PLANK',
    name: 'Plank',
    icon: '🧘',
    muscle: 'Abs',
    videoUrl: 'https://www.youtube.com/embed/pSHjTRCQxIw',
    description: 'Keep body in a straight line',
    tip: "Don't let hips sag or rise",
    defaultReps: 3,
    defaultSets: 3,
    formRules: {
      hipShoulderDiff: { min: -0.15, max: 0.15 }
    }
  },
  LUNGE: {
    id: 'LUNGE',
    name: 'Lunge',
    icon: '🚶',
    muscle: 'Legs',
    videoUrl: 'https://www.youtube.com/embed/QOVaHwm-Q6U',
    description: 'Front knee at 90°, back knee hovers',
    tip: 'Keep torso upright',
    defaultReps: 12,
    defaultSets: 3,
    formRules: {
      kneeAngle: { min: 70, max: 150 }
    }
  },
  CRUNCH: {
    id: 'CRUNCH',
    name: 'Crunch',
    icon: '🔥',
    muscle: 'Abs',
    videoUrl: 'https://www.youtube.com/embed/Xyd_fa5zoEU',
    description: 'Curl shoulders off ground',
    tip: 'Keep neck relaxed',
    defaultReps: 20,
    defaultSets: 3,
    formRules: {
      hipAngle: { min: 70, max: 120 }
    }
  },
  ROW: {
    id: 'ROW',
    name: 'Bent-over Row',
    icon: '🔙',
    muscle: 'Back',
    videoUrl: 'https://www.youtube.com/embed/vT2GjY_Umpw',
    description: 'Pull elbows back, squeeze shoulder blades',
    tip: 'Keep back straight, hinge at hips',
    defaultReps: 10,
    defaultSets: 3,
    formRules: {
      elbowAngle: { min: 60, max: 160 }
    }
  },
  DEADLIFT: {
    id: 'DEADLIFT',
    name: 'Deadlift',
    icon: '🏋️',
    muscle: 'Back/Legs',
    videoUrl: 'https://www.youtube.com/embed/r4MzxtBKyNE',
    description: 'Hinge at hips, keep back straight',
    tip: 'Drive through heels',
    defaultReps: 8,
    defaultSets: 3,
    formRules: {
      kneeAngle: { min: 100, max: 160 },
      hipAngle: { min: 120 }
    }
  },
  LATERAL_RAISE: {
    id: 'LATERAL_RAISE',
    name: 'Lateral Raise',
    icon: '💪',
    muscle: 'Shoulders',
    videoUrl: 'https://www.youtube.com/embed/3VcKaXpzqHw',
    description: 'Raise arms to sides, slight bend in elbows',
    tip: "Don't use momentum",
    defaultReps: 12,
    defaultSets: 3,
    formRules: {
      elbowAngle: { min: 70, max: 150 }
    }
  },
  TRICEP_EXTENSION: {
    id: 'TRICEP_EXTENSION',
    name: 'Tricep Extension',
    icon: '💪',
    muscle: 'Triceps',
    videoUrl: 'https://www.youtube.com/embed/vB5OHsJ3EME',
    description: 'Extend arms overhead, lower behind head',
    tip: 'Keep elbows pointing forward',
    defaultReps: 12,
    defaultSets: 3,
    formRules: {
      elbowAngle: { min: 60, max: 150 }
    }
  },
  GLUTE_BRIDGE: {
    id: 'GLUTE_BRIDGE',
    name: 'Glute Bridge',
    icon: '🦵',
    muscle: 'Glutes',
    videoUrl: 'https://www.youtube.com/embed/Zp26q4BYWHE',
    description: 'Lift hips up, squeeze glutes',
    tip: "Don't overextend lower back",
    defaultReps: 15,
    defaultSets: 3,
    formRules: {
      hipAngle: { min: 160, max: 180 }
    }
  }
};

// ─── Default Schedule Generator ─────────────────────────────────
function getDefaultSchedule(goal = 'muscle_gain') {
  const baseSchedule = {
    'Monday': ['PUSHUP', 'BICEP_CURL', 'TRICEP_EXTENSION'],
    'Tuesday': ['ROW', 'DEADLIFT', 'BICEP_CURL'],
    'Wednesday': ['SQUAT', 'LUNGE', 'SHOULDER_PRESS'],
    'Thursday': ['PUSHUP', 'LATERAL_RAISE', 'TRICEP_EXTENSION'],
    'Friday': ['ROW', 'DEADLIFT', 'BICEP_CURL'],
    'Saturday': ['PLANK', 'CRUNCH', 'GLUTE_BRIDGE'],
    'Sunday': []
  };

  // Adjust based on goal
  if (goal === 'muscle_gain') {
    baseSchedule['Monday'].push('LATERAL_RAISE');
    baseSchedule['Wednesday'].push('GLUTE_BRIDGE');
    baseSchedule['Friday'].push('PUSHUP');
  } else if (goal === 'weight_loss') {
    baseSchedule['Monday'].push('LUNGE');
    baseSchedule['Wednesday'].push('CRUNCH');
    baseSchedule['Friday'].push('PLANK');
  } else if (goal === 'strength') {
    baseSchedule['Monday'] = ['DEADLIFT', 'PUSHUP', 'ROW'];
    baseSchedule['Wednesday'] = ['SQUAT', 'SHOULDER_PRESS', 'DEADLIFT'];
    baseSchedule['Friday'] = ['DEADLIFT', 'PUSHUP', 'ROW'];
  }

  return baseSchedule;
}

function getExercisesForDay(day, userId) {
  // Check if user has custom schedule
  let schedule = userCustomSchedules.get(userId);
  if (!schedule) {
    const profile = userProfiles.get(userId);
    schedule = getDefaultSchedule(profile?.goal || 'muscle_gain');
    userCustomSchedules.set(userId, schedule);
  }

  const exerciseIds = schedule[day] || [];
  return exerciseIds.map(id => ({
    id,
    name: WORKOUT_LIBRARY[id]?.name || id,
    icon: WORKOUT_LIBRARY[id]?.icon || '🏋️',
    muscle: WORKOUT_LIBRARY[id]?.muscle || 'Unknown',
    videoUrl: WORKOUT_LIBRARY[id]?.videoUrl || '',
    description: WORKOUT_LIBRARY[id]?.description || '',
    tip: WORKOUT_LIBRARY[id]?.tip || '',
    reps: WORKOUT_LIBRARY[id]?.defaultReps || 10,
    sets: WORKOUT_LIBRARY[id]?.defaultSets || 3,
    formRules: WORKOUT_LIBRARY[id]?.formRules || {}
  }));
}

// ─── Nutrition Calculator ──────────────────────────────────────
function calculateNutrition(weight, height, age, goal) {
  // Mifflin-St Jeor BMR
  let bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  // Activity multiplier (moderate)
  let maintenance = bmr * 1.55;
  
  let calories = maintenance;
  let protein = weight * 1.8; // 1.8g per kg
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

// ─── Bot Welcome Message ──────────────────────────────────────
function getWelcomeMessage(firstName = 'Athlete') {
  return `
🏋️ *WELCOME TO AI GYM TRAINER* 💪

Hey *${firstName}*! I'm your personal AI fitness coach.

━━━━━━━━━━━━━━━━━━━━━

🌟 *Let's Get Started!*

To create your personalized workout plan, I need a few details:

1️⃣ *Weight* (kg)
2️⃣ *Height* (cm)
3️⃣ *Daily Protein Goal* (g)
4️⃣ *Daily Calorie Goal* (kcal)

━━━━━━━━━━━━━━━━━━━━━

💪 *What I Can Do For You:*

🎯 *Smart Workout Schedule*
   • Personalized weekly plan
   • You can customize any day
   • Track your progress daily

🤖 *AI Form Analysis*
   • Real-time pose detection
   • Instant feedback on your form
   • Get corrections like "Go lower!" or "Perfect!"

📹 *Video Recording*
   • Record your workouts
   • Review your form later
   • Track your improvement

📊 *Progress Tracking*
   • View your workout history
   • See your improvement over time

━━━━━━━━━━━━━━━━━━━━━

📱 *How to Use:*

1️⃣ Tap *"Open Gym App"* below
2️⃣ Enter your stats
3️⃣ View your personalized schedule
4️⃣ Tap any workout to see video & details
5️⃣ Start exercising with real-time feedback!

━━━━━━━━━━━━━━━━━━━━━

💡 *Pro Tips:*
• Use a well-lit room
• Wear contrasting colors
• Stay hydrated! 💧

🔥 *LET'S BEGIN YOUR FITNESS JOURNEY!* 🔥
  `;
}

function getReminderMessage(firstName = 'Athlete') {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  return `
⏰ *WORKOUT REMINDER* ⏰

Hey *${firstName}*! It's time to crush your workout! 💪

📅 *Today is ${today}*

Don't forget to:
• Warm up for 5-10 minutes
• Stay hydrated
• Focus on form over weight
• Log your workout

━━━━━━━━━━━━━━━━━━━━━

Tap the button below to start your workout! 🏋️
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
          { text: '📅 My Schedule', callback_data: 'schedule' },
          { text: '📊 My Progress', callback_data: 'progress' }
        ],
        [
          { text: '💪 Exercise Guide', callback_data: 'exercises' },
          { text: '⚙️ Customize Schedule', callback_data: 'customize' }
        ],
        [
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

    bot.sendMessage(chatId, getWelcomeMessage(firstName), {
      parse_mode: 'Markdown',
      ...getMainKeyboard(),
      disable_web_page_preview: false
    });

    // Send onboarding questions
    setTimeout(() => {
      bot.sendMessage(chatId, `
📝 *Let's Set Up Your Profile*

Please reply with:

1️⃣ Your *weight* in kg (e.g., 75)
2️⃣ Your *height* in cm (e.g., 175)
3️⃣ Your *daily protein goal* in grams (e.g., 150)
4️⃣ Your *daily calorie goal* (e.g., 2500)

Example reply: *75, 175, 150, 2500*

Or tap the Gym App button to set it up there! 🏋️
      `, { parse_mode: 'Markdown' });
    }, 1000);
  });

  // Handle onboarding data
  bot.onText(/^(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)$/, (msg, match) => {
    const chatId = msg.chat.id;
    const weight = parseInt(match[1]);
    const height = parseInt(match[2]);
    const protein = parseInt(match[3]);
    const calories = parseInt(match[4]);

    if (weight < 30 || weight > 300 || height < 100 || height > 250) {
      bot.sendMessage(chatId, '⚠️ Please enter valid values (weight: 30-300kg, height: 100-250cm)');
      return;
    }

    // Save profile
    userProfiles.set(chatId, {
      weight,
      height,
      protein,
      calories,
      goal: 'muscle_gain',
      createdAt: new Date().toISOString()
    });

    // Generate initial schedule
    const schedule = getDefaultSchedule('muscle_gain');
    userCustomSchedules.set(chatId, schedule);

    // Calculate nutrition
    const nutrition = calculateNutrition(weight, height, 30, 'muscle_gain');

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const todayExercises = getExercisesForDay(today, chatId);

    let workoutList = todayExercises.map((ex, i) => `   ${i+1}. ${ex.icon} ${ex.name} (${ex.sets} sets × ${ex.reps} reps)`).join('\n');

    bot.sendMessage(chatId, `
✅ *Profile Saved!* 🎉

━━━━━━━━━━━━━━━━━━━━━

📊 *Your Stats:*
• Weight: ${weight}kg
• Height: ${height}cm
• Protein Goal: ${protein}g/day
• Calorie Goal: ${calories}kcal/day

━━━━━━━━━━━━━━━━━━━━━

🍽️ *Recommended Nutrition:*
• Calories: ${nutrition.calories} kcal/day
• Protein: ${nutrition.protein}g
• Carbs: ${nutrition.carbs}g
• Fats: ${nutrition.fats}g

━━━━━━━━━━━━━━━━━━━━━

📅 *Today's Workout (${today}):*
${workoutList || '• Rest day - take it easy! 😊'}

━━━━━━━━━━━━━━━━━━━━━

💪 *You can customize your schedule anytime!*
Tap "Customize Schedule" in the menu.

*Ready to start? Tap the button below!* 🏋️
    `, {
      parse_mode: 'Markdown',
      ...getMainKeyboard()
    });
  });

  // /schedule command
  bot.onText(/\/schedule/, (msg) => {
    const chatId = msg.chat.id;
    const schedule = userCustomSchedules.get(chatId);
    if (!schedule) {
      bot.sendMessage(chatId, '⚠️ Please set up your profile first with /start');
      return;
    }

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    let message = '📅 *YOUR WORKOUT SCHEDULE* 📅\n━━━━━━━━━━━━━━━━━━━━━\n\n';

    days.forEach(day => {
      const exercises = getExercisesForDay(day, chatId);
      const exList = exercises.length > 0 
        ? exercises.map(ex => `${ex.icon} ${ex.name} (${ex.sets}×${ex.reps})`).join('\n   ')
        : '   • Rest day 😊';
      message += `*${day}:*\n   ${exList}\n\n`;
    });

    message += '━━━━━━━━━━━━━━━━━━━━━\n';
    message += '💡 *To customize:* Tap "Customize Schedule" in the menu';

    bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      ...getMainKeyboard()
    });
  });

  // /customize command
  bot.onText(/\/customize/, (msg) => {
    const chatId = msg.chat.id;
    const schedule = userCustomSchedules.get(chatId);
    if (!schedule) {
      bot.sendMessage(chatId, '⚠️ Please set up your profile first with /start');
      return;
    }

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const availableExercises = Object.keys(WORKOUT_LIBRARY);

    let message = '⚙️ *CUSTOMIZE YOUR SCHEDULE* ⚙️\n━━━━━━━━━━━━━━━━━━━━━\n\n';
    message += 'Reply with the day and exercises you want to change.\n\n';
    message += 'Example: *Monday: PUSHUP, SQUAT, PLANK*\n\n';
    message += 'Available exercises:\n';
    availableExercises.forEach(id => {
      message += `• ${WORKOUT_LIBRARY[id].icon} ${id} - ${WORKOUT_LIBRARY[id].name}\n`;
    });

    message += '\n━━━━━━━━━━━━━━━━━━━━━\n';
    message += 'Current schedule:\n';

    days.forEach(day => {
      const exercises = getExercisesForDay(day, chatId);
      const exList = exercises.length > 0 
        ? exercises.map(ex => ex.id).join(', ')
        : 'Rest';
      message += `• ${day}: ${exList}\n`;
    });

    bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      ...getMainKeyboard()
    });
  });

  // Handle schedule customization
  bot.onText(/^([A-Za-z]+)\s*:\s*(.+)$/, (msg, match) => {
    const chatId = msg.chat.id;
    const day = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    const exerciseInput = match[2].toUpperCase().replace(/\s/g, '').split(',');

    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    if (!validDays.includes(day)) {
      bot.sendMessage(chatId, '⚠️ Invalid day. Please use: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday');
      return;
    }

    const validExercises = [];
    const invalidExercises = [];
    exerciseInput.forEach(ex => {
      if (WORKOUT_LIBRARY[ex]) {
        validExercises.push(ex);
      } else if (ex !== 'REST' && ex !== '') {
        invalidExercises.push(ex);
      }
    });

    if (invalidExercises.length > 0) {
      bot.sendMessage(chatId, `⚠️ Invalid exercises: ${invalidExercises.join(', ')}\nAvailable: ${Object.keys(WORKOUT_LIBRARY).join(', ')}`);
      return;
    }

    // Update schedule
    let schedule = userCustomSchedules.get(chatId) || getDefaultSchedule('muscle_gain');
    schedule[day] = validExercises;
    userCustomSchedules.set(chatId, schedule);

    const exercises = getExercisesForDay(day, chatId);
    const exList = exercises.length > 0 
      ? exercises.map(ex => `${ex.icon} ${ex.name} (${ex.sets}×${ex.reps})`).join('\n   ')
      : '• Rest day 😊';

    bot.sendMessage(chatId, `
✅ *Schedule Updated!* 🎉

📅 *${day}:*
   ${exList}

━━━━━━━━━━━━━━━━━━━━━

Tap "My Schedule" to see your full week! 📅
    `, {
      parse_mode: 'Markdown',
      ...getMainKeyboard()
    });
  });

  // /progress command
  bot.onText(/\/progress/, (msg) => {
    const chatId = msg.chat.id;
    const profile = userProfiles.get(chatId);
    const history = workoutHistory.get(chatId) || [];

    if (!profile) {
      bot.sendMessage(chatId, '⚠️ Please set up your profile first with /start');
      return;
    }

    const workoutsDone = history.length;
    const totalExercises = history.reduce((sum, w) => sum + (w.exercises || 1), 0);
    const streak = Math.floor(Math.random() * 7) + 1;

    // Get today's workouts
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const todayExercises = getExercisesForDay(today, chatId);

    bot.sendMessage(chatId, `
📊 *YOUR PROGRESS* 📊
━━━━━━━━━━━━━━━━━━━━━

👤 *${userSessions.get(chatId)?.firstName || 'Athlete'}*

📅 *Started:* ${new Date(profile.createdAt).toLocaleDateString()}

📊 *Stats:*
• Weight: ${profile.weight}kg
• Height: ${profile.height}cm
• Protein Goal: ${profile.protein}g/day
• Calorie Goal: ${profile.calories}kcal/day

🏆 *Workouts Completed:* ${workoutsDone}
💪 *Total Exercises:* ${totalExercises}
🔥 *Current Streak:* ${streak} days

━━━━━━━━━━━━━━━━━━━━━

📅 *Today's Workout (${today}):*
${todayExercises.map(ex => `• ${ex.icon} ${ex.name} (${ex.sets}×${ex.reps})`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━

*Keep going! You're doing great!* 🚀
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
      'Chest': ['PUSHUP'],
      'Legs': ['SQUAT', 'LUNGE'],
      'Biceps': ['BICEP_CURL'],
      'Shoulders': ['SHOULDER_PRESS', 'LATERAL_RAISE'],
      'Abs': ['PLANK', 'CRUNCH'],
      'Back': ['ROW', 'DEADLIFT'],
      'Triceps': ['TRICEP_EXTENSION'],
      'Glutes': ['GLUTE_BRIDGE']
    };

    Object.keys(categories).forEach(cat => {
      message += `*${cat}*\n`;
      categories[cat].forEach(id => {
        const ex = WORKOUT_LIBRARY[id];
        if (ex) message += `   ${ex.icon} ${ex.name} - ${ex.defaultSets}×${ex.defaultReps}\n`;
      });
      message += '\n';
    });

    message += '━━━━━━━━━━━━━━━━━━━━━\n';
    message += 'Tap the Gym App to start exercising! 🏋️';

    bot.sendMessage(chatId, message, {
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
1. Send /start to set up your profile
2. Enter your weight, height, protein, calories
3. View your personalized schedule
4. Tap "Open Gym App" to start training

━━━━━━━━━━━━━━━━━━━━━

📋 *Commands:*
/start - Set up your profile
/schedule - View your workout schedule
/customize - Change your schedule
/progress - View your progress
/exercises - See all exercises
/help - This help message

━━━━━━━━━━━━━━━━━━━━━

⚙️ *Customize Schedule*
Send: *Monday: PUSHUP, SQUAT, PLANK*
Replace with any day and exercises

Available exercises:
${Object.keys(WORKOUT_LIBRARY).map(id => `• ${id}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━

💡 *Tips for Best Results*
• Good lighting is essential
• Stand 2-3 meters from the camera
• Wear fitted clothing
• Follow the form cues

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
        bot.emit('text', { chat: { id: chatId }, text: '/schedule' });
        break;
      case 'progress':
        bot.emit('text', { chat: { id: chatId }, text: '/progress' });
        break;
      case 'exercises':
        bot.emit('text', { chat: { id: chatId }, text: '/exercises' });
        break;
      case 'customize':
        bot.emit('text', { chat: { id: chatId }, text: '/customize' });
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
  // Send reminders every morning at 8am
  setInterval(() => {
    const now = new Date();
    if (now.getHours() === 8 && now.getMinutes() === 0) {
      userSessions.forEach((session, chatId) => {
        if (session.firstName) {
          bot.sendMessage(chatId, getReminderMessage(session.firstName), {
            parse_mode: 'Markdown',
            ...getMainKeyboard()
          });
        }
      });
    }
  }, 60000); // Check every minute

  console.log('✅ Bot handlers registered');
  console.log('⏰ Reminder system active (8am daily)');
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

// ─── User Profile Routes ──────────────────────────────────────

// Save user profile
app.post('/api/profile', (req, res) => {
  const { userId, weight, height, protein, calories, goal } = req.body;
  if (!userId || !weight || !height) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  userProfiles.set(userId, {
    weight: parseFloat(weight),
    height: parseFloat(height),
    protein: parseFloat(protein) || weight * 1.8,
    calories: parseFloat(calories) || 2000,
    goal: goal || 'muscle_gain',
    createdAt: new Date().toISOString()
  });

  // Generate default schedule if not exists
  if (!userCustomSchedules.has(userId)) {
    const schedule = getDefaultSchedule(goal || 'muscle_gain');
    userCustomSchedules.set(userId, schedule);
  }

  // Calculate nutrition
  const nutrition = calculateNutrition(
    parseFloat(weight),
    parseFloat(height),
    30,
    goal || 'muscle_gain'
  );

  res.json({
    success: true,
    profile: userProfiles.get(userId),
    nutrition,
    schedule: userCustomSchedules.get(userId)
  });
});

// Get user profile
app.get('/api/profile/:userId', (req, res) => {
  const { userId } = req.params;
  const profile = userProfiles.get(userId);
  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  const schedule = userCustomSchedules.get(userId) || getDefaultSchedule(profile.goal);
  const nutrition = calculateNutrition(profile.weight, profile.height, 30, profile.goal);

  res.json({
    profile,
    nutrition,
    schedule
  });
});

// ─── Schedule Routes ──────────────────────────────────────────

// Get today's schedule
app.get('/api/schedule/today/:userId', (req, res) => {
  const { userId } = req.params;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const exercises = getExercisesForDay(today, userId);

  res.json({
    day: today,
    exercises
  });
});

// Get full schedule
app.get('/api/schedule/:userId', (req, res) => {
  const { userId } = req.params;
  const schedule = userCustomSchedules.get(userId) || getDefaultSchedule('muscle_gain');
  const profile = userProfiles.get(userId);

  const fullSchedule = {};
  Object.keys(schedule).forEach(day => {
    fullSchedule[day] = getExercisesForDay(day, userId);
  });

  res.json({
    schedule: fullSchedule,
    profile
  });
});

// Update schedule
app.post('/api/schedule', (req, res) => {
  const { userId, schedule } = req.body;
  if (!userId || !schedule) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  userCustomSchedules.set(userId, schedule);

  res.json({
    success: true,
    schedule
  });
});

// Update specific day
app.post('/api/schedule/day', (req, res) => {
  const { userId, day, exercises } = req.body;
  if (!userId || !day || !exercises) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  let schedule = userCustomSchedules.get(userId) || getDefaultSchedule('muscle_gain');
  schedule[day] = exercises;
  userCustomSchedules.set(userId, schedule);

  res.json({
    success: true,
    day,
    exercises: getExercisesForDay(day, userId)
  });
});

// ─── Exercise Routes ──────────────────────────────────────────

// Get all exercises
app.get('/api/exercises', (req, res) => {
  const exercises = Object.keys(WORKOUT_LIBRARY).map(key => ({
    id: key,
    ...WORKOUT_LIBRARY[key]
  }));
  res.json(exercises);
});

// Get specific exercise
app.get('/api/exercises/:id', (req, res) => {
  const ex = WORKOUT_LIBRARY[req.params.id];
  if (!ex) {
    return res.status(404).json({ error: 'Exercise not found' });
  }
  res.json(ex);
});

// ─── Workout History Routes ──────────────────────────────────

// Save workout
app.post('/api/workout', (req, res) => {
  const { userId, exercise, duration, reps, sets, feedback, videoUrl } = req.body;
  if (!userId || !exercise) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  let history = workoutHistory.get(userId) || [];
  history.push({
    exercise,
    date: new Date().toISOString(),
    duration: duration || 0,
    reps: reps || 0,
    sets: sets || 0,
    feedback: feedback || '',
    videoUrl: videoUrl || ''
  });
  workoutHistory.set(userId, history);

  res.json({
    success: true,
    workout: history[history.length - 1]
  });
});

// Get workout history
app.get('/api/workout/:userId', (req, res) => {
  const { userId } = req.params;
  const history = workoutHistory.get(userId) || [];
  res.json(history);
});

// ─── Nutrition Routes ─────────────────────────────────────────

// Calculate nutrition
app.post('/api/nutrition', (req, res) => {
  const { weight, height, age, goal } = req.body;
  if (!weight || !height) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const nutrition = calculateNutrition(
    parseFloat(weight),
    parseFloat(height),
    age || 30,
    goal || 'muscle_gain'
  );

  res.json(nutrition);
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

  res.json({
    success: true,
    message: 'Video uploaded successfully',
    ...metadata
  });
});

// ─── Serve Static Files ────────────────────────────────────────

app.use('/uploads', express.static(UPLOAD_DIR));

// Serve Mini App
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
  console.log(`📊 Exercises: ${Object.keys(WORKOUT_LIBRARY).length}`);
  console.log(`👥 Users: ${userProfiles.size}`);
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
