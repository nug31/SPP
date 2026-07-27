import React, { useState } from 'react';
import { getStudents, getPayments, updatePaymentStatus, saveStudent, deleteStudent, clearAllPayments, deduplicateStudents, addPayment } from '../services/dataService';
import { generatePaymentPdf } from '../utils/pdfGenerator';
import { Users, CheckCircle2, Clock, XCircle, DollarSign, Search, Plus, MessageCircle, Trash2, FileText, Upload, FileSpreadsheet, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function AdminView({ user, onShowToast }) {
    const [students, setStudents] = useState(getStudents());
    const [payments, setPayments] = useState(getPayments());
    const [search, setSearch] = useState('');
    const [filterKelas, setFilterKelas] = useState('');
    const [filterBulan, setFilterBulan] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [newStudent, setNewStudent] = useState({ nisn: '', name: '', parent_wa: '', kelas: 'X TKR 2' });

    // Reject Modal state
    const [rejectModal, setRejectModal] = useState({ open: false, paymentId: null, studentName: '', reason: '' });
    // Preview Proof Modal state
    const [previewModal, setPreviewModal] = useState({ open: false, url: '', type: 'image/png', studentName: '' });
    // Upload Modal state
    const [uploadModal, setUploadModal] = useState({ open: false, student: null, file: null, month: new Date().getMonth() + 1, year: new Date().getFullYear() });

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const refreshData = () => {
        setStudents(getStudents());
        setPayments(getPayments());
    };

    // Helper untuk melihat bukti transfer (Modal + Blob URL safe)
    const handleViewProof = (proofFile, studentName = '') => {
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
                setPreviewModal({ open: true, url: blobUrl, rawData: proofFile, type: contentType, studentName });
            } catch (e) {
                console.error(e);
                setPreviewModal({ open: true, url: proofFile, rawData: proofFile, type: 'image/png', studentName });
            }
        } else {
            const fullUrl = proofFile.startsWith('http') || proofFile.startsWith('/') ? proofFile : '/uploads/' + proofFile;
            setPreviewModal({ open: true, url: fullUrl, rawData: fullUrl, type: 'image/png', studentName });
        }
    };

    // Handle Admin Upload Payment
    const handleAdminUpload = (e) => {
        e.preventDefault();
        if (!uploadModal.file || !uploadModal.student) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            addPayment({
                student_id: uploadModal.student.id,
                month: uploadModal.month,
                year: uploadModal.year,
                proof_file: reader.result,
                status: 'lunas'
            });
            setUploadModal({ open: false, student: null, file: null, month: currentMonth, year: currentYear });
            refreshData();
            onShowToast('✅ Bukti pembayaran berhasil diunggah & status lunas.', 'success');
        };
        reader.readAsDataURL(uploadModal.file);
    };

    // Handle Excel File Upload
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                let count = 0;
                data.forEach(row => {
                    const nisnVal = String(row.nisn || row.NISN || row.nis || row.NIS || '').trim();
                    const nameVal = String(row.name || row.NAMA || row.Nama || '').trim();
                    const waVal = String(row.parent_wa || row.WA || row.NO_WA || row.No_WA || row.Phone || '').trim();
                    const kelasVal = String(row.kelas || row.KELAS || row.Kelas || 'X TKR 2').trim();

                    if (nameVal || nisnVal) {
                        saveStudent({ nisn: nisnVal, name: nameVal, parent_wa: waVal, kelas: kelasVal });
                        count++;
                    }
                });

                deduplicateStudents();
                refreshData();
                setShowImportModal(false);
                onShowToast(`✅ Berhasil mengimpor & mengurutkan ${count} data siswa dari Excel!`, 'success');
            } catch (err) {
                console.error(err);
                onShowToast('❌ Gagal membaca file Excel. Pastikan format kolom benar.', 'danger');
            }
        };
        reader.readAsBinaryString(file);
    };

    // Download Excel Template
    const downloadTemplate = () => {
        const templateData = [
            { nisn: '0051234567', name: 'Ahmad Supriadi', parent_wa: '081234567890', kelas: 'X TKR 2' },
            { nisn: '0051234568', name: 'Budi Kurniawan', parent_wa: '081298765432', kelas: 'X TKR 2' }
        ];
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template Siswa');
        XLSX.writeFile(wb, 'Template_Data_Siswa_SatuSPP.xlsx');
    };

    // Clean & Sort Students Action
    const handleCleanStudents = () => {
        const cleaned = deduplicateStudents();
        setStudents(cleaned);
        onShowToast(`🔄 Berhasil merapikan data: ${cleaned.length} siswa unik terurut A-Z.`, 'success');
    };

    // Clear All Payments Action
    const handleClearPayments = () => {
        if (window.confirm('Yakin ingin menghapus seluruh data pembayaran dummy? Data pembayaran akan menjadi kosong dan siap diisi data real.')) {
            clearAllPayments();
            refreshData();
            onShowToast('🗑️ Seluruh data pembayaran dummy telah dihapus.', 'info');
        }
    };

    // Filter Students & Sort Alphabetically A-Z
    const filteredStudents = students
        .filter(s => {
            const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.nisn || s.nis || '').includes(search);
            const matchKelas = !filterKelas || s.kelas === filterKelas;
            return matchSearch && matchKelas;
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));

    // Filter Payments
    const filteredPayments = payments.filter(p => {
        const student = students.find(s => s.id === p.student_id);
        const matchSearch = !search || (student && (student.name.toLowerCase().includes(search.toLowerCase()) || (student.nisn || student.nis || '').includes(search)));
        const matchKelas = !filterKelas || (student && student.kelas === filterKelas);
        const matchBulan = !filterBulan || p.month === parseInt(filterBulan);
        const matchStatus = !filterStatus || p.status === filterStatus;
        return matchSearch && matchKelas && matchBulan && matchStatus;
    });

    // Stats
    const thisMonthPayments = payments.filter(p => p.month === currentMonth && p.year === currentYear);
    const lunasCount = thisMonthPayments.filter(p => p.status === 'lunas').length;
    const pendingCount = thisMonthPayments.filter(p => p.status === 'pending').length;
    const belumCount = Math.max(0, students.length - thisMonthPayments.length);

    const handleConfirm = (id) => {
        updatePaymentStatus(id, 'lunas');
        refreshData();
        onShowToast('✅ Pembayaran berhasil dikonfirmasi LUNAS!', 'success');
    };

    const handleOpenReject = (id, name) => {
        setRejectModal({ open: true, paymentId: id, studentName: name, reason: '' });
    };

    const handleConfirmReject = (e) => {
        e.preventDefault();
        updatePaymentStatus(rejectModal.paymentId, 'ditolak', rejectModal.reason);
        setRejectModal({ open: false, paymentId: null, studentName: '', reason: '' });
        refreshData();
        onShowToast('❌ Pembayaran telah ditolak.', 'danger');
    };

    const handleAddStudent = (e) => {
        e.preventDefault();
        saveStudent(newStudent);
        setNewStudent({ nisn: '', name: '', parent_wa: '', kelas: 'X TKR 2' });
        setShowAddForm(false);
        refreshData();
        onShowToast('✅ Data siswa berhasil ditambahkan & diurutkan!', 'success');
    };

    const handleDeleteStudent = (id, name) => {
        if (window.confirm(`Yakin hapus siswa ${name}?`)) {
            deleteStudent(id);
            refreshData();
            onShowToast('🗑️ Data siswa telah dihapus.', 'info');
        }
    };

    const handleSendWa = (student) => {
        const num = student.parent_wa.replace(/[^0-9]/g, '');
        const formattedNum = num.startsWith('0') ? '62' + num.slice(1) : num;
        const text = encodeURIComponent(`Halo Bapak/Ibu Wali Murid dari *${student.name}*.\n\nIni pengingat pembayaran SPP bulan ini sebesar *Rp 700.000* yang belum diterima.\nMohon segera melalukan pembayaran melalui portal SatuSPP.\n\nTerima kasih 🙏`);
        window.open(`https://wa.me/${formattedNum}?text=${text}`, '_blank');
    };

    const kelasList = [...new Set(students.map(s => s.kelas).filter(Boolean))].sort();

    return (
        <div className="admin-container">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-brand">
                    <span className="sidebar-icon">🏫</span>
                    <div>
                        <h2>SatuSPP</h2>
                        <p className="sidebar-sub">Panel Admin</p>
                    </div>
                </div>
                <div className="sidebar-user">
                    <div className="su-avatar">{user.name.charAt(0).toUpperCase()}</div>
                    <div>
                        <div className="su-name">{user.name}</div>
                        <span className={`role-badge role-${user.role}`}>{user.role}</span>
                    </div>
                </div>
                <nav className="sidebar-nav">
                    <ul>
                        <li><a href="#dashboard" className="nav-btn active">📊 Dashboard</a></li>
                        <li><a href="#students" className="nav-btn">👨‍🎓 Data Siswa ({students.length})</a></li>
                        <li><a href="#payments" className="nav-btn">💳 Pembayaran ({payments.length})</a></li>
                    </ul>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="content" id="dashboard">
                <div className="content-header">
                    <h1 className="page-title">Dashboard Pembayaran SPP</h1>
                </div>

                {/* Stats */}
                <div className="stats-grid">
                    <div className="stat-card stat-blue">
                        <div className="stat-icon"><Users color="#3b82f6" size={28} /></div>
                        <div className="stat-info"><div className="stat-num">{students.length}</div><div className="stat-label">Total Siswa</div></div>
                    </div>
                    <div className="stat-card stat-green">
                        <div className="stat-icon"><CheckCircle2 color="#10b981" size={28} /></div>
                        <div className="stat-info"><div className="stat-num">{lunasCount}</div><div className="stat-label">Lunas Bulan Ini</div></div>
                    </div>
                    <div className="stat-card stat-yellow">
                        <div className="stat-icon"><Clock color="#f59e0b" size={28} /></div>
                        <div className="stat-info"><div className="stat-num">{pendingCount}</div><div className="stat-label">Menunggu Verifikasi</div></div>
                    </div>
                    <div className="stat-card stat-red">
                        <div className="stat-icon"><XCircle color="#ef4444" size={28} /></div>
                        <div className="stat-info"><div className="stat-num">{belumCount}</div><div className="stat-label">Belum Bayar</div></div>
                    </div>
                    <div className="stat-card stat-purple">
                        <div className="stat-icon"><DollarSign color="#c084fc" size={28} /></div>
                        <div className="stat-info"><div className="stat-num">Rp {(lunasCount * 700000).toLocaleString('id-ID')}</div><div className="stat-label">Terkumpul Bulan Ini</div></div>
                    </div>
                </div>

                {/* Section Data Siswa */}
                <section id="students" className="card glass" style={{ padding: '24px', marginBottom: '28px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h2>👨‍🎓 Data Siswa</h2>
                        {user.role === 'admin' && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn btn-ghost btn-sm" onClick={handleCleanStudents} title="Urutkan nama A-Z dan bersihkan duplikat">
                                    <RefreshCw size={14} color="#6366f1" /> Rapid Clean & Urutkan
                                </button>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowImportModal(true)}>
                                    <FileSpreadsheet size={14} color="#10b981" /> Import Excel
                                </button>
                                <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(!showAddForm)}>
                                    <Plus size={14} /> Tambah Siswa
                                </button>
                            </div>
                        )}
                    </div>

                    {showAddForm && (
                        <form onSubmit={handleAddStudent} className="glass-inner" style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
                            <div><label style={{ fontSize: '11px', color: '#94a3b8' }}>NISN</label><input type="text" placeholder="NISN" value={newStudent.nisn} onChange={e => setNewStudent({ ...newStudent, nisn: e.target.value })} required /></div>
                            <div><label style={{ fontSize: '11px', color: '#94a3b8' }}>Nama</label><input type="text" placeholder="Nama Lengkap" value={newStudent.name} onChange={e => setNewStudent({ ...newStudent, name: e.target.value })} required /></div>
                            <div><label style={{ fontSize: '11px', color: '#94a3b8' }}>No WA</label><input type="text" placeholder="08xxxxxxxxxx" value={newStudent.parent_wa} onChange={e => setNewStudent({ ...newStudent, parent_wa: e.target.value })} required /></div>
                            <div><label style={{ fontSize: '11px', color: '#94a3b8' }}>Kelas</label>
                                <select className="form-select" value={newStudent.kelas} onChange={e => setNewStudent({ ...newStudent, kelas: e.target.value })}>
                                    <option value="X TKR 2">X TKR 2</option>
                                    <option value="XI TKR 1">XI TKR 1</option>
                                    <option value="XII TKR 1">XII TKR 1</option>
                                </select>
                            </div>
                            <button type="submit" className="btn btn-success btn-sm">Simpan</button>
                        </form>
                    )}

                    {/* Filter bar */}
                    <div className="filter-bar">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                            <Search size={16} color="#94a3b8" />
                            <input type="text" placeholder="🔍 Cari nama atau NISN..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <select className="form-select" value={filterKelas} onChange={e => setFilterKelas(e.target.value)}>
                            <option value="">Semua Kelas</option>
                            {kelasList.map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                    </div>

                    <div className="table-responsive">
                        <table className="data-table">
                            <thead>
                                <tr><th>#</th><th>NISN</th><th>Nama</th><th>Kelas</th><th>No WA</th><th>Aksi</th></tr>
                            </thead>
                            <tbody>
                                {filteredStudents.map((s, i) => (
                                    <tr key={s.id}>
                                        <td>{i + 1}</td>
                                        <td><code>{s.nisn || s.nis}</code></td>
                                        <td><strong>{s.name}</strong></td>
                                        <td><span className="kelas-badge">{s.kelas || 'X TKR 2'}</span></td>
                                        <td>{s.parent_wa}</td>
                                        <td style={{ display: 'flex', gap: '6px' }}>
                                            <button onClick={() => setUploadModal({ open: true, student: s, file: null, month: currentMonth, year: currentYear })} className="btn btn-success btn-sm" title="Input Pembayaran">
                                                <Upload size={12} /> Upload Bukti
                                            </button>
                                            <button onClick={() => handleSendWa(s)} className="btn btn-wa btn-sm" title="Kirim WhatsApp Reminder">
                                                <MessageCircle size={12} /> WA
                                            </button>
                                            {user.role === 'admin' && (
                                                <button onClick={() => handleDeleteStudent(s.id, s.name)} className="btn btn-danger btn-sm" title="Hapus">
                                                    <Trash2 size={12} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {filteredStudents.length === 0 && <tr><td colSpan="6" style={{ textStyle: 'italic', textAlign: 'center', padding: '20px', color: '#64748b' }}>Tidak ada data siswa ditemukan.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Section Pembayaran */}
                <section id="payments" className="card glass" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h2>💳 Daftar Pembayaran</h2>
                        {user.role === 'admin' && payments.length > 0 && (
                            <button className="btn btn-danger btn-sm" onClick={handleClearPayments} title="Hapus semua data pembayaran dummy">
                                <Trash2 size={14} /> Hapus Data Pembayaran Dummy
                            </button>
                        )}
                    </div>


                    <div className="filter-bar">
                        <select className="form-select" value={filterBulan} onChange={e => setFilterBulan(e.target.value)}>
                            <option value="">Semua Bulan</option>
                            {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((b, i) => (
                                <option key={i} value={i + 1}>{b}</option>
                            ))}
                        </select>
                        <select className="form-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                            <option value="">Semua Status</option>
                            <option value="pending">Menunggu</option>
                            <option value="lunas">Lunas</option>
                            <option value="ditolak">Ditolak</option>
                        </select>
                    </div>

                    <div className="table-responsive">
                        <table className="data-table">
                            <thead>
                                <tr><th>Waktu</th><th>Siswa</th><th>Kelas</th><th>Periode</th><th>Status</th><th>Bukti</th><th>Aksi</th></tr>
                            </thead>
                            <tbody>
                                {filteredPayments.map(p => {
                                    const student = students.find(s => s.id === p.student_id);
                                    return (
                                        <tr key={p.id}>
                                            <td style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(p.created_at).toLocaleDateString('id-ID')}</td>
                                            <td>
                                                <strong>{student?.name || 'Siswa'}</strong>
                                                <div style={{ fontSize: '11px', color: '#64748b' }}>{student?.nisn || student?.nis}</div>
                                            </td>
                                            <td><span className="kelas-badge">{student?.kelas || 'X TKR 2'}</span></td>
                                            <td>{p.month}/{p.year}</td>
                                            <td>
                                                {p.status === 'pending' && <span className="badge badge-warning">⏳ Menunggu</span>}
                                                {p.status === 'lunas' && <span className="badge badge-success">✅ Lunas</span>}
                                                {p.status === 'ditolak' && <span className="badge badge-danger">❌ Ditolak</span>}
                                            </td>
                                            <td>
                                                <button
                                                    onClick={() => handleViewProof(p.proof_file, student?.name)}
                                                    className="link-sm"
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                >
                                                    🖼️ Lihat
                                                </button>
                                            </td>
                                            <td>
                                                {p.status === 'pending' && (
                                                    <div style={{ display: 'flex', gap: '6px' }}>
                                                        <button onClick={() => handleConfirm(p.id)} className="btn btn-success btn-sm">✅ Confirm</button>
                                                        <button onClick={() => handleOpenReject(p.id, student?.name)} className="btn btn-danger btn-sm">❌ Reject</button>
                                                    </div>
                                                )}
                                                {p.status === 'lunas' && student && (
                                                    <button onClick={() => generatePaymentPdf(student, p)} className="btn btn-download btn-sm">
                                                        <FileText size={12} /> PDF
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredPayments.length === 0 && <tr><td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>Tidak ada data pembayaran.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>

            {/* Modal Reject */}
            {rejectModal.open && (
                <div className="modal-overlay">
                    <div className="modal-card glass">
                        <h3>❌ Tolak Pembayaran</h3>
                        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '16px' }}>Siswa: {rejectModal.studentName}</p>
                        <form onSubmit={handleConfirmReject}>
                            <div className="form-group">
                                <label>Alasan Penolakan</label>
                                <textarea
                                    className="form-select"
                                    style={{ width: '100%', height: '80px' }}
                                    placeholder="Contoh: Bukti transfer tidak jelas..."
                                    value={rejectModal.reason}
                                    onChange={e => setRejectModal({ ...rejectModal, reason: e.target.value })}
                                    required
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setRejectModal({ open: false, paymentId: null, studentName: '', reason: '' })}>Batal</button>
                                <button type="submit" className="btn btn-danger">Tolak</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Preview Bukti Transfer */}
            {previewModal.open && (
                <div className="modal-overlay" onClick={() => setPreviewModal({ open: false, url: '', type: 'image/png', studentName: '' })}>
                    <div className="modal-card glass" style={{ maxWidth: '640px', width: '90%', padding: '24px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                🖼️ Bukti Transfer {previewModal.studentName ? `— ${previewModal.studentName}` : ''}
                            </h3>
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setPreviewModal({ open: false, url: '', type: 'image/png', studentName: '' })}
                                style={{ padding: '6px' }}
                            >
                                ✖
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
                                download={`bukti-pembayaran-${previewModal.studentName || 'siswa'}`}
                                className="btn btn-primary btn-sm"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                                📥 Unduh / Buka File
                            </a>
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setPreviewModal({ open: false, url: '', type: 'image/png', studentName: '' })}
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Import Excel */}
            {showImportModal && (
                <div className="modal-overlay">
                    <div className="modal-card glass" style={{ maxWidth: '500px' }}>
                        <h3>📥 Import Data Siswa dari Excel</h3>
                        <p style={{ fontSize: '12px', color: '#94a3b8', margin: '8px 0 16px' }}>
                            Upload file Excel (<code>.xlsx</code> / <code>.xls</code>) yang berisi data siswa real.
                        </p>

                        <div style={{ marginBottom: '16px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', fontSize: '12px' }}>
                            <strong>Format Header Kolom Excel:</strong>
                            <div style={{ color: '#818cf8', marginTop: '4px' }}>
                                <code>nisn</code> | <code>name</code> | <code>parent_wa</code> | <code>kelas</code>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Pilih File Excel Data Siswa</label>
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleFileUpload}
                                className="form-select"
                                style={{ width: '100%', padding: '10px' }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
                            <button onClick={downloadTemplate} className="btn btn-ghost btn-sm">
                                📄 Unduh Template Excel
                            </button>
                            <button onClick={() => setShowImportModal(false)} className="btn btn-ghost btn-sm">
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Upload Bukti Pembayaran */}
            {uploadModal.open && (
                <div className="modal-overlay">
                    <div className="modal-card glass" style={{ maxWidth: '400px' }}>
                        <h3>📤 Upload Bukti Pembayaran</h3>
                        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '16px' }}>Siswa: {uploadModal.student?.name}</p>
                        <form onSubmit={handleAdminUpload}>
                            <div className="form-group" style={{ marginBottom: '12px' }}>
                                <label>Bulan Pembayaran</label>
                                <select className="form-select" value={uploadModal.month} onChange={e => setUploadModal({ ...uploadModal, month: parseInt(e.target.value) })}>
                                    {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((b, i) => (
                                        <option key={i} value={i + 1}>{b}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label>Pilih File / Foto</label>
                                <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={(e) => setUploadModal({ ...uploadModal, file: e.target.files[0] })}
                                    required
                                    className="form-select"
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setUploadModal({ open: false, student: null, file: null, month: currentMonth, year: currentYear })}>Batal</button>
                                <button type="submit" className="btn btn-success">Upload & Lunas</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
