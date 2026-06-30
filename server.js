// =============================================
// BACKEND - server.js
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
const crypto = require('crypto');
require('dotenv').config();

const app = express();

// ===== SECURITY =====
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ===== RATE LIMITING =====
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api', limiter);

// ===== DATABASE CONNECTION =====
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gymapp', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// ===== MODELS =====

// User Model
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
    preferredWorkoutDays: { type: [String] },
    medicalInfo: { type: String },
    role: { type: String, enum: ['User', 'Coach', 'Admin'], default: 'User' },
    isPremium: { type: Boolean, default: false },
    premiumExpiry: { type: Date },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    streak: { type: Number, default: 0 },
    lastWorkoutDate: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    refreshTokens: { type: [String], default: [] }
});

UserSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
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
    benefits: { type: String },
    safetyWarnings: { type: String },
    commonMistakes: { type: String },
    alternatives: { type: [String] },
    tips: { type: String },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
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
    exercisesCompleted: { type: Number },
    notes: { type: String }
});

const Progress = mongoose.model('Progress', ProgressSchema);

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
    isActive: { type: Boolean, default: true }
});

const Challenge = mongoose.model('Challenge', ChallengeSchema);

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
        fat: { type: Number },
        ingredients: { type: [String] },
        preparation: { type: String }
    }]
});

const Nutrition = mongoose.model('Nutrition', NutritionSchema);

// Notification Model
const NotificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: ['Workout', 'Meal', 'Water', 'Challenge', 'Achievement', 'System'] },
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

// ===== MIDDLEWARE =====
const authenticate = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
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
            return res.status(403).json({ error: 'Access denied' });
        }
        next();
    };
};

// ===== UPLOAD CONFIG =====
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads/';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

// =============================================
// ===== AUTH ROUTES =====
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
        const refreshToken = jwt.sign({ userId: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });

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
                isPremium: user.isPremium
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
        const refreshToken = jwt.sign({ userId: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });

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

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user || !user.refreshTokens.includes(refreshToken)) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }

        const newToken = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
        const newRefreshToken = jwt.sign({ userId: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });

        user.refreshTokens = user.refreshTokens.filter(t => t !== refreshToken);
        user.refreshTokens.push(newRefreshToken);
        await user.save();

        res.json({
            success: true,
            token: newToken,
            refreshToken: newRefreshToken
        });
    } catch (error) {
        console.error(error);
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
        console.error(error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

// =============================================
// ===== USER ROUTES =====
// =============================================

// Get Profile
app.get('/api/v1/users/profile', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password -refreshTokens');
        res.json({ success: true, user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

// Update Profile
app.put('/api/v1/users/profile', authenticate, async (req, res) => {
    try {
        const allowed = ['fullName', 'gender', 'age', 'height', 'weight', 'fitnessLevel', 'fitnessGoal', 
                        'activityLevel', 'workoutExperience', 'medicalInfo'];
        const updates = {};
        allowed.forEach(field => {
            if (req.body[field] !== undefined) updates[field] = req.body[field];
        });

        const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password -refreshTokens');
        res.json({ success: true, user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Upload Profile Photo
app.post('/api/v1/users/photo', authenticate, upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const photoUrl = `/uploads/${req.file.filename}`;
        const user = await User.findByIdAndUpdate(req.user._id, { profilePhoto: photoUrl }, { new: true });
        res.json({ success: true, photoUrl: photoUrl });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to upload photo' });
    }
});

// Delete Account
app.delete('/api/v1/users/account', authenticate, async (req, res) => {
    try {
        await User.findByIdAndDelete(req.user._id);
        res.json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

// =============================================
// ===== EXERCISE ROUTES =====
// =============================================

// Get All Exercises
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
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch exercises' });
    }
});

// Get Exercise by ID
app.get('/api/v1/exercises/:id', async (req, res) => {
    try {
        const exercise = await Exercise.findById(req.params.id);
        if (!exercise) {
            return res.status(404).json({ error: 'Exercise not found' });
        }
        res.json({ success: true, exercise });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch exercise' });
    }
});

// =============================================
// ===== WORKOUT ROUTES =====
// =============================================

// Create Workout
app.post('/api/v1/workouts', authenticate, async (req, res) => {
    try {
        const { name, exercises, category, difficulty, duration, calories } = req.body;
        
        const workout = new Workout({
            name,
            userId: req.user._id,
            exercises,
            category,
            difficulty,
            duration,
            calories
        });

        await workout.save();
        res.status(201).json({ success: true, workout });
    } catch (error) {
        console.error(error);
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
        const total = await Workout.countDocuments(query);

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
        res.status(500).json({ error: 'Failed to fetch workouts' });
    }
});

// Complete Workout
app.put('/api/v1/workouts/:id/complete', authenticate, async (req, res) => {
    try {
        const { rating, notes } = req.body;
        
        const workout = await Workout.findOne({ _id: req.params.id, userId: req.user._id });
        if (!workout) {
            return res.status(404).json({ error: 'Workout not found' });
        }

        workout.completed = true;
        workout.completionTime = new Date();
        workout.rating = rating;
        workout.notes = notes;
        await workout.save();

        // Update user stats
        const user = await User.findById(req.user._id);
        user.xp += 50; // Base XP for completing workout
        user.streak = user.streak + 1;
        user.lastWorkoutDate = new Date();

        // Level up
        const xpNeeded = user.level * 100;
        if (user.xp >= xpNeeded) {
            user.level += 1;
            await Notification.create({
                userId: user._id,
                type: 'Achievement',
                title: 'Level Up!',
                message: `Congratulations! You've reached Level ${user.level}!`
            });
        }

        await user.save();

        // Check achievements
        const workoutCount = await Workout.countDocuments({ userId: req.user._id, completed: true });
        if (workoutCount === 1) {
            await Achievement.create({
                userId: req.user._id,
                name: 'First Workout',
                description: 'Completed your first workout!',
                badge: '🏆',
                xpEarned: 50
            });
        }

        res.json({ success: true, workout });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to complete workout' });
    }
});

// =============================================
// ===== PROGRESS ROUTES =====
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
        console.error(error);
        res.status(500).json({ error: 'Failed to log progress' });
    }
});

// Get User Progress
app.get('/api/v1/progress', authenticate, async (req, res) => {
    try {
        const { limit = 30 } = req.query;
        const progress = await Progress.find({ userId: req.user._id })
            .sort({ date: -1 })
            .limit(parseInt(limit));
        
        res.json({ success: true, progress });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch progress' });
    }
});

// =============================================
// ===== CHALLENGE ROUTES =====
// =============================================

// Get Active Challenges
app.get('/api/v1/challenges/active', authenticate, async (req, res) => {
    try {
        const challenges = await Challenge.find({
            isActive: true,
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() }
        }).populate('exercises');

        res.json({ success: true, challenges });
    } catch (error) {
        console.error(error);
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

        const alreadyJoined = challenge.participants.some(p => p.userId.toString() === req.user._id.toString());
        if (alreadyJoined) {
            return res.status(400).json({ error: 'Already joined this challenge' });
        }

        challenge.participants.push({ userId: req.user._id });
        await challenge.save();

        res.json({ success: true, challenge });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to join challenge' });
    }
});

// =============================================
// ===== NUTRITION ROUTES =====
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
        console.error(error);
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
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch nutrition' });
    }
});

// =============================================
// ===== NOTIFICATION ROUTES =====
// =============================================

// Get User Notifications
app.get('/api/v1/notifications', authenticate, async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(50);
        
        res.json({ success: true, notifications });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// Mark Notification as Read
app.put('/api/v1/notifications/:id/read', authenticate, async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { read: true },
            { new: true }
        );
        res.json({ success: true, notification });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});

// =============================================
// ===== ACHIEVEMENT ROUTES =====
// =============================================

// Get User Achievements
app.get('/api/v1/achievements', authenticate, async (req, res) => {
    try {
        const achievements = await Achievement.find({ userId: req.user._id })
            .sort({ earnedAt: -1 });
        
        res.json({ success: true, achievements });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch achievements' });
    }
});

// =============================================
// ===== STATS ROUTES =====
// =============================================

// Get User Statistics
app.get('/api/v1/stats', authenticate, async (req, res) => {
    try {
        const totalWorkouts = await Workout.countDocuments({ userId: req.user._id, completed: true });
        const totalExercises = await Workout.aggregate([
            { $match: { userId: req.user._id, completed: true } },
            { $unwind: '$exercises' },
            { $count: 'total' }
        ]);
        const caloriesBurned = await Workout.aggregate([
            { $match: { userId: req.user._id, completed: true } },
            { $group: { _id: null, total: { $sum: '$calories' } } }
        ]);

        const weeklyWorkouts = await Workout.countDocuments({
            userId: req.user._id,
            completed: true,
            date: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        });

        const user = await User.findById(req.user._id);

        res.json({
            success: true,
            stats: {
                totalWorkouts,
                totalExercises: totalExercises[0]?.total || 0,
                caloriesBurned: caloriesBurned[0]?.total || 0,
                currentStreak: user.streak,
                weeklyWorkouts,
                level: user.level,
                xp: user.xp,
                xpToNextLevel: user.level * 100
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// =============================================
// ===== ADMIN ROUTES =====
// =============================================

// Get Dashboard Stats (Admin only)
app.get('/api/v1/admin/stats', authenticate, authorize('Admin'), async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ isActive: true });
        const totalWorkouts = await Workout.countDocuments({ completed: true });
        const totalExercises = await Exercise.countDocuments();

        const dailyRegistrations = await User.countDocuments({
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });

        res.json({
            success: true,
            stats: {
                totalUsers,
                activeUsers,
                totalWorkouts,
                totalExercises,
                dailyRegistrations,
                premiumUsers: await User.countDocuments({ isPremium: true })
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch admin stats' });
    }
});

// Admin: Manage Exercises
app.post('/api/v1/admin/exercises', authenticate, authorize('Admin'), async (req, res) => {
    try {
        const exercise = new Exercise(req.body);
        await exercise.save();
        res.status(201).json({ success: true, exercise });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create exercise' });
    }
});

// Admin: Update Exercise
app.put('/api/v1/admin/exercises/:id', authenticate, authorize('Admin'), async (req, res) => {
    try {
        const exercise = await Exercise.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ success: true, exercise });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update exercise' });
    }
});

// Admin: Delete Exercise
app.delete('/api/v1/admin/exercises/:id', authenticate, authorize('Admin'), async (req, res) => {
    try {
        await Exercise.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Exercise deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete exercise' });
    }
});

// Admin: Broadcast Notification
app.post('/api/v1/admin/broadcast', authenticate, authorize('Admin'), async (req, res) => {
    try {
        const { title, message } = req.body;
        
        const users = await User.find({ isActive: true });
        const notifications = users.map(user => ({
            userId: user._id,
            type: 'System',
            title,
            message
        }));
        
        await Notification.insertMany(notifications);
        res.json({ success: true, message: 'Broadcast sent successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to send broadcast' });
    }
});

// =============================================
// ===== AI COACH ROUTES =====
// =============================================

// AI Coach - Get Personalized Workout
app.post('/api/v1/ai/workout', authenticate, async (req, res) => {
    try {
        const user = req.user;
        
        // Determine workout type based on user's fitness level and goal
        let recommendedExercises = [];
        const targetMuscles = ['Chest', 'Back', 'Legs', 'Shoulders'];
        
        // Select exercises based on user level
        const difficulty = user.fitnessLevel || 'Intermediate';
        const goal = user.fitnessGoal || 'Build Muscle';
        
        // Get exercises from database
        const exercises = await Exercise.find({ 
            difficulty: difficulty,
            isActive: true 
        }).limit(8);

        // Build workout plan
        const workout = {
            name: `AI Custom Workout - ${new Date().toLocaleDateString()}`,
            exercises: exercises.map(ex => ({
                exerciseId: ex._id,
                sets: ex.sets || 3,
                reps: ex.reps || '10-12',
                rest: ex.rest || '60s'
            })),
            category: goal,
            difficulty: difficulty,
            duration: 45,
            calories: 350
        };

        res.json({
            success: true,
            workout,
            recommendation: `Based on your ${difficulty.toLowerCase()} level and ${goal.toLowerCase()} goal, here's a personalized workout for you.`
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to generate AI workout' });
    }
});

// AI Coach - Nutrition Recommendation
app.post('/api/v1/ai/nutrition', authenticate, async (req, res) => {
    try {
        const user = req.user;
        const { goal = user.fitnessGoal || 'Maintain Fitness' } = req.body;
        
        // Calculate macros based on goal
        let macros = {
            calories: 2000,
            protein: 150,
            carbs: 200,
            fat: 65
        };

        if (goal === 'Build Muscle') {
            macros = { calories: 2800, protein: 200, carbs: 300, fat: 80 };
        } else if (goal === 'Lose Weight') {
            macros = { calories: 1800, protein: 160, carbs: 150, fat: 50 };
        }

        // Generate meal suggestions
        const meals = [
            {
                type: 'Breakfast',
                name: 'High Protein Oatmeal',
                calories: 450,
                protein: 30,
                carbs: 50,
                fat: 10,
                ingredients: ['Oats', 'Protein Powder', 'Berries', 'Almond Milk']
            },
            {
                type: 'Lunch',
                name: 'Grilled Chicken Salad',
                calories: 550,
                protein: 45,
                carbs: 30,
                fat: 20,
                ingredients: ['Chicken Breast', 'Mixed Greens', 'Avocado', 'Olive Oil']
            },
            {
                type: 'Dinner',
                name: 'Salmon with Quinoa',
                calories: 650,
                protein: 40,
                carbs: 45,
                fat: 25,
                ingredients: ['Salmon', 'Quinoa', 'Broccoli', 'Lemon']
            }
        ];

        res.json({
            success: true,
            macros,
            meals,
            recommendation: `Based on your ${goal.toLowerCase()} goal, here are your daily macro targets and meal suggestions.`
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to generate nutrition recommendation' });
    }
});

// =============================================
// ===== TELEGRAM BOT INTEGRATION =====
// =============================================

// Telegram WebApp Data
app.post('/api/v1/telegram/webapp', async (req, res) => {
    try {
        const { initData, userId } = req.body;
        
        // Validate Telegram data
        // In production, verify the initData signature
        
        const user = await User.findOne({ telegramId: userId });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
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
        res.status(500).json({ error: 'Telegram WebApp authentication failed' });
    }
});

// Telegram Bot Webhook
app.post('/api/v1/telegram/webhook', async (req, res) => {
    try {
        const { message, callback_query } = req.body;
        
        // Handle Telegram bot commands
        if (message) {
            const text = message.text;
            const chatId = message.chat.id;
            const userId = message.from.id;
            
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
                // Send welcome message with inline keyboard
                res.json({
                    method: 'sendMessage',
                    chat_id: chatId,
                    text: `🏋️ Welcome to ProGym, ${user.fullName}!\n\nYour AI-powered fitness companion is ready to help you reach your goals.`,
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📱 Open App', url: `${process.env.FRONTEND_URL}?telegram_id=${userId}` }],
                            [{ text: '💪 Start Workout', callback_data: 'workout' }],
                            [{ text: '📊 My Progress', callback_data: 'progress' }]
                        ]
                    }
                });
            } else if (text === '/workout' || text === '💪 Start Workout') {
                // Generate workout suggestion
                const exercises = await Exercise.find({ isActive: true }).limit(6);
                const workoutText = exercises.map((ex, i) => 
                    `${i+1}. ${ex.name}\n   🎯 ${ex.muscle} | ${ex.difficulty}\n   📺 ${ex.video || 'No video'}`
                ).join('\n\n');
                
                res.json({
                    method: 'sendMessage',
                    chat_id: chatId,
                    text: `🏋️ *Today's Workout*\n\n${workoutText}\n\n🔹 Sets: 3-4\n🔹 Reps: 8-12\n🔹 Rest: 60s\n\nClick "Open App" to track your workout!`,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '✅ Mark Complete', callback_data: 'complete_workout' }],
                            [{ text: '📱 Open App', url: `${process.env.FRONTEND_URL}?telegram_id=${userId}` }]
                        ]
                    }
                });
            } else if (text === '/progress' || text === '📊 My Progress') {
                const totalWorkouts = await Workout.countDocuments({ userId: user._id, completed: true });
                const streak = user.streak || 0;
                
                res.json({
                    method: 'sendMessage',
                    chat_id: chatId,
                    text: `📊 *Your Progress*\n\n🏋️ Total Workouts: ${totalWorkouts}\n🔥 Current Streak: ${streak} days\n⭐ Level: ${user.level || 1}\n💪 XP: ${user.xp || 0}\n\nKeep pushing! You're doing great! 💪`,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📈 Full Report', callback_data: 'report' }],
                            [{ text: '📱 Open App', url: `${process.env.FRONTEND_URL}?telegram_id=${userId}` }]
                        ]
                    }
                });
            } else if (text === '/nutrition' || text === '🍽 Nutrition') {
                const nutrition = await Nutrition.findOne({ 
                    userId: user._id,
                    date: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                });
                
                const nutritionText = nutrition ? 
                    `🔥 Calories: ${nutrition.calories || 0}\n💪 Protein: ${nutrition.protein || 0}g\n🍚 Carbs: ${nutrition.carbs || 0}g\n🥑 Fat: ${nutrition.fat || 0}g\n💧 Water: ${nutrition.water || 0}L` :
                    'No nutrition data logged today. Track your meals in the app!';
                
                res.json({
                    method: 'sendMessage',
                    chat_id: chatId,
                    text: `🍽 *Today's Nutrition*\n\n${nutritionText}\n\n📱 Log your meals in the app!`,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📝 Log Meal', callback_data: 'log_meal' }],
                            [{ text: '📱 Open App', url: `${process.env.FRONTEND_URL}?telegram_id=${userId}` }]
                        ]
                    }
                });
            } else {
                // Default AI response
                res.json({
                    method: 'sendMessage',
                    chat_id: chatId,
                    text: `🤖 I understand you're asking about fitness. Here are some quick tips:\n\n💪 Stay consistent with your workouts\n🥗 Eat balanced meals with protein\n💧 Drink water throughout the day\n😴 Get 7-9 hours of sleep\n\n📱 Open the app for personalized guidance!`,
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '💪 Start Workout', callback_data: 'workout' }],
                            [{ text: '📊 View Progress', callback_data: 'progress' }]
                        ]
                    }
                });
            }
        }
        
        // Handle callback queries (button presses)
        if (callback_query) {
            const data = callback_query.data;
            const chatId = callback_query.message.chat.id;
            
            if (data === 'workout') {
                // Trigger workout command
                res.json({
                    method: 'sendMessage',
                    chat_id: chatId,
                    text: '🏋️ Starting your workout... Click below to begin!',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📱 Open Workout', url: `${process.env.FRONTEND_URL}?telegram_id=${callback_query.from.id}` }]
                        ]
                    }
                });
            } else if (data === 'progress') {
                // Trigger progress command
                res.json({
                    method: 'sendMessage',
                    chat_id: chatId,
                    text: '📊 Loading your progress...',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📱 View Full Progress', url: `${process.env.FRONTEND_URL}?telegram_id=${callback_query.from.id}` }]
                        ]
                    }
                });
            } else if (data === 'complete_workout') {
                // Mark workout complete
                await Workout.findOneAndUpdate(
                    { userId: callback_query.from.id, completed: false },
                    { completed: true, completionTime: new Date() },
                    { sort: { date: -1 } }
                );
                
                res.json({
                    method: 'sendMessage',
                    chat_id: chatId,
                    text: '✅ Workout marked as complete! Great job! 🎉\n\n🔥 Keep building that streak!'
                });
            }
        }
    } catch (error) {
        console.error('Telegram webhook error:', error);
        res.status(500).json({ error: 'Telegram webhook failed' });
    }
});

// =============================================
// ===== HEALTH CHECK =====
// =============================================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// =============================================
// ===== ERROR HANDLING =====
// =============================================

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// =============================================
// ===== START SERVER =====
// =============================================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 API: http://localhost:${PORT}/api/v1`);
});

module.exports = app;
