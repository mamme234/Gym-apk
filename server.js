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

// ──────────────────────────────────────────────────────────────
//  ALL CONFIG FROM .env
// ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;
const APP_URL = process.env.APP_URL || process.env.WEBAPP_URL;
const ADMIN_ID = process.env.ADMIN_ID;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin123';
const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_URL = process.env.DATABASE_URL;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ──────────────────────────────────────────────────────────────
//  MIDDLEWARE
// ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname));

// ──────────────────────────────────────────────────────────────
//  FILE SYSTEM
// ──────────────────────────────────────────────────────────────
const dirs = [
    path.join(__dirname, 'data', 'users'),
    path.join(__dirname, 'data', 'workouts'),
    path.join(__dirname, 'data', 'nutrition'),
    path.join(__dirname, 'data', 'progress'),
    path.join(__dirname, 'uploads'),
    path.join(__dirname, 'logs')
];

dirs.forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ──────────────────────────────────────────────────────────────
//  MULTER
// ──────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${uuidv4().slice(0, 8)}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4'];
        cb(null, allowed.includes(file.mimetype));
    }
});

// ──────────────────────────────────────────────────────────────
//  JWT
// ──────────────────────────────────────────────────────────────
function generateTokens(userId, email) {
    return {
        accessToken: jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '15m' }),
        refreshToken: jwt.sign({ userId, email }, REFRESH_SECRET, { expiresIn: '7d' })
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
//  ADMIN
// ──────────────────────────────────────────────────────────────
function verifyAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Admin token required' });
    try {
        const token = authHeader.split(' ')[1];
        if (token === ADMIN_TOKEN || token === process.env.ADMIN_TOKEN) {
            next();
        } else {
            const decoded = jwt.verify(token, JWT_SECRET);
            if (decoded.role === 'admin' || decoded.userId === ADMIN_ID) {
                next();
            } else {
                res.status(403).json({ error: 'Admin access required' });
            }
        }
    } catch (error) {
        res.status(401).json({ error: 'Invalid admin token' });
    }
}

// ──────────────────────────────────────────────────────────────
//  USER FUNCTIONS
// ──────────────────────────────────────────────────────────────
function getUserFile(userId) {
    return path.join(__dirname, 'data', 'users', `${userId}.json`);
}

function loadUser(userId) {
    try {
        const file = getUserFile(userId);
        if (fs.existsSync(file)) {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        }
        return null;
    } catch (e) {
        return null;
    }
}

function saveUser(userId, data) {
    try {
        fs.writeFileSync(getUserFile(userId), JSON.stringify(data, null, 2));
        return true;
    } catch (e) {
        console.error('Save error:', e);
        return false;
    }
}

// ──────────────────────────────────────────────────────────────
//  TELEGRAM BOT
// ──────────────────────────────────────────────────────────────
async function sendTelegram(chatId, text, replyMarkup = null) {
    if (!BOT_TOKEN) return;
    try {
        const payload = { chat_id: chatId, text, parse_mode: 'HTML' };
        if (replyMarkup) payload.reply_markup = replyMarkup;
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, payload);
    } catch (e) {
        console.error('Telegram error:', e.message);
    }
}

const MAIN_MENU = {
    inline_keyboard: [
        [{ text: '🏋️ Open Gym', web_app: { url: WEBAPP_URL } }],
        [{ text: '📊 Progress', callback_data: 'progress' }],
        [{ text: '🏆 Challenges', callback_data: 'challenges' }],
        [{ text: '👑 Admin', callback_data: 'admin' }],
        [{ text: '❓ Help', callback_data: 'help' }]
    ]
};

// ──────────────────────────────────────────────────────────────
//  ROUTES
// ──────────────────────────────────────────────────────────────

// Health Check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        app: 'AI Gym Trainer Pro Max 100',
        env: NODE_ENV,
        bot: BOT_TOKEN ? 'active' : 'inactive',
        admin: ADMIN_ID ? 'set' : 'not set'
    });
});

// ──────────────────────────────────────────────────────────────
//  AUTH ROUTES
// ──────────────────────────────────────────────────────────────

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }
        
        const userFiles = fs.readdirSync(path.join(__dirname, 'data', 'users')).filter(f => f.endsWith('.json'));
        for (const file of userFiles) {
            const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'users', file), 'utf8'));
            if (data.email === email) {
                return res.status(400).json({ error: 'User already exists' });
            }
        }
        
        const userId = `user_${Date.now()}_${uuidv4().slice(0, 8)}`;
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const userData = {
            userId,
            email,
            name: name || 'User',
            password: hashedPassword,
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
            isPremium: false
        };
        
        saveUser(userId, userData);
        const tokens = generateTokens(userId, email);
        
        res.status(201).json({
            success: true,
            user: { userId, email, name: userData.name },
            ...tokens
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }
        
        let userData = null;
        let userId = null;
        const userFiles = fs.readdirSync(path.join(__dirname, 'data', 'users')).filter(f => f.endsWith('.json'));
        for (const file of userFiles) {
            const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'users', file), 'utf8'));
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
        
        const tokens = generateTokens(userId, email);
        res.json({
            success: true,
            user: { userId, email, name: userData.name },
            ...tokens
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
        const userFiles = fs.readdirSync(path.join(__dirname, 'data', 'users')).filter(f => f.endsWith('.json'));
        for (const file of userFiles) {
            const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'users', file), 'utf8'));
            if (data.telegramId === telegramId) {
                userData = data;
                userId = file.replace('.json', '');
                break;
            }
        }
        
        if (!userData) {
            userId = `user_${Date.now()}_${uuidv4().slice(0, 8)}`;
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
                isPremium: false
            };
            saveUser(userId, userData);
        }
        
        const tokens = generateTokens(userId, userData.email);
        res.json({
            success: true,
            user: { userId, email: userData.email, name: userData.name, photoUrl: userData.photoUrl },
            ...tokens
        });
    } catch (error) {
        console.error('Telegram login error:', error);
        res.status(500).json({ error: 'Telegram login failed' });
    }
});

// Guest Login
app.post('/api/auth/guest', (req, res) => {
    try {
        const userId = `guest_${Date.now()}_${uuidv4().slice(0, 8)}`;
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
            isGuest: true
        };
        saveUser(userId, userData);
        
        const tokens = generateTokens(userId, userData.email);
        res.json({
            success: true,
            user: { userId, email: userData.email, name: userData.name, isGuest: true },
            ...tokens
        });
    } catch (error) {
        console.error('Guest login error:', error);
        res.status(500).json({ error: 'Guest login failed' });
    }
});

// Refresh Token
app.post('/api/auth/refresh', (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token required' });
        }
        const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
        const tokens = generateTokens(decoded.userId, decoded.email);
        res.json({ success: true, ...tokens });
    } catch (error) {
        res.status(401).json({ error: 'Invalid refresh token' });
    }
});

// ──────────────────────────────────────────────────────────────
//  USER PROFILE ROUTES
// ──────────────────────────────────────────────────────────────

app.get('/api/user/profile', verifyToken, (req, res) => {
    try {
        const userData = loadUser(req.user.userId);
        if (!userData) {
            return res.status(404).json({ error: 'User not found' });
        }
        delete userData.password;
        res.json({ success: true, user: userData });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

app.put('/api/user/profile', verifyToken, (req, res) => {
    try {
        const userData = loadUser(req.user.userId);
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
        saveUser(req.user.userId, userData);
        delete userData.password;
        res.json({ success: true, user: userData });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

app.post('/api/user/photo', verifyToken, upload.single('photo'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const userData = loadUser(req.user.userId);
        if (!userData) {
            return res.status(404).json({ error: 'User not found' });
        }
        const photoUrl = `/api/uploads/${req.file.filename}`;
        userData.photoUrl = photoUrl;
        saveUser(req.user.userId, userData);
        res.json({ success: true, photoUrl });
    } catch (error) {
        res.status(500).json({ error: 'Failed to upload photo' });
    }
});

// ──────────────────────────────────────────────────────────────
//  WORKOUT ROUTES
// ──────────────────────────────────────────────────────────────

app.get('/api/workouts', verifyToken, (req, res) => {
    try {
        const file = path.join(__dirname, 'data', 'workouts', `${req.user.userId}.json`);
        let workouts = [];
        if (fs.existsSync(file)) {
            workouts = JSON.parse(fs.readFileSync(file, 'utf8'));
        }
        res.json({ success: true, workouts });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get workouts' });
    }
});

app.post('/api/workouts', verifyToken, (req, res) => {
    try {
        const { date, exercises, duration, caloriesBurned } = req.body;
        const file = path.join(__dirname, 'data', 'workouts', `${req.user.userId}.json`);
        let workouts = [];
        if (fs.existsSync(file)) {
            workouts = JSON.parse(fs.readFileSync(file, 'utf8'));
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
        fs.writeFileSync(file, JSON.stringify(workouts, null, 2));
        
        // Update user stats
        const userData = loadUser(req.user.userId);
        if (userData) {
            userData.workoutsCompleted = (userData.workoutsCompleted || 0) + 1;
            userData.streak = (userData.streak || 0) + 1;
            userData.xp = (userData.xp || 0) + 50;
            userData.level = Math.floor(userData.xp / 100) + 1;
            saveUser(req.user.userId, userData);
        }
        res.json({ success: true, workout });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save workout' });
    }
});

// ──────────────────────────────────────────────────────────────
//  NUTRITION ROUTES
// ──────────────────────────────────────────────────────────────

app.get('/api/nutrition', verifyToken, (req, res) => {
    try {
        const file = path.join(__dirname, 'data', 'nutrition', `${req.user.userId}.json`);
        let logs = [];
        if (fs.existsSync(file)) {
            logs = JSON.parse(fs.readFileSync(file, 'utf8'));
        }
        res.json({ success: true, logs });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get nutrition' });
    }
});

app.post('/api/nutrition', verifyToken, (req, res) => {
    try {
        const { mealType, food, calories, protein, carbs, fats } = req.body;
        const file = path.join(__dirname, 'data', 'nutrition', `${req.user.userId}.json`);
        let logs = [];
        if (fs.existsSync(file)) {
            logs = JSON.parse(fs.readFileSync(file, 'utf8'));
        }
        const log = {
            id: uuidv4(),
            date: new Date().toISOString(),
            mealType: mealType || 'snack',
            food: food || 'Unknown',
            calories: calories || 0,
            protein: protein || 0,
            carbs: carbs || 0,
            fats: fats || 0
        };
        logs.push(log);
        fs.writeFileSync(file, JSON.stringify(logs, null, 2));
        res.json({ success: true, log });
    } catch (error) {
        res.status(500).json({ error: 'Failed to log nutrition' });
    }
});

// ──────────────────────────────────────────────────────────────
//  PROGRESS ROUTES
// ──────────────────────────────────────────────────────────────

app.get('/api/progress', verifyToken, (req, res) => {
    try {
        const file = path.join(__dirname, 'data', 'progress', `${req.user.userId}.json`);
        let progress = {};
        if (fs.existsSync(file)) {
            progress = JSON.parse(fs.readFileSync(file, 'utf8'));
        }
        res.json({ success: true, progress });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get progress' });
    }
});

app.post('/api/progress', verifyToken, (req, res) => {
    try {
        const { date, weight, bodyFat, muscleMass, measurements } = req.body;
        const file = path.join(__dirname, 'data', 'progress', `${req.user.userId}.json`);
        let progress = {};
        if (fs.existsSync(file)) {
            progress = JSON.parse(fs.readFileSync(file, 'utf8'));
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
        fs.writeFileSync(file, JSON.stringify(progress, null, 2));
        res.json({ success: true, progress });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save progress' });
    }
});

// ──────────────────────────────────────────────────────────────
//  ADMIN ROUTES
// ──────────────────────────────────────────────────────────────

// Get All Users (Admin)
app.get('/api/admin/users', verifyAdmin, (req, res) => {
    try {
        const userFiles = fs.readdirSync(path.join(__dirname, 'data', 'users')).filter(f => f.endsWith('.json'));
        const users = userFiles.map(file => {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'users', file), 'utf8'));
                delete data.password;
                return data;
            } catch (e) {
                return null;
            }
        }).filter(u => u !== null);
        res.json({ success: true, users });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// Get User (Admin)
app.get('/api/admin/users/:userId', verifyAdmin, (req, res) => {
    try {
        const userData = loadUser(req.params.userId);
        if (!userData) {
            return res.status(404).json({ error: 'User not found' });
        }
        delete userData.password;
        res.json({ success: true, user: userData });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// Delete User (Admin)
app.delete('/api/admin/users/:userId', verifyAdmin, (req, res) => {
    try {
        const file = getUserFile(req.params.userId);
        if (fs.existsSync(file)) {
            fs.unlinkSync(file);
            res.json({ success: true, message: 'User deleted' });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Get All Workouts (Admin)
app.get('/api/admin/workouts', verifyAdmin, (req, res) => {
    try {
        const workoutFiles = fs.readdirSync(path.join(__dirname, 'data', 'workouts')).filter(f => f.endsWith('.json'));
        const allWorkouts = {};
        workoutFiles.forEach(file => {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'workouts', file), 'utf8'));
                allWorkouts[file.replace('.json', '')] = data;
            } catch (e) {}
        });
        res.json({ success: true, workouts: allWorkouts });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get workouts' });
    }
});

// Get Stats (Admin)
app.get('/api/admin/stats', verifyAdmin, (req, res) => {
    try {
        const userFiles = fs.readdirSync(path.join(__dirname, 'data', 'users')).filter(f => f.endsWith('.json'));
        let totalUsers = userFiles.length;
        let totalWorkouts = 0;
        let totalXP = 0;
        let premiumUsers = 0;
        
        userFiles.forEach(file => {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'users', file), 'utf8'));
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
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// ──────────────────────────────────────────────────────────────
//  STATS ROUTES (Public)
// ──────────────────────────────────────────────────────────────

app.get('/api/stats', (req, res) => {
    try {
        const userFiles = fs.readdirSync(path.join(__dirname, 'data', 'users')).filter(f => f.endsWith('.json'));
        let totalUsers = userFiles.length;
        let totalWorkouts = 0;
        
        userFiles.forEach(file => {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'users', file), 'utf8'));
                totalWorkouts += data.workoutsCompleted || 0;
            } catch (e) {}
        });
        
        res.json({
            success: true,
            stats: {
                totalUsers,
                totalWorkouts,
                exercises: 300,
                challenges: 100,
                achievements: 100
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// ──────────────────────────────────────────────────────────────
//  UPLOAD ROUTE
// ──────────────────────────────────────────────────────────────

app.get('/api/uploads/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.filename);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

// ──────────────────────────────────────────────────────────────
//  TELEGRAM WEBHOOK
// ──────────────────────────────────────────────────────────────

app.post('/webhook', async (req, res) => {
    try {
        const update = req.body;
        
        if (update.callback_query) {
            const query = update.callback_query;
            const chatId = query.message.chat.id;
            const data = query.data;
            
            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
                callback_query_id: query.id
            });
            
            if (data === 'menu') {
                await sendTelegram(chatId, '🏋️ Main Menu', MAIN_MENU);
            } else if (data === 'progress') {
                // Find user by telegramId
                let userData = null;
                const userFiles = fs.readdirSync(path.join(__dirname, 'data', 'users')).filter(f => f.endsWith('.json'));
                for (const file of userFiles) {
                    const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'users', file), 'utf8'));
                    if (data.telegramId === chatId.toString()) {
                        userData = data;
                        break;
                    }
                }
                
                let msg = '📊 <b>Your Progress</b>\n\n';
                if (userData) {
                    msg += `👤 Name: ${userData.name}\n`;
                    msg += `📏 Height: ${userData.height}cm\n`;
                    msg += `⚖️ Weight: ${userData.weight}kg\n`;
                    msg += `🎯 Goal: ${userData.goal}\n`;
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
            } else if (data === 'challenges') {
                await sendTelegram(chatId, '🏆 <b>Challenges</b>\n\n💪 100 Push-ups\n🧘 2-Min Plank\n🦵 50 Squats\n💪 10 Pull-ups\n🔥 100 Jumping Jacks\n🚶 30 Lunges\n⚡ 20 Burpees\n🔥 50 Mountain Climbers', {
                    inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu' }]]
                });
            } else if (data === 'admin') {
                if (chatId.toString() === ADMIN_ID) {
                    await sendTelegram(chatId, '👑 <b>Admin Panel</b>\n\nUse the web app for full admin control.', {
                        inline_keyboard: [
                            [{ text: '📊 Admin Dashboard', web_app: { url: WEBAPP_URL + '/admin' } }],
                            [{ text: '🔙 Back', callback_data: 'menu' }]
                        ]
                    });
                } else {
                    await sendTelegram(chatId, '⛔ You are not an admin.');
                }
            } else if (data === 'help') {
                await sendTelegram(chatId, '❓ <b>Help</b>\n\n1️⃣ Open Gym - Launch the app\n2️⃣ Progress - View your stats\n3️⃣ Challenges - Start challenges\n4️⃣ Admin - Admin panel (admins only)\n\n💡 The app has AI form correction!', {
                    inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu' }]]
                });
            }
            return res.sendStatus(200);
        }
        
        if (update.message) {
            const chatId = update.message.chat.id;
            const text = update.message.text || '';
            
            if (text === '/start') {
                await sendTelegram(chatId, '🏋️ <b>Welcome to AI Gym Trainer Pro Max 100!</b>\n\n💪 Your AI-powered fitness companion!\n\n🚀 Ready to start?', MAIN_MENU);
            } else if (text === '/menu') {
                await sendTelegram(chatId, '🏋️ Main Menu', MAIN_MENU);
            } else if (text === '/admin' && chatId.toString() === ADMIN_ID) {
                await sendTelegram(chatId, '👑 Admin Panel', {
                    inline_keyboard: [
                        [{ text: '📊 Dashboard', web_app: { url: WEBAPP_URL + '/admin' } }],
                        [{ text: '🔙 Back', callback_data: 'menu' }]
                    ]
                });
            } else {
                // Echo back
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
//  SERVE FRONTEND
// ──────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.send(`
            <h1>🏋️ AI Gym Trainer Pro Max 100</h1>
            <p>Server is running!</p>
            <p>📡 API: <a href="/api/health">/api/health</a></p>
            <p>📱 WebApp URL: ${WEBAPP_URL}</p>
        `);
    }
});

app.get('/admin', (req, res) => {
    res.send(`
        <h1>👑 Admin Dashboard</h1>
        <p>Access via the main app or Telegram bot.</p>
        <p><a href="/">← Back to Home</a></p>
    `);
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
    console.log('\n========================================');
    console.log('🏋️ AI Gym Trainer Pro Max 100');
    console.log('========================================');
    console.log(`🚀 Server running on: http://localhost:${PORT}`);
    console.log(`📡 App URL: ${APP_URL}`);
    console.log(`📱 WebApp URL: ${WEBAPP_URL}`);
    console.log(`👑 Admin ID: ${ADMIN_ID}`);
    console.log(`🤖 Bot Token: ${BOT_TOKEN ? '✅ Set' : '❌ Not set'}`);
    console.log(`🗄️ MongoDB: ${MONGODB_URI ? '✅ Set' : '❌ Not set'}`);
    console.log(`🔐 JWT: ${JWT_SECRET ? '✅ Set' : '❌ Not set'}`);
    console.log('========================================');
    console.log('\n📱 Open in browser:');
    console.log(`   http://localhost:${PORT}`);
    console.log(`   ${APP_URL}`);
    console.log('\n🤖 Bot Commands:');
    console.log('   /start - Welcome menu');
    console.log('   /menu - Main menu');
    console.log('   /admin - Admin panel (admins only)');
    console.log('========================================\n');
});

module.exports = app;
