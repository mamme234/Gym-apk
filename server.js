const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mamme dev';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'mamme dev ref';

// Telegram Bot Token
const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://your-app-url.onrender.com';

// ──────────────────────────────────────────────────────────────
//  MIDDLEWARE
// ──────────────────────────────────────────────────────────────
app.use(cors({
    origin: '*',
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname));

// ──────────────────────────────────────────────────────────────
//  FILE SYSTEM SETUP
// ──────────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
const logsDir = path.join(__dirname, 'logs');
const usersDir = path.join(__dirname, 'data', 'users');
const workoutsDir = path.join(__dirname, 'data', 'workouts');
const nutritionDir = path.join(__dirname, 'data', 'nutrition');
const progressDir = path.join(__dirname, 'data', 'progress');

const dirs = [uploadsDir, logsDir, usersDir, workoutsDir, nutritionDir, progressDir];
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// ──────────────────────────────────────────────────────────────
//  MULTER CONFIGURATION
// ──────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const filename = `${Date.now()}-${uuidv4()}${ext}`;
        cb(null, filename);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type'), false);
    }
};

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter
});

// ──────────────────────────────────────────────────────────────
//  JWT AUTHENTICATION
// ──────────────────────────────────────────────────────────────
function generateTokens(userId, email) {
    const accessToken = jwt.sign(
        { userId, email },
        JWT_SECRET,
        { expiresIn: '15m' }
    );
    const refreshToken = jwt.sign(
        { userId, email },
        REFRESH_SECRET,
        { expiresIn: '7d' }
    );
    return { accessToken, refreshToken };
}

function verifyAccessToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// ──────────────────────────────────────────────────────────────
//  USER DATA MANAGEMENT
// ──────────────────────────────────────────────────────────────
function getUserFilePath(userId) {
    return path.join(usersDir, `${userId}.json`);
}

function loadUserData(userId) {
    const filePath = getUserFilePath(userId);
    if (fs.existsSync(filePath)) {
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) {
            return null;
        }
    }
    return null;
}

function saveUserData(userId, data) {
    const filePath = getUserFilePath(userId);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function generateUserId() {
    return `user_${Date.now()}_${uuidv4().slice(0, 8)}`;
}

// ──────────────────────────────────────────────────────────────
//  TELEGRAM BOT HANDLER
// ──────────────────────────────────────────────────────────────
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

async function answerCallbackQuery(callbackQueryId, text = null) {
    try {
        const url = `https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`;
        const payload = { callback_query_id: callbackQueryId };
        if (text) payload.text = text;
        await axios.post(url, payload);
    } catch (error) {
        console.error('Answer callback error:', error.message);
    }
}

// ──────────────────────────────────────────────────────────────
//  BOT MENUS
// ──────────────────────────────────────────────────────────────
const MAIN_MENU = {
    inline_keyboard: [
        [{ text: '🏋️ Open Gym Trainer', web_app: { url: WEBAPP_URL } }],
        [{ text: '📊 My Progress', callback_data: 'progress' }],
        [{ text: '🏆 Challenges', callback_data: 'challenges' }],
        [{ text: '📏 Height Increase', callback_data: 'height' }],
        [{ text: '💪 Workout Tips', callback_data: 'tips' }],
        [{ text: '📈 Stats', callback_data: 'stats' }],
        [{ text: '❓ Help', callback_data: 'help' }]
    ]
};

const CHALLENGES_MENU = {
    inline_keyboard: [
        [{ text: '💪 100 Push-ups', callback_data: 'challenge_pushups' }, { text: '🧘 2-Min Plank', callback_data: 'challenge_plank' }],
        [{ text: '🦵 50 Squats', callback_data: 'challenge_squats' }, { text: '💪 10 Pull-ups', callback_data: 'challenge_pullups' }],
        [{ text: '🔥 100 Jumping Jacks', callback_data: 'challenge_jacks' }, { text: '🚶 30 Lunges', callback_data: 'challenge_lunges' }],
        [{ text: '⚡ 20 Burpees', callback_data: 'challenge_burpees' }, { text: '🔥 50 Mountain Climbers', callback_data: 'challenge_climbers' }],
        [{ text: '🔙 Back to Menu', callback_data: 'menu' }]
    ]
};

const HEIGHT_MENU = {
    inline_keyboard: [
        [{ text: '🧘 Hanging Leg Raises', callback_data: 'height_legraises' }, { text: '🧘 Cobra Stretch', callback_data: 'height_cobra' }],
        [{ text: '🧘 Hanging Stretch', callback_data: 'height_hang' }, { text: '🧘 Cat-Cow Stretch', callback_data: 'height_catcow' }],
        [{ text: '🧘 Child\'s Pose', callback_data: 'height_child' }, { text: '🦵 Squat Stretch', callback_data: 'height_squat' }],
        [{ text: '🧘 Bridge Pose', callback_data: 'height_bridge' }, { text: '🧘 Twist Stretch', callback_data: 'height_twist' }],
        [{ text: '🔙 Back to Menu', callback_data: 'menu' }]
    ]
};

const TIPS_MENU = {
    inline_keyboard: [
        [{ text: '💪 Chest Tips', callback_data: 'tips_chest' }, { text: '🏋️ Back Tips', callback_data: 'tips_back' }],
        [{ text: '🦵 Leg Tips', callback_data: 'tips_legs' }, { text: '💪 Shoulder Tips', callback_data: 'tips_shoulders' }],
        [{ text: '🔥 Core Tips', callback_data: 'tips_core' }, { text: '🥗 Nutrition Tips', callback_data: 'tips_nutrition' }],
        [{ text: '🔙 Back to Menu', callback_data: 'menu' }]
    ]
};

// ──────────────────────────────────────────────────────────────
//  WEBHOOK ROUTE
// ──────────────────────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
    try {
        const update = req.body;
        
        if (update.callback_query) {
            const query = update.callback_query;
            const chatId = query.message.chat.id;
            const messageId = query.message.message_id;
            const data = query.data;
            
            await answerCallbackQuery(query.id);
            
            // Handle callback data
            const handlers = {
                'menu': async () => {
                    await editTelegramMessage(chatId, messageId,
                        '🏋️ <b>AI Gym Trainer Pro Max 100</b>\n\nYour ultimate fitness companion!',
                        MAIN_MENU
                    );
                },
                'progress': async () => {
                    const userFile = path.join(usersDir, `${chatId}.json`);
                    let progressText = '📊 <b>Your Progress</b>\n\n';
                    if (fs.existsSync(userFile)) {
                        const userData = JSON.parse(fs.readFileSync(userFile, 'utf8'));
                        progressText += `👤 Name: ${userData.name || 'Not set'}\n`;
                        progressText += `📏 Height: ${userData.height || 175}cm\n`;
                        progressText += `⚖️ Weight: ${userData.weight || 75}kg\n`;
                        progressText += `🎯 Goal: ${userData.goal || 'Not set'}\n`;
                        progressText += `🔥 Streak: ${userData.streak || 0} days\n`;
                        progressText += `🏋️ Workouts: ${userData.workoutsCompleted || 0}\n`;
                        progressText += `⭐ Level: ${userData.level || 1}\n`;
                        progressText += `🏆 XP: ${userData.xp || 0}`;
                    } else {
                        progressText += 'No progress data found. Start your first workout!';
                    }
                    await editTelegramMessage(chatId, messageId, progressText, {
                        inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu' }]]
                    });
                },
                'challenges': async () => {
                    await editTelegramMessage(chatId, messageId,
                        '🏆 <b>Choose a Challenge</b>\n\nSelect a challenge to start!',
                        CHALLENGES_MENU
                    );
                },
                'height': async () => {
                    await editTelegramMessage(chatId, messageId,
                        '📏 <b>Height Increase Exercises</b>\n\nSelect an exercise:',
                        HEIGHT_MENU
                    );
                },
                'tips': async () => {
                    await editTelegramMessage(chatId, messageId,
                        '💪 <b>Workout Tips</b>\n\nSelect a muscle group:',
                        TIPS_MENU
                    );
                },
                'stats': async () => {
                    const statsText = '📈 <b>Gym Trainer Stats</b>\n\n' +
                        '🏋️ Exercises: 300+\n' +
                        '📅 Schedule: 7 Days\n' +
                        '🏆 Challenges: 100+\n' +
                        '📏 Height Exercises: 16\n' +
                        '💪 Workout Styles: 11\n' +
                        '👥 Users: Active\n\n' +
                        '🔥 Keep pushing!';
                    await editTelegramMessage(chatId, messageId, statsText, {
                        inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu' }]]
                    });
                },
                'help': async () => {
                    const helpText = '❓ <b>How to use AI Gym Trainer</b>\n\n' +
                        '1️⃣ Open Gym Trainer - Launch the full app\n' +
                        '2️⃣ Challenges - View and start challenges\n' +
                        '3️⃣ Height Increase - Stretching exercises\n' +
                        '4️⃣ Workout Tips - Expert tips\n' +
                        '5️⃣ Stats - View progress\n\n' +
                        '💡 The app has AI form correction with camera!';
                    await editTelegramMessage(chatId, messageId, helpText, {
                        inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu' }]]
                    });
                }
            };

            // Handle challenge details
            if (data.startsWith('challenge_')) {
                const key = data.replace('challenge_', '');
                const challenges = {
                    pushups: { name: '💪 100 Push-ups', desc: 'Complete 100 push-ups!', tip: 'Keep core tight', benefit: 'Builds chest & triceps' },
                    plank: { name: '🧘 2-Minute Plank', desc: 'Hold plank for 2 minutes!', tip: 'Keep body straight', benefit: 'Core stability' },
                    squats: { name: '🦵 50 Squats', desc: 'Complete 50 squats!', tip: 'Keep chest up', benefit: 'Leg strength' },
                    pullups: { name: '💪 10 Pull-ups', desc: 'Complete 10 pull-ups!', tip: 'Full range of motion', benefit: 'Back & grip' },
                    jacks: { name: '🔥 100 Jumping Jacks', desc: 'Complete 100 jumping jacks!', tip: 'Steady rhythm', benefit: 'Cardio' },
                    lunges: { name: '🚶 30 Lunges', desc: 'Complete 30 lunges each leg!', tip: 'Keep knee behind toes', benefit: 'Leg stability' },
                    burpees: { name: '⚡ 20 Burpees', desc: 'Complete 20 burpees!', tip: 'Explosive movement', benefit: 'Full body power' },
                    climbers: { name: '🔥 50 Mountain Climbers', desc: 'Complete 50 mountain climbers!', tip: 'Keep core engaged', benefit: 'Core endurance' }
                };
                const challenge = challenges[key];
                if (challenge) {
                    const text = `🏆 <b>${challenge.name}</b>\n\n📝 ${challenge.desc}\n\n💡 ${challenge.tip}\n\n✅ ${challenge.benefit}`;
                    await editTelegramMessage(chatId, messageId, text, {
                        inline_keyboard: [
                            [{ text: '🏋️ Start Challenge', web_app: { url: WEBAPP_URL } }],
                            [{ text: '🔙 Back', callback_data: 'challenges' }]
                        ]
                    });
                }
                return res.sendStatus(200);
            }

            // Handle height details
            if (data.startsWith('height_')) {
                const key = data.replace('height_', '');
                const exercises = {
                    legraises: { name: '🧘 Hanging Leg Raises', desc: 'Hang and raise legs to chest', tip: 'Keep legs straight', benefit: 'Spinal decompression' },
                    cobra: { name: '🧘 Cobra Stretch', desc: 'Lie on stomach, lift chest up', tip: 'Press through palms', benefit: 'Spinal flexibility' },
                    hang: { name: '🧘 Hanging Stretch', desc: 'Hang from bar, relax body', tip: 'Let gravity stretch', benefit: 'Spinal decompression' },
                    catcow: { name: '🧘 Cat-Cow Stretch', desc: 'Alternate arching and rounding', tip: 'Move with breath', benefit: 'Spinal mobility' },
                    child: { name: '🧘 Child\'s Pose', desc: 'Kneel and stretch forward', tip: 'Relax and breathe', benefit: 'Spinal relaxation' },
                    squat: { name: '🦵 Squat Stretch', desc: 'Deep squat hold', tip: 'Keep heels down', benefit: 'Hip & spinal mobility' },
                    bridge: { name: '🧘 Bridge Pose', desc: 'Lift hips up from lying', tip: 'Press through feet', benefit: 'Spinal extension' },
                    twist: { name: '🧘 Twist Stretch', desc: 'Sitting twist to each side', tip: 'Rotate from waist', benefit: 'Spinal rotation' }
                };
                const exercise = exercises[key];
                if (exercise) {
                    const text = `📏 <b>${exercise.name}</b>\n\n📝 ${exercise.desc}\n\n💡 ${exercise.tip}\n\n✅ ${exercise.benefit}`;
                    await editTelegramMessage(chatId, messageId, text, {
                        inline_keyboard: [
                            [{ text: '📏 Start Routine', web_app: { url: WEBAPP_URL } }],
                            [{ text: '🔙 Back', callback_data: 'height' }]
                        ]
                    });
                }
                return res.sendStatus(200);
            }

            // Handle tips details
            if (data.startsWith('tips_')) {
                const key = data.replace('tips_', '');
                const tips = {
                    chest: { title: '💪 Chest Tips', tips: ['Keep shoulders pinned back', 'Control the descent', 'Squeeze at the top', 'Full range of motion', 'Include incline variations'] },
                    back: { title: '🏋️ Back Tips', tips: ['Keep back straight', 'Squeeze shoulder blades', 'Controlled movements', 'Pull to belly button', 'Deadlifts: neutral spine'] },
                    legs: { title: '🦵 Leg Tips', tips: ['Keep chest up', 'Don\'t lock knees', 'Full range of motion', 'Keep knee behind toes', 'Include calf raises'] },
                    shoulders: { title: '💪 Shoulder Tips', tips: ['Don\'t arch back', 'Use lighter weight', 'Keep core tight', 'Face pulls for health', 'Don\'t neglect rear delts'] },
                    core: { title: '🔥 Core Tips', tips: ['Keep neck relaxed', 'Press lower back down', 'Keep body straight', 'Control the movement', 'Breathe properly'] },
                    nutrition: { title: '🥗 Nutrition Tips', tips: ['Protein: 1.6-2.2g/kg', 'Carbs for fuel', 'Healthy fats essential', 'Hydrate: 2-3L daily', 'Eat within 2 hours after workout', 'Don\'t skip meals'] }
                };
                const tip = tips[key];
                if (tip) {
                    let text = `${tip.title}\n\n`;
                    tip.tips.forEach(t => text += `${t}\n`);
                    await editTelegramMessage(chatId, messageId, text, {
                        inline_keyboard: [[{ text: '🔙 Back', callback_data: 'tips' }]]
                    });
                }
                return res.sendStatus(200);
            }

            // Execute handler
            if (handlers[data]) {
                await handlers[data]();
            }
            
            return res.sendStatus(200);
        }

        // Handle messages
        if (update.message) {
            const chatId = update.message.chat.id;
            const text = update.message.text || '';
            
            if (text === '/start') {
                const welcomeText = 
                    '🏋️ <b>Welcome to AI Gym Trainer Pro Max 100!</b>\n\n' +
                    '💪 Your ultimate AI-powered fitness companion!\n\n' +
                    '🔥 <b>Features:</b>\n' +
                    '• 🏋️ 300+ Exercises\n' +
                    '• 📅 Personalized 7-day schedules\n' +
                    '• 🏆 100+ Challenges\n' +
                    '• 📏 Height increase exercises\n' +
                    '• 💪 Expert workout tips\n' +
                    '• 📊 Track your progress\n' +
                    '• 🎥 AI form correction with camera\n\n' +
                    '🚀 <b>Ready to start?</b>';
                await sendTelegramMessage(chatId, welcomeText, MAIN_MENU);
                return res.sendStatus(200);
            }
            
            if (text === '/menu') {
                await sendTelegramMessage(chatId, '🏋️ Main Menu', MAIN_MENU);
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
        version: 'Pro Max 100',
        exercises: 300,
        challenges: 100,
        achievements: 100,
        server: 'AI Gym Trainer Pro Max 100',
        bot: BOT_TOKEN ? 'active' : 'inactive'
    });
});

// ──────────────────────────────────────────────────────────────
//  AUTHENTICATION ROUTES
// ──────────────────────────────────────────────────────────────

// Register with Email
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name, telegramId } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }
        
        // Check if user exists
        const userFiles = fs.readdirSync(usersDir).filter(f => f.endsWith('.json'));
        for (const file of userFiles) {
            const data = JSON.parse(fs.readFileSync(path.join(usersDir, file), 'utf8'));
            if (data.email === email) {
                return res.status(400).json({ error: 'User already exists' });
            }
        }
        
        const userId = generateUserId();
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const userData = {
            userId,
            email,
            name: name || 'User',
            password: hashedPassword,
            telegramId,
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
            coins: 0,
            workoutsCompleted: 0,
            achievements: [],
            isPremium: false,
            premiumSince: null
        };
        
        saveUserData(userId, userData);
        
        const { accessToken, refreshToken } = generateTokens(userId, email);
        
        res.status(201).json({
            success: true,
            user: { userId, email, name: userData.name },
            accessToken,
            refreshToken
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login with Email
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }
        
        // Find user
        let userData = null;
        let userId = null;
        const userFiles = fs.readdirSync(usersDir).filter(f => f.endsWith('.json'));
        for (const file of userFiles) {
            const data = JSON.parse(fs.readFileSync(path.join(usersDir, file), 'utf8'));
            if (data.email === email) {
                userData = data;
                userId = file.replace('.json', '');
                break;
            }
        }
        
        if (!userData) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const validPassword = await bcrypt.compare(password, userData.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const { accessToken, refreshToken } = generateTokens(userId, email);
        
        res.json({
            success: true,
            user: { userId, email, name: userData.name },
            accessToken,
            refreshToken
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Telegram Login
app.post('/api/auth/telegram', async (req, res) => {
    try {
        const { telegramId, firstName, lastName, photoUrl } = req.body;
        
        if (!telegramId) {
            return res.status(400).json({ error: 'Telegram ID required' });
        }
        
        let userData = null;
        let userId = null;
        const userFiles = fs.readdirSync(usersDir).filter(f => f.endsWith('.json'));
        for (const file of userFiles) {
            const data = JSON.parse(fs.readFileSync(path.join(usersDir, file), 'utf8'));
            if (data.telegramId === telegramId) {
                userData = data;
                userId = file.replace('.json', '');
                break;
            }
        }
        
        if (!userData) {
            // Create new user
            userId = generateUserId();
            const name = `${firstName || ''} ${lastName || ''}`.trim() || 'User';
            userData = {
                userId,
                telegramId,
                name,
                email: `tg_${telegramId}@telegram.user`,
                password: null,
                photoUrl,
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
                coins: 0,
                workoutsCompleted: 0,
                achievements: [],
                isPremium: false,
                premiumSince: null
            };
            saveUserData(userId, userData);
        } else {
            // Update photo if changed
            if (photoUrl && photoUrl !== userData.photoUrl) {
                userData.photoUrl = photoUrl;
                saveUserData(userId, userData);
            }
        }
        
        const { accessToken, refreshToken } = generateTokens(userId, userData.email);
        
        res.json({
            success: true,
            user: { userId, email: userData.email, name: userData.name, photoUrl: userData.photoUrl },
            accessToken,
            refreshToken
        });
    } catch (error) {
        console.error('Telegram login error:', error);
        res.status(500).json({ error: 'Telegram login failed' });
    }
});

// Guest Login
app.post('/api/auth/guest', async (req, res) => {
    try {
        const userId = generateUserId();
        const userData = {
            userId,
            name: `Guest_${userId.slice(-6)}`,
            email: `guest_${userId}@guest.user`,
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
            coins: 0,
            workoutsCompleted: 0,
            achievements: [],
            isPremium: false,
            isGuest: true,
            premiumSince: null
        };
        saveUserData(userId, userData);
        
        const { accessToken, refreshToken } = generateTokens(userId, userData.email);
        
        res.json({
            success: true,
            user: { userId, email: userData.email, name: userData.name, isGuest: true },
            accessToken,
            refreshToken
        });
    } catch (error) {
        console.error('Guest login error:', error);
        res.status(500).json({ error: 'Guest login failed' });
    }
});

// Refresh Token
app.post('/api/auth/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token required' });
        }
        
        const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
        const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.userId, decoded.email);
        
        res.json({
            success: true,
            accessToken,
            refreshToken: newRefreshToken
        });
    } catch (error) {
        res.status(401).json({ error: 'Invalid refresh token' });
    }
});

// Logout
app.post('/api/auth/logout', verifyAccessToken, (req, res) => {
    res.json({ success: true, message: 'Logged out' });
});

// ──────────────────────────────────────────────────────────────
//  USER PROFILE ROUTES
// ──────────────────────────────────────────────────────────────

// Get User Profile
app.get('/api/user/profile', verifyAccessToken, (req, res) => {
    try {
        const userData = loadUserData(req.user.userId);
        if (!userData) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Remove sensitive data
        delete userData.password;
        
        res.json({ success: true, user: userData });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

// Update User Profile
app.put('/api/user/profile', verifyAccessToken, (req, res) => {
    try {
        const userData = loadUserData(req.user.userId);
        if (!userData) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const { name, age, gender, height, weight, goal, fitnessLevel } = req.body;
        
        if (name) userData.name = name;
        if (age) userData.age = parseInt(age);
        if (gender) userData.gender = gender;
        if (height) userData.height = parseInt(height);
        if (weight) userData.weight = parseInt(weight);
        if (goal) userData.goal = goal;
        if (fitnessLevel) userData.fitnessLevel = fitnessLevel;
        
        userData.updatedAt = new Date().toISOString();
        saveUserData(req.user.userId, userData);
        
        delete userData.password;
        res.json({ success: true, user: userData });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Upload Profile Photo
app.post('/api/user/photo', verifyAccessToken, upload.single('photo'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const userData = loadUserData(req.user.userId);
        if (!userData) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const photoUrl = `/api/uploads/${req.file.filename}`;
        userData.photoUrl = photoUrl;
        userData.updatedAt = new Date().toISOString();
        saveUserData(req.user.userId, userData);
        
        res.json({ success: true, photoUrl });
    } catch (error) {
        console.error('Upload photo error:', error);
        res.status(500).json({ error: 'Failed to upload photo' });
    }
});

// ──────────────────────────────────────────────────────────────
//  WORKOUT ROUTES
// ──────────────────────────────────────────────────────────────

// Get All Workouts
app.get('/api/workouts', verifyAccessToken, (req, res) => {
    try {
        const workoutPath = path.join(workoutsDir, `${req.user.userId}.json`);
        let workouts = [];
        if (fs.existsSync(workoutPath)) {
            workouts = JSON.parse(fs.readFileSync(workoutPath, 'utf8'));
        }
        res.json({ success: true, workouts });
    } catch (error) {
        console.error('Get workouts error:', error);
        res.status(500).json({ error: 'Failed to get workouts' });
    }
});

// Save Workout
app.post('/api/workouts', verifyAccessToken, (req, res) => {
    try {
        const { date, exercises, duration, caloriesBurned } = req.body;
        const workoutPath = path.join(workoutsDir, `${req.user.userId}.json`);
        
        let workouts = [];
        if (fs.existsSync(workoutPath)) {
            workouts = JSON.parse(fs.readFileSync(workoutPath, 'utf8'));
        }
        
        const workout = {
            id: uuidv4(),
            date: date || new Date().toISOString(),
            exercises: exercises || [],
            duration: duration || 0,
            caloriesBurned: caloriesBurned || 0,
            createdAt: new Date().toISOString()
        };
        
        workouts.push(workout);
        fs.writeFileSync(workoutPath, JSON.stringify(workouts, null, 2));
        
        // Update user stats
        const userData = loadUserData(req.user.userId);
        if (userData) {
            userData.workoutsCompleted = (userData.workoutsCompleted || 0) + 1;
            userData.streak = (userData.streak || 0) + 1;
            userData.xp = (userData.xp || 0) + 50;
            userData.level = Math.floor(userData.xp / 100) + 1;
            saveUserData(req.user.userId, userData);
        }
        
        res.json({ success: true, workout });
    } catch (error) {
        console.error('Save workout error:', error);
        res.status(500).json({ error: 'Failed to save workout' });
    }
});

// ──────────────────────────────────────────────────────────────
//  NUTRITION ROUTES
// ──────────────────────────────────────────────────────────────

// Get Nutrition Logs
app.get('/api/nutrition', verifyAccessToken, (req, res) => {
    try {
        const nutritionPath = path.join(nutritionDir, `${req.user.userId}.json`);
        let logs = [];
        if (fs.existsSync(nutritionPath)) {
            logs = JSON.parse(fs.readFileSync(nutritionPath, 'utf8'));
        }
        res.json({ success: true, logs });
    } catch (error) {
        console.error('Get nutrition error:', error);
        res.status(500).json({ error: 'Failed to get nutrition logs' });
    }
});

// Log Nutrition
app.post('/api/nutrition', verifyAccessToken, (req, res) => {
    try {
        const { mealType, food, calories, protein, carbs, fats } = req.body;
        const nutritionPath = path.join(nutritionDir, `${req.user.userId}.json`);
        
        let logs = [];
        if (fs.existsSync(nutritionPath)) {
            logs = JSON.parse(fs.readFileSync(nutritionPath, 'utf8'));
        }
        
        const log = {
            id: uuidv4(),
            date: new Date().toISOString(),
            mealType: mealType || 'snack',
            food: food || 'Unknown food',
            calories: calories || 0,
            protein: protein || 0,
            carbs: carbs || 0,
            fats: fats || 0
        };
        
        logs.push(log);
        fs.writeFileSync(nutritionPath, JSON.stringify(logs, null, 2));
        
        res.json({ success: true, log });
    } catch (error) {
        console.error('Log nutrition error:', error);
        res.status(500).json({ error: 'Failed to log nutrition' });
    }
});

// ──────────────────────────────────────────────────────────────
//  PROGRESS ROUTES
// ──────────────────────────────────────────────────────────────

// Get Progress Data
app.get('/api/progress', verifyAccessToken, (req, res) => {
    try {
        const progressPath = path.join(progressDir, `${req.user.userId}.json`);
        let progress = {};
        if (fs.existsSync(progressPath)) {
            progress = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
        }
        res.json({ success: true, progress });
    } catch (error) {
        console.error('Get progress error:', error);
        res.status(500).json({ error: 'Failed to get progress' });
    }
});

// Save Progress
app.post('/api/progress', verifyAccessToken, (req, res) => {
    try {
        const { date, weight, bodyFat, muscleMass, measurements } = req.body;
        const progressPath = path.join(progressDir, `${req.user.userId}.json`);
        
        let progress = {};
        if (fs.existsSync(progressPath)) {
            progress = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
        }
        
        if (!progress.history) progress.history = [];
        
        const entry = {
            date: date || new Date().toISOString(),
            weight: weight || null,
            bodyFat: bodyFat || null,
            muscleMass: muscleMass || null,
            measurements: measurements || {}
        };
        
        progress.history.push(entry);
        progress.current = entry;
        progress.updatedAt = new Date().toISOString();
        
        fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
        
        res.json({ success: true, progress });
    } catch (error) {
        console.error('Save progress error:', error);
        res.status(500).json({ error: 'Failed to save progress' });
    }
});

// ──────────────────────────────────────────────────────────────
//  CHALLENGE ROUTES
// ──────────────────────────────────────────────────────────────

// Get All Challenges
app.get('/api/challenges', (req, res) => {
    try {
        const challenges = [
            { id: 1, name: '100 Push-ups', icon: '💪', target: 100, unit: 'reps', xp: 100 },
            { id: 2, name: '2-Minute Plank', icon: '🧘', target: 120, unit: 'seconds', xp: 100 },
            { id: 3, name: '50 Squats', icon: '🦵', target: 50, unit: 'reps', xp: 100 },
            { id: 4, name: '10 Pull-ups', icon: '💪', target: 10, unit: 'reps', xp: 100 },
            { id: 5, name: '100 Jumping Jacks', icon: '🔥', target: 100, unit: 'reps', xp: 100 },
            { id: 6, name: '30 Lunges', icon: '🚶', target: 30, unit: 'reps', xp: 100 },
            { id: 7, name: '20 Burpees', icon: '⚡', target: 20, unit: 'reps', xp: 100 },
            { id: 8, name: '50 Mountain Climbers', icon: '🔥', target: 50, unit: 'reps', xp: 100 }
        ];
        res.json({ success: true, challenges });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get challenges' });
    }
});

// ──────────────────────────────────────────────────────────────
//  STATS ROUTES
// ──────────────────────────────────────────────────────────────

// Get Global Stats
app.get('/api/stats', (req, res) => {
    try {
        const userFiles = fs.readdirSync(usersDir).filter(f => f.endsWith('.json'));
        let totalUsers = userFiles.length;
        let totalWorkouts = 0;
        let totalXP = 0;
        let premiumUsers = 0;
        
        userFiles.forEach(file => {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(usersDir, file), 'utf8'));
                totalWorkouts += data.workoutsCompleted || 0;
                totalXP += data.xp || 0;
                if (data.isPremium) premiumUsers++;
            } catch (e) {}
        });
        
        res.json({
            success: true,
            stats: {
                totalUsers,
                totalWorkouts,
                totalXP,
                premiumUsers,
                averageWorkouts: totalUsers > 0 ? Math.round(totalWorkouts / totalUsers) : 0,
                averageXP: totalUsers > 0 ? Math.round(totalXP / totalUsers) : 0
            }
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// ──────────────────────────────────────────────────────────────
//  ADMIN ROUTES (Protected)
// ──────────────────────────────────────────────────────────────

// Admin middleware
function verifyAdmin(req, res, next) {
    // Simple admin check - in production use proper admin roles
    const adminToken = req.headers['x-admin-token'];
    if (adminToken === process.env.ADMIN_TOKEN || adminToken === 'admin123') {
        next();
    } else {
        res.status(403).json({ error: 'Admin access required' });
    }
}

// Get All Users (Admin)
app.get('/api/admin/users', verifyAdmin, (req, res) => {
    try {
        const userFiles = fs.readdirSync(usersDir).filter(f => f.endsWith('.json'));
        const users = userFiles.map(file => {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(usersDir, file), 'utf8'));
                delete data.password;
                return data;
            } catch (e) {
                return null;
            }
        }).filter(u => u !== null);
        res.json({ success: true, users });
    } catch (error) {
        console.error('Admin users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// Get User Details (Admin)
app.get('/api/admin/users/:userId', verifyAdmin, (req, res) => {
    try {
        const userData = loadUserData(req.params.userId);
        if (!userData) {
            return res.status(404).json({ error: 'User not found' });
        }
        delete userData.password;
        res.json({ success: true, user: userData });
    } catch (error) {
        console.error('Admin user detail error:', error);
        res.status(500).json({ error: 'Failed to get user details' });
    }
});

// ──────────────────────────────────────────────────────────────
//  UPLOAD ROUTE
// ──────────────────────────────────────────────────────────────
app.get('/api/uploads/:filename', (req, res) => {
    const filePath = path.join(uploadsDir, req.params.filename);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

// ──────────────────────────────────────────────────────────────
//  SERVE STATIC FILES
// ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    try {
        const indexPath = path.join(__dirname, 'index.html');
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            res.send(`
                <h1>🏋️ AI Gym Trainer Pro Max 100</h1>
                <p>Server is running! Please upload your HTML file.</p>
                <p>Current directory: ${__dirname}</p>
                <p>Files: ${fs.readdirSync(__dirname).join(', ')}</p>
            `);
        }
    } catch (error) {
        res.status(500).send('Server error');
    }
});

// Catch-all route
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

// ──────────────────────────────────────────────────────────────
//  ERROR HANDLER
// ──────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: err.message });
    }
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
    console.log(`📁 Users: ${usersDir}`);
    console.log(`📁 Workouts: ${workoutsDir}`);
    console.log(`📁 Nutrition: ${nutritionDir}`);
    console.log(`📁 Progress: ${progressDir}`);
    console.log(`📁 Uploads: ${uploadsDir}`);
    console.log(`🤖 Bot Token: ${BOT_TOKEN ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`🌐 WebApp URL: ${WEBAPP_URL}`);
    console.log('========================================');
    console.log('📊 Status: Ready');
    console.log(`💪 Exercises: 300+`);
    console.log(`🏆 Challenges: 100+`);
    console.log(`🎯 Achievements: 100+`);
    console.log(`🔐 JWT: Enabled`);
    console.log(`📸 Upload: Enabled`);
    console.log('========================================');
    console.log('\n📱 Open in browser: http://localhost:' + PORT);
    console.log('🤖 Bot Commands:');
    console.log('   /start - Welcome menu');
    console.log('   /menu - Main menu');
    console.log('========================================');
    console.log('📡 API Endpoints:');
    console.log('   POST /api/auth/register - Register');
    console.log('   POST /api/auth/login - Login');
    console.log('   POST /api/auth/telegram - Telegram login');
    console.log('   POST /api/auth/guest - Guest login');
    console.log('   GET  /api/user/profile - Get profile');
    console.log('   PUT  /api/user/profile - Update profile');
    console.log('   GET  /api/workouts - Get workouts');
    console.log('   POST /api/workouts - Save workout');
    console.log('   GET  /api/nutrition - Get nutrition');
    console.log('   POST /api/nutrition - Log nutrition');
    console.log('   GET  /api/progress - Get progress');
    console.log('   POST /api/progress - Save progress');
    console.log('   GET  /api/challenges - Get challenges');
    console.log('   GET  /api/stats - Get stats');
    console.log('========================================');
});

module.exports = app;
