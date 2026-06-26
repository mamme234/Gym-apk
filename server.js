const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Telegram Bot Token - Replace with your bot token
const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://your-app-url.onrender.com';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Ensure directories exist
const uploadsDir = path.join(__dirname, 'uploads');
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// ──────────────────────────────────────────────────────────────
//  TELEGRAM BOT HANDLER
// ──────────────────────────────────────────────────────────────

// Send message to Telegram
async function sendTelegramMessage(chatId, text, replyMarkup = null) {
    try {
        const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
        const payload = {
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML',
            disable_web_page_preview: true
        };
        if (replyMarkup) {
            payload.reply_markup = replyMarkup;
        }
        const response = await axios.post(url, payload);
        return response.data;
    } catch (error) {
        console.error('Telegram send error:', error.response?.data || error.message);
        return null;
    }
}

// Edit message
async function editTelegramMessage(chatId, messageId, text, replyMarkup = null) {
    try {
        const url = `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`;
        const payload = {
            chat_id: chatId,
            message_id: messageId,
            text: text,
            parse_mode: 'HTML',
            disable_web_page_preview: true
        };
        if (replyMarkup) {
            payload.reply_markup = replyMarkup;
        }
        const response = await axios.post(url, payload);
        return response.data;
    } catch (error) {
        console.error('Telegram edit error:', error.response?.data || error.message);
        return null;
    }
}

// Answer callback query
async function answerCallbackQuery(callbackQueryId, text = null) {
    try {
        const url = `https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`;
        const payload = {
            callback_query_id: callbackQueryId
        };
        if (text) {
            payload.text = text;
        }
        await axios.post(url, payload);
    } catch (error) {
        console.error('Answer callback error:', error.message);
    }
}

// ──────────────────────────────────────────────────────────────
//  BOT MENUS
// ──────────────────────────────────────────────────────────────

// Main Menu
const MAIN_MENU = {
    inline_keyboard: [
        [
            { text: '🏋️ Open Gym Trainer', web_app: { url: WEBAPP_URL } },
            { text: '📊 My Progress', callback_data: 'progress' }
        ],
        [
            { text: '🏆 Challenges', callback_data: 'challenges' },
            { text: '📏 Height Increase', callback_data: 'height' }
        ],
        [
            { text: '💪 Workout Tips', callback_data: 'tips' },
            { text: '📈 Stats', callback_data: 'stats' }
        ],
        [
            { text: '❓ Help', callback_data: 'help' }
        ]
    ]
};

// Challenges Menu
const CHALLENGES_MENU = {
    inline_keyboard: [
        [
            { text: '💪 100 Push-ups', callback_data: 'challenge_pushups' },
            { text: '🧘 2-Min Plank', callback_data: 'challenge_plank' }
        ],
        [
            { text: '🦵 50 Squats', callback_data: 'challenge_squats' },
            { text: '💪 10 Pull-ups', callback_data: 'challenge_pullups' }
        ],
        [
            { text: '🔥 100 Jumping Jacks', callback_data: 'challenge_jacks' },
            { text: '🚶 30 Lunges', callback_data: 'challenge_lunges' }
        ],
        [
            { text: '⚡ 20 Burpees', callback_data: 'challenge_burpees' },
            { text: '🔥 50 Mountain Climbers', callback_data: 'challenge_climbers' }
        ],
        [
            { text: '🔙 Back to Menu', callback_data: 'menu' }
        ]
    ]
};

// Height Increase Menu
const HEIGHT_MENU = {
    inline_keyboard: [
        [
            { text: '🧘 Hanging Leg Raises', callback_data: 'height_legraises' },
            { text: '🧘 Cobra Stretch', callback_data: 'height_cobra' }
        ],
        [
            { text: '🧘 Hanging Stretch', callback_data: 'height_hang' },
            { text: '🧘 Cat-Cow Stretch', callback_data: 'height_catcow' }
        ],
        [
            { text: '🧘 Child\'s Pose', callback_data: 'height_child' },
            { text: '🦵 Squat Stretch', callback_data: 'height_squat' }
        ],
        [
            { text: '🧘 Bridge Pose', callback_data: 'height_bridge' },
            { text: '🧘 Twist Stretch', callback_data: 'height_twist' }
        ],
        [
            { text: '🔙 Back to Menu', callback_data: 'menu' }
        ]
    ]
};

// Workout Tips Menu
const TIPS_MENU = {
    inline_keyboard: [
        [
            { text: '💪 Chest Tips', callback_data: 'tips_chest' },
            { text: '🏋️ Back Tips', callback_data: 'tips_back' }
        ],
        [
            { text: '🦵 Leg Tips', callback_data: 'tips_legs' },
            { text: '💪 Shoulder Tips', callback_data: 'tips_shoulders' }
        ],
        [
            { text: '🔥 Core Tips', callback_data: 'tips_core' },
            { text: '🥗 Nutrition Tips', callback_data: 'tips_nutrition' }
        ],
        [
            { text: '🔙 Back to Menu', callback_data: 'menu' }
        ]
    ]
};

// ──────────────────────────────────────────────────────────────
//  CHALLENGE DETAILS
// ──────────────────────────────────────────────────────────────

const CHALLENGE_DETAILS = {
    pushups: {
        name: '💪 100 Push-ups Challenge',
        desc: 'Complete 100 push-ups! Break into sets of 10-20.',
        tip: 'Keep core tight, body in straight line',
        benefit: 'Builds chest, shoulders & triceps endurance'
    },
    plank: {
        name: '🧘 2-Minute Plank Challenge',
        desc: 'Hold plank position for 2 full minutes!',
        tip: 'Keep body in a straight line, don\'t sag hips',
        benefit: 'Core stability & endurance'
    },
    squats: {
        name: '🦵 50 Squat Challenge',
        desc: 'Complete 50 squats without stopping!',
        tip: 'Keep chest up, knees tracking toes',
        benefit: 'Leg strength & endurance'
    },
    pullups: {
        name: '💪 10 Pull-ups Challenge',
        desc: 'Complete 10 pull-ups in a row!',
        tip: 'Keep core tight, use full range of motion',
        benefit: 'Back & grip strength'
    },
    jacks: {
        name: '🔥 100 Jumping Jacks',
        desc: 'Complete 100 jumping jacks!',
        tip: 'Keep a steady rhythm, land softly',
        benefit: 'Cardio & endurance'
    },
    lunges: {
        name: '🚶 30 Lunges Challenge',
        desc: 'Complete 30 lunges on each leg!',
        tip: 'Keep front knee behind toes',
        benefit: 'Leg stability & strength'
    },
    burpees: {
        name: '⚡ 20 Burpee Challenge',
        desc: 'Complete 20 burpees!',
        tip: 'Explosive movement, controlled landing',
        benefit: 'Full body power & endurance'
    },
    climbers: {
        name: '🔥 50 Mountain Climbers',
        desc: 'Complete 50 mountain climbers!',
        tip: 'Keep core engaged, don\'t raise hips',
        benefit: 'Core endurance & cardio'
    }
};

// ──────────────────────────────────────────────────────────────
//  HEIGHT EXERCISE DETAILS
// ──────────────────────────────────────────────────────────────

const HEIGHT_DETAILS = {
    legraises: {
        name: '🧘 Hanging Leg Raises',
        desc: 'Hang from bar and raise legs to chest',
        tip: 'Keep legs straight, engage core',
        benefit: 'Spinal decompression & core strength'
    },
    cobra: {
        name: '🧘 Cobra Stretch',
        desc: 'Lie on stomach, lift chest up',
        tip: 'Press through palms, look up',
        benefit: 'Spinal flexibility & back strength'
    },
    hang: {
        name: '🧘 Hanging Stretch',
        desc: 'Hang from bar and relax your body',
        tip: 'Let gravity stretch your spine',
        benefit: 'Spinal decompression'
    },
    catcow: {
        name: '🧘 Cat-Cow Stretch',
        desc: 'Alternate arching and rounding your back',
        tip: 'Move with your breath',
        benefit: 'Spinal mobility & flexibility'
    },
    child: {
        name: '🧘 Child\'s Pose',
        desc: 'Kneel and stretch forward',
        tip: 'Relax and breathe deeply',
        benefit: 'Spinal relaxation & stretch'
    },
    squat: {
        name: '🦵 Squat Stretch',
        desc: 'Deep squat hold position',
        tip: 'Keep heels on the ground',
        benefit: 'Hip & spinal mobility'
    },
    bridge: {
        name: '🧘 Bridge Pose',
        desc: 'Lift hips up from lying position',
        tip: 'Press through your feet',
        benefit: 'Spinal extension & glute strength'
    },
    twist: {
        name: '🧘 Twist Stretch',
        desc: 'Sitting twist to each side',
        tip: 'Rotate from your waist',
        benefit: 'Spinal rotation & mobility'
    }
};

// ──────────────────────────────────────────────────────────────
//  WORKOUT TIPS
// ──────────────────────────────────────────────────────────────

const WORKOUT_TIPS = {
    chest: {
        title: '💪 Chest Workout Tips',
        tips: [
            '🔹 Keep shoulders pinned back during bench press',
            '🔹 Control the descent, don\'t bounce the bar',
            '🔹 Squeeze chest at the top of each rep',
            '🔹 Use full range of motion for growth',
            '🔹 Don\'t forget incline and decline variations'
        ]
    },
    back: {
        title: '🏋️ Back Workout Tips',
        tips: [
            '🔹 Keep back straight during rows',
            '🔹 Squeeze shoulder blades together',
            '🔹 Use controlled movements, not momentum',
            '🔹 Pull to your belly button for rows',
            '🔹 Deadlifts: keep neutral spine'
        ]
    },
    legs: {
        title: '🦵 Leg Workout Tips',
        tips: [
            '🔹 Squats: keep chest up, knees tracking toes',
            '🔹 Don\'t lock your knees at the top',
            '🔹 Full range of motion for growth',
            '🔹 Lunges: keep front knee behind toes',
            '🔹 Don\'t forget calf raises'
        ]
    },
    shoulders: {
        title: '💪 Shoulder Workout Tips',
        tips: [
            '🔹 Don\'t arch your back during overhead press',
            '🔹 Use lighter weight for lateral raises',
            '🔹 Keep core tight for stability',
            '🔹 Face pulls for shoulder health',
            '🔹 Don\'t neglect rear delts'
        ]
    },
    core: {
        title: '🔥 Core Workout Tips',
        tips: [
            '🔹 Keep neck relaxed during crunches',
            '🔹 Press lower back down for leg raises',
            '🔹 Planks: keep body in straight line',
            '🔹 Don\'t use momentum, control the movement',
            '🔹 Breathe properly, exhale on exertion'
        ]
    },
    nutrition: {
        title: '🥗 Nutrition Tips for Fitness',
        tips: [
            '🔹 Protein: 1.6-2.2g per kg of bodyweight',
            '🔹 Carbs: fuel your workouts',
            '🔹 Healthy fats: essential for hormones',
            '🔹 Hydrate: 2-3L water daily',
            '🔹 Eat within 2 hours after workout',
            '🔹 Don\'t skip meals, eat consistent'
        ]
    }
};

// ──────────────────────────────────────────────────────────────
//  TELEGRAM WEBHOOK ROUTE
// ──────────────────────────────────────────────────────────────

app.post('/webhook', async (req, res) => {
    try {
        const update = req.body;
        
        // Handle Callback Queries (Button clicks)
        if (update.callback_query) {
            const query = update.callback_query;
            const chatId = query.message.chat.id;
            const messageId = query.message.message_id;
            const data = query.data;
            
            await answerCallbackQuery(query.id);
            
            // Main Menu
            if (data === 'menu') {
                await editTelegramMessage(chatId, messageId, 
                    '🏋️ <b>AI Gym Trainer Pro Max 100</b>\n\n' +
                    'Your ultimate fitness companion! Choose an option below:',
                    MAIN_MENU
                );
                return res.sendStatus(200);
            }
            
            // Progress
            if (data === 'progress') {
                const userFile = path.join(uploadsDir, `${chatId}.json`);
                let progressText = '📊 <b>Your Progress</b>\n\n';
                if (fs.existsSync(userFile)) {
                    const userData = JSON.parse(fs.readFileSync(userFile, 'utf8'));
                    progressText += `👤 Name: ${userData.name || 'Not set'}\n`;
                    progressText += `📏 Height: ${userData.height || 175}cm\n`;
                    progressText += `⚖️ Weight: ${userData.weight || 75}kg\n`;
                    progressText += `🎯 Style: ${userData.style || 'Full Body'}\n`;
                    progressText += `🔥 Streak: ${userData.streak || 0} days\n`;
                    progressText += `🏋️ Exercises: ${Object.keys(userData.completedExercises || {}).length || 0} completed`;
                } else {
                    progressText += 'No progress data found yet.\n';
                    progressText += 'Start your first workout to track progress!';
                }
                await editTelegramMessage(chatId, messageId, progressText, {
                    inline_keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'menu' }]]
                });
                return res.sendStatus(200);
            }
            
            // Stats
            if (data === 'stats') {
                const statsText = '📈 <b>Gym Trainer Stats</b>\n\n' +
                    '🏋️ <b>Exercises Available:</b> 140\n' +
                    '📅 <b>Schedule:</b> 7 Days\n' +
                    '🏆 <b>Challenges:</b> 8\n' +
                    '📏 <b>Height Exercises:</b> 8\n' +
                    '💪 <b>Workout Styles:</b> 11\n\n' +
                    '🔥 <b>Keep pushing!</b> Every rep counts!';
                await editTelegramMessage(chatId, messageId, statsText, {
                    inline_keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'menu' }]]
                });
                return res.sendStatus(200);
            }
            
            // Help
            if (data === 'help') {
                const helpText = '❓ <b>How to use AI Gym Trainer</b>\n\n' +
                    '1️⃣ <b>Open Gym Trainer</b> - Launch the full app\n' +
                    '2️⃣ <b>Challenges</b> - View and start challenges\n' +
                    '3️⃣ <b>Height Increase</b> - Stretching exercises\n' +
                    '4️⃣ <b>Workout Tips</b> - Expert tips for each muscle\n' +
                    '5️⃣ <b>Stats</b> - View your progress\n\n' +
                    '💡 <b>Tip:</b> The Gym Trainer app has a built-in camera for form correction!';
                await editTelegramMessage(chatId, messageId, helpText, {
                    inline_keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'menu' }]]
                });
                return res.sendStatus(200);
            }
            
            // Challenges
            if (data === 'challenges') {
                await editTelegramMessage(chatId, messageId, 
                    '🏆 <b>Choose a Challenge</b>\n\n' +
                    'Select a challenge to see details and start pushing your limits! 💪',
                    CHALLENGES_MENU
                );
                return res.sendStatus(200);
            }
            
            // Challenge Details
            if (data.startsWith('challenge_')) {
                const key = data.replace('challenge_', '');
                const challenge = CHALLENGE_DETAILS[key];
                if (challenge) {
                    const text = `🏆 <b>${challenge.name}</b>\n\n` +
                        `📝 <b>Description:</b>\n${challenge.desc}\n\n` +
                        `💡 <b>Tip:</b> ${challenge.tip}\n\n` +
                        `✅ <b>Benefit:</b> ${challenge.benefit}\n\n` +
                        `🔥 <b>Ready to challenge yourself?</b>\n` +
                        `Open the Gym Trainer app and start!`;
                    await editTelegramMessage(chatId, messageId, text, {
                        inline_keyboard: [
                            [{ text: '🏋️ Start Challenge', web_app: { url: WEBAPP_URL } }],
                            [{ text: '🔙 Back to Challenges', callback_data: 'challenges' }]
                        ]
                    });
                }
                return res.sendStatus(200);
            }
            
            // Height
            if (data === 'height') {
                await editTelegramMessage(chatId, messageId, 
                    '📏 <b>Height Increase Exercises</b>\n\n' +
                    'Select an exercise to learn more about growing taller! 🧘',
                    HEIGHT_MENU
                );
                return res.sendStatus(200);
            }
            
            // Height Details
            if (data.startsWith('height_')) {
                const key = data.replace('height_', '');
                const exercise = HEIGHT_DETAILS[key];
                if (exercise) {
                    const text = `📏 <b>${exercise.name}</b>\n\n` +
                        `📝 <b>Description:</b>\n${exercise.desc}\n\n` +
                        `💡 <b>Tip:</b> ${exercise.tip}\n\n` +
                        `✅ <b>Benefit:</b> ${exercise.benefit}\n\n` +
                        `🧘 <b>Ready to grow?</b>\n` +
                        `Open the Gym Trainer app for full routine!`;
                    await editTelegramMessage(chatId, messageId, text, {
                        inline_keyboard: [
                            [{ text: '📏 Start Height Routine', web_app: { url: WEBAPP_URL } }],
                            [{ text: '🔙 Back to Height', callback_data: 'height' }]
                        ]
                    });
                }
                return res.sendStatus(200);
            }
            
            // Tips
            if (data === 'tips') {
                await editTelegramMessage(chatId, messageId, 
                    '💪 <b>Workout Tips</b>\n\n' +
                    'Select a muscle group for expert tips!',
                    TIPS_MENU
                );
                return res.sendStatus(200);
            }
            
            // Tips Details
            if (data.startsWith('tips_')) {
                const key = data.replace('tips_', '');
                const tips = WORKOUT_TIPS[key];
                if (tips) {
                    let text = `${tips.title}\n\n`;
                    tips.tips.forEach(tip => {
                        text += `${tip}\n`;
                    });
                    text += '\n💪 <b>Keep pushing!</b>';
                    await editTelegramMessage(chatId, messageId, text, {
                        inline_keyboard: [
                            [{ text: '🔙 Back to Tips', callback_data: 'tips' }]
                        ]
                    });
                }
                return res.sendStatus(200);
            }
            
            return res.sendStatus(200);
        }
        
        // Handle Messages
        if (update.message) {
            const chatId = update.message.chat.id;
            const text = update.message.text || '';
            
            // Start Command
            if (text === '/start') {
                const welcomeText = 
                    '🏋️ <b>Welcome to AI Gym Trainer Pro Max 100!</b>\n\n' +
                    '💪 Your ultimate AI-powered fitness companion!\n\n' +
                    '🔥 <b>Features:</b>\n' +
                    '• 🏋️ 140+ Exercises\n' +
                    '• 📅 Personalized 7-day schedules\n' +
                    '• 🏆 Challenges to push your limits\n' +
                    '• 📏 Height increase exercises\n' +
                    '• 💪 Expert workout tips\n' +
                    '• 📊 Track your progress\n' +
                    '• 🎥 AI form correction with camera\n\n' +
                    '🚀 <b>Ready to start?</b>\n' +
                    'Click "Open Gym Trainer" below!';
                
                await sendTelegramMessage(chatId, welcomeText, MAIN_MENU);
                return res.sendStatus(200);
            }
            
            // Help Command
            if (text === '/help') {
                const helpText = 
                    '❓ <b>Available Commands:</b>\n\n' +
                    '/start - Welcome menu\n' +
                    '/help - This help message\n' +
                    '/menu - Show main menu\n' +
                    '/progress - Your progress\n' +
                    '/challenges - View challenges\n' +
                    '/height - Height increase exercises\n' +
                    '/tips - Workout tips\n' +
                    '/stats - App statistics\n\n' +
                    '💡 Or use the buttons below!';
                
                await sendTelegramMessage(chatId, helpText, {
                    inline_keyboard: [[{ text: '🔙 Main Menu', callback_data: 'menu' }]]
                });
                return res.sendStatus(200);
            }
            
            // Menu Command
            if (text === '/menu') {
                await sendTelegramMessage(chatId, 
                    '🏋️ <b>AI Gym Trainer Pro Max 100</b>\n\n' +
                    'Your ultimate fitness companion! Choose an option below:',
                    MAIN_MENU
                );
                return res.sendStatus(200);
            }
            
            // Progress Command
            if (text === '/progress') {
                const userFile = path.join(uploadsDir, `${chatId}.json`);
                let progressText = '📊 <b>Your Progress</b>\n\n';
                if (fs.existsSync(userFile)) {
                    const userData = JSON.parse(fs.readFileSync(userFile, 'utf8'));
                    progressText += `👤 Name: ${userData.name || 'Not set'}\n`;
                    progressText += `📏 Height: ${userData.height || 175}cm\n`;
                    progressText += `⚖️ Weight: ${userData.weight || 75}kg\n`;
                    progressText += `🎯 Style: ${userData.style || 'Full Body'}\n`;
                    progressText += `🔥 Streak: ${userData.streak || 0} days\n`;
                    progressText += `🏋️ Exercises: ${Object.keys(userData.completedExercises || {}).length || 0} completed`;
                } else {
                    progressText += 'No progress data found yet.\n';
                    progressText += 'Start your first workout to track progress!';
                }
                await sendTelegramMessage(chatId, progressText, {
                    inline_keyboard: [[{ text: '🔙 Main Menu', callback_data: 'menu' }]]
                });
                return res.sendStatus(200);
            }
            
            // Challenges Command
            if (text === '/challenges') {
                await sendTelegramMessage(chatId, 
                    '🏆 <b>Choose a Challenge</b>\n\n' +
                    'Select a challenge to see details and start pushing your limits! 💪',
                    CHALLENGES_MENU
                );
                return res.sendStatus(200);
            }
            
            // Height Command
            if (text === '/height') {
                await sendTelegramMessage(chatId, 
                    '📏 <b>Height Increase Exercises</b>\n\n' +
                    'Select an exercise to learn more about growing taller! 🧘',
                    HEIGHT_MENU
                );
                return res.sendStatus(200);
            }
            
            // Tips Command
            if (text === '/tips') {
                await sendTelegramMessage(chatId, 
                    '💪 <b>Workout Tips</b>\n\n' +
                    'Select a muscle group for expert tips!',
                    TIPS_MENU
                );
                return res.sendStatus(200);
            }
            
            // Stats Command
            if (text === '/stats') {
                const statsText = '📈 <b>Gym Trainer Stats</b>\n\n' +
                    '🏋️ <b>Exercises Available:</b> 140\n' +
                    '📅 <b>Schedule:</b> 7 Days\n' +
                    '🏆 <b>Challenges:</b> 8\n' +
                    '📏 <b>Height Exercises:</b> 8\n' +
                    '💪 <b>Workout Styles:</b> 11\n\n' +
                    '🔥 <b>Keep pushing!</b> Every rep counts!';
                await sendTelegramMessage(chatId, statsText, {
                    inline_keyboard: [[{ text: '🔙 Main Menu', callback_data: 'menu' }]]
                });
                return res.sendStatus(200);
            }
        }
        
        res.sendStatus(200);
    } catch (error) {
        console.error('Webhook error:', error);
        res.sendStatus(500);
    }
});

// ──────────────────────────────────────────────────────────────
//  API ROUTES
// ──────────────────────────────────────────────────────────────

// Health Check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        exercises: 140,
        schedule: '7 days',
        challenges: 8,
        heightExercises: 8,
        server: 'AI Gym Trainer Pro Max 100',
        bot: BOT_TOKEN ? 'active' : 'inactive'
    });
});

// Save user progress
app.post('/api/save-progress', (req, res) => {
    try {
        const { userId, data } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }
        const userFile = path.join(uploadsDir, `${userId}.json`);
        fs.writeFileSync(userFile, JSON.stringify(data, null, 2));
        res.json({ success: true, message: 'Progress saved' });
    } catch (error) {
        console.error('Save error:', error);
        res.status(500).json({ error: 'Failed to save progress' });
    }
});

// Load user progress
app.get('/api/load-progress/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const userFile = path.join(uploadsDir, `${userId}.json`);
        if (fs.existsSync(userFile)) {
            const data = JSON.parse(fs.readFileSync(userFile, 'utf8'));
            res.json({ success: true, data });
        } else {
            res.json({ success: false, data: null });
        }
    } catch (error) {
        console.error('Load error:', error);
        res.status(500).json({ error: 'Failed to load progress' });
    }
});

// Get all users
app.get('/api/users', (req, res) => {
    try {
        const files = fs.readdirSync(uploadsDir)
            .filter(f => f.endsWith('.json'))
            .map(f => f.replace('.json', ''));
        res.json({ users: files });
    } catch (error) {
        res.status(500).json({ error: 'Failed to list users' });
    }
});

// Get user stats
app.get('/api/stats', (req, res) => {
    try {
        const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.json'));
        let totalUsers = files.length;
        let totalWorkouts = 0;
        let totalStreak = 0;
        
        files.forEach(file => {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(uploadsDir, file), 'utf8'));
                totalWorkouts += Object.keys(data.completedExercises || {}).length || 0;
                totalStreak += data.streak || 0;
            } catch (e) {}
        });
        
        res.json({
            totalUsers,
            totalWorkouts,
            averageStreak: totalUsers > 0 ? Math.round(totalStreak / totalUsers) : 0,
            exercises: 140,
            challenges: 8,
            heightExercises: 8
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// ──────────────────────────────────────────────────────────────
//  SERVE STATIC FILES
// ──────────────────────────────────────────────────────────────

// Serve index.html
app.get('/', (req, res) => {
    try {
        const indexPath = path.join(__dirname, 'index.html');
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            res.status(404).send(`
                <h1>❌ index.html not found</h1>
                <p>Please place your HTML file in: ${__dirname}</p>
                <p>Current directory contents:</p>
                <ul>${fs.readdirSync(__dirname).map(f => `<li>${f}</li>`).join('')}</ul>
            `);
        }
    } catch (error) {
        console.error('Error serving index.html:', error);
        res.status(500).send('Server error loading page.');
    }
});

// Serve uploaded files
app.get('/api/uploads/:filename', (req, res) => {
    const filePath = path.join(uploadsDir, req.params.filename);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

// Catch-all route for SPA
app.get('*', (req, res) => {
    const filePath = path.join(__dirname, req.path);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return res.sendFile(filePath);
    }
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Page not found');
    }
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ──────────────────────────────────────────────────────────────
//  START SERVER
// ──────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log('🏋️ AI Gym Trainer Pro Max 100');
    console.log('========================================');
    console.log(`🚀 Server running on: http://localhost:${PORT}`);
    console.log(`📁 Root directory: ${__dirname}`);
    console.log(`📁 Uploads: ${uploadsDir}`);
    console.log(`🤖 Bot Token: ${BOT_TOKEN ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`🌐 WebApp URL: ${WEBAPP_URL}`);
    console.log('========================================');
    console.log('📊 Status: Ready');
    console.log(`💪 Exercises: 140`);
    console.log(`🏆 Challenges: 8`);
    console.log(`📏 Height Exercises: 8`);
    console.log('========================================');
    console.log('\n📱 Open in browser: http://localhost:' + PORT);
    console.log('🤖 Bot Commands:');
    console.log('   /start - Welcome menu');
    console.log('   /help - Help message');
    console.log('   /menu - Main menu');
    console.log('   /progress - Your progress');
    console.log('   /challenges - View challenges');
    console.log('   /height - Height increase exercises');
    console.log('   /tips - Workout tips');
    console.log('   /stats - App statistics');
    console.log('========================================');
});

module.exports = app;
