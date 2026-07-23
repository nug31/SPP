require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const path = require('path');

const supabase = require('./database');
const waBot = require('./wa-bot');
const cronScheduler = require('./cron-scheduler');

// Routes
const authRoutes = require('./routes/auth');
const parentRoutes = require('./routes/parent');
const adminRoutes = require('./routes/admin');
const bendaharaRoutes = require('./routes/bendahara');
const waliKelasRoutes = require('./routes/wali_kelas');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

const port = process.env.PORT || 3001;

// ==================== MIDDLEWARE ====================
app.set('view engine', 'ejs');
app.set('io', io); // Buat io bisa diakses di routes via req.app.get('io')
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET || 'spp-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 8 * 60 * 60 * 1000, // 8 jam
        httpOnly: true
    }
}));

// Inject user ke semua views
app.use((req, res, next) => {
    res.locals.user = req.session?.user || null;
    next();
});

// ==================== SOCKET.IO ====================
io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    // Admin join room 'admin'
    socket.on('join_admin', () => {
        socket.join('admin');
        console.log('Admin joined socket room');
    });

    // Orang tua join room berdasarkan student_id
    socket.on('join_parent', (student_id) => {
        socket.join('parent_' + student_id);
    });

    socket.on('disconnect', () => {
        console.log('Socket disconnected:', socket.id);
    });
});

// ==================== ROUTES ====================
app.use('/', authRoutes);
app.use('/', parentRoutes);
app.use('/admin', adminRoutes);
app.use('/bendahara', bendaharaRoutes);
app.use('/wali-kelas', waliKelasRoutes);

// Error 404
app.use((req, res) => {
    res.status(404).render('error', {
        message: 'Halaman tidak ditemukan.',
        user: req.session?.user || null
    });
});

// ==================== START ====================
cronScheduler.start();

server.listen(port, () => {
    console.log(`\n🚀 SatuSPP running at http://localhost:${port}`);
    console.log(`   Admin  : http://localhost:${port}/admin`);
    console.log(`   Login  : http://localhost:${port}/login\n`);
});
