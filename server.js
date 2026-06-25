const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from root directory (where server.js is)
app.use(express.static(__dirname));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// ✅ MAIN ROUTE - index.html is in root
app.get('/', (req, res) => {
    try {
        // index.html is in the same directory as server.js
        const indexPath = path.join(__dirname, 'index.html');
        
        console.log('📁 Serving index.html from:', indexPath);
        console.log('📁 File exists:', fs.existsSync(indexPath));
        
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            res.status(404).send(`
                <h1>❌ index.html not found</h1>
                <p>Looking for: ${indexPath}</p>
                <p>Current directory: ${__dirname}</p>
            `);
        }
    } catch (error) {
        console.error('Error serving index.html:', error);
        res.status(500).send('Server error loading page.');
    }
});

// API routes
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        exercises: 140,
        schedule: '7 days'
    });
});

// Catch-all route for SPA
app.get('*', (req, res) => {
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log('🏋️ AI Gym Trainer Server');
    console.log('========================================');
    console.log(`🚀 Running on: http://localhost:${PORT}`);
    console.log(`📁 Root directory: ${__dirname}`);
    console.log(`📁 index.html: ${path.join(__dirname, 'index.html')}`);
    console.log(`📁 index.html exists: ${fs.existsSync(path.join(__dirname, 'index.html'))}`);
    console.log(`📁 Uploads: ${uploadsDir}`);
    console.log('📊 Exercises: 140');
    console.log('📅 Schedule: 7 days');
    console.log('========================================');
});
