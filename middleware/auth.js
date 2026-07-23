/**
 * Middleware Authentication & Role Guard
 */

// Cek apakah sudah login
const requireLogin = (req, res, next) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/login');
    }
    next();
};

// Cek role tertentu
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            return res.redirect('/login');
        }
        if (!roles.includes(req.session.user.role)) {
            return res.status(403).render('error', {
                message: 'Akses ditolak. Anda tidak memiliki izin untuk halaman ini.',
                user: req.session.user
            });
        }
        next();
    };
};

module.exports = { requireLogin, requireRole };
