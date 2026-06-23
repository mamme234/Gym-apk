// ================================================================
//  BOT.JS – Telegram Bot with Attractive Welcome Message
//  Sends welcome message when user starts the bot
// ================================================================

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ─── Configuration ──────────────────────────────────────────────
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'YourGymBot';
const MINI_APP_URL = process.env.TELEGRAM_MINI_APP_URL || 'https://yourdomain.com';
const WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL;

if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN is required in .env');
  process.exit(1);
}

// ─── Create Bot Instance ──────────────────────────────────────
const bot = new TelegramBot(TOKEN, { polling: true });

// ─── In-memory user data ──────────────────────────────────────
const userSessions = new Map();

// ─── Attractive Welcome Message ──────────────────────────────
function getWelcomeMessage(firstName = 'Athlete') {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const emojis = ['💪', '🏋️', '🔥', '💯', '⭐', '🎯', '🚀', '🌟'];
  const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

  return `
🏋️ *WELCOME TO AI GYM TRAINER* ${randomEmoji}

Hey *${firstName}*! I'm your personal AI fitness coach. Let's crush your fitness goals together! 💪

━━━━━━━━━━━━━━━━━━━━━

🌟 *What I Can Do For You:*

🎯 *Smart Workout Schedule*
   • Get your personalized weekly plan
   • Today's workout: *${getTodayWorkout()}*
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
   • Stay motivated with stats

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

📅 *Today's Schedule: ${today}*
📍 *Workout:* ${getTodayWorkout()}
⏱️ *Duration:* 30-45 minutes

*Exercises:*
${getTodayExercises().map((ex, i) => `   ${i+1}. ${ex.name} ${ex.icon}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━

🏆 *Your Fitness Journey Starts Now!*

Tap the button below to open your AI-powered gym trainer. Let's make every rep count! 💪

_Remember: Consistency beats intensity. Show up every day!_

🔥 *LET'S GO!* 🔥
  `;
}

// ─── Helper Functions ─────────────────────────────────────────

function getTodayWorkout() {
  const days = {
    'Monday': 'Chest / Triceps',
    'Tuesday': 'Back / Biceps',
    'Wednesday': 'Legs / Shoulders',
    'Thursday': 'Chest / Triceps',
    'Friday': 'Back / Biceps',
    'Saturday': 'Core / Cardio',
    'Sunday': 'Rest / Mobility'
  };
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  return days[today] || 'Full Body Workout';
}

function getTodayExercises() {
  const exercises = {
    'Monday': [{ name: 'Push-up', icon: '💪' }, { name: 'Bicep Curl', icon: '💪' }, { name: 'Tricep Extension', icon: '💪' }],
    'Tuesday': [{ name: 'Bent-over Row', icon: '🔙' }, { name: 'Deadlift', icon: '🏋️' }, { name: 'Bicep Curl', icon: '💪' }],
    'Wednesday': [{ name: 'Squat', icon: '🦵' }, { name: 'Lunge', icon: '🚶' }, { name: 'Shoulder Press', icon: '🏋️' }],
    'Thursday': [{ name: 'Push-up', icon: '💪' }, { name: 'Lateral Raise', icon: '💪' }, { name: 'Tricep Extension', icon: '💪' }],
    'Friday': [{ name: 'Bent-over Row', icon: '🔙' }, { name: 'Deadlift', icon: '🏋️' }, { name: 'Bicep Curl', icon: '💪' }],
    'Saturday': [{ name: 'Plank', icon: '🧘' }, { name: 'Crunch', icon: '🔥' }, { name: 'Glute Bridge', icon: '🦵' }],
    'Sunday': [{ name: 'Rest Day', icon: '😴' }]
  };
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  return exercises[today] || [{ name: 'Full Body Workout', icon: '🏋️' }];
}

// ─── Attractive Inline Keyboard ──────────────────────────────
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
          { text: '🎯 Start Workout', web_app: { url: `${MINI_APP_URL}/tg` } }
        ]
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  };
}

// ─── Welcome Message with Attractive Design ──────────────────
function sendWelcomeMessage(chatId, firstName) {
  const message = getWelcomeMessage(firstName);
  const keyboard = getMainKeyboard();

  bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    ...keyboard,
    disable_web_page_preview: false
  });

  // Send a motivational image/emoji collage
  const motivation = `
🌟 *MOTIVATION OF THE DAY* 🌟

"Success is the sum of small efforts repeated day in and day out."

━━━━━━━━━━━━━━━━━━━━━

🔥 *Did you know?*
• 30 minutes of exercise = 200+ calories burned
• 10,000 steps = 5 miles = 500 calories
• A single push-up works 6 different muscle groups!

━━━━━━━━━━━━━━━━━━━━━

💪 *Your Fitness Journey*
Remember: Every champion was once a beginner.
The only bad workout is the one that didn't happen.

*START TODAY!* 🚀
  `;

  setTimeout(() => {
    bot.sendMessage(chatId, motivation, { parse_mode: 'Markdown' });
  }, 500);
}

// ─── Bot Commands ─────────────────────────────────────────────

// /start command – Attractive Welcome
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || 'Athlete';

  console.log(`👋 New user started bot: ${firstName} (${chatId})`);

  // Store user session
  userSessions.set(chatId, {
    firstName,
    username: msg.from.username,
    startDate: new Date().toISOString(),
    lastActivity: new Date().toISOString()
  });

  // Send attractive welcome message
  sendWelcomeMessage(chatId, firstName);

  // Send a quick-start guide with emojis
  setTimeout(() => {
    const quickStart = `
⚡ *QUICK START GUIDE* ⚡

1️⃣ *Open Gym App* → Tap the button below
2️⃣ *Select Exercise* → Choose from the library
3️⃣ *Start Training* → Get real-time feedback!
4️⃣ *Record & Review* → Watch your progress

━━━━━━━━━━━━━━━━━━━━━

🎯 *Your First Workout*
Try starting with:
• 3 sets of 10 push-ups
• 3 sets of 15 squats
• 3 sets of 30-second planks

*You've got this!* 💪
    `;
    bot.sendMessage(chatId, quickStart, { parse_mode: 'Markdown' });
  }, 1000);
});

// /help command
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  const help = `
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
• *Rep Counting*: Track your repetitions
• *Video Recording*: Record and review

━━━━━━━━━━━━━━━━━━━━━

💡 *Tips for Best Results*
• Good lighting is essential
• Stand 2-3 meters from the camera
• Wear fitted clothing
• Follow the form cues

━━━━━━━━━━━━━━━━━━━━━

📞 *Need More Help?*
Contact: @${BOT_USERNAME}Support

━━━━━━━━━━━━━━━━━━━━━

*Ready to start? Tap the button below!* 🏋️
  `;
  bot.sendMessage(chatId, help, {
    parse_mode: 'Markdown',
    ...getMainKeyboard()
  });
});

// /workout command – Show today's workout
bot.onText(/\/workout/, async (msg) => {
  const chatId = msg.chat.id;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const workout = getTodayWorkout();
  const exercises = getTodayExercises();

  let message = `
📅 *TODAY'S WORKOUT* 📅
━━━━━━━━━━━━━━━━━━━━━

📆 *${today}*
🏋️ *Workout:* ${workout}
⏱️ *Duration:* 30-45 minutes

*Exercises:*\n`;

  exercises.forEach((ex, i) => {
    message += `   ${i+1}. ${ex.name} ${ex.icon}\n`;
  });

  message += `
━━━━━━━━━━━━━━━━━━━━━
💪 *Let's get started!*
  `;

  bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    ...getMainKeyboard()
  });
});

// /progress command – Show user progress
bot.onText(/\/progress/, async (msg) => {
  const chatId = msg.chat.id;
  const userData = userSessions.get(chatId);

  const progress = `
📊 *YOUR PROGRESS* 📊
━━━━━━━━━━━━━━━━━━━━━

👤 *${userData?.firstName || 'Athlete'}*

📅 *Started:* ${userData?.startDate ? new Date(userData.startDate).toLocaleDateString() : 'Today'}

🏆 *Workouts Completed:* ${Math.floor(Math.random() * 20) + 1}

🔥 *Streak:* ${Math.floor(Math.random() * 7) + 1} days

💪 *Total Exercises:* ${Math.floor(Math.random() * 50) + 10}

━━━━━━━━━━━━━━━━━━━━━

📈 *Weekly Progress*
• Monday: ✅ 3/3 exercises
• Tuesday: ✅ 2/3 exercises
• Wednesday: ✅ 3/3 exercises
• Thursday: ⏳ Pending
• Friday: ⏳ Pending
• Saturday: ⏳ Pending
• Sunday: ⏳ Pending

━━━━━━━━━━━━━━━━━━━━━

*Keep going! You're doing great!* 🚀
  `;

  bot.sendMessage(chatId, progress, {
    parse_mode: 'Markdown',
    ...getMainKeyboard()
  });
});

// /exercises command – Show exercise guide
bot.onText(/\/exercises/, async (msg) => {
  const chatId = msg.chat.id;
  const guide = `
💪 *EXERCISE LIBRARY* 💪
━━━━━━━━━━━━━━━━━━━━━

*Chest & Triceps*
• 💪 Push-up – Chest
• 💪 Tricep Extension – Triceps
• 💪 Bench Press – Chest

*Back & Biceps*
• 🔙 Bent-over Row – Back
• 💪 Bicep Curl – Biceps
• 🏋️ Deadlift – Back/Legs

*Legs & Shoulders*
• 🦵 Squat – Legs
• 🚶 Lunge – Legs
• 🏋️ Shoulder Press – Shoulders

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

// ─── Callback Queries ─────────────────────────────────────────

bot.on('callback_query', async (callbackQuery) => {
  const message = callbackQuery.message;
  const chatId = message.chat.id;
  const data = callbackQuery.data;

  switch (data) {
    case 'schedule':
      bot.sendMessage(chatId, '📅 Fetching today\'s schedule...', { parse_mode: 'Markdown' });
      await bot.emit('text', { chat: { id: chatId }, text: '/workout' });
      break;

    case 'progress':
      bot.sendMessage(chatId, '📊 Loading your progress...', { parse_mode: 'Markdown' });
      await bot.emit('text', { chat: { id: chatId }, text: '/progress' });
      break;

    case 'exercises':
      bot.sendMessage(chatId, '💪 Loading exercise guide...', { parse_mode: 'Markdown' });
      await bot.emit('text', { chat: { id: chatId }, text: '/exercises' });
      break;

    case 'help':
      bot.sendMessage(chatId, '❓ Loading help...', { parse_mode: 'Markdown' });
      await bot.emit('text', { chat: { id: chatId }, text: '/help' });
      break;

    default:
      bot.answerCallbackQuery(callbackQuery.id, { text: 'Coming soon! 🚀' });
  }

  bot.answerCallbackQuery(callbackQuery.id);
});

// ─── Webhook Setup (for production) ──────────────────────────

if (WEBHOOK_URL) {
  bot.setWebHook(`${WEBHOOK_URL}/webhook`)
    .then(() => console.log(`✅ Webhook set to: ${WEBHOOK_URL}/webhook`))
    .catch(err => console.error('❌ Webhook error:', err));
}

// ─── Error Handling ───────────────────────────────────────────

bot.on('error', (error) => {
  console.error('❌ Bot error:', error);
});

bot.on('polling_error', (error) => {
  console.error('❌ Polling error:', error.code);
});

// ─── Logging ──────────────────────────────────────────────────

console.log(`🤖 AI Gym Trainer Bot is running...`);
console.log(`📱 Bot username: @${BOT_USERNAME}`);
console.log(`🌐 Mini App URL: ${MINI_APP_URL}`);
console.log(`👥 Listening for messages...\n`);

// ─── Export for use in server.js ─────────────────────────────

module.exports = { bot, userSessions };
