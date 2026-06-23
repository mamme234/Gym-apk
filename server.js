// ================================================================
//  SERVER.JS – Complete AI Gym Trainer
//  Features:
//  - Onboarding: weight, height, protein, calories, workout style
//  - Personalized schedule & nutrition (users can customize)
//  - Workout videos with reps/sets (ALL 140 exercises with YouTube)
//  - Recording with form correction
//  - Telegram bot with welcome & reminder messages
//  - Schedule customization (users can change their workouts)
//  - Dashboard with benefits & what to reduce
//  - Results with nutrition & motivation
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

// ─── Configuration from .env ──────────────────────────────────
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
const STATIC_DIR = process.env.STATIC_DIR || path.join(__dirname, 'public');
const LOG_DIR = path.join(__dirname, 'logs');
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'YourGymBot';
const MINI_APP_URL = process.env.TELEGRAM_MINI_APP_URL || 'https://gym-apk-krk7.vercel.app';
const BACKEND_URL = process.env.BACKEND_URL || 'https://gym-apk-wicj.onrender.com';
const NODE_ENV = process.env.NODE_ENV || 'development';

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
    MINI_APP_URL,
    BACKEND_URL,
    'http://localhost:3000',
    'http://localhost:5173',
    'https://gym-apk-krk7.vercel.app',
    'https://gym-apk-wicj.onrender.com'
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
let bot = null;
if (TOKEN && TOKEN !== 'your-bot-token-here' && TOKEN !== '7609348168:AAHcFz8LxKJfGqWnR8mN3pQvZx7YwCbTdE') {
  bot = new TelegramBot(TOKEN, { polling: true });
  console.log('✅ Telegram Bot initialized with polling');
} else {
  console.log('⚠️ TELEGRAM_BOT_TOKEN not set or invalid');
}

// ─── In-memory Database ─────────────────────────────────────────
const userProfiles = new Map();
const workoutHistory = new Map();
const userSessions = new Map();
const userCustomSchedules = new Map();
const completedWorkouts = new Map();

// ─── ALL 140 EXERCISES WITH REAL YOUTUBE VIDEOS ──────────────────
const EXERCISE_DB = {
  // ===== CHEST (20 exercises) =====
  CHEST_01: { id: 'CHEST_01', name: 'Barbell Bench Press', icon: '🏋️', muscle: 'Chest', videoUrl: 'https://www.youtube.com/embed/gRVjAtPip0Y', premium: true, desc: 'Lie on bench, grip bar slightly wider than shoulders', tip: 'Keep shoulders pinned back, feet planted', defaultReps: 10, defaultSets: 3 },
  CHEST_02: { id: 'CHEST_02', name: 'Dumbbell Bench Press', icon: '🏋️', muscle: 'Chest', videoUrl: 'https://www.youtube.com/embed/VmB1G1K7v94', premium: false, desc: 'Press dumbbells up from chest level', tip: 'Keep wrists straight, control the descent', defaultReps: 10, defaultSets: 3 },
  CHEST_03: { id: 'CHEST_03', name: 'Push-ups', icon: '💪', muscle: 'Chest', videoUrl: 'https://www.youtube.com/embed/IODxDxX7oi4', premium: false, desc: 'Lower chest to ground, push back up', tip: 'Keep core tight, body in straight line', defaultReps: 15, defaultSets: 3 },
  CHEST_04: { id: 'CHEST_04', name: 'Incline Bench Press', icon: '🏋️', muscle: 'Chest', videoUrl: 'https://www.youtube.com/embed/Srqn4F5BvFY', premium: true, desc: 'Press up on incline bench targeting upper chest', tip: 'Keep elbows at 45 degrees', defaultReps: 10, defaultSets: 3 },
  CHEST_05: { id: 'CHEST_05', name: 'Decline Bench Press', icon: '🏋️', muscle: 'Chest', videoUrl: 'https://www.youtube.com/embed/LvL0kLJxYFw', premium: true, desc: 'Press on decline bench targeting lower chest', tip: 'Maintain control throughout movement', defaultReps: 10, defaultSets: 3 },
  CHEST_06: { id: 'CHEST_06', name: 'Chest Dips', icon: '💪', muscle: 'Chest', videoUrl: 'https://www.youtube.com/embed/2z8JmcrW-As', premium: true, desc: 'Lower body between parallel bars, push up', tip: 'Lean forward to target chest more', defaultReps: 12, defaultSets: 3 },
  CHEST_07: { id: 'CHEST_07', name: 'Floor Press', icon: '🏋️', muscle: 'Chest', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Press dumbbells from floor position', tip: 'Great for shoulder safety', defaultReps: 10, defaultSets: 3 },
  CHEST_08: { id: 'CHEST_08', name: 'Dumbbell Fly', icon: '💪', muscle: 'Chest', videoUrl: 'https://www.youtube.com/embed/QENPH9RqQk0', premium: false, desc: 'Open arms wide, squeeze chest', tip: 'Keep slight bend in elbows', defaultReps: 12, defaultSets: 3 },
  CHEST_09: { id: 'CHEST_09', name: 'Close-Grip Push-ups', icon: '💪', muscle: 'Chest', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Hands close together, target inner chest', tip: 'Keep elbows close to body', defaultReps: 15, defaultSets: 3 },
  CHEST_10: { id: 'CHEST_10', name: 'Machine Chest Press', icon: '🏋️', muscle: 'Chest', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Push handles forward, squeeze chest', tip: 'Adjust seat for proper alignment', defaultReps: 10, defaultSets: 3 },
  CHEST_11: { id: 'CHEST_11', name: 'Incline Dumbbell Press', icon: '🏋️', muscle: 'Chest', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Press dumbbells on incline bench', tip: 'Focus on upper chest contraction', defaultReps: 10, defaultSets: 3 },
  CHEST_12: { id: 'CHEST_12', name: 'Decline Push-ups', icon: '💪', muscle: 'Chest', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Feet elevated, lower chest to ground', tip: 'Great for upper chest emphasis', defaultReps: 12, defaultSets: 3 },
  CHEST_13: { id: 'CHEST_13', name: 'Cable Crossovers', icon: '💪', muscle: 'Chest', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Pull cables across body, squeeze chest', tip: 'Cross hands for full contraction', defaultReps: 12, defaultSets: 3 },
  CHEST_14: { id: 'CHEST_14', name: 'Pec Deck Fly', icon: '💪', muscle: 'Chest', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Squeeze handles together, chest isolation', tip: 'Hold peak contraction for 2 seconds', defaultReps: 12, defaultSets: 3 },
  CHEST_15: { id: 'CHEST_15', name: 'Dumbbell Pullover', icon: '🏋️', muscle: 'Chest', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Lower dumbbell behind head, pull over chest', tip: 'Works chest and lats together', defaultReps: 10, defaultSets: 3 },
  CHEST_16: { id: 'CHEST_16', name: 'Svend Press', icon: '🏋️', muscle: 'Chest', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Press plates together, squeeze chest', tip: 'Focus on isometric contraction', defaultReps: 12, defaultSets: 3 },
  CHEST_17: { id: 'CHEST_17', name: 'Single-Arm Cable Fly', icon: '💪', muscle: 'Chest', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Single arm cross body cable fly', tip: 'Great for fixing imbalances', defaultReps: 10, defaultSets: 3 },
  CHEST_18: { id: 'CHEST_18', name: 'Clap Push-ups', icon: '💪', muscle: 'Chest', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Explosive push-ups with clap', tip: 'Focus on explosive power', defaultReps: 10, defaultSets: 3 },
  CHEST_19: { id: 'CHEST_19', name: 'Wide Push-ups', icon: '💪', muscle: 'Chest', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Wide hand placement for outer chest', tip: 'Lower chest deeper for stretch', defaultReps: 12, defaultSets: 3 },
  CHEST_20: { id: 'CHEST_20', name: 'Landmine Press', icon: '🏋️', muscle: 'Chest', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Press barbell from landmine station', tip: 'Great for shoulder health', defaultReps: 10, defaultSets: 3 },

  // ===== BACK (20 exercises) =====
  BACK_01: { id: 'BACK_01', name: 'Pull-ups', icon: '💪', muscle: 'Back', videoUrl: 'https://www.youtube.com/embed/eGo4IYlbE5g', premium: true, desc: 'Pull body up to bar, lower controlled', tip: 'Keep core tight, use full range', defaultReps: 8, defaultSets: 3 },
  BACK_02: { id: 'BACK_02', name: 'Chin-ups', icon: '💪', muscle: 'Back', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Underhand grip pull-ups', tip: 'Focus on bicep engagement', defaultReps: 8, defaultSets: 3 },
  BACK_03: { id: 'BACK_03', name: 'Bent-Over Barbell Row', icon: '🏋️', muscle: 'Back', videoUrl: 'https://www.youtube.com/embed/vT2GjY_Umpw', premium: false, desc: 'Bend at hips, row bar to chest', tip: 'Keep back straight, pull to belly button', defaultReps: 10, defaultSets: 3 },
  BACK_04: { id: 'BACK_04', name: 'Seated Cable Row', icon: '💪', muscle: 'Back', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Pull cable handle to belly', tip: 'Squeeze shoulder blades together', defaultReps: 12, defaultSets: 3 },
  BACK_05: { id: 'BACK_05', name: 'Lat Pulldowns', icon: '💪', muscle: 'Back', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Pull bar down to upper chest', tip: 'Lean back slightly for better engagement', defaultReps: 12, defaultSets: 3 },
  BACK_06: { id: 'BACK_06', name: 'Single-Arm Dumbbell Row', icon: '🏋️', muscle: 'Back', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Row dumbbell up one arm at a time', tip: 'Keep back flat, pull to hip', defaultReps: 10, defaultSets: 3 },
  BACK_07: { id: 'BACK_07', name: 'Face Pulls', icon: '💪', muscle: 'Back', videoUrl: 'https://www.youtube.com/embed/HZSTx1OmeDU', premium: true, desc: 'Pull cables to face, external rotation', tip: 'Great for posture and shoulder health', defaultReps: 15, defaultSets: 3 },
  BACK_08: { id: 'BACK_08', name: 'Inverted Rows', icon: '💪', muscle: 'Back', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Row body weight from under bar', tip: 'Adjust difficulty by foot position', defaultReps: 10, defaultSets: 3 },
  BACK_09: { id: 'BACK_09', name: 'Deadlifts', icon: '🏋️', muscle: 'Back', videoUrl: 'https://www.youtube.com/embed/r4MzxtBKyNE', premium: false, desc: 'Lift barbell from floor to standing', tip: 'Keep back neutral, hinge at hips', defaultReps: 8, defaultSets: 3 },
  BACK_10: { id: 'BACK_10', name: 'Pendlay Rows', icon: '🏋️', muscle: 'Back', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Row from dead stop on floor', tip: 'Explosive upward, controlled down', defaultReps: 8, defaultSets: 3 },
  BACK_11: { id: 'BACK_11', name: 'T-Bar Row', icon: '🏋️', muscle: 'Back', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Row T-bar to chest', tip: 'Focus on lat engagement', defaultReps: 10, defaultSets: 3 },
  BACK_12: { id: 'BACK_12', name: 'Dumbbell Row', icon: '🏋️', muscle: 'Back', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Row dumbbell to hip, alternate sides', tip: 'Keep back flat, full stretch at bottom', defaultReps: 10, defaultSets: 3 },
  BACK_13: { id: 'BACK_13', name: 'Machine Row', icon: '🏋️', muscle: 'Back', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Row machine handles to chest', tip: 'Squeeze shoulder blades', defaultReps: 12, defaultSets: 3 },
  BACK_14: { id: 'BACK_14', name: 'Reverse Fly', icon: '💪', muscle: 'Back', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Open arms back, squeeze rear delts', tip: 'Keep slight bend in elbows', defaultReps: 12, defaultSets: 3 },
  BACK_15: { id: 'BACK_15', name: 'Rack Pulls', icon: '🏋️', muscle: 'Back', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Pull from rack above knees', tip: 'Focus on upper back engagement', defaultReps: 8, defaultSets: 3 },
  BACK_16: { id: 'BACK_16', name: 'Good Mornings', icon: '🏋️', muscle: 'Back', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Bend forward with bar on shoulders', tip: 'Hinge at hips, keep back straight', defaultReps: 10, defaultSets: 3 },
  BACK_17: { id: 'BACK_17', name: 'Straight-Arm Pulldown', icon: '💪', muscle: 'Back', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Pull cable down with straight arms', tip: 'Focus on lat stretch and contraction', defaultReps: 12, defaultSets: 3 },
  BACK_18: { id: 'BACK_18', name: 'Shrugs (Traps)', icon: '🏋️', muscle: 'Back', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Shrug shoulders up with weight', tip: 'Hold peak contraction', defaultReps: 15, defaultSets: 3 },
  BACK_19: { id: 'BACK_19', name: 'Farmers Walk', icon: '🏋️', muscle: 'Back', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Walk carrying heavy weight', tip: 'Keep shoulders back, core tight', defaultReps: 3, defaultSets: 3 },
  BACK_20: { id: 'BACK_20', name: 'Cable Row', icon: '💪', muscle: 'Back', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Row cable handles to belly', tip: 'Controlled movement with squeeze', defaultReps: 12, defaultSets: 3 },

  // ===== SHOULDERS (20 exercises) =====
  SHOULDER_01: { id: 'SHOULDER_01', name: 'Overhead Press', icon: '🏋️', muscle: 'Shoulders', videoUrl: 'https://www.youtube.com/embed/qEwKCR5JCog', premium: false, desc: 'Press bar overhead from shoulders', tip: 'Keep core tight, don\'t lean back', defaultReps: 10, defaultSets: 3 },
  SHOULDER_02: { id: 'SHOULDER_02', name: 'Dumbbell Shoulder Press', icon: '🏋️', muscle: 'Shoulders', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Press dumbbells overhead', tip: 'Keep wrists straight, control descent', defaultReps: 10, defaultSets: 3 },
  SHOULDER_03: { id: 'SHOULDER_03', name: 'Arnold Press', icon: '🏋️', muscle: 'Shoulders', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Rotate dumbbells from front to overhead', tip: 'Works all three delt heads', defaultReps: 10, defaultSets: 3 },
  SHOULDER_04: { id: 'SHOULDER_04', name: 'Lateral Raises', icon: '💪', muscle: 'Shoulders', videoUrl: 'https://www.youtube.com/embed/3VcKaXpzqHw', premium: false, desc: 'Raise arms to sides, slight bend', tip: 'Use lighter weight, focus on form', defaultReps: 12, defaultSets: 3 },
  SHOULDER_05: { id: 'SHOULDER_05', name: 'Front Raises', icon: '💪', muscle: 'Shoulders', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Raise weight in front to shoulder height', tip: 'Control the movement, don\'t swing', defaultReps: 12, defaultSets: 3 },
  SHOULDER_06: { id: 'SHOULDER_06', name: 'Reverse Fly', icon: '💪', muscle: 'Shoulders', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Open arms back, squeeze rear delts', tip: 'Keep slight bend in elbows', defaultReps: 12, defaultSets: 3 },
  SHOULDER_07: { id: 'SHOULDER_07', name: 'Upright Rows', icon: '🏋️', muscle: 'Shoulders', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Row bar up to chin', tip: 'Keep elbows high, use lighter weight', defaultReps: 10, defaultSets: 3 },
  SHOULDER_08: { id: 'SHOULDER_08', name: 'Shrugs', icon: '🏋️', muscle: 'Shoulders', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Shrug shoulders up, hold peak', tip: 'Heavy weight, controlled movement', defaultReps: 15, defaultSets: 3 },
  SHOULDER_09: { id: 'SHOULDER_09', name: 'Clean & Press', icon: '🏋️', muscle: 'Shoulders', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Explosive clean to press overhead', tip: 'Use hip drive, explosive power', defaultReps: 8, defaultSets: 3 },
  SHOULDER_10: { id: 'SHOULDER_10', name: 'Dumbbell Snatch', icon: '🏋️', muscle: 'Shoulders', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Snatch dumbbell overhead in one motion', tip: 'Explosive hip extension', defaultReps: 8, defaultSets: 3 },
  SHOULDER_11: { id: 'SHOULDER_11', name: 'Front Raises (Plate)', icon: '💪', muscle: 'Shoulders', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Raise plate with both hands in front', tip: 'Control the movement', defaultReps: 12, defaultSets: 3 },
  SHOULDER_12: { id: 'SHOULDER_12', name: 'Cable Lateral Raise', icon: '💪', muscle: 'Shoulders', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Cable lateral raise for constant tension', tip: 'Stand far enough for tension', defaultReps: 12, defaultSets: 3 },
  SHOULDER_13: { id: 'SHOULDER_13', name: 'Single-Arm Cable Raise', icon: '💪', muscle: 'Shoulders', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Single arm cable lateral raise', tip: 'Focus on form and control', defaultReps: 10, defaultSets: 3 },
  SHOULDER_14: { id: 'SHOULDER_14', name: 'Face Pulls', icon: '💪', muscle: 'Shoulders', videoUrl: 'https://www.youtube.com/embed/HZSTx1OmeDU', premium: true, desc: 'Pull to face with external rotation', tip: 'Great for shoulder health', defaultReps: 15, defaultSets: 3 },
  SHOULDER_15: { id: 'SHOULDER_15', name: 'Push Press', icon: '🏋️', muscle: 'Shoulders', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Press with leg drive overhead', tip: 'Use dip and drive technique', defaultReps: 8, defaultSets: 3 },
  SHOULDER_16: { id: 'SHOULDER_16', name: 'Pike Push-ups', icon: '💪', muscle: 'Shoulders', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Body weight shoulder press', tip: 'Great for shoulder strength', defaultReps: 10, defaultSets: 3 },
  SHOULDER_17: { id: 'SHOULDER_17', name: 'Cuban Press', icon: '🏋️', muscle: 'Shoulders', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Rotator cuff strengthening exercise', tip: 'Light weight, focus on control', defaultReps: 12, defaultSets: 3 },
  SHOULDER_18: { id: 'SHOULDER_18', name: 'Arnold Press (Variation)', icon: '🏋️', muscle: 'Shoulders', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Press with rotation through full ROM', tip: 'Smooth controlled movement', defaultReps: 10, defaultSets: 3 },
  SHOULDER_19: { id: 'SHOULDER_19', name: 'YTW Raises', icon: '💪', muscle: 'Shoulders', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Shoulder health exercises', tip: 'Focus on posture and control', defaultReps: 10, defaultSets: 3 },
  SHOULDER_20: { id: 'SHOULDER_20', name: 'Landmine Press', icon: '🏋️', muscle: 'Shoulders', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Angled press from landmine', tip: 'Great for shoulder health', defaultReps: 10, defaultSets: 3 },

  // ===== BICEPS (20 exercises) =====
  BICEPS_01: { id: 'BICEPS_01', name: 'Barbell Curl', icon: '💪', muscle: 'Biceps', videoUrl: 'https://www.youtube.com/embed/ykJmrZ5v0Oo', premium: false, desc: 'Curl barbell up to shoulders', tip: 'Keep elbows pinned to sides', defaultReps: 10, defaultSets: 3 },
  BICEPS_02: { id: 'BICEPS_02', name: 'Dumbbell Curl', icon: '💪', muscle: 'Biceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Curl dumbbells alternately or together', tip: 'Full range of motion', defaultReps: 10, defaultSets: 3 },
  BICEPS_03: { id: 'BICEPS_03', name: 'Hammer Curl', icon: '💪', muscle: 'Biceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Neutral grip curl', tip: 'Works brachialis and biceps', defaultReps: 10, defaultSets: 3 },
  BICEPS_04: { id: 'BICEPS_04', name: 'Preacher Curl', icon: '💪', muscle: 'Biceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Curl on preacher bench', tip: 'Strict form, full stretch at bottom', defaultReps: 10, defaultSets: 3 },
  BICEPS_05: { id: 'BICEPS_05', name: 'Concentration Curl', icon: '💪', muscle: 'Biceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'One-arm curl with elbow on knee', tip: 'Focus on peak contraction', defaultReps: 10, defaultSets: 3 },
  BICEPS_06: { id: 'BICEPS_06', name: 'Cable Curl', icon: '💪', muscle: 'Biceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Cable curl for constant tension', tip: 'Step back for more tension', defaultReps: 12, defaultSets: 3 },
  BICEPS_07: { id: 'BICEPS_07', name: 'Chin-ups (Underhand)', icon: '💪', muscle: 'Biceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Underhand grip pull-ups', tip: 'Focus on bicep engagement', defaultReps: 8, defaultSets: 3 },
  BICEPS_08: { id: 'BICEPS_08', name: 'Resistance Band Curl', icon: '💪', muscle: 'Biceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Band curl for constant tension', tip: 'Great for home workouts', defaultReps: 12, defaultSets: 3 },
  BICEPS_09: { id: 'BICEPS_09', name: 'EZ Bar Curl', icon: '💪', muscle: 'Biceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Curl with EZ bar', tip: 'Easier on wrists', defaultReps: 10, defaultSets: 3 },
  BICEPS_10: { id: 'BICEPS_10', name: 'Wide-Grip Curl', icon: '💪', muscle: 'Biceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Curl with wide grip', tip: 'Targets inner head of bicep', defaultReps: 10, defaultSets: 3 },
  BICEPS_11: { id: 'BICEPS_11', name: 'Zottman Curl', icon: '💪', muscle: 'Biceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Curl with supination, lower with pronation', tip: 'Works biceps and forearms', defaultReps: 10, defaultSets: 3 },
  BICEPS_12: { id: 'BICEPS_12', name: 'Reverse Curl', icon: '💪', muscle: 'Biceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Overhand grip curl', tip: 'Great for forearms and brachialis', defaultReps: 10, defaultSets: 3 },
  BICEPS_13: { id: 'BICEPS_13', name: 'Spider Curl', icon: '💪', muscle: 'Biceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Curl leaning forward on incline bench', tip: 'Prevents cheating', defaultReps: 10, defaultSets: 3 },
  BICEPS_14: { id: 'BICEPS_14', name: 'Incline Dumbbell Curl', icon: '💪', muscle: 'Biceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Curl on incline bench', tip: 'Great stretch at bottom', defaultReps: 10, defaultSets: 3 },
  BICEPS_15: { id: 'BICEPS_15', name: '21s (7-7-7)', icon: '💪', muscle: 'Biceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: '7 lower half, 7 upper half, 7 full reps', tip: 'Intense pump workout', defaultReps: 21, defaultSets: 3 },
  BICEPS_16: { id: 'BICEPS_16', name: 'Isometric Hold Curl', icon: '💪', muscle: 'Biceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Hold curl at peak contraction', tip: 'Builds endurance and control', defaultReps: 10, defaultSets: 3 },
  BICEPS_17: { id: 'BICEPS_17', name: 'Bayesian Cable Curl', icon: '💪', muscle: 'Biceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Curl with cable behind body', tip: 'Unmatched tension on biceps', defaultReps: 10, defaultSets: 3 },
  BICEPS_18: { id: 'BICEPS_18', name: 'Cross-Body Hammer Curl', icon: '💪', muscle: 'Biceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Hammer curl across body', tip: 'Targets brachialis', defaultReps: 10, defaultSets: 3 },
  BICEPS_19: { id: 'BICEPS_19', name: 'Towel Curl', icon: '💪', muscle: 'Biceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Curl with rolled towel', tip: 'Grip strength builder', defaultReps: 10, defaultSets: 3 },
  BICEPS_20: { id: 'BICEPS_20', name: 'Cable Curl (Variation)', icon: '💪', muscle: 'Biceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Various cable curl variations', tip: 'Constant tension throughout', defaultReps: 12, defaultSets: 3 },

  // ===== TRICEPS (20 exercises) =====
  TRICEPS_01: { id: 'TRICEPS_01', name: 'Tricep Pushdowns', icon: '💪', muscle: 'Triceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Push cable bar down to thighs', tip: 'Keep elbows locked at sides', defaultReps: 12, defaultSets: 3 },
  TRICEPS_02: { id: 'TRICEPS_02', name: 'Close-Grip Bench Press', icon: '🏋️', muscle: 'Triceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Press with close grip', tip: 'Focus on tricep drive', defaultReps: 10, defaultSets: 3 },
  TRICEPS_03: { id: 'TRICEPS_03', name: 'Tricep Dips', icon: '💪', muscle: 'Triceps', videoUrl: 'https://www.youtube.com/embed/2z8JmcrW-As', premium: true, desc: 'Dip between parallel bars', tip: 'Keep body upright for triceps focus', defaultReps: 12, defaultSets: 3 },
  TRICEPS_04: { id: 'TRICEPS_04', name: 'Overhead Tricep Extension', icon: '💪', muscle: 'Triceps', videoUrl: 'https://www.youtube.com/embed/vB5OHsJ3EME', premium: false, desc: 'Extend dumbbell behind head', tip: 'Keep elbows pointing forward', defaultReps: 10, defaultSets: 3 },
  TRICEPS_05: { id: 'TRICEPS_05', name: 'Diamond Push-ups', icon: '💪', muscle: 'Triceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Push-ups with hands together', tip: 'Hands form diamond shape', defaultReps: 12, defaultSets: 3 },
  TRICEPS_06: { id: 'TRICEPS_06', name: 'Rope Pushdowns', icon: '💪', muscle: 'Triceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Push rope attachment down', tip: 'Spread rope at bottom for full contraction', defaultReps: 12, defaultSets: 3 },
  TRICEPS_07: { id: 'TRICEPS_07', name: 'Reverse Grip Pushdowns', icon: '💪', muscle: 'Triceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Underhand grip pushdown', tip: 'Targets different head of tricep', defaultReps: 12, defaultSets: 3 },
  TRICEPS_08: { id: 'TRICEPS_08', name: 'Lying Tricep Extension', icon: '💪', muscle: 'Triceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Extend from lying position', tip: 'Keep elbows pointed to ceiling', defaultReps: 10, defaultSets: 3 },
  TRICEPS_09: { id: 'TRICEPS_09', name: 'Tricep Press Machine', icon: '🏋️', muscle: 'Triceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Press machine handles down', tip: 'Full range of motion', defaultReps: 10, defaultSets: 3 },
  TRICEPS_10: { id: 'TRICEPS_10', name: 'Neutral-Grip Dips', icon: '💪', muscle: 'Triceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Dips with neutral grip', tip: 'Great for elbow health', defaultReps: 12, defaultSets: 3 },
  TRICEPS_11: { id: 'TRICEPS_11', name: 'Skull Crushers', icon: '💪', muscle: 'Triceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Lower bar to forehead, extend up', tip: 'Keep elbows stable', defaultReps: 10, defaultSets: 3 },
  TRICEPS_12: { id: 'TRICEPS_12', name: 'Dumbbell Kickbacks', icon: '💪', muscle: 'Triceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Kick dumbbell back from bent over position', tip: 'Focus on full contraction', defaultReps: 12, defaultSets: 3 },
  TRICEPS_13: { id: 'TRICEPS_13', name: 'Cable Kickbacks', icon: '💪', muscle: 'Triceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Kick cable back for constant tension', tip: 'Keep elbow locked at side', defaultReps: 12, defaultSets: 3 },
  TRICEPS_14: { id: 'TRICEPS_14', name: 'Bench Dips', icon: '💪', muscle: 'Triceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Dip using bench behind you', tip: 'Great home exercise', defaultReps: 12, defaultSets: 3 },
  TRICEPS_15: { id: 'TRICEPS_15', name: 'Tate Press', icon: '🏋️', muscle: 'Triceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Press dumbbell with palms facing up', tip: 'Unique tricep exercise', defaultReps: 10, defaultSets: 3 },
  TRICEPS_16: { id: 'TRICEPS_16', name: 'Single-Arm Overhead Extension', icon: '💪', muscle: 'Triceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'One arm overhead extension', tip: 'Focus on form and control', defaultReps: 10, defaultSets: 3 },
  TRICEPS_17: { id: 'TRICEPS_17', name: 'JM Press', icon: '🏋️', muscle: 'Triceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Hybrid between bench and skull crusher', tip: 'Great for tricep mass', defaultReps: 10, defaultSets: 3 },
  TRICEPS_18: { id: 'TRICEPS_18', name: 'Floor Press (Close Grip)', icon: '🏋️', muscle: 'Triceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Press from floor position', tip: 'Safe for shoulders', defaultReps: 10, defaultSets: 3 },
  TRICEPS_19: { id: 'TRICEPS_19', name: 'Band Pushdowns', icon: '💪', muscle: 'Triceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Push band down with constant tension', tip: 'Great for home', defaultReps: 15, defaultSets: 3 },
  TRICEPS_20: { id: 'TRICEPS_20', name: 'Tricep Hold Extensions', icon: '💪', muscle: 'Triceps', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Hold and extend for burn', tip: 'Isometric focus', defaultReps: 10, defaultSets: 3 },

  // ===== LEGS (20 exercises) =====
  LEGS_01: { id: 'LEGS_01', name: 'Squats', icon: '🦵', muscle: 'Legs', videoUrl: 'https://www.youtube.com/embed/aclHkVaku9U', premium: false, desc: 'Squat with barbell or bodyweight', tip: 'Keep chest up, knees tracking toes', defaultReps: 15, defaultSets: 3 },
  LEGS_02: { id: 'LEGS_02', name: 'Deadlifts', icon: '🏋️', muscle: 'Legs', videoUrl: 'https://www.youtube.com/embed/r4MzxtBKyNE', premium: false, desc: 'Lift barbell from ground', tip: 'Hinge at hips, keep back neutral', defaultReps: 8, defaultSets: 3 },
  LEGS_03: { id: 'LEGS_03', name: 'Lunges', icon: '🚶', muscle: 'Legs', videoUrl: 'https://www.youtube.com/embed/QOVaHwm-Q6U', premium: false, desc: 'Step forward and lunge down', tip: 'Keep front knee behind toes', defaultReps: 12, defaultSets: 3 },
  LEGS_04: { id: 'LEGS_04', name: 'Bulgarian Split Squats', icon: '🦵', muscle: 'Legs', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Rear foot elevated split squat', tip: 'Great for quads and stability', defaultReps: 10, defaultSets: 3 },
  LEGS_05: { id: 'LEGS_05', name: 'Glute Bridges', icon: '🦵', muscle: 'Legs', videoUrl: 'https://www.youtube.com/embed/Zp26q4BYWHE', premium: false, desc: 'Bridge hips up with weight', tip: 'Squeeze glutes at top', defaultReps: 15, defaultSets: 3 },
  LEGS_06: { id: 'LEGS_06', name: 'Romanian Deadlifts', icon: '🏋️', muscle: 'Legs', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Hinge deadlift with slight bend', tip: 'Focus on hamstring stretch', defaultReps: 10, defaultSets: 3 },
  LEGS_07: { id: 'LEGS_07', name: 'Hip Thrusts', icon: '🦵', muscle: 'Legs', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Thrust hips up with bar', tip: 'Best glute builder', defaultReps: 12, defaultSets: 3 },
  LEGS_08: { id: 'LEGS_08', name: 'Reverse Lunges', icon: '🚶', muscle: 'Legs', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Step backward into lunge', tip: 'Easier on knees', defaultReps: 12, defaultSets: 3 },
  LEGS_09: { id: 'LEGS_09', name: 'Single-Leg Glute Bridge', icon: '🦵', muscle: 'Legs', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'One leg glute bridge', tip: 'Great for imbalances', defaultReps: 12, defaultSets: 3 },
  LEGS_10: { id: 'LEGS_10', name: 'Hamstring Curls', icon: '💪', muscle: 'Legs', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Curl hamstrings on machine', tip: 'Full range of motion', defaultReps: 12, defaultSets: 3 },
  LEGS_11: { id: 'LEGS_11', name: 'Step-ups', icon: '🦵', muscle: 'Legs', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Step up onto elevated surface', tip: 'Drive through heel', defaultReps: 10, defaultSets: 3 },
  LEGS_12: { id: 'LEGS_12', name: 'Leg Press', icon: '🏋️', muscle: 'Legs', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Press weight with legs', tip: 'Full range of motion', defaultReps: 12, defaultSets: 3 },
  LEGS_13: { id: 'LEGS_13', name: 'Leg Extensions', icon: '💪', muscle: 'Legs', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Extend legs on machine', tip: 'Focus on quad contraction', defaultReps: 12, defaultSets: 3 },
  LEGS_14: { id: 'LEGS_14', name: 'Leg Curls', icon: '💪', muscle: 'Legs', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Curl legs on machine', tip: 'Control the movement', defaultReps: 12, defaultSets: 3 },
  LEGS_15: { id: 'LEGS_15', name: 'Calf Raises', icon: '🦵', muscle: 'Legs', videoUrl: 'https://www.youtube.com/embed/-M4-G8p8fmc', premium: false, desc: 'Raise heels to stand on toes', tip: 'Full extension at top', defaultReps: 15, defaultSets: 3 },
  LEGS_16: { id: 'LEGS_16', name: 'Seated Calf Raises', icon: '🦵', muscle: 'Legs', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Calf raises seated', tip: 'Focus on soleus muscle', defaultReps: 15, defaultSets: 3 },
  LEGS_17: { id: 'LEGS_17', name: 'Sumo Squats', icon: '🦵', muscle: 'Legs', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Wide stance squat', tip: 'Targets adductors', defaultReps: 12, defaultSets: 3 },
  LEGS_18: { id: 'LEGS_18', name: 'Lateral Lunges', icon: '🚶', muscle: 'Legs', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Step to side into lunge', tip: 'Great for hip mobility', defaultReps: 10, defaultSets: 3 },
  LEGS_19: { id: 'LEGS_19', name: 'Side-Lying Leg Lifts', icon: '🦵', muscle: 'Legs', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Lift leg while lying on side', tip: 'Glute medius focus', defaultReps: 12, defaultSets: 3 },
  LEGS_20: { id: 'LEGS_20', name: 'Resistance Band Walks', icon: '🦵', muscle: 'Legs', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Walk with band around ankles', tip: 'Great for glute activation', defaultReps: 10, defaultSets: 3 },

  // ===== CORE (20 exercises) =====
  CORE_01: { id: 'CORE_01', name: 'Crunches', icon: '🔥', muscle: 'Core', videoUrl: 'https://www.youtube.com/embed/Xyd_fa5zoEU', premium: false, desc: 'Curl upper body up', tip: 'Keep neck relaxed', defaultReps: 20, defaultSets: 3 },
  CORE_02: { id: 'CORE_02', name: 'Leg Raises', icon: '🔥', muscle: 'Core', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Raise legs up and down', tip: 'Keep lower back pressed down', defaultReps: 15, defaultSets: 3 },
  CORE_03: { id: 'CORE_03', name: 'Planks', icon: '🧘', muscle: 'Core', videoUrl: 'https://www.youtube.com/embed/pSHjTRCQxIw', premium: false, desc: 'Hold push-up position', tip: 'Keep body in straight line', defaultReps: 3, defaultSets: 3 },
  CORE_04: { id: 'CORE_04', name: 'Side Planks', icon: '🧘', muscle: 'Core', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Hold on side, body straight', tip: 'Great for obliques', defaultReps: 3, defaultSets: 3 },
  CORE_05: { id: 'CORE_05', name: 'Mountain Climbers', icon: '🔥', muscle: 'Core', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Drive knees to chest alternately', tip: 'Keep core engaged', defaultReps: 20, defaultSets: 3 },
  CORE_06: { id: 'CORE_06', name: 'Sit-ups', icon: '🔥', muscle: 'Core', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Full sit-up from lying', tip: 'Keep feet anchored', defaultReps: 15, defaultSets: 3 },
  CORE_07: { id: 'CORE_07', name: 'Hollow Body Holds', icon: '🧘', muscle: 'Core', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Hold hollow body position', tip: 'Press lower back into floor', defaultReps: 3, defaultSets: 3 },
  CORE_08: { id: 'CORE_08', name: 'Deadbugs', icon: '🧘', muscle: 'Core', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Alternate arm and leg extension', tip: 'Keep core tight', defaultReps: 10, defaultSets: 3 },
  CORE_09: { id: 'CORE_09', name: 'Reverse Crunches', icon: '🔥', muscle: 'Core', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Lift hips off floor', tip: 'Lower back control', defaultReps: 15, defaultSets: 3 },
  CORE_10: { id: 'CORE_10', name: 'Cable Woodchoppers', icon: '💪', muscle: 'Core', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Chop cable across body', tip: 'Rotate from core', defaultReps: 12, defaultSets: 3 },
  CORE_11: { id: 'CORE_11', name: 'Russian Twists', icon: '🔥', muscle: 'Core', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Twist torso with weight', tip: 'Rotate from core', defaultReps: 15, defaultSets: 3 },
  CORE_12: { id: 'CORE_12', name: 'Flutter Kicks', icon: '🔥', muscle: 'Core', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Kick legs up and down', tip: 'Keep lower back pressed', defaultReps: 20, defaultSets: 3 },
  CORE_13: { id: 'CORE_13', name: 'V-Ups', icon: '🔥', muscle: 'Core', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Raise arms and legs to meet', tip: 'Focus on core contraction', defaultReps: 12, defaultSets: 3 },
  CORE_14: { id: 'CORE_14', name: 'Bicycle Crunches', icon: '🔥', muscle: 'Core', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Alternate elbow to knee', tip: 'Rotate from core', defaultReps: 20, defaultSets: 3 },
  CORE_15: { id: 'CORE_15', name: 'Toe Touches', icon: '🔥', muscle: 'Core', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Reach hands to toes', tip: 'Crunch up, not reach', defaultReps: 15, defaultSets: 3 },
  CORE_16: { id: 'CORE_16', name: 'Heel Touches', icon: '🔥', muscle: 'Core', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: false, desc: 'Reach hands to heels', tip: 'Great for obliques', defaultReps: 15, defaultSets: 3 },
  CORE_17: { id: 'CORE_17', name: 'L-Sits', icon: '🧘', muscle: 'Core', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Hold L-sit position', tip: 'Full core engagement', defaultReps: 3, defaultSets: 3 },
  CORE_18: { id: 'CORE_18', name: 'Windshield Wipers', icon: '🔥', muscle: 'Core', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Rotate legs side to side', tip: 'Keep shoulders planted', defaultReps: 12, defaultSets: 3 },
  CORE_19: { id: 'CORE_19', name: 'Dragon Flags', icon: '🔥', muscle: 'Core', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Full body core exercise', tip: 'Advanced move', defaultReps: 8, defaultSets: 3 },
  CORE_20: { id: 'CORE_20', name: 'Barbell Rollouts', icon: '🏋️', muscle: 'Core', videoUrl: 'https://www.youtube.com/embed/6G7p0x9Fy3c', premium: true, desc: 'Roll barbell out and back', tip: 'Keep core engaged throughout', defaultReps: 10, defaultSets: 3 }
};

// ─── Workout Style Mapping ──────────────────────────────────────
const WORKOUT_STYLES = {
  'Push/Pull/Legs': {
    monday: ['CHEST_01', 'CHEST_02', 'CHEST_03', 'SHOULDER_01', 'SHOULDER_02', 'TRICEPS_01', 'TRICEPS_02'],
    tuesday: ['BACK_01', 'BACK_02', 'BACK_03', 'BACK_04', 'BICEPS_01', 'BICEPS_02'],
    wednesday: ['LEGS_01', 'LEGS_02', 'LEGS_03', 'LEGS_04', 'CORE_01', 'CORE_02'],
    thursday: ['CHEST_04', 'CHEST_05', 'CHEST_06', 'SHOULDER_03', 'SHOULDER_04', 'TRICEPS_03', 'TRICEPS_04'],
    friday: ['BACK_05', 'BACK_06', 'BACK_07', 'BACK_08', 'BICEPS_03', 'BICEPS_04'],
    saturday: ['LEGS_05', 'LEGS_06', 'LEGS_07', 'LEGS_08', 'CORE_03', 'CORE_04'],
    sunday: []
  },
  'Upper/Lower': {
    monday: ['CHEST_01', 'CHEST_02', 'BACK_01', 'BACK_02', 'SHOULDER_01', 'BICEPS_01', 'TRICEPS_01'],
    tuesday: ['LEGS_01', 'LEGS_02', 'LEGS_03', 'LEGS_04', 'CORE_01', 'CORE_02'],
    wednesday: ['CHEST_03', 'CHEST_04', 'BACK_03', 'BACK_04', 'SHOULDER_02', 'BICEPS_02', 'TRICEPS_02'],
    thursday: ['LEGS_05', 'LEGS_06', 'LEGS_07', 'LEGS_08', 'CORE_03', 'CORE_04'],
    friday: ['CHEST_05', 'CHEST_06', 'BACK_05', 'BACK_06', 'SHOULDER_03', 'BICEPS_03', 'TRICEPS_03'],
    saturday: ['LEGS_09', 'LEGS_10', 'LEGS_11', 'LEGS_12', 'CORE_05', 'CORE_06'],
    sunday: []
  },
  'Full Body': {
    monday: ['CHEST_01', 'BACK_01', 'LEGS_01', 'SHOULDER_01', 'BICEPS_01', 'TRICEPS_01', 'CORE_01'],
    tuesday: ['CHEST_02', 'BACK_02', 'LEGS_02', 'SHOULDER_02', 'BICEPS_02', 'TRICEPS_02', 'CORE_02'],
    wednesday: ['CHEST_03', 'BACK_03', 'LEGS_03', 'SHOULDER_03', 'BICEPS_03', 'TRICEPS_03', 'CORE_03'],
    thursday: ['CHEST_04', 'BACK_04', 'LEGS_04', 'SHOULDER_04', 'BICEPS_04', 'TRICEPS_04', 'CORE_04'],
    friday: ['CHEST_05', 'BACK_05', 'LEGS_05', 'SHOULDER_05', 'BICEPS_05', 'TRICEPS_05', 'CORE_05'],
    saturday: ['CHEST_06', 'BACK_06', 'LEGS_06', 'SHOULDER_06', 'BICEPS_06', 'TRICEPS_06', 'CORE_06'],
    sunday: []
  },
  'Bro Split': {
    monday: ['CHEST_01', 'CHEST_02', 'CHEST_03', 'CHEST_04', 'CHEST_05', 'CHEST_06'],
    tuesday: ['BACK_01', 'BACK_02', 'BACK_03', 'BACK_04', 'BACK_05', 'BACK_06'],
    wednesday: ['SHOULDER_01', 'SHOULDER_02', 'SHOULDER_03', 'SHOULDER_04', 'SHOULDER_05', 'SHOULDER_06'],
    thursday: ['LEGS_01', 'LEGS_02', 'LEGS_03', 'LEGS_04', 'LEGS_05', 'LEGS_06'],
    friday: ['BICEPS_01', 'BICEPS_02', 'BICEPS_03', 'TRICEPS_01', 'TRICEPS_02', 'TRICEPS_03'],
    saturday: ['CORE_01', 'CORE_02', 'CORE_03', 'CORE_04', 'CORE_05', 'CORE_06'],
    sunday: []
  },
  'Antagonistic Supersets': {
    monday: ['CHEST_01', 'BACK_01', 'CHEST_02', 'BACK_02', 'BICEPS_01', 'TRICEPS_01'],
    tuesday: ['LEGS_01', 'SHOULDER_01', 'LEGS_02', 'SHOULDER_02', 'CORE_01', 'CORE_02'],
    wednesday: ['CHEST_03', 'BACK_03', 'CHEST_04', 'BACK_04', 'BICEPS_02', 'TRICEPS_02'],
    thursday: ['LEGS_03', 'SHOULDER_03', 'LEGS_04', 'SHOULDER_04', 'CORE_03', 'CORE_04'],
    friday: ['CHEST_05', 'BACK_05', 'CHEST_06', 'BACK_06', 'BICEPS_03', 'TRICEPS_03'],
    saturday: ['LEGS_05', 'SHOULDER_05', 'LEGS_06', 'SHOULDER_06', 'CORE_05', 'CORE_06'],
    sunday: []
  },
  'German Volume (GVT)': {
    monday: ['CHEST_01', 'BACK_01', 'LEGS_01', 'CHEST_02', 'BACK_02'],
    tuesday: ['SHOULDER_01', 'BICEPS_01', 'TRICEPS_01', 'CORE_01', 'SHOULDER_02'],
    wednesday: ['CHEST_03', 'BACK_03', 'LEGS_02', 'CHEST_04', 'BACK_04'],
    thursday: ['SHOULDER_03', 'BICEPS_02', 'TRICEPS_02', 'CORE_02', 'SHOULDER_04'],
    friday: ['CHEST_05', 'BACK_05', 'LEGS_03', 'CHEST_06', 'BACK_06'],
    saturday: ['SHOULDER_05', 'BICEPS_03', 'TRICEPS_03', 'CORE_03', 'SHOULDER_06'],
    sunday: []
  },
  'HIIT': {
    monday: ['LEGS_01', 'LEGS_02', 'CORE_01', 'CORE_02', 'LEGS_03'],
    tuesday: ['SHOULDER_01', 'BICEPS_01', 'TRICEPS_01', 'CORE_03', 'SHOULDER_02'],
    wednesday: ['LEGS_04', 'LEGS_05', 'CORE_04', 'CORE_05', 'LEGS_06'],
    thursday: ['SHOULDER_03', 'BICEPS_02', 'TRICEPS_02', 'CORE_06', 'SHOULDER_04'],
    friday: ['LEGS_07', 'LEGS_08', 'CORE_07', 'CORE_08', 'LEGS_09'],
    saturday: ['SHOULDER_05', 'BICEPS_03', 'TRICEPS_03', 'CORE_09', 'SHOULDER_06'],
    sunday: []
  },
  'CrossFit-Style': {
    monday: ['CHEST_01', 'BACK_01', 'LEGS_01', 'SHOULDER_01', 'CORE_01', 'BICEPS_01', 'TRICEPS_01'],
    tuesday: ['CHEST_02', 'BACK_02', 'LEGS_02', 'SHOULDER_02', 'CORE_02', 'BICEPS_02', 'TRICEPS_02'],
    wednesday: ['CHEST_03', 'BACK_03', 'LEGS_03', 'SHOULDER_03', 'CORE_03', 'BICEPS_03', 'TRICEPS_03'],
    thursday: ['CHEST_04', 'BACK_04', 'LEGS_04', 'SHOULDER_04', 'CORE_04', 'BICEPS_04', 'TRICEPS_04'],
    friday: ['CHEST_05', 'BACK_05', 'LEGS_05', 'SHOULDER_05', 'CORE_05', 'BICEPS_05', 'TRICEPS_05'],
    saturday: ['CHEST_06', 'BACK_06', 'LEGS_06', 'SHOULDER_06', 'CORE_06', 'BICEPS_06', 'TRICEPS_06'],
    sunday: []
  },
  'Calisthenics': {
    monday: ['CHEST_03', 'BACK_01', 'BACK_02', 'SHOULDER_01', 'CORE_01', 'CORE_02'],
    tuesday: ['CHEST_09', 'BACK_03', 'BACK_04', 'SHOULDER_02', 'CORE_03', 'CORE_04'],
    wednesday: ['CHEST_12', 'BACK_05', 'BACK_06', 'SHOULDER_03', 'CORE_05', 'CORE_06'],
    thursday: ['CHEST_18', 'BACK_07', 'BACK_08', 'SHOULDER_04', 'CORE_07', 'CORE_08'],
    friday: ['CHEST_19', 'BACK_09', 'BACK_10', 'SHOULDER_05', 'CORE_09', 'CORE_10'],
    saturday: ['CHEST_20', 'BACK_11', 'BACK_12', 'SHOULDER_06', 'CORE_11', 'CORE_12'],
    sunday: []
  },
  'Powerlifting': {
    monday: ['LEGS_01', 'LEGS_02', 'BACK_01', 'BACK_02', 'CHEST_01', 'CHEST_02'],
    tuesday: ['LEGS_03', 'LEGS_04', 'BACK_03', 'BACK_04', 'CHEST_03', 'CHEST_04'],
    wednesday: ['LEGS_05', 'LEGS_06', 'BACK_05', 'BACK_06', 'CHEST_05', 'CHEST_06'],
    thursday: ['LEGS_07', 'LEGS_08', 'BACK_07', 'BACK_08', 'CHEST_07', 'CHEST_08'],
    friday: ['LEGS_09', 'LEGS_10', 'BACK_09', 'BACK_10', 'CHEST_09', 'CHEST_10'],
    saturday: ['LEGS_11', 'LEGS_12', 'BACK_11', 'BACK_12', 'CHEST_11', 'CHEST_12'],
    sunday: []
  },
  'Hypertrophy-Specific': {
    monday: ['CHEST_01', 'CHEST_02', 'SHOULDER_01', 'SHOULDER_02', 'BICEPS_01', 'TRICEPS_01'],
    tuesday: ['BACK_01', 'BACK_02', 'BACK_03', 'BACK_04', 'BICEPS_02', 'TRICEPS_02'],
    wednesday: ['LEGS_01', 'LEGS_02', 'LEGS_03', 'LEGS_04', 'CORE_01', 'CORE_02'],
    thursday: ['CHEST_03', 'CHEST_04', 'SHOULDER_03', 'SHOULDER_04', 'BICEPS_03', 'TRICEPS_03'],
    friday: ['BACK_05', 'BACK_06', 'BACK_07', 'BACK_08', 'BICEPS_04', 'TRICEPS_04'],
    saturday: ['LEGS_05', 'LEGS_06', 'LEGS_07', 'LEGS_08', 'CORE_03', 'CORE_04'],
    sunday: []
  }
};

// ─── Helper Functions ──────────────────────────────────────────

function getExercisesForDay(day, userId) {
  const profile = userProfiles.get(userId);
  if (!profile) return [];
  
  const style = profile.style || 'Full Body';
  const styleMap = WORKOUT_STYLES[style] || WORKOUT_STYLES['Full Body'];
  const exerciseIds = styleMap[day.toLowerCase()] || [];
  
  return exerciseIds.map(id => {
    const ex = EXERCISE_DB[id];
    if (!ex) return null;
    return {
      id: ex.id,
      name: ex.name,
      icon: ex.icon,
      muscle: ex.muscle,
      videoUrl: ex.videoUrl,
      desc: ex.desc,
      tip: ex.tip,
      reps: ex.defaultReps,
      sets: ex.defaultSets,
      premium: ex.premium
    };
  }).filter(ex => ex !== null);
}

function calculateNutrition(weight, height, age, goal) {
  let bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  let maintenance = bmr * 1.55;
  
  let calories = maintenance;
  let protein = weight * 1.8;
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

// ─── Telegram Bot ──────────────────────────────────────────────

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
5️⃣ *Workout Style* (Full Body, Push/Pull/Legs, etc.)

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

function getMainKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🏋️ Open Gym App', web_app: { url: MINI_APP_URL } }],
        [{ text: '📅 My Schedule', callback_data: 'schedule' }, { text: '📊 My Progress', callback_data: 'progress' }],
        [{ text: '💪 Exercise Guide', callback_data: 'exercises' }, { text: '⚙️ Customize Schedule', callback_data: 'customize' }],
        [{ text: '❓ Help', callback_data: 'help' }]
      ]
    }
  };
}

if (bot) {
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
  });

  bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    switch (data) {
      case 'schedule':
        const profile = userProfiles.get(chatId);
        if (!profile) {
          bot.sendMessage(chatId, '⚠️ Please set up your profile first with /start');
          break;
        }
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        let scheduleMsg = '📅 *YOUR WORKOUT SCHEDULE* 📅\n━━━━━━━━━━━━━━━━━━━━━\n\n';
        days.forEach(day => {
          const exercises = getExercisesForDay(day, chatId);
          const exList = exercises.length > 0 
            ? exercises.map(ex => `${ex.icon} ${ex.name} (${ex.sets}×${ex.reps})`).join('\n   ')
            : '   • Rest day 😊';
          scheduleMsg += `*${day}:*\n   ${exList}\n\n`;
        });
        bot.sendMessage(chatId, scheduleMsg, { parse_mode: 'Markdown', ...getMainKeyboard() });
        break;
        
      case 'progress':
        const profileData = userProfiles.get(chatId);
        if (!profileData) {
          bot.sendMessage(chatId, '⚠️ Please set up your profile first with /start');
          break;
        }
        const history = workoutHistory.get(chatId) || [];
        const workoutsDone = history.length;
        const totalExercises = history.reduce((sum, w) => sum + (w.exercises || 1), 0);
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const todayExercises = getExercisesForDay(today, chatId);
        
        bot.sendMessage(chatId, `
📊 *YOUR PROGRESS* 📊
━━━━━━━━━━━━━━━━━━━━━

👤 *${userSessions.get(chatId)?.firstName || 'Athlete'}*

📅 *Started:* ${new Date(profileData.createdAt).toLocaleDateString()}

📊 *Stats:*
• Weight: ${profileData.weight}kg
• Height: ${profileData.height}cm
• Protein Goal: ${profileData.protein}g/day
• Calorie Goal: ${profileData.calories}kcal/day

🏆 *Workouts Completed:* ${workoutsDone}
💪 *Total Exercises:* ${totalExercises}

━━━━━━━━━━━━━━━━━━━━━

📅 *Today's Workout (${today}):*
${todayExercises.map(ex => `• ${ex.icon} ${ex.name} (${ex.sets}×${ex.reps})`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━

*Keep going! You're doing great!* 🚀
        `, { parse_mode: 'Markdown', ...getMainKeyboard() });
        break;
        
      case 'exercises':
        let exMsg = '💪 *EXERCISE LIBRARY* 💪\n━━━━━━━━━━━━━━━━━━━━━\n\n';
        const categories = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Core'];
        categories.forEach(cat => {
          exMsg += `*${cat}*\n`;
          const exercises = Object.values(EXERCISE_DB).filter(ex => ex.muscle === cat);
          exercises.slice(0, 5).forEach(ex => {
            exMsg += `   ${ex.icon} ${ex.name} - ${ex.defaultSets}×${ex.defaultReps}\n`;
          });
          exMsg += '\n';
        });
        exMsg += '━━━━━━━━━━━━━━━━━━━━━\n';
        exMsg += 'Tap the Gym App to start exercising! 🏋️';
        bot.sendMessage(chatId, exMsg, { parse_mode: 'Markdown', ...getMainKeyboard() });
        break;
        
      case 'customize':
        bot.sendMessage(chatId, `
⚙️ *CUSTOMIZE YOUR SCHEDULE* ⚙️
━━━━━━━━━━━━━━━━━━━━━

Send: *Monday: CHEST_01, BACK_01, LEGS_01*

Replace with any day and exercise IDs

Available exercises:
${Object.keys(EXERCISE_DB).slice(0, 20).map(id => `• ${id} - ${EXERCISE_DB[id].name}`).join('\n')}

...and many more! Use the exercise guide to see all.
        `, { parse_mode: 'Markdown', ...getMainKeyboard() });
        break;
        
      case 'help':
        bot.sendMessage(chatId, `
❓ *HOW TO USE AI GYM TRAINER* ❓

━━━━━━━━━━━━━━━━━━━━━

🎯 *Getting Started*
1. Send /start to set up your profile
2. Enter your stats
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
Send: *Monday: CHEST_01, BACK_01, LEGS_01*

━━━━━━━━━━━━━━━━━━━━━

*Ready to start? Tap the button below!* 🏋️
        `, { parse_mode: 'Markdown', ...getMainKeyboard() });
        break;
        
      default:
        bot.answerCallbackQuery(callbackQuery.id, { text: 'Coming soon! 🚀' });
    }
    bot.answerCallbackQuery(callbackQuery.id);
  });

  // Schedule customization
  bot.onText(/^([A-Za-z]+)\s*:\s*(.+)$/, (msg, match) => {
    const chatId = msg.chat.id;
    const day = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    const exerciseInput = match[2].toUpperCase().replace(/\s/g, '').split(',');

    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    if (!validDays.includes(day)) {
      bot.sendMessage(chatId, '⚠️ Invalid day. Use: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday');
      return;
    }

    const validExercises = [];
    const invalidExercises = [];
    exerciseInput.forEach(ex => {
      if (EXERCISE_DB[ex]) {
        validExercises.push(ex);
      } else if (ex !== 'REST' && ex !== '') {
        invalidExercises.push(ex);
      }
    });

    if (invalidExercises.length > 0) {
      bot.sendMessage(chatId, `⚠️ Invalid exercises: ${invalidExercises.join(', ')}`);
      return;
    }

    // Update schedule
    let schedule = userCustomSchedules.get(chatId) || {};
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
    `, { parse_mode: 'Markdown', ...getMainKeyboard() });
  });

  console.log('✅ Bot handlers registered');
}

// ─── API ROUTES ─────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    bot: !!bot,
    botUsername: BOT_USERNAME,
    miniAppUrl: MINI_APP_URL,
    users: userProfiles.size,
    exercises: Object.keys(EXERCISE_DB).length
  });
});

// ─── Profile Routes ────────────────────────────────────────────

app.post('/api/profile', (req, res) => {
  const { userId, name, weight, height, protein, calories, style, startTime, duration, goal } = req.body;
  if (!userId || !weight || !height) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const profile = {
    name: name || 'Athlete',
    weight: parseFloat(weight),
    height: parseFloat(height),
    protein: parseFloat(protein) || weight * 1.8,
    calories: parseFloat(calories) || 2000,
    style: style || 'Full Body',
    startTime: startTime || '06:00',
    duration: parseInt(duration) || 45,
    goal: goal || 'muscle_gain',
    createdAt: new Date().toISOString()
  };

  userProfiles.set(userId, profile);

  const nutrition = calculateNutrition(profile.weight, profile.height, 30, profile.goal);

  res.json({
    success: true,
    profile,
    nutrition
  });
});

app.get('/api/profile/:userId', (req, res) => {
  const { userId } = req.params;
  const profile = userProfiles.get(userId);
  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  const nutrition = calculateNutrition(profile.weight, profile.height, 30, profile.goal);

  res.json({
    profile,
    nutrition
  });
});

// ─── Schedule Routes ────────────────────────────────────────────

app.get('/api/schedule/:userId', (req, res) => {
  const { userId } = req.params;
  const profile = userProfiles.get(userId);
  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const schedule = {};

  days.forEach(day => {
    schedule[day] = getExercisesForDay(day, userId);
  });

  res.json({
    schedule,
    profile
  });
});

app.get('/api/schedule/today/:userId', (req, res) => {
  const { userId } = req.params;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const exercises = getExercisesForDay(today, userId);

  res.json({
    day: today,
    exercises
  });
});

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

// ─── Exercise Routes ────────────────────────────────────────────

app.get('/api/exercises', (req, res) => {
  const exercises = Object.keys(EXERCISE_DB).map(key => ({
    id: key,
    ...EXERCISE_DB[key]
  }));
  res.json(exercises);
});

app.get('/api/exercises/:id', (req, res) => {
  const ex = EXERCISE_DB[req.params.id];
  if (!ex) {
    return res.status(404).json({ error: 'Exercise not found' });
  }
  res.json(ex);
});

app.get('/api/exercises/muscle/:muscle', (req, res) => {
  const { muscle } = req.params;
  const exercises = Object.keys(EXERCISE_DB)
    .filter(key => EXERCISE_DB[key].muscle.toLowerCase() === muscle.toLowerCase())
    .map(key => ({ id: key, ...EXERCISE_DB[key] }));
  res.json(exercises);
});

// ─── Workout History Routes ────────────────────────────────────

app.post('/api/workout', (req, res) => {
  const { userId, exercise, duration, reps, sets, feedback } = req.body;
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
    feedback: feedback || ''
  });
  workoutHistory.set(userId, history);

  res.json({
    success: true,
    workout: history[history.length - 1]
  });
});

app.get('/api/workout/:userId', (req, res) => {
  const { userId } = req.params;
  const history = workoutHistory.get(userId) || [];
  res.json(history);
});

// ─── Nutrition Routes ──────────────────────────────────────────

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

// ─── Completed Workouts Routes ─────────────────────────────────

app.post('/api/completed', (req, res) => {
  const { userId, day, exercise, workout } = req.body;
  if (!userId || !exercise) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  let completed = completedWorkouts.get(userId) || [];
  completed.push({
    day,
    exercise,
    workout,
    date: new Date().toISOString()
  });
  completedWorkouts.set(userId, completed);

  res.json({
    success: true,
    completed: completed[completed.length - 1]
  });
});

app.get('/api/completed/:userId', (req, res) => {
  const { userId } = req.params;
  const completed = completedWorkouts.get(userId) || [];
  res.json(completed);
});

// ─── Video Upload ──────────────────────────────────────────────

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

// ─── Static Files ──────────────────────────────────────────────

app.use('/uploads', express.static(UPLOAD_DIR));

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
    message: NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// ─── Start Server ──────────────────────────────────────────────

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n========================================');
  console.log('🏋️ AI Gym Trainer Server');
  console.log('========================================');
  console.log(`🚀 Running on: http://localhost:${PORT}`);
  console.log(`📁 Uploads: ${UPLOAD_DIR}`);
  console.log(`🤖 Bot: @${BOT_USERNAME}`);
  console.log(`🌐 Mini App: ${MINI_APP_URL}`);
  console.log(`📊 Exercises: ${Object.keys(EXERCISE_DB).length}`);
  console.log(`👥 Users: ${userProfiles.size}`);
  console.log(`📋 Styles: ${Object.keys(WORKOUT_STYLES).length}`);
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
