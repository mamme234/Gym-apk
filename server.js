// =============================================
// BACKEND - server.js (Full Production Ready)
// =============================================

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// =============================================
// SECURITY & MIDDLEWARE
// =============================================

app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests, please try again later.'
});
app.use('/api', limiter);

// Static files for uploads
app.use('/uploads', express.static('uploads'));

// =============================================
// DATABASE CONNECTION
// =============================================

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000
});

mongoose.connection.on('connected', () => {
    console.log('✅ MongoDB connected successfully');
});

mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err);
});

// =============================================
// MODELS
// =============================================

// User Schema
const UserSchema = new mongoose.Schema({
    telegramId: { type: String, unique: true, sparse: true },
    email: { type: String, unique: true, sparse: true },
    password: { type: String },
    googleId: { type: String, unique: true, sparse: true },
    username: { type: String, unique: true },
    fullName: { type: String },
    profilePhoto: { type: String },
    gender: { type: String, enum: ['Male', 'Female', 'Non-binary'] },
    age: { type: Number },
    height: { type: Number },
    weight: { type: Number },
    fitnessLevel: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced', 'Professional'] },
    fitnessGoal: { type: String, enum: ['Lose Weight', 'Build Muscle', 'Maintain Fitness', 'Increase Strength'] },
    activityLevel: { type: String, enum: ['Sedentary', 'Light', 'Moderate', 'Active', 'Very Active'] },
    workoutExperience: { type: String, enum: ['Less than 1 year', '1-3 years', '3-5 years', '5+ years'] },
    role: { type: String, enum: ['User', 'Coach', 'Admin'], default: 'User' },
    isPremium: { type: Boolean, default: false },
    premiumExpiry: { type: Date },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    streak: { type: Number, default: 0 },
    lastWorkoutDate: { type: Date },
    isActive: { type: Boolean, default: true },
    refreshTokens: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

// Exercise Schema
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
    createdAt: { type: Date, default: Date.now }
});

const Exercise = mongoose.model('Exercise', ExerciseSchema);

// Workout Schema
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
    rating: { type: Number, min: 1, max: 5 }
});

const Workout = mongoose.model('Workout', WorkoutSchema);

// Progress Schema
const ProgressSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, default: Date.now },
    weight: { type: Number },
    bodyFat: { type: Number },
    bmi: { type: Number },
    caloriesBurned: { type: Number },
    workoutDuration: { type: Number },
    exercisesCompleted: { type: Number }
});

const Progress = mongoose.model('Progress', ProgressSchema);

// Nutrition Schema
const NutritionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, default: Date.now },
    calories: { type: Number },
    protein: { type: Number },
    carbs: { type: Number },
    fat: { type: Number },
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

// Challenge Schema
const ChallengeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    difficulty: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'] },
    type: { type: String, enum: ['Daily', 'Weekly', 'Monthly'] },
    startDate: { type: Date },
    endDate: { type: Date },
    requiredWorkouts: { type: Number },
    rewardXp: { type: Number },
    rewardBadge: { type: String },
    participants: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        progress: { type: Number, default: 0 },
        completed: { type: Boolean, default: false },
        joinedAt: { type: Date, default: Date.now }
    }],
    isActive: { type: Boolean, default: true }
});

const Challenge = mongoose.model('Challenge', ChallengeSchema);

// Notification Schema
const NotificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: ['Workout', 'Meal', 'Water', 'Challenge', 'Achievement', 'System'] },
    title: { type: String },
    message: { type: String },
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const Notification = mongoose.model('Notification', NotificationSchema);

// Achievement Schema
const AchievementSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    description: { type: String },
    badge: { type: String },
    xpEarned: { type: Number },
    earnedAt: { type: Date, default: Date.now }
});

const Achievement = mongoose.model('Achievement', AchievementSchema);

// =============================================
// MIDDLEWARE
// =============================================

const authenticate = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        if (!user || !user.isActive) {
            return res.status(401).json({ error: 'User not found or inactive' });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

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
                        'fitnessGoal', 'activityLevel', 'workoutExperience'];
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
// EXERCISE ROUTES
// =============================================

// Get Exercises with Filters
app.get('/api/v1/exercises', async (req, res) => {
    try {
        const { category, muscle, difficulty, search, page = 1, limit = 20 } = req.query;
        
        let query = { isActive: true };
        if (category) query.category = category;
        if (muscle) query.muscle = { $regex: muscle, $options: 'i' };
        if (difficulty) query.difficulty = difficulty;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { muscle: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const exercises = await Exercise.find(query).skip(skip).limit(parseInt(limit));
        const total = await Exercise.countDocuments(query);

        res.json({
            success: true,
            exercises,
            pagination: { page: parseInt(page), limit: parseInt(limit), total }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch exercises' });
    }
});

// Get Single Exercise
app.get('/api/v1/exercises/:id', async (req, res) => {
    try {
        const exercise = await Exercise.findById(req.params.id);
        if (!exercise) {
            return res.status(404).json({ error: 'Exercise not found' });
        }
        res.json({ success: true, exercise });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch exercise' });
    }
});

// =============================================
// WORKOUT ROUTES
// =============================================

// Create Workout
app.post('/api/v1/workouts', authenticate, async (req, res) => {
    try {
        const workout = new Workout({
            userId: req.user._id,
            ...req.body
        });
        await workout.save();
        res.status(201).json({ success: true, workout });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create workout' });
    }
});

// Get User Workouts
app.get('/api/v1/workouts', authenticate, async (req, res) => {
    try {
        const { completed, limit = 20, page = 1 } = req.query;
        let query = { userId: req.user._id };
        if (completed !== undefined) query.completed = completed === 'true';

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const workouts = await Workout.find(query)
            .populate('exercises.exerciseId')
            .sort({ date: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        res.json({ success: true, workouts });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch workouts' });
    }
});

// Complete Workout
app.put('/api/v1/workouts/:id/complete', authenticate, async (req, res) => {
    try {
        const workout = await Workout.findOne({ _id: req.params.id, userId: req.user._id });
        if (!workout) {
            return res.status(404).json({ error: 'Workout not found' });
        }

        workout.completed = true;
        workout.completionTime = new Date();
        workout.rating = req.body.rating;
        await workout.save();

        // Update user stats
        const user = await User.findById(req.user._id);
        user.xp += 50;
        user.streak = user.streak + 1;
        user.lastWorkoutDate = new Date();

        // Level up
        if (user.xp >= user.level * 100) {
            user.level += 1;
            await Notification.create({
                userId: user._id,
                type: 'Achievement',
                title: 'Level Up!',
                message: `🎉 Congratulations! You've reached Level ${user.level}!`
            });
        }

        await user.save();
        res.json({ success: true, workout });
    } catch (error) {
        res.status(500).json({ error: 'Failed to complete workout' });
    }
});

// =============================================
// PROGRESS ROUTES
// =============================================

// Log Progress
app.post('/api/v1/progress', authenticate, async (req, res) => {
    try {
        const progress = new Progress({
            userId: req.user._id,
            ...req.body
        });
        await progress.save();
        res.status(201).json({ success: true, progress });
    } catch (error) {
        res.status(500).json({ error: 'Failed to log progress' });
    }
});

// Get Progress
app.get('/api/v1/progress', authenticate, async (req, res) => {
    try {
        const { limit = 30 } = req.query;
        const progress = await Progress.find({ userId: req.user._id })
            .sort({ date: -1 })
            .limit(parseInt(limit));
        res.json({ success: true, progress });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch progress' });
    }
});

// =============================================
// NUTRITION ROUTES
// =============================================

// Log Nutrition
app.post('/api/v1/nutrition', authenticate, async (req, res) => {
    try {
        const nutrition = new Nutrition({
            userId: req.user._id,
            ...req.body
        });
        await nutrition.save();
        res.status(201).json({ success: true, nutrition });
    } catch (error) {
        res.status(500).json({ error: 'Failed to log nutrition' });
    }
});

// Get Today's Nutrition
app.get('/api/v1/nutrition/today', authenticate, async (req, res) => {
    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const nutrition = await Nutrition.findOne({
            userId: req.user._id,
            date: { $gte: startOfDay, $lte: endOfDay }
        });

        res.json({ success: true, nutrition });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch nutrition' });
    }
});

// =============================================
// CHALLENGE ROUTES
// =============================================

// Get Active Challenges
app.get('/api/v1/challenges/active', authenticate, async (req, res) => {
    try {
        const challenges = await Challenge.find({
            isActive: true,
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() }
        });
        res.json({ success: true, challenges });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch challenges' });
    }
});

// Join Challenge
app.post('/api/v1/challenges/:id/join', authenticate, async (req, res) => {
    try {
        const challenge = await Challenge.findById(req.params.id);
        if (!challenge) {
            return res.status(404).json({ error: 'Challenge not found' });
        }

        const alreadyJoined = challenge.participants.some(
            p => p.userId.toString() === req.user._id.toString()
        );
        if (alreadyJoined) {
            return res.status(400).json({ error: 'Already joined this challenge' });
        }

        challenge.participants.push({ userId: req.user._id });
        await challenge.save();
        res.json({ success: true, challenge });
    } catch (error) {
        res.status(500).json({ error: 'Failed to join challenge' });
    }
});

// =============================================
// STATS ROUTES
// =============================================

// Get User Statistics
app.get('/api/v1/stats', authenticate, async (req, res) => {
    try {
        const totalWorkouts = await Workout.countDocuments({ 
            userId: req.user._id, 
            completed: true 
        });
        
        const caloriesBurned = await Workout.aggregate([
            { $match: { userId: req.user._id, completed: true } },
            { $group: { _id: null, total: { $sum: '$calories' } } }
        ]);

        const weeklyWorkouts = await Workout.countDocuments({
            userId: req.user._id,
            completed: true,
            date: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        });

        res.json({
            success: true,
            stats: {
                totalWorkouts,
                caloriesBurned: caloriesBurned[0]?.total || 0,
                currentStreak: req.user.streak,
                weeklyWorkouts,
                level: req.user.level,
                xp: req.user.xp,
                xpToNextLevel: req.user.level * 100
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// =============================================
// AI COACH ROUTES
// =============================================

// AI Workout Generator
app.post('/api/v1/ai/workout', authenticate, async (req, res) => {
    try {
        const user = req.user;
        const difficulty = user.fitnessLevel || 'Intermediate';
        const goal = user.fitnessGoal || 'Build Muscle';

        // Get exercises based on user level
        const exercises = await Exercise.find({ 
            difficulty: difficulty,
            isActive: true 
        }).limit(8);

        if (exercises.length === 0) {
            return res.status(404).json({ error: 'No exercises found for your level' });
        }

        const workout = {
            name: `AI Custom Workout - ${new Date().toLocaleDateString()}`,
            exercises: exercises.map(ex => ({
                exerciseId: ex._id,
                name: ex.name,
                muscle: ex.muscle,
                sets: ex.sets || 3,
                reps: ex.reps || '10-12',
                rest: ex.rest || '60s',
                video: ex.video
            })),
            category: goal,
            difficulty: difficulty,
            duration: 45,
            calories: 350
        };

        res.json({
            success: true,
            workout,
            recommendation: `💪 Based on your ${difficulty.toLowerCase()} level, here's a personalized workout for ${goal.toLowerCase()}.`
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate AI workout' });
    }
});

// AI Nutrition Planner
app.post('/api/v1/ai/nutrition', authenticate, async (req, res) => {
    try {
        const user = req.user;
        const goal = user.fitnessGoal || 'Maintain Fitness';

        // Calculate macros based on goal
        let macros;
        switch(goal) {
            case 'Build Muscle':
                macros = { calories: 2800, protein: 200, carbs: 300, fat: 80 };
                break;
            case 'Lose Weight':
                macros = { calories: 1800, protein: 160, carbs: 150, fat: 50 };
                break;
            default:
                macros = { calories: 2200, protein: 150, carbs: 200, fat: 65 };
        }

        // Meal suggestions
        const meals = [
            {
                type: 'Breakfast',
                name: 'Protein Oatmeal',
                calories: 450,
                protein: 30,
                carbs: 50,
                fat: 10
            },
            {
                type: 'Lunch',
                name: 'Grilled Chicken Salad',
                calories: 550,
                protein: 45,
                carbs: 30,
                fat: 20
            },
            {
                type: 'Dinner',
                name: 'Salmon with Quinoa',
                calories: 650,
                protein: 40,
                carbs: 45,
                fat: 25
            },
            {
                type: 'Snack',
                name: 'Greek Yogurt with Berries',
                calories: 200,
                protein: 20,
                carbs: 15,
                fat: 5
            }
        ];

        res.json({
            success: true,
            macros,
            meals,
            recommendation: `🍽️ Here are your daily macro targets for ${goal.toLowerCase()}.`
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate nutrition plan' });
    }
});

// =============================================
// TELEGRAM BOT WEBHOOK
// =============================================

const axios = require('axios');

// Send Telegram message helper
async function sendTelegramMessage(chatId, text, replyMarkup = null) {
    try {
        const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
        const payload = {
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML',
            reply_markup: replyMarkup
        };
        await axios.post(url, payload);
    } catch (error) {
        console.error('Telegram send error:', error.message);
    }
}

// Telegram Webhook
app.post(`/webhook/${process.env.TELEGRAM_BOT_TOKEN}`, async (req, res) => {
    try {
        const { message, callback_query } = req.body;

        // Handle callback queries (button presses)
        if (callback_query) {
            const chatId = callback_query.message.chat.id;
            const userId = callback_query.from.id;
            const data = callback_query.data;

            // Answer callback query
            await axios.post(
                `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
                { callback_query_id: callback_query.id }
            );

            // Find user
            let user = await User.findOne({ telegramId: userId.toString() });
            if (!user) {
                user = new User({
                    telegramId: userId.toString(),
                    username: callback_query.from.username || `user_${userId}`,
                    fullName: callback_query.from.first_name || 'User'
                });
                await user.save();
            }

            // Handle different callback actions
            if (data === 'workout') {
                const exercises = await Exercise.find({ isActive: true }).limit(5);
                let workoutText = '🏋️ <b>Your Workout</b>\n\n';
                exercises.forEach((ex, i) => {
                    workoutText += `${i+1}. ${ex.name}\n   🎯 ${ex.muscle} | ${ex.difficulty}\n\n`;
                });
                workoutText += '🔹 Sets: 3-4\n🔹 Reps: 8-12\n🔹 Rest: 60s';

                await sendTelegramMessage(chatId, workoutText, {
                    inline_keyboard: [
                        [{ text: '✅ Complete Workout', callback_data: 'complete' }],
                        [{ text: '📊 View Progress', callback_data: 'progress' }],
                        [{ text: '📱 Open App', url: `${process.env.FRONTEND_URL}?tg=${userId}` }]
                    ]
                });
            }

            else if (data === 'progress') {
                const totalWorkouts = await Workout.countDocuments({ 
                    userId: user._id, 
                    completed: true 
                });
                
                const progressText = `📊 <b>Your Progress</b>\n\n` +
                    `🏋️ Total Workouts: ${totalWorkouts}\n` +
                    `🔥 Current Streak: ${user.streak} days\n` +
                    `⭐ Level: ${user.level}\n` +
                    `💪 XP: ${user.xp}\n\n` +
                    `Keep pushing! You're doing great! 💪`;

                await sendTelegramMessage(chatId, progressText, {
                    inline_keyboard: [
                        [{ text: '📈 Full Stats', callback_data: 'stats' }],
                        [{ text: '📱 Open App', url: `${process.env.FRONTEND_URL}?tg=${userId}` }]
                    ]
                });
            }

            else if (data === 'stats') {
                const stats = await Workout.aggregate([
                    { $match: { userId: user._id, completed: true } },
                    { $group: { 
                        _id: null, 
                        totalCalories: { $sum: '$calories' },
                        avgDuration: { $avg: '$duration' }
                    } }
                ]);

                const statsText = `📈 <b>Detailed Statistics</b>\n\n` +
                    `📊 Total Workouts: ${await Workout.countDocuments({ userId: user._id, completed: true })}\n` +
                    `🔥 Calories Burned: ${stats[0]?.totalCalories || 0} kcal\n` +
                    `⏱️ Avg Duration: ${Math.round(stats[0]?.avgDuration || 0)} min\n` +
                    `🏆 Current Level: ${user.level}\n` +
                    `⭐ Total XP: ${user.xp}`;

                await sendTelegramMessage(chatId, statsText, {
                    inline_keyboard: [
                        [{ text: '📊 Progress', callback_data: 'progress' }],
                        [{ text: '📱 Open App', url: `${process.env.FRONTEND_URL}?tg=${userId}` }]
                    ]
                });
            }

            else if (data === 'complete') {
                // Find last incomplete workout
                const workout = await Workout.findOne({
                    userId: user._id,
                    completed: false
                }).sort({ date: -1 });

                if (workout) {
                    workout.completed = true;
                    workout.completionTime = new Date();
                    await workout.save();

                    user.xp += 50;
                    user.streak += 1;
                    user.lastWorkoutDate = new Date();
                    
                    if (user.xp >= user.level * 100) {
                        user.level += 1;
                    }
                    await user.save();

                    await sendTelegramMessage(chatId, '✅ <b>Workout Complete!</b>\n\n🎉 Great job! You earned 50 XP!\n🔥 Streak: ' + user.streak + ' days');
                } else {
                    await sendTelegramMessage(chatId, 'ℹ️ No active workout found. Start a new workout!');
                }
            }

            else if (data === 'nutrition') {
                const nutrition = await Nutrition.findOne({
                    userId: user._id,
                    date: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                });

                let nutritionText;
                if (nutrition) {
                    nutritionText = `🍽️ <b>Today's Nutrition</b>\n\n` +
                        `🔥 Calories: ${nutrition.calories || 0}\n` +
                        `💪 Protein: ${nutrition.protein || 0}g\n` +
                        `🍚 Carbs: ${nutrition.carbs || 0}g\n` +
                        `🥑 Fat: ${nutrition.fat || 0}g\n` +
                        `💧 Water: ${nutrition.water || 0}L`;
                } else {
                    nutritionText = `🍽️ <b>Nutrition</b>\n\n` +
                        `No nutrition data logged today.\n` +
                        `Track your meals in the app!`;
                }

                await sendTelegramMessage(chatId, nutritionText, {
                    inline_keyboard: [
                        [{ text: '📱 Log Meals', url: `${process.env.FRONTEND_URL}?tg=${userId}` }],
                        [{ text: '🍽️ Meal Plan', callback_data: 'mealplan' }]
                    ]
                });
            }

            else if (data === 'mealplan') {
                const goal = user.fitnessGoal || 'Maintain Fitness';
                let mealText = `🍽️ <b>Your Meal Plan</b>\n\n`;
                
                if (goal === 'Build Muscle') {
                    mealText += '🥚 <b>Breakfast:</b> Protein Oatmeal (450 cal)\n' +
                        '🥗 <b>Lunch:</b> Grilled Chicken Salad (550 cal)\n' +
                        '🍣 <b>Dinner:</b> Salmon with Quinoa (650 cal)\n' +
                        '🥜 <b>Snack:</b> Greek Yogurt (200 cal)\n\n' +
                        '📊 Total: 1850 cal | 135g Protein';
                } else if (goal === 'Lose Weight') {
                    mealText += '🥚 <b>Breakfast:</b> Egg Whites & Veggies (300 cal)\n' +
                        '🥗 <b>Lunch:</b> Tuna Salad (400 cal)\n' +
                        '🍗 <b>Dinner:</b> Grilled Chicken & Broccoli (450 cal)\n' +
                        '🥜 <b>Snack:</b> Apple & Almonds (150 cal)\n\n' +
                        '📊 Total: 1300 cal | 100g Protein';
                } else {
                    mealText += '🥚 <b>Breakfast:</b> Oatmeal with Berries (400 cal)\n' +
                        '🥗 <b>Lunch:</b> Turkey Sandwich (500 cal)\n' +
                        '🍣 <b>Dinner:</b> Fish with Rice (600 cal)\n' +
                        '🥜 <b>Snack:</b> Mixed Nuts (200 cal)\n\n' +
                        '📊 Total: 1700 cal | 120g Protein';
                }

                await sendTelegramMessage(chatId, mealText, {
                    inline_keyboard: [
                        [{ text: '📱 Open App', url: `${process.env.FRONTEND_URL}?tg=${userId}` }]
                    ]
                });
            }

            else if (data === 'challenge') {
                const challenge = await Challenge.findOne({
                    isActive: true,
                    endDate: { $gte: new Date() }
                });

                let challengeText = '🏆 <b>Active Challenges</b>\n\n';
                if (challenge) {
                    challengeText += `📌 ${challenge.name}\n` +
                        `📝 ${challenge.description || 'Complete workouts to earn rewards!'}\n` +
                        `🎯 ${challenge.requiredWorkouts} workouts required\n` +
                        `⭐ Reward: ${challenge.rewardXp} XP`;

                    const isJoined = challenge.participants.some(
                        p => p.userId.toString() === user._id.toString()
                    );

                    const buttons = [];
                    if (!isJoined) {
                        buttons.push([{ text: '🎯 Join Challenge', callback_data: 'join_challenge' }]);
                    }
                    buttons.push([{ text: '📱 Open App', url: `${process.env.FRONTEND_URL}?tg=${userId}` }]);
                    
                    await sendTelegramMessage(chatId, challengeText, {
                        inline_keyboard: buttons
                    });
                } else {
                    await sendTelegramMessage(chatId, '🏆 No active challenges right now. Check back soon!');
                }
            }

            else if (data === 'join_challenge') {
                const challenge = await Challenge.findOne({
                    isActive: true,
                    endDate: { $gte: new Date() }
                });

                if (challenge) {
                    const alreadyJoined = challenge.participants.some(
                        p => p.userId.toString() === user._id.toString()
                    );

                    if (!alreadyJoined) {
                        challenge.participants.push({ userId: user._id });
                        await challenge.save();
                        await sendTelegramMessage(chatId, '🎯 <b>Challenge Joined!</b>\n\nGood luck! Complete the required workouts to earn rewards! 💪');
                    } else {
                        await sendTelegramMessage(chatId, 'ℹ️ You already joined this challenge!');
                    }
                }
            }

            else if (data === 'profile') {
                const profileText = `👤 <b>Your Profile</b>\n\n` +
                    `📛 Name: ${user.fullName || 'Not set'}\n` +
                    `🔹 Username: ${user.username}\n` +
                    `🎯 Goal: ${user.fitnessGoal || 'Not set'}\n` +
                    `📊 Level: ${user.fitnessLevel || 'Not set'}\n` +
                    `⭐ Level: ${user.level}\n` +
                    `💪 XP: ${user.xp}\n` +
                    `🔥 Streak: ${user.streak} days`;

                await sendTelegramMessage(chatId, profileText, {
                    inline_keyboard: [
                        [{ text: '✏️ Update Profile', url: `${process.env.FRONTEND_URL}?tg=${userId}` }],
                        [{ text: '📱 Open App', url: `${process.env.FRONTEND_URL}?tg=${userId}` }]
                    ]
                });
            }

            else if (data === 'help') {
                const helpText = `❓ <b>Help & Support</b>\n\n` +
                    `Available commands:\n` +
                    `/start - Start the bot\n` +
                    `/workout - Get a workout\n` +
                    `/progress - View progress\n` +
                    `/nutrition - Nutrition info\n` +
                    `/challenge - View challenges\n` +
                    `/profile - View profile\n` +
                    `/help - Show this help\n\n` +
                    `📱 Open the web app for full features!`;

                await sendTelegramMessage(chatId, helpText, {
                    inline_keyboard: [
                        [{ text: '📱 Open App', url: `${process.env.FRONTEND_URL}?tg=${userId}` }],
                        [{ text: '📧 Contact Support', url: `mailto:${process.env.SUPPORT_EMAIL || 'support@gymapp.com'}` }]
                    ]
                });
            }

            else {
                // Default response for unknown callback
                await sendTelegramMessage(chatId, '❓ Unknown command. Use /help to see available options.');
            }

            return res.json({ success: true });
        }

        // Handle regular messages
        if (message) {
            const chatId = message.chat.id;
            const userId = message.from.id;
            const text = message.text || '';

            // Find or create user
            let user = await User.findOne({ telegramId: userId.toString() });
            if (!user) {
                user = new User({
                    telegramId: userId.toString(),
                    username: message.from.username || `user_${userId}`,
                    fullName: `${message.from.first_name || ''} ${message.from.last_name || ''}`.trim() || 'Telegram User'
                });
                await user.save();
            }

            // Handle commands
            if (text === '/start') {
                const welcomeText = `🏋️ <b>Welcome to ProGym, ${user.fullName}!</b>\n\n` +
                    `Your AI-powered fitness companion is ready to help you reach your goals.\n\n` +
                    `💪 Track workouts\n` +
                    `🍽️ Nutrition guidance\n` +
                    `🏆 Challenges\n` +
                    `📊 Progress tracking\n` +
                    `🤖 AI Coach`;

                await sendTelegramMessage(chatId, welcomeText, {
                    inline_keyboard: [
                        [{ text: '💪 Start Workout', callback_data: 'workout' }],
                        [{ text: '📊 My Progress', callback_data: 'progress' }],
                        [{ text: '🍽️ Nutrition', callback_data: 'nutrition' }],
                        [{ text: '🏆 Challenges', callback_data: 'challenge' }],
                        [{ text: '👤 Profile', callback_data: 'profile' }],
                        [{ text: '📱 Open App', url: `${process.env.FRONTEND_URL}?tg=${userId}` }]
                    ]
                });
            }

            else if (text === '/workout') {
                const exercises = await Exercise.find({ isActive: true }).limit(5);
                let workoutText = '🏋️ <b>Your Workout</b>\n\n';
                exercises.forEach((ex, i) => {
                    workoutText += `${i+1}. ${ex.name}\n   🎯 ${ex.muscle} | ${ex.difficulty}\n\n`;
                });
                workoutText += '🔹 Sets: 3-4\n🔹 Reps: 8-12\n🔹 Rest: 60s';

                await sendTelegramMessage(chatId, workoutText, {
                    inline_keyboard: [
                        [{ text: '✅ Complete Workout', callback_data: 'complete' }],
                        [{ text: '📊 Progress', callback_data: 'progress' }],
                        [{ text: '📱 Open App', url: `${process.env.FRONTEND_URL}?tg=${userId}` }]
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
                    `💪 XP: ${user.xp}\n\n` +
                    `Keep pushing! You're doing great! 💪`;

                await sendTelegramMessage(chatId, progressText, {
                    inline_keyboard: [
                        [{ text: '📈 Full Stats', callback_data: 'stats' }],
                        [{ text: '📱 Open App', url: `${process.env.FRONTEND_URL}?tg=${userId}` }]
                    ]
                });
            }

            else if (text === '/nutrition') {
                const nutrition = await Nutrition.findOne({
                    userId: user._id,
                    date: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                });

                let nutritionText;
                if (nutrition) {
                    nutritionText = `🍽️ <b>Today's Nutrition</b>\n\n` +
                        `🔥 Calories: ${nutrition.calories || 0}\n` +
                        `💪 Protein: ${nutrition.protein || 0}g\n` +
                        `🍚 Carbs: ${nutrition.carbs || 0}g\n` +
                        `🥑 Fat: ${nutrition.fat || 0}g\n` +
                        `💧 Water: ${nutrition.water || 0}L`;
                } else {
                    nutritionText = `🍽️ <b>Nutrition</b>\n\n` +
                        `No nutrition data logged today.\n` +
                        `Track your meals in the app!`;
                }

                await sendTelegramMessage(chatId, nutritionText, {
                    inline_keyboard: [
                        [{ text: '📱 Log Meals', url: `${process.env.FRONTEND_URL}?tg=${userId}` }],
                        [{ text: '🍽️ Meal Plan', callback_data: 'mealplan' }]
                    ]
                });
            }

            else if (text === '/challenge') {
                const challenge = await Challenge.findOne({
                    isActive: true,
                    endDate: { $gte: new Date() }
                });

                let challengeText = '🏆 <b>Active Challenges</b>\n\n';
                if (challenge) {
                    challengeText += `📌 ${challenge.name}\n` +
                        `📝 ${challenge.description || 'Complete workouts to earn rewards!'}\n` +
                        `🎯 ${challenge.requiredWorkouts} workouts required\n` +
                        `⭐ Reward: ${challenge.rewardXp} XP`;

                    const isJoined = challenge.participants.some(
                        p => p.userId.toString() === user._id.toString()
                    );

                    const buttons = [];
                    if (!isJoined) {
                        buttons.push([{ text: '🎯 Join Challenge', callback_data: 'join_challenge' }]);
                    }
                    buttons.push([{ text: '📱 Open App', url: `${process.env.FRONTEND_URL}?tg=${userId}` }]);
                    
                    await sendTelegramMessage(chatId, challengeText, {
                        inline_keyboard: buttons
                    });
                } else {
                    await sendTelegramMessage(chatId, '🏆 No active challenges right now. Check back soon!');
                }
            }

            else if (text === '/profile') {
                const profileText = `👤 <b>Your Profile</b>\n\n` +
                    `📛 Name: ${user.fullName || 'Not set'}\n` +
                    `🔹 Username: ${user.username}\n` +
                    `🎯 Goal: ${user.fitnessGoal || 'Not set'}\n` +
                    `📊 Level: ${user.fitnessLevel || 'Not set'}\n` +
                    `⭐ Level: ${user.level}\n` +
                    `💪 XP: ${user.xp}\n` +
                    `🔥 Streak: ${user.streak} days`;

                await sendTelegramMessage(chatId, profileText, {
                    inline_keyboard: [
                        [{ text: '✏️ Update Profile', url: `${process.env.FRONTEND_URL}?tg=${userId}` }],
                        [{ text: '📱 Open App', url: `${process.env.FRONTEND_URL}?tg=${userId}` }]
                    ]
                });
            }

            else if (text === '/help') {
                const helpText = `❓ <b>Help & Support</b>\n\n` +
                    `Available commands:\n` +
                    `/start - Start the bot\n` +
                    `/workout - Get a workout\n` +
                    `/progress - View progress\n` +
                    `/nutrition - Nutrition info\n` +
                    `/challenge - View challenges\n` +
                    `/profile - View profile\n` +
                    `/help - Show this help\n\n` +
                    `📱 Open the web app for full features!`;

                await sendTelegramMessage(chatId, helpText, {
                    inline_keyboard: [
                        [{ text: '📱 Open App', url: `${process.env.FRONTEND_URL}?tg=${userId}` }],
                        [{ text: '📧 Contact Support', url: `mailto:${process.env.SUPPORT_EMAIL || 'support@gymapp.com'}` }]
                    ]
                });
            }

            else {
                // AI Chat response for any other message
                const aiResponse = `🤖 <b>AI Coach</b>\n\n` +
                    `I understand you're asking about fitness. Here are some quick tips:\n\n` +
                    `💪 Stay consistent with your workouts\n` +
                    `🥗 Eat balanced meals with protein\n` +
                    `💧 Drink water throughout the day\n` +
                    `😴 Get 7-9 hours of sleep\n\n` +
                    `📱 Open the app for personalized guidance!`;

                await sendTelegramMessage(chatId, aiResponse, {
                    inline_keyboard: [
                        [{ text: '💪 Start Workout', callback_data: 'workout' }],
                        [{ text: '📊 View Progress', callback_data: 'progress' }],
                        [{ text: '📱 Open App', url: `${process.env.FRONTEND_URL}?tg=${userId}` }]
                    ]
                });
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Telegram webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

// =============================================
// HEALTH CHECK
// =============================================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// =============================================
// ERROR HANDLING
// =============================================

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// =============================================
// START SERVER
// =============================================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 API: http://localhost:${PORT}/api/v1`);
    console.log(`🤖 Telegram Bot Webhook: http://localhost:${PORT}/webhook/${process.env.TELEGRAM_BOT_TOKEN}`);
});

module.exports = app;
