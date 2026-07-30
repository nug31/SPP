/**
 * Routes: Admin Panel
 * Fitur: Dashboard, import Excel, konfirmasi/tolak, filter, search, WA manual
 */
const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const supabase = require('../database');
const waBot = require('../wa-bot');
const { requireRole } = require('../middleware/auth');
const router = express.Router();

const uploadMemory = multer({ storage: multer.memoryStorage() });

// Semua route admin harus login sebagai admin atau bendahara
router.use(requireRole('admin', 'bendahara'));

// GET /admin — Dashboard admin
router.get('/', async (req, res) => {
    const { search, bulan, kelas, status, success, error: errQ } = req.query;
    const user = req.session.user;

    // Query siswa dengan filter search
    let studentQuery = supabase.from('students').select('*').order('name', { ascending: true });
    if (search) studentQuery = studentQuery.or(`name.ilike.%${search}%,nisn.ilike.%${search}%,nis.ilike.%${search}%`);
    if (kelas) studentQuery = studentQuery.eq('kelas', kelas);
    const { data: students } = await studentQuery;

    // Query payments dengan filter
    let paymentQuery = supabase
        .from('payments')
        .select('*, students(name, nisn, nis, kelas, parent_wa)')
        .order('created_at', { ascending: false });

    if (bulan) paymentQuery = paymentQuery.eq('month', parseInt(bulan));
    if (status) paymentQuery = paymentQuery.eq('status', status);
    if (kelas) {
        const kelasIds = (students || []).map(s => s.id);
        if (kelasIds.length > 0) paymentQuery = paymentQuery.in('student_id', kelasIds);
    }
    if (search) {
        const searchIds = (students || []).map(s => s.id);
        if (searchIds.length > 0) paymentQuery = paymentQuery.in('student_id', searchIds);
        else paymentQuery = paymentQuery.in('student_id', [0]); // no result
    }

    const { data: payments } = await paymentQuery;

    // Notifikasi belum dibaca (admin)
    const { data: notifRaw } = await supabase
        .from('notifications')
        .select('*')
        .eq('target_role', 'admin')
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(20);

    // Statistik ringkas
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const { data: thisMonthPayments } = await supabase
        .from('payments').select('status')
        .eq('month', currentMonth).eq('year', currentYear);

    const stats = {
        totalSiswa: (students || []).length,
        lunasCount: (thisMonthPayments || []).filter(p => p.status === 'lunas').length,
        pendingCount: (thisMonthPayments || []).filter(p => p.status === 'pending').length,
        belumCount: (students || []).length - (thisMonthPayments || []).length
    };

    const flatPayments = (payments || []).map(p => ({
        ...p,
        name: p.students?.name || '-',
        nisn: p.students?.nisn || p.students?.nis || '-',
        nis: p.students?.nisn || p.students?.nis || '-',
        kelas: p.students?.kelas || '-',
        parent_wa: p.students?.parent_wa || ''
    }));

    // Daftar kelas unik
    const { data: allStudents } = await supabase.from('students').select('kelas');
    const kelasList = [...new Set((allStudents || []).map(s => s.kelas).filter(Boolean))].sort();

    const sortedStudents = (students || []).sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));

    res.render('admin', {
        students: sortedStudents,
        payments: flatPayments,
        notifications: notifRaw || [],
        stats,
        kelasList,
        filters: { search: search || '', bulan: bulan || '', kelas: kelas || '', status: status || '' },
        success: success || null,
        error: errQ || null,
        user
    });
});

// POST /admin/clear-payments — Hapus seluruh data pembayaran dummy
router.post('/clear-payments', requireRole('admin'), async (req, res) => {
    await supabase.from('payments').delete();
    res.redirect('/admin?success=payments_cleared');
});

// POST /admin/import — Import Excel
router.post('/import', uploadMemory.single('excel'), async (req, res) => {
    if (!req.file) return res.redirect('/admin?error=nofile');
    try {
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        const rows = data
            .filter(r => (r.nisn || r.nis || r.NISN || r.NIS || r.name || r.NAMA) && (r.name || r.NAMA))
            .map(r => {
                const idVal = String(r.nisn || r.NISN || r.nis || r.NIS || '').trim();
                return {
                    nisn: idVal,
                    nis: idVal,
                    name: String(r.name || r.NAMA || '').trim(),
                    parent_wa: String(r.parent_wa || r.WA || r.NO_WA || '').trim(),
                    kelas: r.kelas || r.KELAS ? String(r.kelas || r.KELAS).trim() : 'X TKR 2'
                };
            });
        if (!rows.length) return res.redirect('/admin?error=emptydata');
        const { error } = await supabase.from('students').upsert(rows, { onConflict: 'nisn' });
        if (error) return res.redirect('/admin?error=importfailed');
        res.redirect('/admin?success=imported');
    } catch {
        res.redirect('/admin?error=importfailed');
    }
});

// POST /admin/confirm/:id — Konfirmasi lunas
router.post('/confirm/:id', async (req, res) => {
    const { id } = req.params;

    // Ambil info payment untuk notifikasi
    const { data: payment } = await supabase
        .from('payments').select('*, students(name, nisn, nis, parent_wa)')
        .eq('id', id).single();

    const { error } = await supabase
        .from('payments')
        .update({ status: 'lunas', updated_at: new Date().toISOString() })
        .eq('id', id);

    if (error) return res.status(500).send('Database error');

    if (payment) {
        const student = payment.students;

        // Notifikasi real-time ke orang tua via Socket.io
        if (req.app.get('io')) {
            req.app.get('io').to('parent_' + payment.student_id).emit('payment_approved', {
                month: payment.month, year: payment.year
            });
        }

        // Simpan notifikasi ke DB
        await supabase.from('notifications').insert([{
            type: 'approved',
            student_id: payment.student_id,
            payment_id: parseInt(id),
            message: `Pembayaran SPP ${payment.month}/${payment.year} atas nama ${student?.name} telah dikonfirmasi LUNAS`,
            target_role: 'orang_tua'
        }]);

        // Kirim WA ke orang tua
        if (student?.parent_wa) {
            waBot.sendPaymentApproved(student.parent_wa, student.name, payment.month, payment.year);
        }
    }

    res.redirect('/admin');
});

// POST /admin/reject/:id — Tolak pembayaran
router.post('/reject/:id', async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    const { data: payment } = await supabase
        .from('payments').select('*, students(name, nisn, nis, parent_wa)')
        .eq('id', id).single();

    const { error } = await supabase
        .from('payments')
        .update({ status: 'ditolak', updated_at: new Date().toISOString() })
        .eq('id', id);

    if (error) return res.status(500).send('Database error');

    if (payment) {
        const student = payment.students;

        // Notifikasi real-time
        if (req.app.get('io')) {
            req.app.get('io').to('parent_' + payment.student_id).emit('payment_rejected', {
                month: payment.month, year: payment.year, reason
            });
        }

        // Simpan notifikasi
        await supabase.from('notifications').insert([{
            type: 'rejected',
            student_id: payment.student_id,
            payment_id: parseInt(id),
            message: `Pembayaran SPP ${payment.month}/${payment.year} atas nama ${student?.name} DITOLAK. Alasan: ${reason || '-'}`,
            target_role: 'orang_tua'
        }]);

        // Kirim WA ke orang tua
        if (student?.parent_wa) {
            waBot.sendPaymentRejected(student.parent_wa, student.name, payment.month, payment.year, reason);
        }
    }

    res.redirect('/admin');
});

// POST /admin/delete-student/:id — Hapus siswa
router.post('/delete-student/:id', requireRole('admin'), async (req, res) => {
    const { id } = req.params;
    await supabase.from('payments').delete().eq('student_id', id);
    await supabase.from('students').delete().eq('id', id);
    res.redirect('/admin');
});

// POST /admin/wa-remind/:student_id — Kirim WA reminder manual
router.post('/wa-remind/:student_id', async (req, res) => {
    const { student_id } = req.params;
    const { data: student } = await supabase.from('students').select('*').eq('id', student_id).single();
    if (!student) return res.redirect('/admin?error=studentnotfound');

    const bulanNamaList = ['Desember', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const currentMonth = new Date().getMonth() + 1;
    const bulanNama = bulanNamaList[currentMonth] || 'bulan ini';
    const kelas = student.kelas || 'X TKR 2';
    const formattedName = student.name
        ? student.name.toLowerCase().replace(/(?:^|\s|-)\S/g, (a) => a.toUpperCase())
        : '';

    const msg = `Assalamu'alaikum warahmatullahi wabarakatuh.\nYth. Bapak/Ibu ${formattedName}\n\nDengan hormat.\n\nPerkenankan saya selaku Wali Kelas ${kelas} mengingatkan untuk pembayaran SPP Bulan ${bulanNama}.\n\nApabila pembayaran belum sempat dilakukan, mohon kesediaan Bapak/Ibu untuk dapat menyelesaikannya pada kesempatan pertama. Apabila pembayaran sudah dilakukan, mohon berkenan mengirimkan bukti transfer kepada saya agar dapat saya teruskan kepada bagian administrasi.\n\nAtas perhatian, kerja sama, dan pengertiannya, saya ucapkan terima kasih. 🙏😊`;

    await waBot.sendMessage(student.parent_wa, msg);
    res.redirect('/admin?success=wa_sent');
});

// POST /admin/notif-read — Tandai notifikasi sebagai dibaca
router.post('/notif-read', async (req, res) => {
    await supabase.from('notifications').update({ is_read: true }).eq('target_role', 'admin');
    res.json({ ok: true });
});

// POST /admin/add-student — Tambah siswa manual
router.post('/add-student', requireRole('admin'), async (req, res) => {
    const { nisn, nis, name, parent_wa, kelas } = req.body;
    const idVal = nisn || nis;
    if (!idVal || !name || !parent_wa) return res.redirect('/admin?error=missingdata');
    const { error } = await supabase.from('students')
        .upsert([{ nisn: idVal, nis: idVal, name, parent_wa, kelas: kelas || 'X TKR 2' }], { onConflict: 'nisn' });
    if (error) return res.redirect('/admin?error=addfailed');
    res.redirect('/admin?success=added');
});

module.exports = router;
