import React, { useState } from 'react';
import CountdownWidget from '../components/CountdownWidget';
import { generatePaymentPdf } from '../utils/pdfGenerator';
import { getStudents, getPayments, addPayment } from '../services/dataService';
import { Search, UploadCloud, FileText, CheckCircle2, AlertCircle, Clock, ExternalLink } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function ParentView({ onShowToast }) {
    const [nisnSearch, setNisnSearch] = useState('');
    const [searchedStudent, setSearchedStudent] = useState(null);
    const [searchErr, setSearchErr] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const bulanNama = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    const handleSearch = (e) => {
        e.preventDefault();
        setSearchErr('');
        if (!nisnSearch.trim()) return;

        const students = getStudents();
        const found = students.find(s => (s.nisn === nisnSearch.trim() || s.nis === nisnSearch.trim()));
        if (!found) {
            setSearchedStudent(null);
            setSearchErr('Siswa dengan NISN tersebut tidak ditemukan.');
        } else {
            setSearchedStudent(found);
        }
    };

    const handleUpload = (e) => {
        e.preventDefault();
        if (!selectedFile || !searchedStudent) return;

        // Convert file preview to data URL
        const reader = new FileReader();
        reader.onloadend = () => {
            addPayment({
                student_id: searchedStudent.id,
                month: currentMonth,
                year: currentYear,
                proof_file: reader.result
            });

            setSelectedFile(null);
            onShowToast('✅ Bukti pembayaran berhasil diunggah dan sedang menunggu konfirmasi admin.', 'success');
            // Trigger confetti
            confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
        };
        reader.readAsDataURL(selectedFile);
    };

    // Calculate status & history
    const allPayments = searchedStudent ? getPayments().filter(p => p.student_id === searchedStudent.id) : [];
    const currentPayment = allPayments.find(p => p.month === currentMonth && p.year === currentYear);

    return (
        <div className="app-parent-container">
            <div className="parent-card-wrap">
                <div className="card glass" style={{ padding: '32px 28px' }}>
                    <div className="header">
                        <h1>SatuSPP</h1>
                        <p>Portal Pembayaran SPP Kelas X TKR 2 — Rp 700.000 / Bulan</p>
                    </div>

                    {/* Countdown Widget */}
                    <CountdownWidget />

                    {/* Search Section */}
                    <div className="search-section">
                        <form onSubmit={handleSearch} className="search-form">
                            <input
                                type="text"
                                placeholder="Masukkan NISN Siswa..."
                                value={nisnSearch}
                                onChange={(e) => setNisnSearch(e.target.value)}
                                required
                            />
                            <button type="submit" className="btn btn-primary">
                                <Search size={16} /> Cek Tagihan
                            </button>
                        </form>
                    </div>

                    {searchErr && <div className="alert alert-danger" style={{ color: '#fca5a5', marginTop: '12px', fontSize: '13px' }}>⚠️ {searchErr}</div>}

                    {/* Student Info Card */}
                    {searchedStudent && (
                        <div className="student-info fade-in">
                            <h3>📋 Data Siswa</h3>
                            <div className="info-grid">
                                <div className="info-item">
                                    <span className="info-label">Nama Siswa</span>
                                    <span className="info-val">{searchedStudent.name}</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">NISN</span>
                                    <span className="info-val">{searchedStudent.nisn || searchedStudent.nis}</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">Kelas</span>
                                    <span className="info-val">{searchedStudent.kelas || 'X TKR 2'}</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">No WhatsApp Wali</span>
                                    <span className="info-val">{searchedStudent.parent_wa}</span>
                                </div>
                            </div>

                            {/* Status Bulan Ini */}
                            <div className="payment-status">
                                <h4>Status Bulan Ini ({currentMonth}/{currentYear})</h4>

                                {!currentPayment && (
                                    <div>
                                        <span className="badge badge-danger"><AlertCircle size={12} /> Belum Dibayar</span>
                                        <form onSubmit={handleUpload} style={{ marginTop: '14px' }}>
                                            <div className="form-group">
                                                <label>📎 Unggah Bukti Transfer (Foto/PDF)</label>
                                                <div className="file-drop-zone">
                                                    <input
                                                        type="file"
                                                        accept="image/*,.pdf"
                                                        onChange={(e) => setSelectedFile(e.target.files[0])}
                                                        required
                                                    />
                                                    <span className="drop-icon"><UploadCloud size={28} color="#818cf8" /></span>
                                                    <span id="file-name-display">{selectedFile ? selectedFile.name : 'Klik atau seret file ke sini'}</span>
                                                </div>
                                            </div>
                                            <button type="submit" className="btn btn-success">Kirim Bukti Pembayaran</button>
                                        </form>
                                    </div>
                                )}

                                {currentPayment?.status === 'pending' && (
                                    <div>
                                        <span className="badge badge-warning"><Clock size={12} /> ⏳ Menunggu Konfirmasi Admin</span>
                                        <p className="status-msg">Terima kasih, bukti Anda telah kami terima dan sedang diverifikasi oleh admin.</p>
                                    </div>
                                )}

                                {currentPayment?.status === 'lunas' && (
                                    <div>
                                        <span className="badge badge-success"><CheckCircle2 size={12} /> ✅ Lunas</span>
                                        <p className="status-msg">Terima kasih, pembayaran SPP bulan ini telah lunas.</p>
                                        <button
                                            onClick={() => generatePaymentPdf(searchedStudent, currentPayment)}
                                            className="btn-download"
                                        >
                                            <FileText size={16} /> Unduh Bukti Lunas (PDF)
                                        </button>
                                    </div>
                                )}

                                {currentPayment?.status === 'ditolak' && (
                                    <div>
                                        <span className="badge badge-danger">❌ Ditolak</span>
                                        <p className="status-msg" style={{ color: '#fca5a5' }}>
                                            Alasan: {currentPayment.reject_reason || 'Bukti transfer tidak jelas / tidak valid.'}
                                        </p>
                                        <form onSubmit={handleUpload} style={{ marginTop: '14px' }}>
                                            <div className="form-group">
                                                <label>📎 Unggah Ulang Bukti Transfer</label>
                                                <input
                                                    type="file"
                                                    accept="image/*,.pdf"
                                                    onChange={(e) => setSelectedFile(e.target.files[0])}
                                                    required
                                                />
                                            </div>
                                            <button type="submit" className="btn btn-success">Kirim Ulang Bukti</button>
                                        </form>
                                    </div>
                                )}
                            </div>

                            {/* Riwayat Pembayaran */}
                            {allPayments.length > 0 && (
                                <div className="history-section">
                                    <h4>📚 Riwayat Pembayaran</h4>
                                    <div className="history-list">
                                        {allPayments.map(p => (
                                            <div key={p.id} className="history-item">
                                                <div className="history-left">
                                                    <span className="history-period">{bulanNama[p.month]} {p.year}</span>
                                                    <span className="history-date">Diunggah: {new Date(p.created_at).toLocaleDateString('id-ID')}</span>
                                                </div>
                                                <div className="history-right">
                                                    {p.status === 'lunas' && (
                                                        <>
                                                            <span className="badge badge-success">Lunas</span>
                                                            <button
                                                                onClick={() => generatePaymentPdf(searchedStudent, p)}
                                                                className="link-sm"
                                                            >
                                                                📄 PDF
                                                            </button>
                                                        </>
                                                    )}
                                                    {p.status === 'pending' && <span className="badge badge-warning">Pending</span>}
                                                    {p.status === 'ditolak' && <span className="badge badge-danger">Ditolak</span>}
                                                    <a href={p.proof_file} target="_blank" rel="noreferrer" className="link-sm">
                                                        <ExternalLink size={10} /> Lihat
                                                    </a>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
