/**
 * Routes: Wali Kelas Dashboard
 * Fitur: Lihat status pembayaran kelas yang diampu (read-only)
 */
const express = require('express');
const supabase = require('../database');
const { requireRole } = require('../middleware/auth');
const router = express.Router();

router.use(requireRole('admin', 'wali_kelas'));

router.get('/', async (req, res) => {
    const user = req.session.user;
    const { bulan, tahun } = req.query;

    const currentMonth = parseInt(bulan) || new Date().getMonth() + 1;
    const currentYear = parseInt(tahun) || new Date().getFullYear();

    // Siswa di kelas wali kelas ini
    let studentQuery = supabase.from('students').select('*').order('name', { ascending: true });
    if (user.role === 'wali_kelas' && user.kelas) {
        studentQuery = studentQuery.eq('kelas', user.kelas);
    }
    const { data: students } = await studentQuery;

    // Ambil pembayaran bulan/tahun ini untuk semua siswa di kelas
    const studentIds = (students || []).map(s => s.id);
    let payments = [];
    if (studentIds.length > 0) {
        const { data: pData } = await supabase
            .from('payments').select('*')
            .in('student_id', studentIds)
            .eq('month', currentMonth)
            .eq('year', currentYear);
        payments = pData || [];
    }

    // Gabungkan data siswa dengan status pembayaran
    const studentStatus = (students || []).map(s => {
        const p = payments.find(p => p.student_id === s.id);
        return { ...s, payment: p || null };
    });

    const lunasCount = studentStatus.filter(s => s.payment?.status === 'lunas').length;
    const pendingCount = studentStatus.filter(s => s.payment?.status === 'pending').length;
    const belumCount = studentStatus.filter(s => !s.payment).length;

    res.render('wali_kelas', {
        user,
        studentStatus,
        currentMonth, currentYear,
        stats: { lunas: lunasCount, pending: pendingCount, belum: belumCount, total: studentStatus.length }
    });
});

module.exports = router;
