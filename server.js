// =============================================
// BACKEND - server.js (Full Admin Panel + Telegram Bot)
// =============================================

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
require('dotenv').config();

const app = express();

// =============================================
// MIDDLEWARE
// =============================================

app.use(helmet());
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

console.log('🚀 Starting server...');
console.log('📡 Webhook URL:', process.env.WEBHOOK_URL);

// =============================================
// DATABASE CONNECTION
// =============================================

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000
});

mongoose.connection.on('connected', () => console.log('✅ MongoDB connected'));
mongoose.connection.on('error', (err) => console.error('❌ MongoDB error:', err));

// =============================================
// MODELS
// =============================================

// User Model
const UserSchema = new mongoose.Schema({
    telegramId: { type: String, unique: true, sparse: true },
    email: { type: String, unique: true, sparse: true },
    password: { type: String },
    username: { type: String, unique: true, sparse: true },
    fullName: { type: String },
    profilePhoto: { type: String },
    gender: { type: String, enum: ['Male', 'Female', 'Non-binary'] },
    age: { type: Number },
    height: { type: Number },
    weight: { type: Number },
    fitnessLevel: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced', 'Professional'], default: 'Beginner' },
    fitnessGoal: { type: String, enum: ['Lose Weight', 'Build Muscle', 'Maintain Fitness', 'Increase Strength'], default: 'Build Muscle' },
    activityLevel: { type: String, enum: ['Sedentary', 'Light', 'Moderate', 'Active', 'Very Active'] },
    role: { type: String, enum: ['User', 'Admin', 'SuperAdmin'], default: 'User' },
    isPremium: { type: Boolean, default: false },
    premiumExpiry: { type: Date },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    streak: { type: Number, default: 0 },
    lastWorkoutDate: { type: Date },
    isActive: { type: Boolean, default: true },
    isBanned: { type: Boolean, default: false },
    refreshTokens: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

// Exercise Model
const ExerciseSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: String, required: true },
    muscle: { type: String, required: true },
    difficulty: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced', 'Professional'] },
    equipment: { type: String },
    video: { type: String },
    image: { type: String },
    description: { type: String },
    instructions: { type: String },
    sets: { type: Number, default: 3 },
    reps: { type: String, default: '8-12' },
    rest: { type: String, default: '60s' },
    tempo: { type: String, default: '2010' },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Exercise = mongoose.model('Exercise', ExerciseSchema);

// Workout Model
const WorkoutSchema = new mongoose.Schema({
    name: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    exercises: [{
        exerciseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise' },
        sets: { type: Number },
        reps: { type: String },
        weight: { type: Number },
        rest: { type: String },
        completed: { type: Boolean, default: false }
    }],
    category: { type: String },
    difficulty: { type: String },
    duration: { type: Number },
    calories: { type: Number },
    date: { type: Date, default: Date.now },
    completed: { type: Boolean, default: false },
    completionTime: { type: Date },
    rating: { type: Number, min: 1, max: 5 },
    notes: { type: String }
});

const Workout = mongoose.model('Workout', WorkoutSchema);

// Progress Model
const ProgressSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, default: Date.now },
    weight: { type: Number },
    bodyFat: { type: Number },
    bmi: { type: Number },
    chest: { type: Number },
    waist: { type: Number },
    hips: { type: Number },
    arms: { type: Number },
    legs: { type: Number },
    caloriesBurned: { type: Number },
    workoutDuration: { type: Number },
    exercisesCompleted: { type: Number }
});

const Progress = mongoose.model('Progress', ProgressSchema);

// Nutrition Model
const NutritionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, default: Date.now },
    calories: { type: Number },
    protein: { type: Number },
    carbs: { type: Number },
    fat: { type: Number },
    fiber: { type: Number },
    water: { type: Number },
    meals: [{
        type: { type: String, enum: ['Breakfast', 'Lunch', 'Dinner', 'Snack'] },
        name: { type: String },
        calories: { type: Number },
        protein: { type: Number },
        carbs: { type: Number },
        fat: { type: Number }
    }]
});

const Nutrition = mongoose.model('Nutrition', NutritionSchema);

// Challenge Model
const ChallengeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    difficulty: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'] },
    type: { type: String, enum: ['Daily', 'Weekly', 'Monthly'] },
    startDate: { type: Date },
    endDate: { type: Date },
    exercises: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Exercise' }],
    requiredWorkouts: { type: Number },
    rewardXp: { type: Number },
    rewardBadge: { type: String },
    participants: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        progress: { type: Number, default: 0 },
        completed: { type: Boolean, default: false },
        joinedAt: { type: Date, default: Date.now }
    }],
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

const Challenge = mongoose.model('Challenge', ChallengeSchema);

// Notification Model
const NotificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: ['Workout', 'Meal', 'Water', 'Challenge', 'Achievement', 'System', 'Admin'] },
    title: { type: String },
    message: { type: String },
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const Notification = mongoose.model('Notification', NotificationSchema);

// Achievement Model
const AchievementSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    description: { type: String },
    badge: { type: String },
    xpEarned: { type: Number },
    earnedAt: { type: Date, default: Date.now }
});

const Achievement = mongoose.model('Achievement', AchievementSchema);

// Admin Log Model
const AdminLogSchema = new mongoose.Schema({
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String },
    target: { type: String },
    targetId: { type: String },
    details: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String },
    createdAt: { type: Date, default: Date.now }
});

const AdminLog = mongoose.model('AdminLog', AdminLogSchema);

// =============================================
// AUTH MIDDLEWARE
// =============================================

const authenticate = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        if (!user || !user.isActive || user.isBanned) {
            return res.status(401).json({ error: 'User not found or banned' });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied. Admin only.' });
        }
        next();
    };
};

const isAdmin = authorize('Admin', 'SuperAdmin');
const isSuperAdmin = authorize('SuperAdmin');

// =============================================
// TELEGRAM BOT FUNCTIONS
// =============================================

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : [];

async function sendTelegramMessage(chatId, text, replyMarkup = null) {
    try {
        const response = await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML',
            reply_markup: replyMarkup
        });
        return response.data;
    } catch (error) {
        console.error('❌ Send message error:', error.response?.data || error.message);
        throw error;
    }
}

async function sendTelegramPhoto(chatId, photoUrl, caption = '') {
    try {
        const response = await axios.post(`${TELEGRAM_API}/sendPhoto`, {
            chat_id: chatId,
            photo: photoUrl,
            caption: caption,
            parse_mode: 'HTML'
        });
        return response.data;
    } catch (error) {
        console.error('❌ Send photo error:', error.response?.data || error.message);
    }
}

// =============================================
// AUTH ROUTES
// =============================================

// Register
app.post('/api/v1/auth/register', async (req, res) => {
    try {
        const { email, username, password, fullName } = req.body;

        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({
            email,
            username,
            password: hashedPassword,
            fullName
        });

        await user.save();

        const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
        const refreshToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

        user.refreshTokens.push(refreshToken);
        await user.save();

        res.status(201).json({
            success: true,
            token,
            refreshToken,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                isPremium: user.isPremium,
                level: user.level,
                xp: user.xp
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
app.post('/api/v1/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
        const refreshToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

        user.refreshTokens.push(refreshToken);
        await user.save();

        res.json({
            success: true,
            token,
            refreshToken,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                isPremium: user.isPremium,
                level: user.level,
                xp: user.xp,
                streak: user.streak
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Telegram Auth
app.post('/api/v1/auth/telegram', async (req, res) => {
    try {
        const { telegramId, username, firstName, lastName, photoUrl } = req.body;

        let user = await User.findOne({ telegramId });
        if (!user) {
            user = new User({
                telegramId,
                username: username || `telegram_${telegramId}`,
                fullName: `${firstName || ''} ${lastName || ''}`.trim() || 'Telegram User',
                profilePhoto: photoUrl
            });
            await user.save();
        }

        const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                username: user.username,
                fullName: user.fullName,
                role: user.role,
                isPremium: user.isPremium,
                level: user.level,
                xp: user.xp,
                streak: user.streak
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Telegram authentication failed' });
    }
});

// Refresh Token
app.post('/api/v1/auth/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(401).json({ error: 'Refresh token required' });
        }

        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user || !user.refreshTokens.includes(refreshToken)) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }

        const newToken = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
        const newRefreshToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

        user.refreshTokens = user.refreshTokens.filter(t => t !== refreshToken);
        user.refreshTokens.push(newRefreshToken);
        await user.save();

        res.json({ success: true, token: newToken, refreshToken: newRefreshToken });
    } catch (error) {
        res.status(401).json({ error: 'Invalid refresh token' });
    }
});

// Logout
app.post('/api/v1/auth/logout', authenticate, async (req, res) => {
    try {
        const { refreshToken } = req.body;
        req.user.refreshTokens = req.user.refreshTokens.filter(t => t !== refreshToken);
        await req.user.save();
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Logout failed' });
    }
});

// =============================================
// USER ROUTES
// =============================================

// Get Profile
app.get('/api/v1/users/profile', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password -refreshTokens');
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

// Update Profile
app.put('/api/v1/users/profile', authenticate, async (req, res) => {
    try {
        const allowed = ['fullName', 'gender', 'age', 'height', 'weight', 'fitnessLevel', 
                        'fitnessGoal', 'activityLevel'];
        const updates = {};
        allowed.forEach(field => {
            if (req.body[field] !== undefined) updates[field] = req.body[field];
        });

        const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true })
            .select('-password -refreshTokens');
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// =============================================
// ADMIN ROUTES
// =============================================

// === Dashboard Stats ===
app.get('/api/v1/admin/dashboard', authenticate, isAdmin, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ isActive: true });
        const bannedUsers = await User.countDocuments({ isBanned: true });
        const premiumUsers = await User.countDocuments({ isPremium: true });
        const totalWorkouts = await Workout.countDocuments({ completed: true });
        const totalExercises = await Exercise.countDocuments();
        const totalChallenges = await Challenge.countDocuments({ isActive: true });

        // Recent users
        const recentUsers = await User.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('-password -refreshTokens');

        // Recent workouts
        const recentWorkouts = await Workout.find({ completed: true })
            .sort({ completionTime: -1 })
            .limit(5)
            .populate('userId', 'fullName username');

        res.json({
            success: true,
            stats: {
                totalUsers,
                activeUsers,
                bannedUsers,
                premiumUsers,
                totalWorkouts,
                totalExercises,
                totalChallenges
            },
            recentUsers,
            recentWorkouts
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to get dashboard stats' });
    }
});

// === Get All Users ===
app.get('/api/v1/admin/users', authenticate, isAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        let query = {};
        if (search) {
            query.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const users = await User.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .select('-password -refreshTokens');

        const total = await User.countDocuments(query);

        res.json({
            success: true,
            users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// === Get User by ID (Admin) ===
app.get('/api/v1/admin/users/:id', authenticate, isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password -refreshTokens');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get user stats
        const totalWorkouts = await Workout.countDocuments({ userId: user._id, completed: true });
        const workouts = await Workout.find({ userId: user._id, completed: true })
            .sort({ date: -1 })
            .limit(10);

        res.json({
            success: true,
            user,
            stats: { totalWorkouts },
            recentWorkouts: workouts
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// === Update User (Admin) ===
app.put('/api/v1/admin/users/:id', authenticate, isAdmin, async (req, res) => {
    try {
        const { role, isPremium, isActive, isBanned, fitnessLevel, fitnessGoal } = req.body;
        
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (role) user.role = role;
        if (isPremium !== undefined) user.isPremium = isPremium;
        if (isActive !== undefined) user.isActive = isActive;
        if (isBanned !== undefined) user.isBanned = isBanned;
        if (fitnessLevel) user.fitnessLevel = fitnessLevel;
        if (fitnessGoal) user.fitnessGoal = fitnessGoal;

        await user.save();

        // Log admin action
        await AdminLog.create({
            adminId: req.user._id,
            action: 'UPDATE_USER',
            target: 'User',
            targetId: user._id.toString(),
            details: req.body,
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'User updated successfully',
            user: user.toObject({ versionKey: false })
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// === Delete User (Admin) ===
app.delete('/api/v1/admin/users/:id', authenticate, isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Don't allow deleting yourself
        if (user._id.toString() === req.user._id.toString()) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        await user.deleteOne();

        await AdminLog.create({
            adminId: req.user._id,
            action: 'DELETE_USER',
            target: 'User',
            targetId: user._id.toString(),
            details: { username: user.username, email: user.email },
            ip: req.ip
        });

        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// === Get All Exercises (Admin) ===
app.get('/api/v1/admin/exercises', authenticate, isAdmin, async (req, res) => {
    try {
        const exercises = await Exercise.find().sort({ createdAt: -1 });
        res.json({ success: true, exercises });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to get exercises' });
    }
});

// === Create Exercise (Admin) ===
app.post('/api/v1/admin/exercises', authenticate, isAdmin, async (req, res) => {
    try {
        const exercise = new Exercise({
            ...req.body,
            createdBy: req.user._id
        });
        await exercise.save();

        await AdminLog.create({
            adminId: req.user._id,
            action: 'CREATE_EXERCISE',
            target: 'Exercise',
            targetId: exercise._id.toString(),
            details: { name: exercise.name },
            ip: req.ip
        });

        res.status(201).json({ success: true, exercise });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create exercise' });
    }
});

// === Update Exercise (Admin) ===
app.put('/api/v1/admin/exercises/:id', authenticate, isAdmin, async (req, res) => {
    try {
        const exercise = await Exercise.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!exercise) {
            return res.status(404).json({ error: 'Exercise not found' });
        }

        await AdminLog.create({
            adminId: req.user._id,
            action: 'UPDATE_EXERCISE',
            target: 'Exercise',
            targetId: exercise._id.toString(),
            details: { name: exercise.name },
            ip: req.ip
        });

        res.json({ success: true, exercise });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update exercise' });
    }
});

// === Delete Exercise (Admin) ===
app.delete('/api/v1/admin/exercises/:id', authenticate, isAdmin, async (req, res) => {
    try {
        const exercise = await Exercise.findByIdAndDelete(req.params.id);
        if (!exercise) {
            return res.status(404).json({ error: 'Exercise not found' });
        }

        await AdminLog.create({
            adminId: req.user._id,
            action: 'DELETE_EXERCISE',
            target: 'Exercise',
            targetId: exercise._id.toString(),
            details: { name: exercise.name },
            ip: req.ip
        });

        res.json({ success: true, message: 'Exercise deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete exercise' });
    }
});

// === Get All Challenges (Admin) ===
app.get('/api/v1/admin/challenges', authenticate, isAdmin, async (req, res) => {
    try {
        const challenges = await Challenge.find()
            .sort({ createdAt: -1 })
            .populate('createdBy', 'fullName username');
        res.json({ success: true, challenges });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to get challenges' });
    }
});

// === Create Challenge (Admin) ===
app.post('/api/v1/admin/challenges', authenticate, isAdmin, async (req, res) => {
    try {
        const challenge = new Challenge({
            ...req.body,
            createdBy: req.user._id
        });
        await challenge.save();

        await AdminLog.create({
            adminId: req.user._id,
            action: 'CREATE_CHALLENGE',
            target: 'Challenge',
            targetId: challenge._id.toString(),
            details: { name: challenge.name },
            ip: req.ip
        });

        res.status(201).json({ success: true, challenge });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create challenge' });
    }
});

// === Delete Challenge (Admin) ===
app.delete('/api/v1/admin/challenges/:id', authenticate, isAdmin, async (req, res) => {
    try {
        const challenge = await Challenge.findByIdAndDelete(req.params.id);
        if (!challenge) {
            return res.status(404).json({ error: 'Challenge not found' });
        }

        await AdminLog.create({
            adminId: req.user._id,
            action: 'DELETE_CHALLENGE',
            target: 'Challenge',
            targetId: challenge._id.toString(),
            details: { name: challenge.name },
            ip: req.ip
        });

        res.json({ success: true, message: 'Challenge deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete challenge' });
    }
});

// === Get All Notifications ===
app.get('/api/v1/admin/notifications', authenticate, isAdmin, async (req, res) => {
    try {
        const notifications = await Notification.find()
            .sort({ createdAt: -1 })
            .limit(100)
            .populate('userId', 'fullName username');
        res.json({ success: true, notifications });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to get notifications' });
    }
});

// === Send Broadcast Notification ===
app.post('/api/v1/admin/broadcast', authenticate, isAdmin, async (req, res) => {
    try {
        const { title, message, target = 'all' } = req.body;

        let query = { isActive: true, isBanned: false };
        if (target === 'premium') {
            query.isPremium = true;
        }

        const users = await User.find(query);
        const notifications = users.map(user => ({
            userId: user._id,
            type: 'Admin',
            title,
            message
        }));

        await Notification.insertMany(notifications);

        // Send Telegram notification to admins
        for (const adminId of ADMIN_IDS) {
            await sendTelegramMessage(
                adminId,
                `📢 <b>Broadcast Sent</b>\n\n📌 ${title}\n📝 ${message}\n👥 Sent to: ${users.length} users`
            );
        }

        await AdminLog.create({
            adminId: req.user._id,
            action: 'BROADCAST',
            target: 'Notification',
            details: { title, message, target, count: users.length },
            ip: req.ip
        });

        res.json({ 
            success: true, 
            message: `Broadcast sent to ${users.length} users` 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to send broadcast' });
    }
});

// === Get Admin Logs ===
app.get('/api/v1/admin/logs', authenticate, isSuperAdmin, async (req, res) => {
    try {
        const { limit = 50, page = 1 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const logs = await AdminLog.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('adminId', 'fullName username');

        const total = await AdminLog.countDocuments();

        res.json({
            success: true,
            logs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to get logs' });
    }
});

// === Get App Stats (Admin) ===
app.get('/api/v1/admin/stats', authenticate, isAdmin, async (req, res) => {
    try {
        const [
            totalUsers,
            activeUsers,
            premiumUsers,
            totalWorkouts,
            completedWorkouts,
            totalExercises,
            totalChallenges,
            activeChallenges
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ isActive: true }),
            User.countDocuments({ isPremium: true }),
            Workout.countDocuments(),
            Workout.countDocuments({ completed: true }),
            Exercise.countDocuments(),
            Challenge.countDocuments(),
            Challenge.countDocuments({ isActive: true })
        ]);

        // Weekly stats
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const newUsersThisWeek = await User.countDocuments({
            createdAt: { $gte: weekAgo }
        });

        const workoutsThisWeek = await Workout.countDocuments({
            completed: true,
            completionTime: { $gte: weekAgo }
        });

        res.json({
            success: true,
            stats: {
                totalUsers,
                activeUsers,
                premiumUsers,
                totalWorkouts,
                completedWorkouts,
                totalExercises,
                totalChallenges,
                activeChallenges,
                newUsersThisWeek,
                workoutsThisWeek
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// === Get All Workouts (Admin) ===
app.get('/api/v1/admin/workouts', authenticate, isAdmin, async (req, res) => {
    try {
        const { limit = 50, page = 1 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const workouts = await Workout.find()
            .sort({ date: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('userId', 'fullName username');

        const total = await Workout.countDocuments();

        res.json({
            success: true,
            workouts,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to get workouts' });
    }
});

// =============================================
// TELEGRAM BOT WEBHOOK
// =============================================

app.post(`/webhook/${process.env.TELEGRAM_BOT_TOKEN}`, async (req, res) => {
    console.log('📩 Webhook received');
    
    try {
        const { message, callback_query } = req.body;

        // Handle callback queries
        if (callback_query) {
            const chatId = callback_query.message.chat.id;
            const userId = callback_query.from.id;
            
            await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
                callback_query_id: callback_query.id
            });

            let user = await User.findOne({ telegramId: userId.toString() });
            if (!user) {
                user = new User({
                    telegramId: userId.toString(),
                    username: callback_query.from.username || `user_${userId}`,
                    fullName: callback_query.from.first_name || 'User'
                });
                await user.save();
            }

            // Handle admin callbacks
            if (callback_query.data === 'admin_dashboard') {
                if (!ADMIN_IDS.includes(userId.toString())) {
                    await sendTelegramMessage(chatId, '⛔ Access denied. Admin only.');
                    return res.json({ success: true });
                }

                const totalUsers = await User.countDocuments();
                const activeUsers = await User.countDocuments({ isActive: true });
                const totalWorkouts = await Workout.countDocuments({ completed: true });
                const premiumUsers = await User.countDocuments({ isPremium: true });

                const text = `👑 <b>Admin Dashboard</b>\n\n` +
                    `👥 Total Users: ${totalUsers}\n` +
                    `🟢 Active Users: ${activeUsers}\n` +
                    `⭐ Premium Users: ${premiumUsers}\n` +
                    `🏋️ Total Workouts: ${totalWorkouts}\n\n` +
                    `📊 <b>Quick Actions:</b>`;

                await sendTelegramMessage(chatId, text, {
                    inline_keyboard: [
                        [{ text: '👥 View Users', callback_data: 'admin_users' }],
                        [{ text: '📢 Send Broadcast', callback_data: 'admin_broadcast' }],
                        [{ text: '📊 Full Stats', callback_data: 'admin_stats' }],
                        [{ text: '📱 Open Admin Panel', url: process.env.FRONTEND_URL + '/admin' }]
                    ]
                });
            }

            else if (callback_query.data === 'admin_users') {
                if (!ADMIN_IDS.includes(userId.toString())) {
                    await sendTelegramMessage(chatId, '⛔ Access denied.');
                    return res.json({ success: true });
                }

                const users = await User.find()
                    .sort({ createdAt: -1 })
                    .limit(10)
                    .select('fullName username role isActive isPremium createdAt');

                let text = '👥 <b>Recent Users</b>\n\n';
                users.forEach((u, i) => {
                    text += `${i+1}. ${u.fullName || u.username}\n` +
                        `   Role: ${u.role} | Premium: ${u.isPremium ? '✅' : '❌'}\n` +
                        `   Status: ${u.isActive ? '🟢 Active' : '🔴 Inactive'}\n\n`;
                });

                await sendTelegramMessage(chatId, text, {
                    inline_keyboard: [
                        [{ text: '📊 Admin Dashboard', callback_data: 'admin_dashboard' }],
                        [{ text: '📱 Open Admin Panel', url: process.env.FRONTEND_URL + '/admin' }]
                    ]
                });
            }

            else if (callback_query.data === 'admin_broadcast') {
                if (!ADMIN_IDS.includes(userId.toString())) {
                    await sendTelegramMessage(chatId, '⛔ Access denied.');
                    return res.json({ success: true });
                }

                await sendTelegramMessage(chatId, 
                    '📢 <b>Send Broadcast</b>\n\n' +
                    'Send a message to all users.\n' +
                    'Format: /broadcast [title] | [message]\n\n' +
                    'Example:\n' +
                    '/broadcast New Workout! | Check out our new HIIT program! 🏋️'
                );
            }

            else if (callback_query.data === 'admin_stats') {
                if (!ADMIN_IDS.includes(userId.toString())) {
                    await sendTelegramMessage(chatId, '⛔ Access denied.');
                    return res.json({ success: true });
                }

                const stats = await getAdminStats();
                const text = `📊 <b>Full Statistics</b>\n\n` +
                    `👥 Total Users: ${stats.totalUsers}\n` +
                    `🟢 Active Users: ${stats.activeUsers}\n` +
                    `⭐ Premium Users: ${stats.premiumUsers}\n` +
                    `🏋️ Total Workouts: ${stats.totalWorkouts}\n` +
                    `✅ Completed Workouts: ${stats.completedWorkouts}\n` +
                    `📝 Total Exercises: ${stats.totalExercises}\n` +
                    `🏆 Active Challenges: ${stats.activeChallenges}\n` +
                    `📈 New Users This Week: ${stats.newUsersThisWeek}`;

                await sendTelegramMessage(chatId, text, {
                    inline_keyboard: [
                        [{ text: '👑 Dashboard', callback_data: 'admin_dashboard' }],
                        [{ text: '📱 Open Admin Panel', url: process.env.FRONTEND_URL + '/admin' }]
                    ]
                });
            }

            // Regular user callbacks
            else if (callback_query.data === 'workout') {
                const exercises = await Exercise.find({ isActive: true }).limit(5);
                let text = '🏋️ <b>Your Workout</b>\n\n';
                exercises.forEach((ex, i) => {
                    text += `${i+1}. ${ex.name}\n   🎯 ${ex.muscle}\n\n`;
                });
                text += '🔹 Sets: 3-4\n🔹 Reps: 8-12\n🔹 Rest: 60s';
                
                await sendTelegramMessage(chatId, text, {
                    inline_keyboard: [
                        [{ text: '✅ Complete Workout', callback_data: 'complete' }],
                        [{ text: '📊 Progress', callback_data: 'progress' }],
                        [{ text: '📱 Open App', url: process.env.FRONTEND_URL }]
                    ]
                });
            }

            else if (callback_query.data === 'progress') {
                const totalWorkouts = await Workout.countDocuments({ 
                    userId: user._id, 
                    completed: true 
                });
                
                const text = `📊 <b>Your Progress</b>\n\n` +
                    `🏋️ Total Workouts: ${totalWorkouts}\n` +
                    `🔥 Current Streak: ${user.streak} days\n` +
                    `⭐ Level: ${user.level}\n` +
                    `💪 XP: ${user.xp}\n\n` +
                    `Keep pushing! You're doing great! 💪`;
                
                await sendTelegramMessage(chatId, text, {
                    inline_keyboard: [
                        [{ text: '💪 Start Workout', callback_data: 'workout' }],
                        [{ text: '📱 Open App', url: process.env.FRONTEND_URL }]
                    ]
                });
            }

            else if (callback_query.data === 'complete') {
                const workout = new Workout({
                    userId: user._id,
                    completed: true,
                    date: new Date(),
                    duration: 30,
                    calories: 200
                });
                await workout.save();
                
                user.xp += 50;
                user.streak += 1;
                if (user.xp >= user.level * 100) {
                    user.level += 1;
                }
                await user.save();
                
                await sendTelegramMessage(
                    chatId,
                    '✅ <b>Workout Complete!</b>\n\n🎉 Great job! You earned 50 XP!\n🔥 Current Streak: ' + user.streak + ' days'
                );
            }

            else {
                await sendTelegramMessage(chatId, '❓ Use /start to see menu.');
            }

            return res.json({ success: true });
        }

        // Handle messages
        if (message) {
            const chatId = message.chat.id;
            const userId = message.from.id;
            const text = message.text || '';

            let user = await User.findOne({ telegramId: userId.toString() });
            if (!user) {
                user = new User({
                    telegramId: userId.toString(),
                    username: message.from.username || `user_${userId}`,
                    fullName: `${message.from.first_name || ''} ${message.from.last_name || ''}`.trim() || 'Telegram User'
                });
                await user.save();
            }

            // Check if user is admin
            const isUserAdmin = ADMIN_IDS.includes(userId.toString());

            // Handle /start
            if (text === '/start') {
                const welcomeText = `🏋️ <b>Welcome to ProGym, ${user.fullName}!</b>\n\n` +
                    `Your AI-powered fitness companion is ready to help you reach your goals.\n\n` +
                    `💪 Track workouts\n` +
                    `🍽️ Nutrition guidance\n` +
                    `🏆 Challenges\n` +
                    `📊 Progress tracking\n` +
                    `🤖 AI Coach`;

                const keyboard = [
                    [{ text: '💪 Start Workout', callback_data: 'workout' }],
                    [{ text: '📊 My Progress', callback_data: 'progress' }],
                    [{ text: '📱 Open App', url: process.env.FRONTEND_URL }]
                ];

                // Add admin button if user is admin
                if (isUserAdmin) {
                    keyboard.push([{ text: '👑 Admin Panel', callback_data: 'admin_dashboard' }]);
                }

                await sendTelegramMessage(chatId, welcomeText, {
                    inline_keyboard: keyboard
                });
            }

            // Admin commands
            else if (text.startsWith('/broadcast') && isUserAdmin) {
                try {
                    const parts = text.replace('/broadcast', '').trim().split('|');
                    if (parts.length < 2) {
                        await sendTelegramMessage(chatId, 
                            '❌ Invalid format.\n' +
                            'Use: /broadcast [title] | [message]'
                        );
                        return;
                    }

                    const title = parts[0].trim();
                    const message = parts[1].trim();

                    const users = await User.find({ isActive: true, isBanned: false });
                    const notifications = users.map(u => ({
                        userId: u._id,
                        type: 'Admin',
                        title,
                        message
                    }));

                    await Notification.insertMany(notifications);

                    await AdminLog.create({
                        adminId: user._id,
                        action: 'BROADCAST',
                        target: 'Notification',
                        details: { title, message, count: users.length },
                        ip: 'telegram'
                    });

                    await sendTelegramMessage(
                        chatId,
                        `✅ Broadcast sent to ${users.length} users!\n\n📌 ${title}\n📝 ${message}`
                    );
                } catch (error) {
                    console.error(error);
                    await sendTelegramMessage(chatId, '❌ Failed to send broadcast.');
                }
            }

            else if (text === '/admin' && isUserAdmin) {
                const totalUsers = await User.countDocuments();
                const activeUsers = await User.countDocuments({ isActive: true });
                const totalWorkouts = await Workout.countDocuments({ completed: true });

                const text = `👑 <b>Admin Dashboard</b>\n\n` +
                    `👥 Total Users: ${totalUsers}\n` +
                    `🟢 Active Users: ${activeUsers}\n` +
                    `🏋️ Total Workouts: ${totalWorkouts}\n\n` +
                    `📊 <b>Quick Actions:</b>`;

                await sendTelegramMessage(chatId, text, {
                    inline_keyboard: [
                        [{ text: '👥 View Users', callback_data: 'admin_users' }],
                        [{ text: '📢 Send Broadcast', callback_data: 'admin_broadcast' }],
                        [{ text: '📊 Full Stats', callback_data: 'admin_stats' }],
                        [{ text: '📱 Open Admin Panel', url: process.env.FRONTEND_URL + '/admin' }]
                    ]
                });
            }

            else if (text === '/workout') {
                const exercises = await Exercise.find({ isActive: true }).limit(5);
                let workoutText = '🏋️ <b>Your Workout</b>\n\n';
                exercises.forEach((ex, i) => {
                    workoutText += `${i+1}. ${ex.name}\n   🎯 ${ex.muscle}\n\n`;
                });
                workoutText += '🔹 Sets: 3-4\n🔹 Reps: 8-12\n🔹 Rest: 60s';
                
                await sendTelegramMessage(chatId, workoutText, {
                    inline_keyboard: [
                        [{ text: '✅ Complete Workout', callback_data: 'complete' }],
                        [{ text: '📊 Progress', callback_data: 'progress' }]
                    ]
                });
            }

            else if (text === '/progress') {
                const totalWorkouts = await Workout.countDocuments({ 
                    userId: user._id, 
                    completed: true 
                });
                
                const progressText = `📊 <b>Your Progress</b>\n\n` +
                    `🏋️ Total Workouts: ${totalWorkouts}\n` +
                    `🔥 Current Streak: ${user.streak} days\n` +
                    `⭐ Level: ${user.level}\n` +
                    `💪 XP: ${user.xp}`;
                
                await sendTelegramMessage(chatId, progressText);
            }

            else if (text === '/help') {
                const helpText = `❓ <b>Available Commands</b>\n\n` +
                    `/start - Show main menu\n` +
                    `/workout - Get a workout\n` +
                    `/progress - View progress\n` +
                    `/help - Show this help\n` +
                    (isUserAdmin ? `/admin - Admin dashboard\n/broadcast - Send broadcast\n` : '') +
                    `\n📱 Open the web app for full features!`;

                await sendTelegramMessage(chatId, helpText);
            }

            else {
                // AI response
                const aiText = `🤖 <b>AI Coach</b>\n\n` +
                    `I'm here to help you with your fitness journey!\n\n` +
                    `💪 Stay consistent with your workouts\n` +
                    `🥗 Eat balanced meals with protein\n` +
                    `💧 Drink water throughout the day\n` +
                    `😴 Get 7-9 hours of sleep\n\n` +
                    `Use /start to see the main menu.`;

                await sendTelegramMessage(chatId, aiText);
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Webhook error:', error);
        res.status(500).json({ error: 'Webhook failed' });
    }
});

// =============================================
// SEED DATA
// =============================================

async function seedExercises() {
    const count = await Exercise.countDocuments();
    if (count === 0) {
        console.log('🌱 Seeding exercises...');
        const exercises = [
            { name: 'Barbell Bench Press', category: 'Chest', muscle: 'Chest', difficulty: 'Intermediate', equipment: 'Barbell', video: 'https://www.youtube.com/embed/4Y2ZdHCOXok' },
            { name: 'Dumbbell Shoulder Press', category: 'Shoulders', muscle: 'Shoulders', difficulty: 'Intermediate', equipment: 'Dumbbells', video: 'https://www.youtube.com/embed/REBhldQ6V6Y' },
            { name: 'Squats', category: 'Legs', muscle: 'Legs', difficulty: 'Beginner', equipment: 'Barbell', video: 'https://www.youtube.com/embed/YaXPRqUwItQ' },
            { name: 'Pull-ups', category: 'Back', muscle: 'Back', difficulty: 'Intermediate', equipment: 'Pull-up Bar', video: 'https://www.youtube.com/embed/eGo4IYlbE5g' },
            { name: 'Planks', category: 'Core', muscle: 'Core', difficulty: 'Beginner', equipment: 'Bodyweight', video: 'https://www.youtube.com/embed/pSHjTRCQxIw' },
            { name: 'Tricep Pushdowns', category: 'Triceps', muscle: 'Triceps', difficulty: 'Beginner', equipment: 'Cable', video: 'https://www.youtube.com/embed/2-LAMcpzODU' },
            { name: 'Barbell Curl', category: 'Biceps', muscle: 'Biceps', difficulty: 'Beginner', equipment: 'Barbell', video: 'https://www.youtube.com/embed/ykJirr3Y-2g' },
            { name: 'Deadlifts', category: 'Back', muscle: 'Back', difficulty: 'Intermediate', equipment: 'Barbell', video: 'https://www.youtube.com/embed/op9kVnSso6Q' },
            { name: 'Lunges', category: 'Legs', muscle: 'Legs', difficulty: 'Beginner', equipment: 'Dumbbells', video: 'https://www.youtube.com/embed/QOVaHwm-Q6U' },
            { name: 'Overhead Press', category: 'Shoulders', muscle: 'Shoulders', difficulty: 'Intermediate', equipment: 'Barbell', video: 'https://www.youtube.com/embed/2yjwXTZQDDI' }
        ];
        await Exercise.insertMany(exercises);
        console.log('✅ Exercises seeded!');
    }
}

// =============================================
// SET WEBHOOK
// =============================================

async function setWebhook() {
    try {
        const webhookUrl = `${process.env.WEBHOOK_URL}/webhook/${process.env.TELEGRAM_BOT_TOKEN}`;
        console.log('🔗 Setting webhook to:', webhookUrl);
        
        const response = await axios.post(`${TELEGRAM_API}/setWebhook`, {
            url: webhookUrl,
            allowed_updates: ['message', 'callback_query']
        });
        
        console.log('✅ Webhook set:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Webhook error:', error.response?.data || error.message);
    }
}

// =============================================
// HEALTH CHECK
// =============================================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        adminIds: ADMIN_IDS,
        webhookUrl: `${process.env.WEBHOOK_URL}/webhook/${process.env.TELEGRAM_BOT_TOKEN}`
    });
});

// =============================================
// START SERVER
// =============================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`🔗 Health: http://localhost:${PORT}/api/health`);
    console.log(`🤖 Webhook: ${process.env.WEBHOOK_URL}/webhook/${process.env.TELEGRAM_BOT_TOKEN}`);
    console.log(`👑 Admin IDs: ${ADMIN_IDS.join(', ')}\n`);
    
    await seedExercises();
    await setWebhook();
    
    console.log('✅ Server ready!');
});

module.exports = app;
