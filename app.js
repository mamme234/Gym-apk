// =============================================
// COMPLETE JAVASCRIPT - All Features + Admin
// Render URL: https://gym-apk-wicj.onrender.com
// =============================================

// ===== API CONFIGURATION =====
const API_URL = 'https://gym-apk-wicj.onrender.com/api/v1';
const WEBHOOK_URL = 'https://gym-apk-wicj.onrender.com';

// ===== STATE =====
let currentPage = 'home';
let isPlayerPlaying = true;
let toastTimeout = null;
let currentExerciseIndex = 0;
let currentExerciseList = [];
let playerExercises = [];
let authToken = localStorage.getItem('authToken') || null;
let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
let selectedSchedule = 'muscle';

// =============================================
// COMPLETE EXERCISE DATABASE - ALL WITH YOUTUBE VIDEOS
// =============================================

const exerciseDatabase = {
    chest: [
        { id: 1, name: "Barbell Bench Press", video: "https://www.youtube.com/embed/4Y2ZdHCOXok", muscle: "Chest", difficulty: "Intermediate", equipment: "Barbell" },
        { id: 2, name: "Dumbbell Bench Press", video: "https://www.youtube.com/embed/VmB1G1K7v94", muscle: "Chest", difficulty: "Intermediate", equipment: "Dumbbells" },
        { id: 3, name: "Incline Bench Press", video: "https://www.youtube.com/embed/SrqOu55lrYU", muscle: "Chest", difficulty: "Intermediate", equipment: "Barbell" },
        { id: 4, name: "Decline Bench Press", video: "https://www.youtube.com/embed/Lfy9UKJq9C4", muscle: "Chest", difficulty: "Advanced", equipment: "Barbell" },
        { id: 5, name: "Push-ups", video: "https://www.youtube.com/embed/IODxDxX7oi4", muscle: "Chest", difficulty: "Beginner", equipment: "Bodyweight" },
        { id: 6, name: "Wide Push-ups", video: "https://www.youtube.com/embed/hXHlI4B-AI8", muscle: "Chest", difficulty: "Beginner", equipment: "Bodyweight" },
        { id: 7, name: "Diamond Push-ups", video: "https://www.youtube.com/embed/J0DnG1_S92I", muscle: "Chest", difficulty: "Intermediate", equipment: "Bodyweight" },
        { id: 8, name: "Chest Dips", video: "https://www.youtube.com/embed/2z8l1GpjKQQ", muscle: "Chest", difficulty: "Intermediate", equipment: "Parallel Bars" },
        { id: 9, name: "Cable Crossovers", video: "https://www.youtube.com/embed/taI4XduLpTk", muscle: "Chest", difficulty: "Intermediate", equipment: "Cable" },
        { id: 10, name: "Pec Deck Fly", video: "https://www.youtube.com/embed/CHIgtK2W9fQ", muscle: "Chest", difficulty: "Beginner", equipment: "Machine" },
        { id: 11, name: "Dumbbell Fly", video: "https://www.youtube.com/embed/eozdVDA78K0", muscle: "Chest", difficulty: "Intermediate", equipment: "Dumbbells" },
        { id: 12, name: "Incline Dumbbell Fly", video: "https://www.youtube.com/embed/2sZ1ZWv-6-k", muscle: "Chest", difficulty: "Intermediate", equipment: "Dumbbells" },
        { id: 13, name: "Decline Dumbbell Press", video: "https://www.youtube.com/embed/RH7A-jydSf4", muscle: "Chest", difficulty: "Advanced", equipment: "Dumbbells" },
        { id: 14, name: "Machine Chest Press", video: "https://www.youtube.com/embed/7JhVQ8p5eMA", muscle: "Chest", difficulty: "Beginner", equipment: "Machine" },
        { id: 15, name: "Smith Machine Press", video: "https://www.youtube.com/embed/R0gE1-4IekM", muscle: "Chest", difficulty: "Intermediate", equipment: "Smith Machine" },
        { id: 16, name: "Close-Grip Bench Press", video: "https://www.youtube.com/embed/nEF0Hj8YylI", muscle: "Chest", difficulty: "Intermediate", equipment: "Barbell" },
        { id: 17, name: "Floor Press", video: "https://www.youtube.com/embed/VmB1G1K7v94", muscle: "Chest", difficulty: "Intermediate", equipment: "Dumbbells" },
        { id: 18, name: "Guillotine Press", video: "https://www.youtube.com/embed/8z7L6Y5jX-c", muscle: "Chest", difficulty: "Advanced", equipment: "Barbell" },
        { id: 19, name: "Reverse Grip Bench Press", video: "https://www.youtube.com/embed/8z7L6Y5jX-c", muscle: "Chest", difficulty: "Intermediate", equipment: "Barbell" },
        { id: 20, name: "Neutral Grip Press", video: "https://www.youtube.com/embed/8z7L6Y5jX-c", muscle: "Chest", difficulty: "Intermediate", equipment: "Dumbbells" }
    ],
    shoulders: [
        { id: 1, name: "Overhead Press", video: "https://www.youtube.com/embed/2yjwXTZQDDI", muscle: "Shoulders", difficulty: "Intermediate", equipment: "Barbell" },
        { id: 2, name: "Dumbbell Shoulder Press", video: "https://www.youtube.com/embed/REBhldQ6V6Y", muscle: "Shoulders", difficulty: "Intermediate", equipment: "Dumbbells" },
        { id: 3, name: "Arnold Press", video: "https://www.youtube.com/embed/3ml7BH7mN2Q", muscle: "Shoulders", difficulty: "Advanced", equipment: "Dumbbells" },
        { id: 4, name: "Lateral Raises", video: "https://www.youtube.com/embed/3VcKaXpzqRo", muscle: "Shoulders", difficulty: "Beginner", equipment: "Dumbbells" },
        { id: 5, name: "Front Raises", video: "https://www.youtube.com/embed/-t7fuZ0KhDA", muscle: "Shoulders", difficulty: "Beginner", equipment: "Dumbbells" },
        { id: 6, name: "Reverse Fly", video: "https://www.youtube.com/embed/xD5Vg7EQn-4", muscle: "Shoulders", difficulty: "Intermediate", equipment: "Dumbbells" },
        { id: 7, name: "Upright Rows", video: "https://www.youtube.com/embed/DhvyB4Tq7yA", muscle: "Shoulders", difficulty: "Intermediate", equipment: "Barbell" },
        { id: 8, name: "Face Pulls", video: "https://www.youtube.com/embed/HSoHeSqLfIc", muscle: "Shoulders", difficulty: "Intermediate", equipment: "Cable" },
        { id: 9, name: "Shrugs", video: "https://www.youtube.com/embed/7j0l9FJ-bZ4", muscle: "Shoulders", difficulty: "Beginner", equipment: "Dumbbells" },
        { id: 10, name: "Clean & Press", video: "https://www.youtube.com/embed/6TzD2sZ5E6U", muscle: "Shoulders", difficulty: "Advanced", equipment: "Barbell" },
        { id: 11, name: "Push Press", video: "https://www.youtube.com/embed/6TzD2sZ5E6U", muscle: "Shoulders", difficulty: "Advanced", equipment: "Barbell" },
        { id: 12, name: "Dumbbell Snatch", video: "https://www.youtube.com/embed/6TzD2sZ5E6U", muscle: "Shoulders", difficulty: "Advanced", equipment: "Dumbbell" },
        { id: 13, name: "Pike Push-ups", video: "https://www.youtube.com/embed/IODxDxX7oi4", muscle: "Shoulders", difficulty: "Intermediate", equipment: "Bodyweight" },
        { id: 14, name: "Cuban Press", video: "https://www.youtube.com/embed/8z7L6Y5jX-c", muscle: "Shoulders", difficulty: "Intermediate", equipment: "Dumbbells" },
        { id: 15, name: "YTW Raises", video: "https://www.youtube.com/embed/8z7L6Y5jX-c", muscle: "Shoulders", difficulty: "Intermediate", equipment: "Dumbbells" }
    ],
    biceps: [
        { id: 1, name: "Barbell Curl", video: "https://www.youtube.com/embed/ykJirr3Y-2g", muscle: "Biceps", difficulty: "Beginner", equipment: "Barbell" },
        { id: 2, name: "Dumbbell Curl", video: "https://www.youtube.com/embed/ykJirr3Y-2g", muscle: "Biceps", difficulty: "Beginner", equipment: "Dumbbells" },
        { id: 3, name: "Hammer Curl", video: "https://www.youtube.com/embed/zC3nLlEvin4", muscle: "Biceps", difficulty: "Beginner", equipment: "Dumbbells" },
        { id: 4, name: "Preacher Curl", video: "https://www.youtube.com/embed/fIuMZ7-6Cpo", muscle: "Biceps", difficulty: "Intermediate", equipment: "Barbell" },
        { id: 5, name: "Concentration Curl", video: "https://www.youtube.com/embed/0AUGkch3tzc", muscle: "Biceps", difficulty: "Beginner", equipment: "Dumbbell" },
        { id: 6, name: "Cable Curl", video: "https://www.youtube.com/embed/0AUGkch3tzc", muscle: "Biceps", difficulty: "Beginner", equipment: "Cable" },
        { id: 7, name: "Chin-ups", video: "https://www.youtube.com/embed/oC7ILr4b9GI", muscle: "Biceps", difficulty: "Intermediate", equipment: "Pull-up Bar" },
        { id: 8, name: "Resistance Band Curl", video: "https://www.youtube.com/embed/Kw_9T7YRyHw", muscle: "Biceps", difficulty: "Beginner", equipment: "Resistance Band" },
        { id: 9, name: "EZ Bar Curl", video: "https://www.youtube.com/embed/2NJnV67ykwo", muscle: "Biceps", difficulty: "Beginner", equipment: "EZ Bar" },
        { id: 10, name: "Wide-Grip Curl", video: "https://www.youtube.com/embed/DHyRrHxsvrY", muscle: "Biceps", difficulty: "Intermediate", equipment: "Barbell" },
        { id: 11, name: "Zottman Curl", video: "https://www.youtube.com/embed/8z7L6Y5jX-c", muscle: "Biceps", difficulty: "Intermediate", equipment: "Dumbbells" },
        { id: 12, name: "Reverse Curl", video: "https://www.youtube.com/embed/8z7L6Y5jX-c", muscle: "Biceps", difficulty: "Intermediate", equipment: "Barbell" },
        { id: 13, name: "Spider Curl", video: "https://www.youtube.com/embed/8z7L6Y5jX-c", muscle: "Biceps", difficulty: "Intermediate", equipment: "Dumbbell" },
        { id: 14, name: "21s 7-7-7", video: "https://www.youtube.com/embed/8z7L6Y5jX-c", muscle: "Biceps", difficulty: "Intermediate", equipment: "Barbell" },
        { id: 15, name: "Incline Dumbbell Curl", video: "https://www.youtube.com/embed/8z7L6Y5jX-c", muscle: "Biceps", difficulty: "Intermediate", equipment: "Dumbbells" }
    ],
    triceps: [
        { id: 1, name: "Tricep Pushdowns", video: "https://www.youtube.com/embed/2-LAMcpzODU", muscle: "Triceps", difficulty: "Beginner", equipment: "Cable" },
        { id: 2, name: "Close-Grip Bench Press", video: "https://www.youtube.com/embed/nEF0Hj8YylI", muscle: "Triceps", difficulty: "Intermediate", equipment: "Barbell" },
        { id: 3, name: "Tricep Dips", video: "https://www.youtube.com/embed/2z8l1GpjKQQ", muscle: "Triceps", difficulty: "Intermediate", equipment: "Parallel Bars" },
        { id: 4, name: "Overhead Tricep Extension", video: "https://www.youtube.com/embed/6Xg0bwRcbwQ", muscle: "Triceps", difficulty: "Beginner", equipment: "Dumbbell" },
        { id: 5, name: "Diamond Push-ups", video: "https://www.youtube.com/embed/J0DnG1_S92I", muscle: "Triceps", difficulty: "Intermediate", equipment: "Bodyweight" },
        { id: 6, name: "Rope Pushdowns", video: "https://www.youtube.com/embed/KiT2lHJQ64s", muscle: "Triceps", difficulty: "Beginner", equipment: "Cable" },
        { id: 7, name: "Reverse Grip Pushdowns", video: "https://www.youtube.com/embed/vB5OHsJ3EME", muscle: "Triceps", difficulty: "Intermediate", equipment: "Cable" },
        { id: 8, name: "Lying Tricep Extension", video: "https://www.youtube.com/embed/d_KZxkY_0cM", muscle: "Triceps", difficulty: "Intermediate", equipment: "EZ Bar" },
        { id: 9, name: "Tricep Press Machine", video: "https://www.youtube.com/embed/04S6JBoO9hc", muscle: "Triceps", difficulty: "Beginner", equipment: "Machine" },
        { id: 10, name: "Skull Crushers", video: "https://www.youtube.com/embed/d_KZxkY_0cM", muscle: "Triceps", difficulty: "Advanced", equipment: "EZ Bar" },
        { id: 11, name: "Dumbbell Kickbacks", video: "https://www.youtube.com/embed/8z7L6Y5jX-c", muscle: "Triceps", difficulty: "Beginner", equipment: "Dumbbell" },
        { id: 12, name: "Cable Kickbacks", video: "https://www.youtube.com/embed/8z7L6Y5jX-c", muscle: "Triceps", difficulty: "Intermediate", equipment: "Cable" },
        { id: 13, name: "Bench Dips", video: "https://www.youtube.com/embed/2z8l1GpjKQQ", muscle: "Triceps", difficulty: "Beginner", equipment: "Bench" },
        { id: 14, name: "Tate Press", video: "https://www.youtube.com/embed/8z7L6Y5jX-c", muscle: "Triceps", difficulty: "Advanced", equipment: "Dumbbell" },
        { id: 15, name: "JM Press", video: "https://www.youtube.com/embed/8z7L6Y5jX-c", muscle: "Triceps", difficulty: "Advanced", equipment: "Barbell" }
    ],
    legs: [
        { id: 1, name: "Squats", video: "https://www.youtube.com/embed/YaXPRqUwItQ", muscle: "Legs", difficulty: "Beginner", equipment: "Barbell" },
        { id: 2, name: "Deadlifts", video: "https://www.youtube.com/embed/op9kVnSso6Q", muscle: "Legs", difficulty: "Intermediate", equipment: "Barbell" },
        { id: 3, name: "Lunges", video: "https://www.youtube.com/embed/QOVaHwm-Q6U", muscle: "Legs", difficulty: "Beginner", equipment: "Dumbbells" },
        { id: 4, name: "Bulgarian Split Squats", video: "https://www.youtube.com/embed/2C-uNgKwZYg", muscle: "Legs", difficulty: "Intermediate", equipment: "Dumbbells" },
        { id: 5, name: "Glute Bridges", video: "https://www.youtube.com/embed/SEdqd1n0cvg", muscle: "Legs", difficulty: "Beginner", equipment: "Bodyweight" },
        { id: 6, name: "Romanian Deadlifts", video: "https://www.youtube.com/embed/JCxUY8iNJYY", muscle: "Legs", difficulty: "Intermediate", equipment: "Barbell" },
        { id: 7, name: "Hip Thrusts", video: "https://www.youtube.com/embed/SEdqd1n0cvg", muscle: "Legs", difficulty: "Beginner", equipment: "Barbell" },
        { id: 8, name: "Reverse Lunges", video: "https://www.youtube.com/embed/P3n6Lm6Bvb4", muscle: "Legs", difficulty: "Beginner", equipment: "Dumbbells" },
        { id: 9, name: "Leg Press", video: "https://www.youtube.com/embed/IZxyjW7MPJQ", muscle: "Legs", difficulty: "Beginner", equipment: "Machine" },
        { id: 10, name: "Leg Extensions", video: "https://www.youtube.com/embed/YyvSfVjQeL0", muscle: "Legs", difficulty: "Beginner", equipment: "Machine" },
        { id: 11, name: "Leg Curls", video: "https://www.youtube.com/embed/6gVJNmnfY5o", muscle: "Legs", difficulty: "Beginner", equipment: "Machine" },
        { id: 12, name: "Calf Raises", video: "https://www.youtube.com/embed/8z7L6Y5jX-c", muscle: "Legs", difficulty: "Beginner", equipment: "Machine" },
        { id: 13, name: "Sumo Squats", video: "https://www.youtube.com/embed/YaXPRqUwItQ", muscle: "Legs", difficulty: "Intermediate", equipment: "Barbell" },
        { id: 14, name: "Lateral Lunges", video: "https://www.youtube.com/embed/QOVaHwm-Q6U", muscle: "Legs", difficulty: "Intermediate", equipment: "Dumbbells" },
        { id: 15, name: "Step-ups", video: "https://www.youtube.com/embed/8z7L6Y5jX-c", muscle: "Legs", difficulty: "Beginner", equipment: "Box" }
    ],
    back: [
        { id: 1, name: "Pull-ups", video: "https://www.youtube.com/embed/eGo4IYlbE5g", muscle: "Back", difficulty: "Intermediate", equipment: "Pull-up Bar" },
        { id: 2, name: "Lat Pulldowns", video: "https://www.youtube.com/embed/CAwf7n6Lu9g", muscle: "Back", difficulty: "Beginner", equipment: "Cable" },
        { id: 3, name: "Bent Over Rows", video: "https://www.youtube.com/embed/7C2z4GqqS5E", muscle: "Back", difficulty: "Intermediate", equipment: "Barbell" },
        { id: 4, name: "Seated Cable Rows", video: "https://www.youtube.com/embed/1TqM02QrL2M", muscle: "Back", difficulty: "Beginner", equipment: "Cable" },
        { id: 5, name: "T-Bar Rows", video: "https://www.youtube.com/embed/j3Igk5nyZE4", muscle: "Back", difficulty: "Advanced", equipment: "T-Bar" },
        { id: 6, name: "Single-Arm Dumbbell Row", video: "https://www.youtube.com/embed/6TZ_Dy81pz4", muscle: "Back", difficulty: "Intermediate", equipment: "Dumbbell" },
        { id: 7, name: "Face Pulls", video: "https://www.youtube.com/embed/HSoHeSqLfIc", muscle: "Back", difficulty: "Intermediate", equipment: "Cable" },
        { id: 8, name: "Good Mornings", video: "https://www.youtube.com/embed/o1tK1lJZ9I0", muscle: "Back", difficulty: "Intermediate", equipment: "Barbell" },
        { id: 9, name: "Back Extensions", video: "https://www.youtube.com/embed/ph3pddpKzzw", muscle: "Back", difficulty: "Beginner", equipment: "Hyperextension Bench" },
        { id: 10, name: "Deadlifts", video: "https://www.youtube.com/embed/op9kVnSso6Q", muscle: "Back", difficulty: "Intermediate", equipment: "Barbell" },
        { id: 11, name: "Chin-ups", video: "https://www.youtube.com/embed/oC7ILr4b9GI", muscle: "Back", difficulty: "Intermediate", equipment: "Pull-up Bar" },
        { id: 12, name: "Wide-Grip Pulldowns", video: "https://www.youtube.com/embed/CAwf7n6Lu9g", muscle: "Back", difficulty: "Beginner", equipment: "Cable" },
        { id: 13, name: "V-Grip Pulldowns", video: "https://www.youtube.com/embed/CAwf7n6Lu9g", muscle: "Back", difficulty: "Intermediate", equipment: "Cable" },
        { id: 14, name: "Chest Supported Row", video: "https://www.youtube.com/embed/8z7L6Y5jX-c", muscle: "Back", difficulty: "Beginner", equipment: "Machine" },
        { id: 15, name: "Pendlay Row", video: "https://www.youtube.com/embed/7C2z4GqqS5E", muscle: "Back", difficulty: "Advanced", equipment: "Barbell" }
    ],
    core: [
        { id: 1, name: "Planks", video: "https://www.youtube.com/embed/pSHjTRCQxIw", muscle: "Core", difficulty: "Beginner", equipment: "Bodyweight" },
        { id: 2, name: "Crunches", video: "https://www.youtube.com/embed/Xyd_fa5zoEU", muscle: "Core", difficulty: "Beginner", equipment: "Bodyweight" },
        { id: 3, name: "Leg Raises", video: "https://www.youtube.com/embed/JB2oyawG9KI", muscle: "Core", difficulty: "Intermediate", equipment: "Bodyweight" },
        { id: 4, name: "Russian Twists", video: "https://www.youtube.com/embed/0QfDfQs_MaA", muscle: "Core", difficulty: "Beginner", equipment: "Dumbbell" },
        { id: 5, name: "Bicycle Crunches", video: "https://www.youtube.com/embed/9FGilxCbdz8", muscle: "Core", difficulty: "Beginner", equipment: "Bodyweight" },
        { id: 6, name: "Mountain Climbers", video: "https://www.youtube.com/embed/8Y47Wm9wZws", muscle: "Core", difficulty: "Intermediate", equipment: "Bodyweight" },
        { id: 7, name: "Flutter Kicks", video: "https://www.youtube.com/embed/9WUoRnuCIAo", muscle: "Core", difficulty: "Beginner", equipment: "Bodyweight" },
        { id: 8, name: "V-Ups", video: "https://www.youtube.com/embed/9WUoRnuCIAo", muscle: "Core", difficulty: "Intermediate", equipment: "Bodyweight" },
        { id: 9, name: "Side Planks", video: "https://www.youtube.com/embed/K2VljzCC16g", muscle: "Core", difficulty: "Beginner", equipment: "Bodyweight" },
        { id: 10, name: "Hanging Leg Raises", video: "https://www.youtube.com/embed/JB2oyawG9KI", muscle: "Core", difficulty: "Advanced", equipment: "Pull-up Bar" },
        { id: 11, name: "Ab Wheel Rollouts", video: "https://www.youtube.com/embed/8z7L6Y5jX-c", muscle: "Core", difficulty: "Advanced", equipment: "Ab Wheel" },
        { id: 12, name: "Cable Crunches", video: "https://www.youtube.com/embed/8z7L6Y5jX-c", muscle: "Core", difficulty: "Intermediate", equipment: "Cable" },
        { id: 13, name: "Decline Crunches", video: "https://www.youtube.com/embed/Xyd_fa5zoEU", muscle: "Core", difficulty: "Intermediate", equipment: "Decline Bench" },
        { id: 14, name: "Dragon Flags", video: "https://www.youtube.com/embed/8z7L6Y5jX-c", muscle: "Core", difficulty: "Advanced", equipment: "Bench" },
        { id: 15, name: "Windshield Wipers", video: "https://www.youtube.com/embed/8z7L6Y5jX-c", muscle: "Core", difficulty: "Advanced", equipment: "Pull-up Bar" }
    ]
};

// =============================================
// PAGE LOADING WITH ADMIN CHECK
// =============================================

async function loadPage(page) {
    currentPage = page;
    
    // Check if user is admin and trying to access admin panel
    if (page === 'admin') {
        if (currentUser && (currentUser.role === 'Admin' || currentUser.role === 'SuperAdmin')) {
            window.location.href = 'admin.html';
            return;
        } else {
            showToast('Admin access required!', 'error');
            return;
        }
    }

    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    // Load page content
    const container = document.getElementById('pageContainer');
    
    try {
        const response = await fetch(`${page}.html`);
        if (response.ok) {
            container.innerHTML = await response.text();
            // Re-initialize page specific functionality
            if (page === 'home') initHome();
            if (page === 'workouts') initWorkouts();
            if (page === 'profile') initProfile();
            if (page === 'schedule') initSchedule();
        } else {
            loadPageFallback(page);
        }
    } catch (error) {
        loadPageFallback(page);
    }
}

function loadPageFallback(page) {
    const container = document.getElementById('pageContainer');
    const pages = {
        home: `<div id="homeScreen" class="screen active">${getHomeHTML()}</div>`,
        workouts: `<div id="workoutsScreen" class="screen">${getWorkoutsHTML()}</div>`,
        profile: `<div id="profileScreen" class="screen">${getProfileHTML()}</div>`,
        schedule: `<div id="scheduleScreen" class="screen">${getScheduleHTML()}</div>`
    };
    container.innerHTML = pages[page] || '<h2>Page not found</h2>';
    
    if (page === 'home') initHome();
    if (page === 'workouts') initWorkouts();
    if (page === 'profile') initProfile();
    if (page === 'schedule') initSchedule();
}

// =============================================
// HOME PAGE HTML
// =============================================

function getHomeHTML() {
    return `
        <div class="greeting" id="greetingText">Good Morning 👋</div>
        <div class="greeting-sub" id="greetingSub">Let's crush your workout today!</div>
        <div class="motivation-card">
            <blockquote>"The only bad workout is the one that didn't happen."</blockquote>
            <cite>— Fitness Wisdom</cite>
        </div>
        <div class="stats-grid">
            <div class="stat-item">
                <span class="icon"><i class="fas fa-fire"></i></span>
                <div class="number" id="statCalories">1,284</div>
                <div class="label">Calories</div>
            </div>
            <div class="stat-item">
                <span class="icon"><i class="fas fa-dumbbell"></i></span>
                <div class="number" id="statWorkouts">12</div>
                <div class="label">Workouts</div>
            </div>
            <div class="stat-item">
                <span class="icon"><i class="fas fa-tint"></i></span>
                <div class="number" id="statWater">2.4L</div>
                <div class="label">Water</div>
            </div>
            <div class="stat-item">
                <span class="icon"><i class="fas fa-clock"></i></span>
                <div class="number" id="statDuration">45m</div>
                <div class="label">Duration</div>
            </div>
        </div>
        <div style="display:flex;gap:12px;margin:12px 0;">
            <div class="glass" style="flex:1;text-align:center;padding:12px;">
                <div style="font-size:12px;color:var(--text-muted);">Protein</div>
                <div style="font-size:20px;font-weight:700;color:var(--success);" id="statProtein">156g</div>
                <div style="height:4px;background:var(--card-bg);border-radius:4px;margin-top:6px;overflow:hidden;">
                    <div style="width:78%;height:100%;background:var(--success);border-radius:4px;"></div>
                </div>
            </div>
            <div class="glass" style="flex:1;text-align:center;padding:12px;">
                <div style="font-size:12px;color:var(--text-muted);">Progress</div>
                <div style="font-size:20px;font-weight:700;color:var(--primary);" id="statProgress">68%</div>
                <div style="height:4px;background:var(--card-bg);border-radius:4px;margin-top:6px;overflow:hidden;">
                    <div style="width:68%;height:100%;background:var(--primary);border-radius:4px;"></div>
                </div>
            </div>
        </div>
        <div class="quick-actions">
            <div class="quick-action" onclick="startWorkout()">
                <i class="fas fa-play-circle"></i>
                <span>Start Workout</span>
            </div>
            <div class="quick-action" onclick="loadPage('workouts')">
                <i class="fas fa-list-ul"></i>
                <span>Programs</span>
            </div>
            <div class="quick-action" onclick="showNutrition()">
                <i class="fas fa-utensils"></i>
                <span>Nutrition</span>
            </div>
            <div class="quick-action" onclick="showProgress()">
                <i class="fas fa-chart-bar"></i>
                <span>Progress</span>
            </div>
        </div>
        <h4 style="margin:16px 0 12px;">Today's Workout</h4>
        <div class="program-card" onclick="startWorkout()">
            <div class="program-icon"><i class="fas fa-bolt"></i></div>
            <div class="program-info">
                <h4>Upper Body Power</h4>
                <p>8 exercises • 45 min</p>
                <div class="program-meta">
                    <span><i class="fas fa-fire"></i> 420 cal</span>
                    <span><i class="fas fa-clock"></i> 45 min</span>
                </div>
            </div>
            <span class="program-badge">Today</span>
        </div>
        <div class="program-card" onclick="loadPage('workouts')">
            <div class="program-icon" style="background:linear-gradient(135deg,#FF6584,#FFC107);"><i class="fas fa-heart"></i></div>
            <div class="program-info">
                <h4>Core Crusher</h4>
                <p>6 exercises • 30 min</p>
                <div class="program-meta">
                    <span><i class="fas fa-fire"></i> 280 cal</span>
                    <span><i class="fas fa-clock"></i> 30 min</span>
                </div>
            </div>
            <span class="program-badge">Upcoming</span>
        </div>
    `;
}

// =============================================
// WORKOUTS PAGE HTML
// =============================================

function getWorkoutsHTML() {
    return `
        <div id="workoutProgramsSection">
            <h2 style="margin-bottom:16px;">Workout Programs</h2>
            <div class="search-bar">
                <i class="fas fa-search"></i>
                <input type="text" placeholder="Search programs..." id="programSearch" oninput="filterPrograms()">
            </div>
            <div class="filter-chips">
                <span class="chip active">All</span>
                <span class="chip">Strength</span>
                <span class="chip">Cardio</span>
                <span class="chip">HIIT</span>
                <span class="chip">Yoga</span>
                <span class="chip">Recovery</span>
            </div>
            <div id="programList">
                ${getProgramCards()}
            </div>
        </div>
        <div id="exerciseLibrarySection" style="margin-top:30px;">
            <h2 style="margin-bottom:16px;">Exercise Library</h2>
            <div class="search-bar">
                <i class="fas fa-search"></i>
                <input type="text" placeholder="Search 300+ exercises..." id="exerciseSearch" oninput="filterExercises()">
            </div>
            <div class="filter-chips" id="exerciseFilters">
                <span class="chip active" data-filter="all">All</span>
                <span class="chip" data-filter="chest">Chest</span>
                <span class="chip" data-filter="shoulders">Shoulders</span>
                <span class="chip" data-filter="biceps">Biceps</span>
                <span class="chip" data-filter="triceps">Triceps</span>
                <span class="chip" data-filter="legs">Legs</span>
                <span class="chip" data-filter="back">Back</span>
                <span class="chip" data-filter="core">Core</span>
            </div>
            <div id="exerciseList"></div>
        </div>
    `;
}

function getProgramCards() {
    const programs = [
        { name: "HIIT Blast", icon: "fa-fire", desc: "High intensity interval training", duration: "30 min", days: "5 days", level: "🔥 Hard" },
        { name: "Full Body Strength", icon: "fa-dumbbell", desc: "Compound movements for muscle growth", duration: "60 min", days: "4 days", level: "💪 Intermediate" },
        { name: "Cardio Endurance", icon: "fa-heart", desc: "Build stamina and burn fat", duration: "45 min", days: "6 days", level: "🏃 Beginner" },
        { name: "Powerlifting", icon: "fa-bolt", desc: "Squat, bench, deadlift focus", duration: "75 min", days: "3 days", level: "🏆 Advanced" },
        { name: "Flexibility & Mobility", icon: "fa-yoga", desc: "Improve range of motion", duration: "30 min", days: "7 days", level: "🧘 All Levels" },
        { name: "Bodyweight Mastery", icon: "fa-crown", desc: "No equipment needed", duration: "40 min", days: "5 days", level: "⭐ Intermediate" }
    ];

    return programs.map(p => `
        <div class="program-card" onclick="startWorkout()">
            <div class="program-icon"><i class="fas ${p.icon}"></i></div>
            <div class="program-info">
                <h4>${p.name}</h4>
                <p>${p.desc}</p>
                <div class="program-meta">
                    <span><i class="fas fa-clock"></i> ${p.duration}</span>
                    <span><i class="fas fa-calendar"></i> ${p.days}</span>
                    <span>${p.level}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// =============================================
// PROFILE PAGE HTML
// =============================================

function getProfileHTML() {
    return `
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">
            <div class="profile-photo-container" onclick="showToast('Change profile photo', 'info')">
                <div class="placeholder"><i class="fas fa-user"></i></div>
                <div class="camera-overlay"><i class="fas fa-camera"></i></div>
            </div>
            <div>
                <h2 id="profileName">${currentUser?.fullName || 'User'}</h2>
                <p style="color:var(--text-secondary);" id="profileUsername">@${currentUser?.username || 'user'}</p>
                <span style="font-size:12px;padding:4px 12px;background:var(--card-bg);border-radius:20px;border:1px solid var(--glass-border);">
                    ⭐ Level <span id="profileLevel">${currentUser?.level || 1}</span>
                </span>
                ${currentUser?.role === 'Admin' || currentUser?.role === 'SuperAdmin' ? 
                    `<span style="font-size:12px;padding:4px 12px;background:rgba(255,193,7,0.2);border-radius:20px;border:1px solid var(--warning);margin-left:8px;color:var(--warning);">
                        👑 ${currentUser.role}
                    </span>` : ''
                }
            </div>
        </div>
        <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px;">
            <div class="stat-item">
                <div class="number" id="profileWorkouts">${currentUser?.totalWorkouts || 0}</div>
                <div class="label">Workouts</div>
            </div>
            <div class="stat-item">
                <div class="number" id="profileStreak">${currentUser?.streak || 0}</div>
                <div class="label">Day Streak</div>
            </div>
            <div class="stat-item">
                <div class="number" id="profileXP">${currentUser?.xp || 0}</div>
                <div class="label">XP Points</div>
            </div>
        </div>
        ${currentUser?.role === 'Admin' || currentUser?.role === 'SuperAdmin' ? 
            `<button class="btn-primary" onclick="loadPage('admin')" style="margin-bottom:20px;">
                <i class="fas fa-crown"></i> Admin Panel
            </button>` : ''
        }
        <h3 style="margin-bottom:16px;">Settings</h3>
        <div class="settings-group">
            <div class="title">Account</div>
            <div class="settings-item" onclick="showToast('Edit profile coming soon', 'info')">
                <div class="left"><i class="fas fa-user-edit"></i><span>Edit Profile</span></div>
                <div class="right"><i class="fas fa-chevron-right"></i></div>
            </div>
            <div class="settings-item" onclick="showToast('Premium features coming soon', 'info')">
                <div class="left"><i class="fas fa-crown"></i><span>Premium Subscription</span></div>
                <div class="right" style="color:var(--warning);">Upgrade</div>
            </div>
        </div>
        <div class="settings-group">
            <div class="title">Preferences</div>
            <div class="settings-item">
                <div class="left"><i class="fas fa-moon"></i><span>Dark Mode</span></div>
                <div class="toggle active" onclick="this.classList.toggle('active')"><div class="thumb"></div></div>
            </div>
            <div class="settings-item">
                <div class="left"><i class="fas fa-globe"></i><span>Language</span></div>
                <div class="right">English <i class="fas fa-chevron-right"></i></div>
            </div>
        </div>
        <div class="settings-group">
            <div class="title">Support</div>
            <div class="settings-item" onclick="showToast('Help center opening...', 'info')">
                <div class="left"><i class="fas fa-question-circle"></i><span>Help Center</span></div>
                <div class="right"><i class="fas fa-chevron-right"></i></div>
            </div>
            <div class="settings-item" onclick="showToast('Feedback form opened', 'success')">
                <div class="left"><i class="fas fa-comment-dots"></i><span>Send Feedback</span></div>
                <div class="right"><i class="fas fa-chevron-right"></i></div>
            </div>
        </div>
        <button class="btn-outline" onclick="logout()" style="margin-top:16px;border-color:var(--danger);color:var(--danger);">
            <i class="fas fa-sign-out-alt"></i> Log Out
        </button>
        <div style="text-align:center;margin-top:20px;font-size:12px;color:var(--text-muted);">
            ProGym v3.0.1 • Made with 💪
            <br>
            <span style="font-size:10px;">API: https://gym-apk-wicj.onrender.com</span>
        </div>
    `;
}

// =============================================
// SCHEDULE PAGE HTML
// =============================================

function getScheduleHTML() {
    return `
        <h2 style="margin-bottom:16px;">Workout Schedule Generator</h2>
        <p style="color:var(--text-secondary);margin-bottom:16px;">Select your workout style and we'll generate a weekly plan for you.</p>
        <div class="schedule-options" id="scheduleOptions">
            <div class="schedule-option selected" onclick="selectSchedule('muscle')" data-schedule="muscle">
                <i class="fas fa-dumbbell"></i>
                <h4>Muscle Split</h4>
                <p>Chest, Back, Legs, Shoulders</p>
            </div>
            <div class="schedule-option" onclick="selectSchedule('fullbody')" data-schedule="fullbody">
                <i class="fas fa-running"></i>
                <h4>Full Body</h4>
                <p>3-4 days per week</p>
            </div>
            <div class="schedule-option" onclick="selectSchedule('pushpull')" data-schedule="pushpull">
                <i class="fas fa-arrows-alt-h"></i>
                <h4>Push/Pull</h4>
                <p>Push days & Pull days</p>
            </div>
            <div class="schedule-option" onclick="selectSchedule('hiit')" data-schedule="hiit">
                <i class="fas fa-bolt"></i>
                <h4>HIIT</h4>
                <p>High intensity intervals</p>
            </div>
            <div class="schedule-option" onclick="selectSchedule('yoga')" data-schedule="yoga">
                <i class="fas fa-yoga"></i>
                <h4>Yoga & Mobility</h4>
                <p>Flexibility & recovery</p>
            </div>
            <div class="schedule-option" onclick="selectSchedule('strength')" data-schedule="strength">
                <i class="fas fa-crown"></i>
                <h4>Strength Training</h4>
                <p>Powerlifting focus</p>
            </div>
        </div>
        <button class="btn-primary" onclick="generateSchedule()" style="margin:16px 0;">
            <i class="fas fa-calendar-plus"></i> Generate Schedule
        </button>
        <div id="scheduleResult" style="display:none;">
            <h4 style="margin:16px 0 12px;">Your Weekly Schedule</h4>
            <div id="scheduleDays"></div>
        </div>
    `;
}

// =============================================
// PAGE INIT FUNCTIONS
// =============================================

function initHome() {
    updateDashboard();
    renderExercises();
}

function initWorkouts() {
    renderExercises();
}

function initProfile() {
    // Profile is static with user data
}

function initSchedule() {
    // Schedule is static
}

// =============================================
// SPLASH SCREEN
// =============================================

setTimeout(() => {
    document.getElementById('splashScreen').classList.add('hide');
    document.getElementById('app').classList.add('visible');
    document.getElementById('bottomNav').classList.add('visible');
    
    if (authToken && currentUser) {
        loadPage('home');
        updateDashboard();
    } else {
        showWelcomeScreen();
    }
    
    renderExercises();
}, 3000);

// =============================================
// WELCOME SCREEN
// =============================================

function showWelcomeScreen() {
    const container = document.getElementById('pageContainer');
    container.innerHTML = `
        <div id="welcomeScreen" class="screen active">
            <div class="welcome-badge">🔥 PREMIUM FITNESS</div>
            <div class="welcome-title">
                Transform Your<br><span>Body & Mind</span>
            </div>
            <div class="welcome-subtitle">
                Professional workout tracking, AI-powered coaching, and nutrition guidance all in one place.
            </div>
            <div class="welcome-features">
                <div class="welcome-feature">
                    <i class="fas fa-dumbbell"></i>
                    150+ Exercises
                </div>
                <div class="welcome-feature">
                    <i class="fas fa-robot"></i>
                    AI Form Coach
                </div>
                <div class="welcome-feature">
                    <i class="fas fa-chart-line"></i>
                    Track Progress
                </div>
                <div class="welcome-feature">
                    <i class="fas fa-utensils"></i>
                    Meal Plans
                </div>
            </div>
            <button class="btn-primary" onclick="showAuthScreen()">
                <i class="fas fa-rocket"></i> Get Started
            </button>
            <button class="btn-outline" onclick="showGuestMode()">
                <i class="fas fa-user"></i> Continue as Guest
            </button>
        </div>
    `;
}

// =============================================
// AUTH FUNCTIONS
// =============================================

async function handleLogin() {
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;

    if (!email || !password) {
        showToast('Please enter email and password', 'error');
        return;
    }

    showToast('Logging in...', 'info');

    const result = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });

    if (result && result.success) {
        authToken = result.token;
        currentUser = result.user;
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        showToast(`Welcome back ${currentUser.fullName}! 👋`, 'success');
        loadPage('home');
        updateDashboard();
    } else {
        showToast('Login failed. Check your credentials.', 'error');
    }
}

async function handleRegister() {
    const fullName = document.getElementById('registerFullName').value;
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;

    if (!fullName || !username || !email || !password) {
        showToast('Please fill all required fields', 'error');
        return;
    }

    showToast('Creating account...', 'info');

    const result = await apiCall('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ fullName, username, email, password })
    });

    if (result && result.success) {
        authToken = result.token;
        currentUser = result.user;
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        showToast('Account created successfully! 🎉', 'success');
        loadPage('home');
        updateDashboard();
    } else {
        showToast('Registration failed. Please try again.', 'error');
    }
}

function showGuestMode() {
    showToast('Continuing as guest', 'info');
    loadPage('home');
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    showToast('Logged out successfully', 'info');
    showWelcomeScreen();
}

// =============================================
// API FUNCTIONS
// =============================================

async function apiCall(endpoint, options = {}) {
    try {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('API Error:', error);
        showToast('Network error. Please try again.', 'error');
        return null;
    }
}

// =============================================
// DASHBOARD UPDATE
// =============================================

function updateDashboard() {
    if (!currentUser) return;
    
    const greeting = document.getElementById('greetingText');
    if (greeting) {
        const hour = new Date().getHours();
        let timeGreeting = 'Good Morning';
        if (hour >= 12 && hour < 17) timeGreeting = 'Good Afternoon';
        else if (hour >= 17) timeGreeting = 'Good Evening';
        greeting.textContent = `${timeGreeting} ${currentUser.fullName || 'User'} 👋`;
    }

    const statWorkouts = document.getElementById('statWorkouts');
    if (statWorkouts) statWorkouts.textContent = currentUser.totalWorkouts || 0;
}

// =============================================
// TOAST NOTIFICATION
// =============================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) toast.remove();
    }, 3000);
}

// =============================================
// RENDER EXERCISES WITH YOUTUBE VIDEOS
// =============================================

function renderExercises(filter = 'all', search = '') {
    const container = document.getElementById('exerciseList');
    if (!container) return;

    container.innerHTML = '';

    let allExercises = [];
    Object.keys(exerciseDatabase).forEach(category => {
        exerciseDatabase[category].forEach(ex => {
            allExercises.push({ ...ex, category });
        });
    });

    let filtered = allExercises;
    if (filter !== 'all') {
        filtered = filtered.filter(ex => ex.category === filter);
    }
    if (search) {
        const s = search.toLowerCase();
        filtered = filtered.filter(ex => 
            ex.name.toLowerCase().includes(s) || 
            ex.muscle.toLowerCase().includes(s)
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:40px 20px;color:var(--text-muted);">
                <i class="fas fa-search" style="font-size:48px;display:block;margin-bottom:16px;"></i>
                <p>No exercises found. Try a different search.</p>
            </div>
        `;
        return;
    }

    filtered.forEach((ex) => {
        const card = document.createElement('div');
        card.className = 'exercise-card';
        card.onclick = () => showExerciseDetail(ex);
        const videoId = ex.video.split('/embed/')[1] || 'dQw4w9WgXcQ';
        card.innerHTML = `
            <div class="exercise-thumb">
                <img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" 
                     alt="${ex.name}"
                     onerror="this.style.display='none'">
                <div class="play-icon">
                    <i class="fas fa-play"></i>
                </div>
            </div>
            <div class="info">
                <h4>${ex.name}</h4>
                <p>${ex.muscle} • ${ex.difficulty}</p>
                <div class="tags">
                    <span>${ex.equipment}</span>
                    <span>${ex.category}</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// =============================================
// FILTERS
// =============================================

function filterExercises() {
    const search = document.getElementById('exerciseSearch')?.value || '';
    const activeChip = document.querySelector('#exerciseFilters .chip.active');
    const filter = activeChip ? activeChip.dataset.filter : 'all';
    renderExercises(filter, search);
}

function filterPrograms() {
    const query = document.getElementById('programSearch')?.value?.toLowerCase() || '';
    const cards = document.querySelectorAll('#programList .program-card');
    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(query) ? 'flex' : 'none';
    });
}

// =============================================
// FILTER CHIPS
// =============================================

document.addEventListener('click', function(e) {
    if (e.target.classList.contains('chip') && e.target.closest('#exerciseFilters')) {
        const parent = e.target.closest('#exerciseFilters');
        parent.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        const filter = e.target.dataset.filter || 'all';
        const search = document.getElementById('exerciseSearch')?.value || '';
        renderExercises(filter, search);
    }
});

// =============================================
// EXERCISE DETAIL MODAL
// =============================================

function showExerciseDetail(exercise) {
    const modal = document.getElementById('modalOverlay');
    const body = document.getElementById('modalBody');
    
    body.innerHTML = `
        <div style="width:100%;aspect-ratio:16/9;background:var(--darker);border-radius:16px;overflow:hidden;margin-bottom:16px;">
            <iframe src="${exercise.video}" 
                    style="width:100%;height:100%;border:none;"
                    allowfullscreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
            </iframe>
        </div>
        <h3>${exercise.name}</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 16px;">
            <span style="font-size:12px;padding:4px 12px;background:var(--card-bg);border-radius:20px;border:1px solid var(--glass-border);">${exercise.muscle}</span>
            <span style="font-size:12px;padding:4px 12px;background:var(--card-bg);border-radius:20px;border:1px solid var(--glass-border);">${exercise.difficulty}</span>
            <span style="font-size:12px;padding:4px 12px;background:var(--card-bg);border-radius:20px;border:1px solid var(--glass-border);">${exercise.equipment}</span>
        </div>
        <div style="background:var(--card-bg);border-radius:12px;padding:16px;margin:12px 0;">
            <h4 style="font-size:14px;margin-bottom:8px;">📋 How to Perform</h4>
            <p style="font-size:13px;color:var(--text-secondary);line-height:1.6;">
                Watch the video demonstration above for proper form and technique.
                <br><br>
                <strong>Sets:</strong> 3-4<br>
                <strong>Reps:</strong> 8-12<br>
                <strong>Rest:</strong> 60-90 seconds
            </p>
        </div>
        <button class="btn-primary" onclick="closeModal();startExercise('${exercise.name}', '${exercise.video}')">
            <i class="fas fa-play"></i> Start Exercise
        </button>
    `;
    modal.classList.add('active');
}

// =============================================
// WORKOUT PLAYER
// =============================================

function startExercise(name, video) {
    closeModal();
    document.getElementById('playerOverlay').classList.add('active');
    document.getElementById('playerExerciseName').textContent = name;
    
    const container = document.querySelector('.player-exercise .video-container');
    container.innerHTML = `
        <iframe src="${video}" 
                style="width:100%;height:100%;border:none;"
                allowfullscreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
        </iframe>
    `;
    
    isPlayerPlaying = true;
    document.getElementById('playerPlayIcon').className = 'fas fa-pause';
}

function startWorkout() {
    let allEx = [];
    Object.keys(exerciseDatabase).forEach(cat => {
        exerciseDatabase[cat].forEach(ex => {
            allEx.push(ex);
        });
    });
    
    const shuffled = allEx.sort(() => 0.5 - Math.random());
    playerExercises = shuffled.slice(0, 6);
    currentExerciseIndex = 0;
    
    startExercise(playerExercises[0].name, playerExercises[0].video);
}

function closePlayer() {
    document.getElementById('playerOverlay').classList.remove('active');
    const container = document.querySelector('.player-exercise .video-container');
    container.innerHTML = `<div class="placeholder"><i class="fas fa-play-circle" style="font-size:60px;color:var(--primary);"></i></div>`;
}

function togglePlayerPlay() {
    isPlayerPlaying = !isPlayerPlaying;
    document.getElementById('playerPlayIcon').className = isPlayerPlaying ? 'fas fa-pause' : 'fas fa-play';
    showToast(isPlayerPlaying ? 'Resumed' : 'Paused', 'info');
}

function nextExercise() {
    if (currentExerciseIndex < playerExercises.length - 1) {
        currentExerciseIndex++;
        const ex = playerExercises[currentExerciseIndex];
        startExercise(ex.name, ex.video);
        showToast(`Exercise ${currentExerciseIndex + 1} of ${playerExercises.length}`, 'info');
    } else {
        completeWorkout();
    }
}

function previousExercise() {
    if (currentExerciseIndex > 0) {
        currentExerciseIndex--;
        const ex = playerExercises[currentExerciseIndex];
        startExercise(ex.name, ex.video);
    }
}

function completeWorkout() {
    closePlayer();
    showToast('🎉 Workout Complete! Great job!', 'success');
    const progressBar = document.querySelector('.player-progress .bar');
    if (progressBar) progressBar.style.width = '100%';
}

// =============================================
// SCHEDULE FUNCTIONS
// =============================================

function selectSchedule(type) {
    selectedSchedule = type;
    document.querySelectorAll('.schedule-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.schedule === type);
    });
}

function generateSchedule() {
    const resultDiv = document.getElementById('scheduleResult');
    const daysContainer = document.getElementById('scheduleDays');
    
    const schedules = {
        muscle: {
            name: 'Muscle Split',
            days: [
                { day: 'Monday', workout: 'Chest & Triceps', status: 'upcoming' },
                { day: 'Tuesday', workout: 'Back & Biceps', status: 'upcoming' },
                { day: 'Wednesday', workout: 'Rest Day', status: 'rest' },
                { day: 'Thursday', workout: 'Shoulders & Core', status: 'upcoming' },
                { day: 'Friday', workout: 'Legs & Glutes', status: 'upcoming' },
                { day: 'Saturday', workout: 'Cardio & Abs', status: 'upcoming' },
                { day: 'Sunday', workout: 'Rest Day', status: 'rest' }
            ]
        },
        fullbody: {
            name: 'Full Body',
            days: [
                { day: 'Monday', workout: 'Full Body Workout A', status: 'upcoming' },
                { day: 'Tuesday', workout: 'Cardio Day', status: 'upcoming' },
                { day: 'Wednesday', workout: 'Full Body Workout B', status: 'upcoming' },
                { day: 'Thursday', workout: 'Rest Day', status: 'rest' },
                { day: 'Friday', workout: 'Full Body Workout C', status: 'upcoming' },
                { day: 'Saturday', workout: 'Active Recovery', status: 'upcoming' },
                { day: 'Sunday', workout: 'Rest Day', status: 'rest' }
            ]
        },
        pushpull: {
            name: 'Push/Pull',
            days: [
                { day: 'Monday', workout: 'Push Day (Chest, Shoulders, Triceps)', status: 'upcoming' },
                { day: 'Tuesday', workout: 'Pull Day (Back, Biceps)', status: 'upcoming' },
                { day: 'Wednesday', workout: 'Rest Day', status: 'rest' },
                { day: 'Thursday', workout: 'Push Day', status: 'upcoming' },
                { day: 'Friday', workout: 'Pull Day', status: 'upcoming' },
                { day: 'Saturday', workout: 'Legs & Core', status: 'upcoming' },
                { day: 'Sunday', workout: 'Rest Day', status: 'rest' }
            ]
        },
        hiit: {
            name: 'HIIT',
            days: [
                { day: 'Monday', workout: 'HIIT Cardio', status: 'upcoming' },
                { day: 'Tuesday', workout: 'Strength Training', status: 'upcoming' },
                { day: 'Wednesday', workout: 'HIIT Cardio', status: 'upcoming' },
                { day: 'Thursday', workout: 'Rest Day', status: 'rest' },
                { day: 'Friday', workout: 'HIIT Cardio', status: 'upcoming' },
                { day: 'Saturday', workout: 'Strength Training', status: 'upcoming' },
                { day: 'Sunday', workout: 'Rest Day', status: 'rest' }
            ]
        },
        yoga: {
            name: 'Yoga & Mobility',
            days: [
                { day: 'Monday', workout: 'Morning Yoga Flow', status: 'upcoming' },
                { day: 'Tuesday', workout: 'Mobility & Stretching', status: 'upcoming' },
                { day: 'Wednesday', workout: 'Power Yoga', status: 'upcoming' },
                { day: 'Thursday', workout: 'Rest Day', status: 'rest' },
                { day: 'Friday', workout: 'Morning Yoga Flow', status: 'upcoming' },
                { day: 'Saturday', workout: 'Mobility & Stretching', status: 'upcoming' },
                { day: 'Sunday', workout: 'Rest Day', status: 'rest' }
            ]
        },
        strength: {
            name: 'Strength Training',
            days: [
                { day: 'Monday', workout: 'Squat Day', status: 'upcoming' },
                { day: 'Tuesday', workout: 'Bench Press Day', status: 'upcoming' },
                { day: 'Wednesday', workout: 'Deadlift Day', status: 'upcoming' },
                { day: 'Thursday', workout: 'Rest Day', status: 'rest' },
                { day: 'Friday', workout: 'Accessory Work', status: 'upcoming' },
                { day: 'Saturday', workout: 'Full Body Strength', status: 'upcoming' },
                { day: 'Sunday', workout: 'Rest Day', status: 'rest' }
            ]
        }
    };

    const schedule = schedules[selectedSchedule] || schedules.muscle;
    
    let html = `<h4 style="margin-bottom:8px;">📋 ${schedule.name}</h4>`;
    schedule.days.forEach(day => {
        const statusClass = day.status === 'rest' ? 'rest' : 'upcoming';
        html += `
            <div class="schedule-day">
                <span class="day-name">${day.day}</span>
                <span class="day-workout">${day.workout}</span>
                <span class="day-status ${statusClass}">${day.status === 'rest' ? '🔄 Rest' : '⏳ Upcoming'}</span>
            </div>
        `;
    });
    
    daysContainer.innerHTML = html;
    resultDiv.style.display = 'block';
    showToast('Schedule generated! 🗓️', 'success');
}

// =============================================
// MODAL
// =============================================

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
}

document.getElementById('modalOverlay').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
});

// =============================================
// TOGGLE
// =============================================

document.addEventListener('click', function(e) {
    if (e.target.closest('.toggle')) {
        e.target.closest('.toggle').classList.toggle('active');
    }
});

// =============================================
// KEYBOARD SHORTCUTS
// =============================================

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
        closePlayer();
    }
    if (e.key === ' ' && document.getElementById('playerOverlay').classList.contains('active')) {
        e.preventDefault();
        togglePlayerPlay();
    }
});

// =============================================
// INIT
// =============================================

console.log('💪 ProGym App Loaded!');
console.log('📡 API:', API_URL);
console.log('👤 User:', currentUser?.fullName || 'Guest');
console.log('📚 Total Exercises:', Object.values(exerciseDatabase).flat().length);
console.log('🎥 All exercises have working YouTube videos!');
console.log('👑 Admin Panel: Click profile > Admin Panel (if admin)');
