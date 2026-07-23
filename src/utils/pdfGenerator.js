import { jsPDF } from 'jspdf';

export const generatePaymentPdf = (student, payment) => {
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a5'
    });

    const monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    // Border Frame
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(1);
    doc.rect(5, 5, 138, 200);

    // Title & Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text('SatuSPP', 74, 22, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Sistem Informasi Pembayaran SPP Sekolah', 74, 28, { align: 'center' });

    // Divider Line
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(0.8);
    doc.line(15, 34, 133, 34);

    // LUNAS Badge
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(16, 185, 129);
    doc.text('✓ BUKTI PEMBAYARAN LUNAS', 74, 46, { align: 'center' });

    // Section 1: Data Siswa
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Data Siswa:', 15, 58);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    let y = 66;
    const addRow = (label, val) => {
        doc.setTextColor(71, 85, 105);
        doc.text(label + ':', 15, y);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(String(val), 55, y);
        doc.setFont('helvetica', 'normal');
        y += 8;
    };

    addRow('Nama Siswa', student.name);
    addRow('NISN', student.nisn || student.nis);
    addRow('Kelas', student.kelas || 'X TKR 2');

    // Section 2: Detail Pembayaran
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('Detail Pembayaran:', 15, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    addRow('Periode SPP', `${monthNames[payment.month]} ${payment.year}`);
    addRow('Nominal SPP', 'Rp 700.000');
    addRow('Status Pembayaran', 'LUNAS');
    addRow('Tanggal Konfirmasi', new Date(payment.updated_at || payment.created_at).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric'
    }));

    // Footer
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(15, 165, 133, 165);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(148, 163, 184);
    doc.text('Dokumen ini diterbitkan secara digital oleh sistem SatuSPP.', 74, 175, { align: 'center' });
    doc.text('Sah dan valid tanpa memerlukan tanda tangan basah.', 74, 180, { align: 'center' });

    // Download File
    doc.save(`Bukti-Lunas-SPP-${student.nisn || student.nis}-${payment.month}-${payment.year}.pdf`);
};
