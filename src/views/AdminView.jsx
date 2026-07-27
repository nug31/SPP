import React, { useState, useEffect } from 'react';
import { getStudents, getPayments, updatePaymentStatus, saveStudent, deleteStudent, clearAllPayments, deduplicateStudents, addPayment, deletePayment, importStudents } from '../services/dataService';
import { generatePaymentPdf } from '../utils/pdfGenerator';
import { Users, CheckCircle2, Clock, XCircle, DollarSign, Search, Plus, MessageCircle, Trash2, FileText, Upload, FileSpreadsheet, RefreshCw, Sparkles, Check } from 'lucide-react';
import * as XLSX from 'xlsx';
import Tesseract from 'tesseract.js';

export default function AdminView({ user, onShowToast }) {
    const [students, setStudents] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterKelas, setFilterKelas] = useState('');
    const [filterBulan, setFilterBulan] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showMasterModal, setShowMasterModal] = useState(false);
    const [selectedExcelFile, setSelectedExcelFile] = useState(null);
    const [importing, setImporting] = useState(false);
    const [newStudent, setNewStudent] = useState({ nisn: '', name: '', parent_wa: '', kelas: 'X TKR 2' });

    // Reject Modal state
    const [rejectModal, setRejectModal] = useState({ open: false, paymentId: null, studentName: '', reason: '' });
    // Preview Proof Modal state
    const [previewModal, setPreviewModal] = useState({ open: false, url: '', type: 'image/png', studentName: '' });
    // Upload Modal state & OCR auto-detection state
    const [uploadModal, setUploadModal] = useState({ open: false, student: null, file: null, month: new Date().getMonth() + 1, year: new Date().getFullYear() });
    const [ocrScanning, setOcrScanning] = useState(false);
    const [ocrMatchStatus, setOcrMatchStatus] = useState(null);

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const refreshData = async () => {
        setLoading(true);
        try {
            const [st, pa] = await Promise.all([getStudents(), getPayments()]);
            setStudents(st);
            setPayments(pa);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshData();
    }, []);

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

    // Handle File Change with AI OCR Auto-Detection
    const handleReceiptFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadModal(prev => ({ ...prev, file }));
        setOcrMatchStatus(null);

        // Run OCR if file is an image
        if (file.type.startsWith('image/')) {
            setOcrScanning(true);
            try {
                const worker = await Tesseract.createWorker('eng');
                const ret = await worker.recognize(file);
                await worker.terminate();

                const text = (ret.data.text || '').toLowerCase();

                let matchedStudent = null;
                let highestScore = 0;

                for (const s of students) {
                    const fullName = (s.name || '').toLowerCase();
                    const nameParts = fullName.split(/\s+/).filter(p => p.length > 2);
                    const nisn = (s.nisn || s.nis || '').toLowerCase();

                    let score = 0;

                    if (nisn && nisn.length > 3 && text.includes(nisn)) {
                        score += 100;
                    }

                    if (fullName && text.includes(fullName)) {
                        score += 80;
                    } else {
                        for (const part of nameParts) {
                            if (text.includes(part)) {
                                score += 25;
                            }
                        }
                    }

                    if (score > highestScore && score >= 25) {
                        highestScore = score;
                        matchedStudent = s;
                    }
                }

                if (matchedStudent) {
                    setUploadModal(prev => ({ ...prev, student: matchedStudent }));
                    setOcrMatchStatus({
                        found: true,
                        studentName: matchedStudent.name,
                        score: highestScore
                    });
                    onShowToast(`✨ Terdeteksi Otomatis: ${matchedStudent.name}`, 'success');
                } else {
                    setOcrMatchStatus({ found: false });
                }
            } catch (err) {
                console.error('OCR Error:', err);
                setOcrMatchStatus({ found: false });
            } finally {
                setOcrScanning(false);
            }
        }
    };

    // Handle Excel File Import
    const handleExecuteImport = () => {
        if (!selectedExcelFile) {
            onShowToast('⚠️ Silakan pilih file Excel terlebih dahulu.', 'warning');
            return;
        }

        setImporting(true);
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (!data || data.length === 0) {
                    setImporting(false);
                    onShowToast('⚠️ File Excel kosong atau tidak terbaca.', 'warning');
                    return;
                }

                // Parse student data with flexible header matching
                const parsedStudents = data.map(row => {
                    const keys = Object.keys(row);
                    const nameKey = keys.find(k => /nama|name/i.test(k));
                    const nisnKey = keys.find(k => /nisn|nis/i.test(k));
                    const waKey = keys.find(k => /wa|phone|hp|telepon|parent_wa/i.test(k));
                    const kelasKey = keys.find(k => /kelas|class/i.test(k));

                    return {
                        name: nameKey ? String(row[nameKey] || '').trim() : '',
                        nisn: nisnKey ? String(row[nisnKey] || '').trim() : '',
                        parent_wa: waKey ? String(row[waKey] || '').trim() : '',
                        kelas: kelasKey ? String(row[kelasKey] || '').trim() : 'X TKR 2'
                    };
                }).filter(item => item.name || item.nisn);

                if (parsedStudents.length === 0) {
                    setImporting(false);
                    onShowToast('⚠️ Tidak ada kolom Nama atau NISN yang ditemukan pada Excel.', 'warning');
                    return;
                }

                const processExcel = async () => {
                    const result = await importStudents(parsedStudents);
                    await refreshData();
                    setImporting(false);
                    setSelectedExcelFile(null);
                    setShowImportModal(false);

                    if (result.error) {
                        onShowToast(`⚠️ Gagal simpan ke Supabase (Status 401/RLS). Silakan jalankan SQL pengaktifan akses di Supabase SQL Editor.`, 'danger');
                    } else {
                        onShowToast(`✅ Berhasil mengimpor ${result.count} data siswa dari Excel ke Supabase!`, 'success');
                    }
                };
                processExcel();
            } catch (err) {
                console.error(err);
                setImporting(false);
                onShowToast('❌ Gagal membaca file Excel. Pastikan format file (.xlsx) benar.', 'danger');
            }
        };
        reader.readAsBinaryString(selectedExcelFile);
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
    const handleCleanStudents = async () => {
        await deduplicateStudents();
        await refreshData();
        onShowToast(`🔄 Berhasil merapikan data.`, 'success');
    };

    // Clear All Payments Action
    const handleClearPayments = async () => {
        if (window.confirm('Yakin ingin menghapus seluruh data pembayaran dummy? Data pembayaran akan menjadi kosong dan siap diisi data real.')) {
            await clearAllPayments();
            await refreshData();
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

    // Calculate Unpaid Students for target month
    const targetMonth = filterBulan ? parseInt(filterBulan) : currentMonth;
    const paidStudentIds = new Set(
        payments
            .filter(p => p.month === targetMonth && p.year === currentYear && (p.status === 'lunas' || p.status === 'pending'))
            .map(p => p.student_id)
    );

    const unpaidStudents = students
        .filter(s => {
            const isUnpaid = !paidStudentIds.has(s.id);
            const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.nisn || s.nis || '').includes(search);
            const matchKelas = !filterKelas || s.kelas === filterKelas;
            return isUnpaid && matchSearch && matchKelas;
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));

    // Stats Calculation (Dynamic for selected month or overall)
    const bulanNamaList = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    
    const relevantPayments = filterBulan 
        ? payments.filter(p => p.month === parseInt(filterBulan))
        : payments;

    const lunasCount = relevantPayments.filter(p => p.status === 'lunas').length;
    const pendingCount = relevantPayments.filter(p => p.status === 'pending').length;
    const belumCount = Math.max(0, students.length - lunasCount);
    const totalTerkumpul = lunasCount * 700000;

    const labelLunas = filterBulan ? `Lunas Bulan ${bulanNamaList[filterBulan]}` : 'Total Transaksi Lunas';
    const labelPending = filterBulan ? `Menunggu (Bulan ${bulanNamaList[filterBulan]})` : 'Menunggu Verifikasi';
    const labelBelum = filterBulan ? `Belum Bayar (Bulan ${bulanNamaList[filterBulan]})` : 'Belum Lunas';
    const labelTerkumpul = filterBulan ? `Terkumpul Bulan ${bulanNamaList[filterBulan]}` : 'Total Terkumpul';

    const handleConfirm = async (id) => {
        await updatePaymentStatus(id, 'lunas');
        await refreshData();
        onShowToast('✅ Pembayaran berhasil dikonfirmasi LUNAS!', 'success');
    };

    const handleOpenReject = (id, name) => {
        setRejectModal({ open: true, paymentId: id, studentName: name, reason: '' });
    };

    const handleConfirmReject = async (e) => {
        e.preventDefault();
        await updatePaymentStatus(rejectModal.paymentId, 'ditolak', rejectModal.reason);
        setRejectModal({ open: false, paymentId: null, studentName: '', reason: '' });
        await refreshData();
        onShowToast('❌ Pembayaran telah ditolak.', 'danger');
    };

    const handleAddStudent = async (e) => {
        e.preventDefault();
        await saveStudent(newStudent);
        setNewStudent({ nisn: '', name: '', parent_wa: '', kelas: 'X TKR 2' });
        setShowAddForm(false);
        await refreshData();
        onShowToast('✅ Data siswa berhasil ditambahkan & diurutkan!', 'success');
    };

    const handleDeleteStudent = async (id, name) => {
        if (window.confirm(`Yakin hapus siswa ${name}?`)) {
            await deleteStudent(id);
            await refreshData();
            onShowToast('🗑️ Data siswa telah dihapus.', 'info');
        }
    };

    const handleDeletePayment = async (id) => {
        if (window.confirm('Yakin ingin menghapus data pembayaran ini?')) {
            await deletePayment(id);
            await refreshData();
            onShowToast('🗑️ Data pembayaran telah dihapus.', 'info');
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
                        <div className="stat-info"><div className="stat-num">{lunasCount}</div><div className="stat-label">{labelLunas}</div></div>
                    </div>
                    <div className="stat-card stat-yellow">
                        <div className="stat-icon"><Clock color="#f59e0b" size={28} /></div>
                        <div className="stat-info"><div className="stat-num">{pendingCount}</div><div className="stat-label">{labelPending}</div></div>
                    </div>
                    <div className="stat-card stat-red">
                        <div className="stat-icon"><XCircle color="#ef4444" size={28} /></div>
                        <div className="stat-info"><div className="stat-num">{belumCount}</div><div className="stat-label">{labelBelum}</div></div>
                    </div>
                    <div className="stat-card stat-purple">
                        <div className="stat-icon"><DollarSign color="#c084fc" size={28} /></div>
                        <div className="stat-info"><div className="stat-num">Rp {totalTerkumpul.toLocaleString('id-ID')}</div><div className="stat-label">{labelTerkumpul}</div></div>
                    </div>
                </div>

                {/* Action Bar & Global Filters */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '280px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', padding: '8px 14px', borderRadius: '10px' }}>
                            <Search size={16} color="#94a3b8" />
                            <input type="text" placeholder="🔍 Cari nama siswa atau NISN..." value={search} onChange={e => setSearch(e.target.value)} style={{ background: 'none', border: 'none', color: '#fff', width: '100%', outline: 'none' }} />
                        </div>
                        <select className="form-select" value={filterKelas} onChange={e => setFilterKelas(e.target.value)} style={{ width: '150px' }}>
                            <option value="">Semua Kelas</option>
                            {kelasList.map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                        <select className="form-select" value={filterBulan} onChange={e => setFilterBulan(e.target.value)} style={{ width: '150px' }}>
                            <option value="">Semua Bulan</option>
                            {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((b, i) => (
                                <option key={i} value={i + 1}>{b}</option>
                            ))}
                        </select>
                    </div>

                    {user.role === 'admin' && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-primary" onClick={() => { setUploadModal({ open: true, student: null, file: null, month: targetMonth, year: currentYear }); setOcrMatchStatus(null); }}>
                                <Sparkles size={16} /> Upload Bukti TF (Auto AI Detect)
                            </button>
                            <button className="btn btn-ghost" onClick={() => setShowMasterModal(true)}>
                                📁 Master Data Siswa ({students.length})
                            </button>
                        </div>
                    )}
                </div>

                {/* Section 1: Data Siswa Sudah Bayar & Verifikasi */}
                <section id="payments" className="card glass" style={{ padding: '24px', marginBottom: '28px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h2>✅ Status Pembayaran Siswa ({filteredPayments.length})</h2>
                        {user.role === 'admin' && payments.length > 0 && (
                            <button className="btn btn-danger btn-sm" onClick={handleClearPayments} title="Hapus semua data pembayaran dummy">
                                <Trash2 size={14} /> Hapus Data Pembayaran Dummy
                            </button>
                        )}
                    </div>

                    <div className="table-responsive">
                        <table className="data-table">
                            <thead>
                                <tr><th>Waktu</th><th>Nama Siswa</th><th>Kelas</th><th>Periode</th><th>Status</th><th>Bukti Transfer</th><th>Aksi</th></tr>
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
                                                {p.status === 'lunas' && (
                                                    <div style={{ display: 'flex', gap: '6px' }}>
                                                        {student && (
                                                            <button onClick={() => generatePaymentPdf(student, p)} className="btn btn-download btn-sm">
                                                                <FileText size={12} /> PDF
                                                            </button>
                                                        )}
                                                        {user.role === 'admin' && (
                                                            <button onClick={() => handleDeletePayment(p.id)} className="btn btn-danger btn-sm" title="Hapus">
                                                                <Trash2 size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredPayments.length === 0 && <tr><td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>Belum ada transaksi pembayaran pada periode ini.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Section 2: Data Siswa Belum Bayar */}
                <section id="unpaid" className="card glass" style={{ padding: '24px', marginBottom: '28px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h2 style={{ color: '#f87171' }}>⚠️ Daftar Siswa Belum Bayar — Bulan {bulanNamaList[targetMonth]} ({unpaidStudents.length} Siswa)</h2>
                    </div>

                    <div className="table-responsive">
                        <table className="data-table">
                            <thead>
                                <tr><th>#</th><th>NISN</th><th>Nama Siswa</th><th>Kelas</th><th>No WA Ortu</th><th>Aksi Cepat</th></tr>
                            </thead>
                            <tbody>
                                {unpaidStudents.map((s, i) => (
                                    <tr key={s.id}>
                                        <td>{i + 1}</td>
                                        <td><code>{s.nisn || s.nis}</code></td>
                                        <td><strong>{s.name}</strong></td>
                                        <td><span className="kelas-badge">{s.kelas || 'X TKR 2'}</span></td>
                                        <td>{s.parent_wa}</td>
                                        <td style={{ display: 'flex', gap: '6px' }}>
                                            <button onClick={() => setUploadModal({ open: true, student: s, file: null, month: targetMonth, year: currentYear })} className="btn btn-success btn-sm" title="Input Pembayaran">
                                                <Upload size={12} /> Upload Bukti
                                            </button>
                                            <button onClick={() => handleSendWa(s)} className="btn btn-wa btn-sm" title="Kirim WhatsApp Reminder">
                                                <MessageCircle size={12} /> Kirim WA
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {unpaidStudents.length === 0 && (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: '#34d399' }}>
                                            🎉 Luar biasa! Seluruh siswa telah melunasi pembayaran SPP untuk bulan ini.
                                        </td>
                                    </tr>
                                )}
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

            {/* Modal Master Data Siswa (Di Database) */}
            {showMasterModal && (
                <div className="modal-overlay" onClick={() => setShowMasterModal(false)}>
                    <div className="modal-card glass" style={{ maxWidth: '800px', width: '95%', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px' }}>📁 Master Data Siswa (Database: {students.length} Siswa)</h3>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn btn-ghost btn-sm" onClick={handleCleanStudents} title="Urutkan nama A-Z">
                                    <RefreshCw size={14} color="#6366f1" /> Clean A-Z
                                </button>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowImportModal(true)}>
                                    <FileSpreadsheet size={14} color="#10b981" /> Import Excel
                                </button>
                                <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(!showAddForm)}>
                                    <Plus size={14} /> Tambah Siswa
                                </button>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowMasterModal(false)}>✖</button>
                            </div>
                        </div>

                        {showAddForm && (
                            <form onSubmit={handleAddStudent} className="glass-inner" style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '10px', alignItems: 'end', padding: '12px' }}>
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

                        <div className="table-responsive">
                            <table className="data-table">
                                <thead>
                                    <tr><th>#</th><th>NISN</th><th>Nama Siswa</th><th>Kelas</th><th>No WA Ortu</th><th>Aksi</th></tr>
                                </thead>
                                <tbody>
                                    {students.map((s, i) => (
                                        <tr key={s.id}>
                                            <td>{i + 1}</td>
                                            <td><code>{s.nisn || s.nis}</code></td>
                                            <td><strong>{s.name}</strong></td>
                                            <td><span className="kelas-badge">{s.kelas || 'X TKR 2'}</span></td>
                                            <td>{s.parent_wa}</td>
                                            <td>
                                                {user.role === 'admin' && (
                                                    <button onClick={() => handleDeleteStudent(s.id, s.name)} className="btn btn-danger btn-sm" title="Hapus">
                                                        <Trash2 size={12} /> Hapus
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Import Excel */}
            {showImportModal && (
                <div className="modal-overlay">
                    <div className="modal-card glass" style={{ maxWidth: '520px' }}>
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
                                onChange={e => setSelectedExcelFile(e.target.files[0] || null)}
                                className="form-select"
                                style={{ width: '100%', padding: '10px' }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
                            <button onClick={downloadTemplate} className="btn btn-ghost btn-sm">
                                📄 Unduh Template Excel
                            </button>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => { setShowImportModal(false); setSelectedExcelFile(null); }} className="btn btn-ghost btn-sm">
                                    Batal
                                </button>
                                <button onClick={handleExecuteImport} className="btn btn-success btn-sm" disabled={!selectedExcelFile || importing}>
                                    {importing ? '⏳ Mengimpor...' : '🚀 Import Data'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Upload Bukti Pembayaran */}
            {uploadModal.open && (
                <div className="modal-overlay">
                    <div className="modal-card glass" style={{ maxWidth: '440px' }}>
                        <h3>📤 Upload Bukti Pembayaran</h3>
                        <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>
                            Upload foto resi/bukti transfer m-banking. Sistem akan otomatis mendeteksi nama siswa!
                        </p>

                        <form onSubmit={(e) => {
                            e.preventDefault();
                            if (!uploadModal.file || !uploadModal.student) {
                                onShowToast('⚠️ Silakan pilih file dan siswa terlebih dahulu.', 'warning');
                                return;
                            }
                            const reader = new FileReader();
                            reader.onloadend = async () => {
                                await addPayment({
                                    student_id: uploadModal.student.id,
                                    month: uploadModal.month,
                                    year: uploadModal.year,
                                    proof_file: reader.result,
                                    status: 'lunas'
                                });
                                setUploadModal({ open: false, student: null, file: null, month: currentMonth, year: currentYear });
                                setOcrMatchStatus(null);
                                await refreshData();
                                onShowToast('✅ Bukti pembayaran berhasil diunggah & status lunas.', 'success');
                            };
                            reader.readAsDataURL(uploadModal.file);
                        }}>
                            {/* File Picker first for OCR auto-detection */}
                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label>Pilih Foto Resi / Bukti Transfer</label>
                                <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={handleReceiptFileChange}
                                    required
                                    className="form-select"
                                />
                                {ocrScanning && (
                                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <RefreshCw size={14} className="spin" /> 🤖 Mengakses AI OCR untuk mendeteksi nama di foto resi...
                                    </div>
                                )}
                                {ocrMatchStatus?.found && (
                                    <div style={{ marginTop: '8px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Sparkles size={14} /> Terdeteksi Otomatis: <strong>{ocrMatchStatus.studentName}</strong>
                                    </div>
                                )}
                                {ocrMatchStatus && !ocrMatchStatus.found && !ocrScanning && (
                                    <div style={{ marginTop: '8px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid #f59e0b', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', color: '#fbbf24' }}>
                                        ℹ️ Nama tidak otomatis terdeteksi. Silakan pilih siswa secara manual di bawah.
                                    </div>
                                )}
                            </div>

                            <div className="form-group" style={{ marginBottom: '12px' }}>
                                <label>Nama Siswa</label>
                                <select
                                    className="form-select"
                                    value={uploadModal.student?.id || ''}
                                    onChange={e => {
                                        const selectedId = parseInt(e.target.value);
                                        const found = students.find(s => s.id === selectedId);
                                        setUploadModal({ ...uploadModal, student: found || null });
                                    }}
                                    required
                                >
                                    <option value="">-- Pilih Siswa --</option>
                                    {students.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.kelas || 'X TKR 2'}) - NISN: {s.nisn || s.nis}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label>Bulan Pembayaran</label>
                                <select className="form-select" value={uploadModal.month} onChange={e => setUploadModal({ ...uploadModal, month: parseInt(e.target.value) })}>
                                    {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((b, i) => (
                                        <option key={i} value={i + 1}>{b}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => { setUploadModal({ open: false, student: null, file: null, month: currentMonth, year: currentYear }); setOcrMatchStatus(null); }}>Batal</button>
                                <button type="submit" className="btn btn-success" disabled={ocrScanning || !uploadModal.student || !uploadModal.file}>
                                    Upload & Set Lunas
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
