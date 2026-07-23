/**
 * Routes: Bendahara Dashboard
 * Fitur: Rekap keuangan, statistik per kelas, ekspor
 */
const express = require('express');
const supabase = require('../database');
const { requireRole } = require('../middleware/auth');
const router = express.Router();

router.use(requireRole('admin', 'bendahara'));

router.get('/', async (req, res) => {
    const user = req.session.user;
    const { tahun } = req.query;
    const year = parseInt(tahun) || new Date().getFullYear();

    // Semua pembayaran tahun ini
    const { data: payments } = await supabase
        .from('payments')
        .select('*, students(name, nis, kelas)')
        .eq('year', year)
        .eq('status', 'lunas')
        .order('month', { ascending: true });

    // Semua siswa
    const { data: students } = await supabase.from('students').select('*');

    // Total terkumpul
    const totalTerkumpul = (payments || []).length * 700000;

    // Rekap per bulan
    const rekapBulan = [];
    const bulanNama = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
    for (let m = 1; m <= 12; m++) {
        const lunasM = (payments || []).filter(p => p.month === m).length;
        rekapBulan.push({
            bulan: bulanNama[m - 1],
            month: m,
            lunas: lunasM,
            nominal: lunasM * 700000
        });
    }

    // Rekap per kelas
    const kelasMap = {};
    (students || []).forEach(s => {
        const k = s.kelas || 'X TKR 2';
        if (!kelasMap[k]) kelasMap[k] = { total: 0, lunas: 0 };
        kelasMap[k].total++;
    });
    (payments || []).forEach(p => {
        const k = p.students?.kelas || 'X TKR 2';
        if (kelasMap[k]) kelasMap[k].lunas++;
    });

    res.render('bendahara', {
        user, year,
        totalTerkumpul,
        rekapBulan,
        kelasMap,
        totalSiswa: (students || []).length,
        payments: payments || []
    });
});

module.exports = router;
