const express = require('express');
const cors = require('cors');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ──────────────────────────────────────────────────────────────
//  FROM .env
// ──────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;
const ADMIN_ID = process.env.ADMIN_ID;

// ──────────────────────────────────────────────────────────────
//  MIDDLEWARE
// ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ──────────────────────────────────────────────────────────────
//  FOLDERS
// ──────────────────────────────────────────────────────────────
const usersDir = __dirname + '/data/users';
if (!fs.existsSync(usersDir)) fs.mkdirSync(usersDir, { recursive: true });

// ──────────────────────────────────────────────────────────────
//  USER FUNCTIONS
// ──────────────────────────────────────────────────────────────
function loadUser(userId) {
    try {
        const file = usersDir + '/' + userId + '.json';
        if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file));
        return null;
    } catch (e) { return null; }
}

function saveUser(userId, data) {
    fs.writeFileSync(usersDir + '/' + userId + '.json', JSON.stringify(data, null, 2));
}

// ──────────────────────────────────────────────────────────────
//  JWT
// ──────────────────────────────────────────────────────────────
function generateTokens(userId, email) {
    return {
        accessToken: jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' }),
        refreshToken: jwt.sign({ userId, email }, REFRESH_SECRET, { expiresIn: '30d' })
    };
}

function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });
    try {
        req.user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// ──────────────────────────────────────────────────────────────
//  TELEGRAM BOT
// ──────────────────────────────────────────────────────────────
const MAIN_MENU = {
    inline_keyboard: [
        [{ text: '🏋️ Open Gym', web_app: { url: WEBAPP_URL } }],
        [{ text: '📊 Progress', callback_data: 'progress' }],
        [{ text: '🏆 Challenges', callback_data: 'challenges' }],
        [{ text: '👑 Admin', callback_data: 'admin' }],
        [{ text: '❓ Help', callback_data: 'help' }]
    ]
};

async function sendTelegram(chatId, text, replyMarkup = null) {
    if (!BOT_TOKEN) return;
    try {
        const payload = { chat_id: chatId, text, parse_mode: 'HTML' };
        if (replyMarkup) payload.reply_markup = replyMarkup;
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, payload);
    } catch (e) { console.error('Telegram error:', e.message); }
}

// ──────────────────────────────────────────────────────────────
//  WEBHOOK
// ──────────────────────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
    try {
        const update = req.body;

        // Callback Queries (Button clicks)
        if (update.callback_query) {
            const query = update.callback_query;
            const chatId = query.message.chat.id;
            const data = query.data;

            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
                callback_query_id: query.id
            });

            if (data === 'menu') {
                await sendTelegram(chatId, '🏋️ <b>Main Menu</b>', MAIN_MENU);
            }
            else if (data === 'progress') {
                let userData = null;
                const files = fs.readdirSync(usersDir);
                for (const file of files) {
                    const data = JSON.parse(fs.readFileSync(usersDir + '/' + file));
                    if (data.telegramId == chatId) { userData = data; break; }
                }

                let msg = '📊 <b>Your Progress</b>\n\n';
                if (userData) {
                    msg += `👤 Name: ${userData.name || 'User'}\n`;
                    msg += `📏 Height: ${userData.height || 175}cm\n`;
                    msg += `⚖️ Weight: ${userData.weight || 75}kg\n`;
                    msg += `🎯 Goal: ${userData.goal || 'Body Recomposition'}\n`;
                    msg += `🔥 Streak: ${userData.streak || 0} days\n`;
                    msg += `🏋️ Workouts: ${userData.workoutsCompleted || 0}\n`;
                    msg += `⭐ Level: ${userData.level || 1}\n`;
                    msg += `🏆 XP: ${userData.xp || 0}`;
                } else {
                    msg += 'No data found. Start your first workout!';
                }

                await sendTelegram(chatId, msg, {
                    inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu' }]]
                });
            }
            else if (data === 'challenges') {
                await sendTelegram(chatId, '🏆 <b>Challenges</b>\n\n💪 100 Push-ups\n🧘 2-Min Plank\n🦵 50 Squats\n💪 10 Pull-ups\n🔥 100 Jumping Jacks\n🚶 30 Lunges\n⚡ 20 Burpees', {
                    inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu' }]]
                });
            }
            else if (data === 'admin') {
                if (chatId == ADMIN_ID) {
                    await sendTelegram(chatId, '👑 <b>Admin Panel</b>', {
                        inline_keyboard: [
                            [{ text: '📊 Dashboard', web_app: { url: WEBAPP_URL + '/admin' } }],
                            [{ text: '📋 Users', callback_data: 'users' }],
                            [{ text: '🔙 Back', callback_data: 'menu' }]
                        ]
                    });
                } else {
                    await sendTelegram(chatId, '⛔ You are not an admin.');
                }
            }
            else if (data === 'users') {
                const files = fs.readdirSync(usersDir);
                let msg = '👥 <b>Users</b>\n\n';
                files.forEach((file, i) => {
                    try {
                        const data = JSON.parse(fs.readFileSync(usersDir + '/' + file));
                        msg += `${i+1}. ${data.name || 'User'} (${data.email || 'No email'})\n`;
                    } catch (e) {}
                });
                msg += `\nTotal: ${files.length} users`;
                await sendTelegram(chatId, msg, {
                    inline_keyboard: [[{ text: '🔙 Back', callback_data: 'admin' }]]
                });
            }
            else if (data === 'help') {
                await sendTelegram(chatId, '❓ <b>Help</b>\n\n1️⃣ Open Gym - Launch the app\n2️⃣ Progress - View your stats\n3️⃣ Challenges - Start challenges\n4️⃣ Admin - Admin panel\n\n💡 The app has AI form correction!', {
                    inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu' }]]
                });
            }
            return res.sendStatus(200);
        }

        // Messages
        if (update.message) {
            const chatId = update.message.chat.id;
            const text = update.message.text || '';

            if (text === '/start') {
                await sendTelegram(chatId, '🏋️ <b>Welcome to AI Gym Trainer!</b>\n\n💪 Your AI-powered fitness companion!\n\n🚀 Ready to start?', MAIN_MENU);
            }
            else if (text === '/menu') {
                await sendTelegram(chatId, '🏋️ <b>Main Menu</b>', MAIN_MENU);
            }
            else if (text === '/progress') {
                // Same as progress callback
                let userData = null;
                const files = fs.readdirSync(usersDir);
                for (const file of files) {
                    const data = JSON.parse(fs.readFileSync(usersDir + '/' + file));
                    if (data.telegramId == chatId) { userData = data; break; }
                }

                let msg = '📊 <b>Your Progress</b>\n\n';
                if (userData) {
                    msg += `👤 Name: ${userData.name || 'User'}\n`;
                    msg += `📏 Height: ${userData.height || 175}cm\n`;
                    msg += `⚖️ Weight: ${userData.weight || 75}kg\n`;
                    msg += `🎯 Goal: ${userData.goal || 'Body Recomposition'}\n`;
                    msg += `🔥 Streak: ${userData.streak || 0} days\n`;
                    msg += `🏋️ Workouts: ${userData.workoutsCompleted || 0}\n`;
                    msg += `⭐ Level: ${userData.level || 1}\n`;
                    msg += `🏆 XP: ${userData.xp || 0}`;
                } else {
                    msg += 'No data found. Start your first workout!';
                }

                await sendTelegram(chatId, msg, {
                    inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu' }]]
                });
            }
            else if (text === '/challenges') {
                await sendTelegram(chatId, '🏆 <b>Challenges</b>\n\n💪 100 Push-ups\n🧘 2-Min Plank\n🦵 50 Squats\n💪 10 Pull-ups\n🔥 100 Jumping Jacks\n🚶 30 Lunges\n⚡ 20 Burpees', {
                    inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu' }]]
                });
            }
            else if (text === '/admin' && chatId == ADMIN_ID) {
                await sendTelegram(chatId, '👑 <b>Admin Panel</b>', {
                    inline_keyboard: [
                        [{ text: '📊 Dashboard', web_app: { url: WEBAPP_URL + '/admin' } }],
                        [{ text: '📋 Users', callback_data: 'users' }],
                        [{ text: '🔙 Back', callback_data: 'menu' }]
                    ]
                });
            }
            else if (text === '/help') {
                await sendTelegram(chatId, '❓ <b>Commands</b>\n\n/start - Welcome\n/menu - Main menu\n/progress - Your stats\n/challenges - View challenges\n/admin - Admin panel\n/help - This help', {
                    inline_keyboard: [[{ text: '🔙 Main Menu', callback_data: 'menu' }]]
                });
            }
            else {
                await sendTelegram(chatId, `🤖 I received: "${text}"\n\nUse /menu for options.`);
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

// Health
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name, telegramId } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

        const files = fs.readdirSync(usersDir);
        for (const file of files) {
            const data = JSON.parse(fs.readFileSync(usersDir + '/' + file));
            if (data.email === email) return res.status(400).json({ error: 'User exists' });
        }

        const userId = 'user_' + Date.now();
        const hashedPassword = await bcrypt.hash(password, 10);

        const userData = {
            userId,
            email,
            name: name || 'User',
            password: hashedPassword,
            telegramId: telegramId || null,
            createdAt: new Date().toISOString(),
            height: 175,
            weight: 75,
            age: 25,
            gender: 'Male',
            goal: 'Body Recomposition',
            fitnessLevel: 'Intermediate',
            streak: 0,
            xp: 0,
            level: 1,
            workoutsCompleted: 0
        };

        saveUser(userId, userData);
        const tokens = generateTokens(userId, email);

        res.status(201).json({ success: true, user: { userId, email, name: userData.name }, ...tokens });
    } catch (error) {
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

        let userData = null;
        let userId = null;
        const files = fs.readdirSync(usersDir);
        for (const file of files) {
            const data = JSON.parse(fs.readFileSync(usersDir + '/' + file));
            if (data.email === email) {
                userData = data;
                userId = file.replace('.json', '');
                break;
            }
        }

        if (!userData) return res.status(401).json({ error: 'Invalid credentials' });

        const validPassword = await bcrypt.compare(password, userData.password);
        if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

        const tokens = generateTokens(userId, email);
        res.json({ success: true, user: { userId, email, name: userData.name }, ...tokens });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// Guest
app.post('/api/auth/guest', (req, res) => {
    try {
        const userId = 'guest_' + Date.now();
        const userData = {
            userId,
            name: 'Guest',
            email: 'guest_' + userId + '@guest.user',
            password: null,
            createdAt: new Date().toISOString(),
            height: 175,
            weight: 75,
            age: 25,
            gender: 'Male',
            goal: 'Body Recomposition',
            fitnessLevel: 'Intermediate',
            streak: 0,
            xp: 0,
            level: 1,
            workoutsCompleted: 0,
            isGuest: true
        };
        saveUser(userId, userData);
        const tokens = generateTokens(userId, userData.email);
        res.json({ success: true, user: { userId, email: userData.email, name: userData.name, isGuest: true }, ...tokens });
    } catch (error) {
        res.status(500).json({ error: 'Guest login failed' });
    }
});

// Profile
app.get('/api/user/profile', verifyToken, (req, res) => {
    try {
        const userData = loadUser(req.user.userId);
        if (!userData) return res.status(404).json({ error: 'User not found' });
        delete userData.password;
        res.json({ success: true, user: userData });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

app.put('/api/user/profile', verifyToken, (req, res) => {
    try {
        const userData = loadUser(req.user.userId);
        if (!userData) return res.status(404).json({ error: 'User not found' });
        const { name, age, gender, height, weight, goal, fitnessLevel } = req.body;
        if (name) userData.name = name;
        if (age) userData.age = parseInt(age);
        if (gender) userData.gender = gender;
        if (height) userData.height = parseInt(height);
        if (weight) userData.weight = parseInt(weight);
        if (goal) userData.goal = goal;
        if (fitnessLevel) userData.fitnessLevel = fitnessLevel;
        userData.updatedAt = new Date().toISOString();
        saveUser(req.user.userId, userData);
        delete userData.password;
        res.json({ success: true, user: userData });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Workout
app.post('/api/workouts', verifyToken, (req, res) => {
    try {
        const userData = loadUser(req.user.userId);
        if (!userData) return res.status(404).json({ error: 'User not found' });
        userData.workoutsCompleted = (userData.workoutsCompleted || 0) + 1;
        userData.streak = (userData.streak || 0) + 1;
        userData.xp = (userData.xp || 0) + 50;
        userData.level = Math.floor(userData.xp / 100) + 1;
        saveUser(req.user.userId, userData);
        res.json({ success: true, message: 'Workout saved!' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save workout' });
    }
});

// ──────────────────────────────────────────────────────────────
//  SERVE FRONTEND
// ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    const indexPath = __dirname + '/index.html';
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.send('<h1>🏋️ AI Gym Trainer</h1><p>Server is running!</p>');
    }
});

// ──────────────────────────────────────────────────────────────
//  START
// ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log('\n========================================');
    console.log('🏋️ AI Gym Trainer');
    console.log('========================================');
    console.log(`🚀 Server: http://localhost:${PORT}`);
    console.log(`🤖 Bot: ${BOT_TOKEN ? '✅' : '❌'}`);
    console.log(`👑 Admin: ${ADMIN_ID || 'Not set'}`);
    console.log('========================================');
    console.log('\n🤖 Bot Commands:');
    console.log('   /start   - Welcome');
    console.log('   /menu    - Main menu');
    console.log('   /progress- Your stats');
    console.log('   /challenges - Challenges');
    console.log('   /admin   - Admin panel');
    console.log('   /help    - Help');
    console.log('========================================\n');
});
