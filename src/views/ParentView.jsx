import React, { useState } from 'react';
import CountdownWidget from '../components/CountdownWidget';
import { generatePaymentPdf } from '../utils/pdfGenerator';
import { getStudents, getPayments, addPayment } from '../services/dataService';
import { Search, UploadCloud, FileText, CheckCircle2, AlertCircle, Clock, ExternalLink, Eye, X } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function ParentView({ onShowToast }) {
    const [nisnSearch, setNisnSearch] = useState('');
    const [searchedStudent, setSearchedStudent] = useState(null);
    const [searchErr, setSearchErr] = useState('');
    const [previewModal, setPreviewModal] = useState({ open: false, url: '', type: 'image/png' });

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



    // Helper untuk melihat bukti transfer (Modal + Blob URL safe)
    const handleViewProof = (proofFile) => {
        if (!proofFile) return;

        if (proofFile.startsWith('data:')) {
            try {
                const parts = proofFile.split(';base64,');
                const contentType = parts[0].split(':')[1] || 'image/png';
                const raw = window.atob(parts[1]);
                const uInt8Array = new Uint8Array(raw.length);
                for (let i = 0; i < raw.length; ++i) {
                    uInt8Array[i] = raw.charCodeAt(i);
                }
                const blob = new Blob([uInt8Array], { type: contentType });
                const blobUrl = URL.createObjectURL(blob);
                setPreviewModal({ open: true, url: blobUrl, rawData: proofFile, type: contentType });
            } catch (e) {
                console.error(e);
                setPreviewModal({ open: true, url: proofFile, rawData: proofFile, type: 'image/png' });
            }
        } else {
            const fullUrl = proofFile.startsWith('http') || proofFile.startsWith('/') ? proofFile : '/uploads/' + proofFile;
            setPreviewModal({ open: true, url: fullUrl, rawData: fullUrl, type: 'image/png' });
        }
    };

    // Calculate status & history
    const allPayments = searchedStudent ? getPayments().filter(p => p.student_id === searchedStudent.id) : [];
    const currentPayment = allPayments.find(p => p.month === currentMonth && p.year === currentYear);

    const isStep1Done = !!searchedStudent;
    const isStep2Done = currentPayment && currentPayment.status !== 'ditolak';

    return (
        <div className="app-parent-container">
            <div className="parent-card-wrap">
                <div className="card glass" style={{ padding: '36px 30px' }}>
                    <div className="header">
                        <h1>SatuSPP</h1>
                        <p>Portal Pembayaran SPP Online X TKR 2 — Rp 700.000 / Bulan</p>
                    </div>

                    {/* Apple Style Step Guide for Parents */}
                    <div className="parent-step-guide">
                        <div className={`step-item ${!isStep1Done ? 'active' : 'completed'}`}>
                            <span className="step-num">{isStep1Done ? '✓' : '1'}</span>
                            <span>Cek NISN</span>
                        </div>
                        <span className="step-arrow">➔</span>
                        <div className={`step-item ${isStep1Done && !isStep2Done ? 'active' : (isStep2Done ? 'completed' : '')}`}>
                            <span className="step-num">{isStep2Done ? '✓' : '2'}</span>
                            <span>Status Bayar</span>
                        </div>
                    </div>

                    {/* Countdown Widget */}
                    <CountdownWidget />

                    {/* Search Section */}
                    <div className="search-section">
                        <form onSubmit={handleSearch} className="search-form">
                            <input
                                type="text"
                                placeholder="Masukkan NISN Siswa (contoh: 0104000553)..."
                                value={nisnSearch}
                                onChange={(e) => setNisnSearch(e.target.value)}
                                required
                            />
                            <button type="submit" className="btn btn-primary">
                                <Search size={16} /> Cek Tagihan
                            </button>
                        </form>
                    </div>

                    {searchErr && <div className="alert alert-danger" style={{ color: '#fca5a5', marginTop: '14px', fontSize: '13px' }}>⚠️ {searchErr}</div>}

                    {/* Student Info Card */}
                    {searchedStudent && (
                        <div className="student-info fade-in">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '800', color: '#fff' }}>
                                    {searchedStudent.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '17px', color: '#f9fafb' }}>{searchedStudent.name}</h3>
                                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>NISN: {searchedStudent.nisn || searchedStudent.nis}</span>
                                </div>
                            </div>

                            <div className="info-grid">
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
                                <h4>Status Pembayaran Bulan Ini ({currentMonth}/{currentYear})</h4>

                                {!currentPayment && (
                                    <div>
                                        <span className="badge badge-danger"><AlertCircle size={12} /> Belum Dibayar</span>
                                        <p className="status-msg">Silakan lakukan pembayaran dan serahkan bukti transfer ke admin sekolah.</p>
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
                                        <p className="status-msg">Silakan hubungi admin sekolah untuk menyelesaikan masalah ini.</p>
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
                                                    <button
                                                        onClick={() => handleViewProof(p.proof_file)}
                                                        className="link-sm"
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                    >
                                                        <Eye size={12} /> Lihat
                                                    </button>
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

            {/* Modal Preview Bukti Transfer */}
            {previewModal.open && (
                <div className="modal-overlay" onClick={() => setPreviewModal({ open: false, url: '', type: 'image/png' })}>
                    <div className="modal-card glass" style={{ maxWidth: '640px', width: '90%', padding: '24px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                🖼️ Bukti Transfer Siswa
                            </h3>
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setPreviewModal({ open: false, url: '', type: 'image/png' })}
                                style={{ padding: '6px' }}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div style={{ background: 'rgba(0, 0, 0, 0.4)', borderRadius: '12px', padding: '16px', maxHeight: '65vh', overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            {previewModal.type?.includes('pdf') ? (
                                <iframe src={previewModal.url} style={{ width: '100%', height: '480px', border: 'none', borderRadius: '8px' }} title="Bukti PDF" />
                            ) : (
                                <img
                                    src={previewModal.url || previewModal.rawData}
                                    alt="Bukti Transfer"
                                    style={{ maxWidth: '100%', maxHeight: '500px', borderRadius: '8px', objectFit: 'contain', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
                                />
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '20px' }}>
                            <a
                                href={previewModal.url || previewModal.rawData}
                                target="_blank"
                                rel="noreferrer"
                                download="bukti-pembayaran-spp"
                                className="btn btn-primary btn-sm"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                                <ExternalLink size={14} /> Unduh / Buka File
                            </a>
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setPreviewModal({ open: false, url: '', type: 'image/png' })}
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

