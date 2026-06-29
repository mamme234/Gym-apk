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
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'refresh';
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://gym-apk-wicj.onrender.com';
const ADMIN_ID = process.env.ADMIN_ID;

// ──────────────────────────────────────────────────────────────
//  MIDDLEWARE
// ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
        [{ text: '📊 My Progress', callback_data: 'progress' }],
        [{ text: '🏆 Challenges', callback_data: 'challenges' }],
        [{ text: '👑 Admin', callback_data: 'admin' }],
        [{ text: '❓ Help', callback_data: 'help' }]
    ]
};

async function sendTelegram(chatId, text, replyMarkup = null) {
    if (!BOT_TOKEN) {
        console.log('⚠️ BOT_TOKEN not set');
        return;
    }
    try {
        const payload = { chat_id: chatId, text, parse_mode: 'HTML' };
        if (replyMarkup) payload.reply_markup = replyMarkup;
        const response = await axios.post(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
            payload
        );
        console.log('✅ Message sent to', chatId);
        return response.data;
    } catch (e) {
        console.error('❌ Telegram send error:', e.response?.data || e.message);
    }
}

// ──────────────────────────────────────────────────────────────
//  WEBHOOK GET - For browser testing
// ──────────────────────────────────────────────────────────────
app.get('/webhook', (req, res) => {
    res.json({
        message: '✅ Webhook endpoint is active!',
        method: 'POST only for Telegram updates',
        status: 'active',
        bot: BOT_TOKEN ? 'configured' : 'not configured',
        webapp: WEBAPP_URL,
        admin: ADMIN_ID || 'not set'
    });
});

// ──────────────────────────────────────────────────────────────
//  WEBHOOK POST - Main Bot Handler
// ──────────────────────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
    console.log('📩 Webhook received');
    
    try {
        const update = req.body;

        // Callback Queries (Button clicks)
        if (update.callback_query) {
            const query = update.callback_query;
            const chatId = query.message.chat.id;
            const data = query.data;

            console.log(`📱 Callback: ${data} from ${chatId}`);

            // Answer callback
            try {
                await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
                    callback_query_id: query.id
                });
            } catch (e) {
                console.log('Answer callback error:', e.message);
            }

            // Handle Menu
            if (data === 'menu') {
                await sendTelegram(chatId, '🏋️ <b>Main Menu</b>', MAIN_MENU);
            }
            // Handle Progress
            else if (data === 'progress') {
                let userData = null;
                const files = fs.readdirSync(usersDir);
                for (const file of files) {
                    const data2 = JSON.parse(fs.readFileSync(usersDir + '/' + file));
                    if (data2.telegramId == chatId) { userData = data2; break; }
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
                    msg += 'No data found. Start your first workout! 🏋️';
                }

                await sendTelegram(chatId, msg, {
                    inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu' }]]
                });
            }
            // Handle Challenges
            else if (data === 'challenges') {
                await sendTelegram(chatId, 
                    '🏆 <b>Available Challenges</b>\n\n' +
                    '💪 100 Push-ups - 100 XP\n' +
                    '🧘 2-Min Plank - 100 XP\n' +
                    '🦵 50 Squats - 100 XP\n' +
                    '💪 10 Pull-ups - 100 XP\n' +
                    '🔥 100 Jumping Jacks - 100 XP\n\n' +
                    'Open the app to start challenges! 🚀',
                    {
                        inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu' }]]
                    }
                );
            }
            // Handle Admin
            else if (data === 'admin') {
                if (chatId == ADMIN_ID) {
                    await sendTelegram(chatId, '👑 <b>Admin Panel</b>', {
                        inline_keyboard: [
                            [{ text: '📊 Dashboard', web_app: { url: WEBAPP_URL + '/admin' } }],
                            [{ text: '📋 Users List', callback_data: 'users' }],
                            [{ text: '🔙 Back', callback_data: 'menu' }]
                        ]
                    });
                } else {
                    await sendTelegram(chatId, '⛔ You are not an admin.');
                }
            }
            // Handle Users List (Admin)
            else if (data === 'users') {
                if (chatId != ADMIN_ID) {
                    await sendTelegram(chatId, '⛔ Access denied.');
                    return res.sendStatus(200);
                }
                
                const files = fs.readdirSync(usersDir);
                let msg = '👥 <b>Users</b>\n\n';
                if (files.length === 0) {
                    msg += 'No users yet.';
                } else {
                    files.forEach((file, i) => {
                        try {
                            const data2 = JSON.parse(fs.readFileSync(usersDir + '/' + file));
                            msg += `${i+1}. ${data2.name || 'User'} (${data2.email || 'No email'})\n`;
                            msg += `   Workouts: ${data2.workoutsCompleted || 0} | XP: ${data2.xp || 0}\n`;
                        } catch (e) {}
                    });
                    msg += `\n📊 Total: ${files.length} users`;
                }
                
                await sendTelegram(chatId, msg, {
                    inline_keyboard: [[{ text: '🔙 Back', callback_data: 'admin' }]]
                });
            }
            // Handle Help
            else if (data === 'help') {
                await sendTelegram(chatId, 
                    '❓ <b>Help & Commands</b>\n\n' +
                    '🏋️ <b>Open Gym</b> - Launch the full app\n' +
                    '📊 <b>Progress</b> - View your stats\n' +
                    '🏆 <b>Challenges</b> - View challenges\n' +
                    '👑 <b>Admin</b> - Admin panel\n\n' +
                    '💡 <b>Tips:</b>\n' +
                    '• Complete workouts to earn XP\n' +
                    '• Track your progress daily\n' +
                    '• Use camera for form correction',
                    {
                        inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu' }]]
                    }
                );
            }
            
            return res.sendStatus(200);
        }

        // ──────────────────────────────────────────────────────────────
        //  MESSAGES
        // ──────────────────────────────────────────────────────────────
        if (update.message) {
            const chatId = update.message.chat.id;
            const text = update.message.text || '';
            const firstName = update.message.chat.first_name || 'User';

            console.log(`💬 Message from ${chatId}: ${text}`);

            // /start command
            if (text === '/start') {
                await sendTelegram(chatId, 
                    `🏋️ <b>Welcome to AI Gym Trainer!</b>\n\n` +
                    `👋 Hello ${firstName}!\n\n` +
                    `💪 Your AI-powered fitness companion is ready!\n\n` +
                    `🚀 <b>Get started:</b>\n` +
                    `• Click "Open Gym" to launch the app\n` +
                    `• Track your progress daily\n` +
                    `• Complete challenges for XP\n\n` +
                    `🔥 Let's crush your fitness goals!`,
                    MAIN_MENU
                );
            }
            // /menu command
            else if (text === '/menu') {
                await sendTelegram(chatId, '🏋️ <b>Main Menu</b>', MAIN_MENU);
            }
            // /progress command
            else if (text === '/progress') {
                let userData = null;
                const files = fs.readdirSync(usersDir);
                for (const file of files) {
                    const data2 = JSON.parse(fs.readFileSync(usersDir + '/' + file));
                    if (data2.telegramId == chatId) { userData = data2; break; }
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
                    msg += 'No data found. Start your first workout! 🏋️';
                }

                await sendTelegram(chatId, msg, {
                    inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu' }]]
                });
            }
            // /challenges command
            else if (text === '/challenges') {
                await sendTelegram(chatId, 
                    '🏆 <b>Available Challenges</b>\n\n' +
                    '💪 100 Push-ups - 100 XP\n' +
                    '🧘 2-Min Plank - 100 XP\n' +
                    '🦵 50 Squats - 100 XP\n' +
                    '💪 10 Pull-ups - 100 XP\n' +
                    '🔥 100 Jumping Jacks - 100 XP\n\n' +
                    'Open the app to start challenges! 🚀',
                    {
                        inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu' }]]
                    }
                );
            }
            // /admin command
            else if (text === '/admin') {
                if (chatId == ADMIN_ID) {
                    await sendTelegram(chatId, '👑 <b>Admin Panel</b>', {
                        inline_keyboard: [
                            [{ text: '📊 Dashboard', web_app: { url: WEBAPP_URL + '/admin' } }],
                            [{ text: '📋 Users List', callback_data: 'users' }],
                            [{ text: '🔙 Back', callback_data: 'menu' }]
                        ]
                    });
                } else {
                    await sendTelegram(chatId, '⛔ You are not an admin.');
                }
            }
            // /help command
            else if (text === '/help') {
                await sendTelegram(chatId, 
                    '❓ <b>Available Commands</b>\n\n' +
                    '/start - Welcome menu\n' +
                    '/menu - Main menu\n' +
                    '/progress - Your stats\n' +
                    '/challenges - View challenges\n' +
                    '/admin - Admin panel (admins only)\n' +
                    '/help - This help message\n\n' +
                    '💡 Click buttons below for quick access!',
                    {
                        inline_keyboard: [[{ text: '🔙 Main Menu', callback_data: 'menu' }]]
                    }
                );
            }
            // Unknown command
            else {
                await sendTelegram(chatId, 
                    `🤖 I received: "${text}"\n\n` +
                    `Use /menu for options or /help for commands.`,
                    {
                        inline_keyboard: [[{ text: '🔙 Main Menu', callback_data: 'menu' }]]
                    }
                );
            }
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('❌ Webhook error:', error);
        res.sendStatus(500);
    }
});

// ──────────────────────────────────────────────────────────────
//  SET WEBHOOK ENDPOINT
// ──────────────────────────────────────────────────────────────
app.post('/setwebhook', async (req, res) => {
    if (!BOT_TOKEN) {
        return res.status(400).json({ error: 'BOT_TOKEN not set' });
    }
    
    try {
        const appUrl = process.env.APP_URL || process.env.WEBAPP_URL || `https://localhost:${PORT}`;
        const webhookUrl = `${appUrl}/webhook`;
        
        console.log(`🔗 Setting webhook to: ${webhookUrl}`);
        
        const response = await axios.post(
            `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
            { url: webhookUrl }
        );
        
        res.json({
            success: true,
            message: 'Webhook set successfully',
            webhook: webhookUrl,
            response: response.data
        });
    } catch (error) {
        console.error('❌ Set webhook error:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Failed to set webhook',
            details: error.response?.data || error.message
        });
    }
});

// ──────────────────────────────────────────────────────────────
//  GET WEBHOOK STATUS
// ──────────────────────────────────────────────────────────────
app.get('/webhookstatus', async (req, res) => {
    if (!BOT_TOKEN) {
        return res.status(400).json({ error: 'BOT_TOKEN not set' });
    }
    
    try {
        const response = await axios.get(
            `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`
        );
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ──────────────────────────────────────────────────────────────
//  API ROUTES
// ──────────────────────────────────────────────────────────────

// Health
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        bot: BOT_TOKEN ? 'active' : 'inactive',
        webapp: WEBAPP_URL
    });
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
        res.send(`
            <h1>🏋️ AI Gym Trainer</h1>
            <p>Server is running!</p>
            <p>📡 API: <a href="/api/health">/api/health</a></p>
            <p>🤖 Bot Status: <a href="/webhookstatus">/webhookstatus</a></p>
            <p>🔗 Set Webhook: POST to /setwebhook</p>
            <p>📱 Webhook: <a href="/webhook">/webhook</a></p>
        `);
    }
});

// ──────────────────────────────────────────────────────────────
//  START SERVER
// ──────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', async () => {
    console.log('\n========================================');
    console.log('🏋️ AI Gym Trainer');
    console.log('========================================');
    console.log(`🚀 Server: http://localhost:${PORT}`);
    console.log(`🤖 Bot Token: ${BOT_TOKEN ? '✅ Set' : '❌ Not set'}`);
    console.log(`👑 Admin ID: ${ADMIN_ID || 'Not set'}`);
    console.log(`📱 WebApp: ${WEBAPP_URL}`);
    console.log('========================================');
    console.log('\n🤖 Bot Commands:');
    console.log('   /start    - Welcome');
    console.log('   /menu     - Main menu');
    console.log('   /progress - Your stats');
    console.log('   /challenges - Challenges');
    console.log('   /admin    - Admin panel');
    console.log('   /help     - Help');
    console.log('========================================');
    console.log('\n🔗 Webhook URLs:');
    console.log(`   GET  ${WEBAPP_URL}/webhook - Check status`);
    console.log(`   POST ${WEBAPP_URL}/setwebhook - Set webhook`);
    console.log(`   GET  ${WEBAPP_URL}/webhookstatus - Webhook info`);
    console.log('========================================\n');
    
    // Auto-set webhook on startup
    if (BOT_TOKEN && WEBAPP_URL) {
        try {
            const webhookUrl = `${WEBAPP_URL}/webhook`;
            const response = await axios.post(
                `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
                { url: webhookUrl }
            );
            console.log('✅ Webhook auto-set to:', webhookUrl);
            console.log('📡 Response:', response.data.description || 'Success');
        } catch (e) {
            console.log('⚠️ Could not auto-set webhook. Please set manually.');
            console.log(`   POST ${WEBAPP_URL}/setwebhook`);
        }
    }
});

module.exports = app;
