/**
 * Routes: Portal Orang Tua / Wali Murid
 * Fitur: Cek tagihan, upload bukti, countdown, riwayat, download PDF
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const PDFDocument = require('pdfkit');
const supabase = require('../database');
const waBot = require('../wa-bot');
const router = express.Router();

// Multer untuk upload bukti
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const uploadLocal = multer({ storage });

// GET / — Halaman utama cek tagihan by NISN / NIS
router.get('/', async (req, res) => {
    const nisn = req.query.nisn || req.query.nis;
    const { success } = req.query;
    const user = req.session?.user || null;

    if (!nisn) {
        return res.render('index', {
            student: null, payment: null, payments: [],
            error: null, success: null, user
        });
    }

    const { data: student, error: studentErr } = await supabase
        .from('students').select('*').eq('nisn', nisn).single();

    if (studentErr || !student) {
        return res.render('index', {
            student: null, payment: null, payments: [],
            error: 'Siswa dengan NISN tersebut tidak ditemukan.', success: null, user
        });
    }

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // Pembayaran bulan ini
    const { data: payment } = await supabase
        .from('payments').select('*')
        .eq('student_id', student.id)
        .eq('month', currentMonth).eq('year', currentYear).single();

    // Riwayat semua pembayaran
    const { data: payments } = await supabase
        .from('payments').select('*')
        .eq('student_id', student.id)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

    res.render('index', {
        student, payment: payment || null,
        payments: payments || [],
        error: null, success: success || null,
        currentMonth, currentYear, user
    });
});

// POST /upload-proof — Upload bukti pembayaran
router.post('/upload-proof', uploadLocal.single('proof'), async (req, res) => {
    const { student_id, month, year } = req.body;
    const nisnVal = req.body.nisn || req.body.nis || '';
    const file = req.file;

    if (!file) return res.status(400).send('File bukti pembayaran diperlukan.');

    // Cek apakah sudah ada pembayaran bulan ini
    const { data: existing } = await supabase
        .from('payments').select('id')
        .eq('student_id', student_id)
        .eq('month', month).eq('year', year).single();

    if (existing) {
        return res.redirect('/?error=already_uploaded&nisn=' + nisnVal);
    }

    const { data: newPayment, error } = await supabase
        .from('payments')
        .insert([{
            student_id: parseInt(student_id),
            month: parseInt(month),
            year: parseInt(year),
            proof_file: file.filename,
            status: 'pending'
        }])
        .select().single();

    if (error) {
        console.error('Upload error:', error);
        return res.status(500).send('Gagal menyimpan data: ' + error.message);
    }

    // Kirim notifikasi real-time ke admin via Socket.io
    if (req.app.get('io')) {
        const { data: student } = await supabase
            .from('students').select('name, nisn, nis').eq('id', student_id).single();

        req.app.get('io').to('admin').emit('new_upload', {
            student_name: student?.name,
            student_nisn: student?.nisn || student?.nis,
            month: parseInt(month),
            year: parseInt(year),
            payment_id: newPayment?.id
        });
    }

    // Simpan ke tabel notifications
    const { data: student } = await supabase
        .from('students').select('name').eq('id', student_id).single();

    await supabase.from('notifications').insert([{
        type: 'upload',
        student_id: parseInt(student_id),
        payment_id: newPayment?.id,
        message: `${student?.name} mengunggah bukti pembayaran bulan ${month}/${year}`,
        target_role: 'admin'
    }]);

    res.redirect('/?success=1&nisn=' + nisnVal);
});

// GET /download-pdf/:payment_id — Download bukti lunas PDF
router.get('/download-pdf/:payment_id', async (req, res) => {
    const { payment_id } = req.params;

    const { data: payment, error: pErr } = await supabase
        .from('payments').select('*, students(name, nisn, nis, kelas)')
        .eq('id', payment_id).single();

    if (pErr || !payment) return res.status(404).send('Data pembayaran tidak ditemukan.');
    if (payment.status !== 'lunas') return res.status(403).send('Hanya pembayaran yang sudah lunas yang dapat diunduh.');

    const student = payment.students;
    const studentNisn = student.nisn || student.nis || '-';
    const bulanNama = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    // Generate PDF
    const doc = new PDFDocument({ size: 'A5', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="bukti-lunas-${studentNisn}-${payment.month}-${payment.year}.pdf"`);
    doc.pipe(res);

    // Header
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#1e293b')
        .text('SatuSPP', { align: 'center' });
    doc.font('Helvetica').fontSize(11).fillColor('#64748b')
        .text('Sistem Informasi Pembayaran SPP Sekolah', { align: 'center' });

    doc.moveTo(40, 100).lineTo(555, 100).strokeColor('#4F46E5').lineWidth(2).stroke();

    doc.fontSize(16).fillColor('#059669').font('Helvetica-Bold')
        .text('✓ BUKTI PEMBAYARAN LUNAS', { align: 'center' });

    doc.moveDown(1.5);
    doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(12).text('Data Siswa:');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(11);
    row(doc, 'Nama Siswa', student.name);
    row(doc, 'NISN', studentNisn);
    row(doc, 'Kelas', student.kelas || 'X TKR 2');

    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(12).text('Detail Pembayaran:');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(11);
    row(doc, 'Periode', `${bulanNama[payment.month]} ${payment.year}`);
    row(doc, 'Nominal', 'Rp 700.000');
    row(doc, 'Status', 'LUNAS');
    row(doc, 'Tanggal Konfirmasi', new Date(payment.updated_at || payment.created_at).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric'
    }));

    doc.moveDown(2);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#e2e8f0').lineWidth(1).stroke();
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(9).fillColor('#94a3b8')
        .text('Dokumen ini diterbitkan secara digital oleh Portal SPP Sekolah.', { align: 'center' })
        .text('Tidak diperlukan tanda tangan basah.', { align: 'center' });

    doc.end();
});

function row(doc, label, value) {
    doc.fillColor('#475569').text(label + ':', { continued: true, width: 150 })
        .fillColor('#1e293b').text('  ' + value);
}

module.exports = router;
