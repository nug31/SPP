/**
 * Routes: Autentikasi (Login / Logout)
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const supabase = require('../database');
const router = express.Router();

// GET /login
router.get('/login', (req, res) => {
    if (req.session && req.session.user) {
        return redirectByRole(res, req.session.user.role);
    }
    res.render('login', { error: null });
});

// POST /login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.render('login', { error: 'Email dan password wajib diisi.' });
    }

    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .single();

    if (error || !user) {
        if (req.headers['content-type']?.includes('application/json')) {
            return res.status(401).json({ error: 'Email atau password salah.' });
        }
        return res.render('login', { error: 'Email atau password salah.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
        if (req.headers['content-type']?.includes('application/json')) {
            return res.status(401).json({ error: 'Email atau password salah.' });
        }
        return res.render('login', { error: 'Email atau password salah.' });
    }

    // Simpan ke session
    req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        kelas: user.kelas,
        student_id: user.student_id
    };

    // Jika request dari React (JSON), kembalikan data user
    if (req.headers['content-type']?.includes('application/json')) {
        return res.json(req.session.user);
    }

    redirectByRole(res, user.role);
});

// GET /logout
router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

function redirectByRole(res, role) {
    const map = {
        admin: '/admin',
        bendahara: '/bendahara',
        wali_kelas: '/wali-kelas',
        orang_tua: '/'
    };
    res.redirect(map[role] || '/');
}

module.exports = router;
