// Data Service for SatuSPP React App
// Supports persistent localStorage state & Supabase client integration

const STORAGE_KEYS = {
    STUDENTS: 'satuspp_students',
    PAYMENTS: 'satuspp_payments',
    NOTIFS: 'satuspp_notifications',
    USER: 'satuspp_user'
};

const INITIAL_STUDENTS = [
    { id: 1, nisn: '0051234567', nis: '0051234567', name: 'Ahmad Rizky', parent_wa: '081234567890', kelas: 'X TKR 2' },
    { id: 2, nisn: '0051234568', nis: '0051234568', name: 'Budi Santoso', parent_wa: '081298765432', kelas: 'X TKR 2' },
    { id: 3, nisn: '0051234569', nis: '0051234569', name: 'Citra Dewi', parent_wa: '081311223344', kelas: 'X TKR 2' },
    { id: 4, nisn: '0051234570', nis: '0051234570', name: 'Deni Setiawan', parent_wa: '081455667788', kelas: 'XI TKR 1' },
    { id: 5, nisn: '0051234571', nis: '0051234571', name: 'Eka Putri', parent_wa: '081599887766', kelas: 'XI TKR 1' },
];

// Data pembayaran kosong untuk real data
const INITIAL_PAYMENTS = [];

// Helper untuk membersihkan duplikat & mengurutkan siswa berdasarkan nama
export const deduplicateAndSortStudents = (studentList) => {
    if (!Array.isArray(studentList)) return [];
    const map = new Map();
    const usedIds = new Set();
    
    studentList.forEach(s => {
        const nisnVal = String(s.nisn || s.nis || '').trim();
        const nameVal = String(s.name || '').trim();
        if (!nameVal && !nisnVal) return;

        // Gunakan key NISN jika ada, jika tidak pakai Name
        const key = nisnVal ? nisnVal.toLowerCase() : nameVal.toLowerCase();
        if (!map.has(key)) {
            let uniqueId = s.id;
            if (!uniqueId) uniqueId = Date.now();
            
            // Fix ID Collisions (for corrupted data where students share same ID)
            while (usedIds.has(uniqueId)) {
                uniqueId = typeof uniqueId === 'number' 
                    ? uniqueId + Math.floor(Math.random() * 10000) + 1 
                    : uniqueId + '_' + Math.random().toString(36).substr(2, 5);
            }
            usedIds.add(uniqueId);

            map.set(key, {
                ...s,
                id: uniqueId,
                nisn: nisnVal,
                nis: nisnVal,
                name: nameVal,
                parent_wa: String(s.parent_wa || '').trim(),
                kelas: String(s.kelas || 'X TKR 2').trim()
            });
        }
    });

    const result = Array.from(map.values());
    // Urutkan berdasarkan Nama Siswa (A-Z)
    result.sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));
    return result;
};

export const getStudents = () => {
    const data = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    if (!data) {
        const initialSorted = deduplicateAndSortStudents(INITIAL_STUDENTS);
        localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(initialSorted));
        return initialSorted;
    }
    try {
        const parsed = JSON.parse(data);
        const cleaned = deduplicateAndSortStudents(parsed);
        // Sync kembali jika jumlah berubah karena deduplikasi
        if (cleaned.length !== parsed.length) {
            localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(cleaned));
        }
        return cleaned;
    } catch {
        return [];
    }
};

export const saveStudent = (newStudent) => {
    const students = getStudents();
    const idVal = String(newStudent.nisn || newStudent.nis || '').trim();
    const nameVal = String(newStudent.name || '').trim();

    const existingIndex = students.findIndex(s => 
        (idVal && (s.nisn === idVal || s.nis === idVal)) || 
        (s.name.toLowerCase() === nameVal.toLowerCase())
    );

    let updated;
    if (existingIndex >= 0) {
        students[existingIndex] = {
            ...students[existingIndex],
            ...newStudent,
            nisn: idVal || students[existingIndex].nisn,
            nis: idVal || students[existingIndex].nis,
            name: nameVal || students[existingIndex].name,
            parent_wa: String(newStudent.parent_wa || students[existingIndex].parent_wa).trim(),
            kelas: String(newStudent.kelas || students[existingIndex].kelas).trim()
        };
        updated = students;
    } else {
        const item = {
            id: Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9),
            nisn: idVal,
            nis: idVal,
            name: nameVal,
            parent_wa: String(newStudent.parent_wa || '').trim(),
            kelas: String(newStudent.kelas || 'X TKR 2').trim()
        };
        updated = [...students, item];
    }
    const finalCleaned = deduplicateAndSortStudents(updated);
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(finalCleaned));
    return finalCleaned;
};

export const deleteStudent = (id) => {
    const students = getStudents().filter(s => s.id !== id);
    const cleaned = deduplicateAndSortStudents(students);
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(cleaned));
    return cleaned;
};

export const deduplicateStudents = () => {
    const current = getStudents();
    const cleaned = deduplicateAndSortStudents(current);
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(cleaned));
    return cleaned;
};

export const getPayments = () => {
    const data = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
    if (!data) {
        localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(INITIAL_PAYMENTS));
        return INITIAL_PAYMENTS;
    }
    try {
        const parsed = JSON.parse(data);
        // Hapus data dummy jika ada (misal payment id 101/102 yang menunjuk ke dummy data)
        const realPayments = parsed.filter(p => p.id !== 101 && p.id !== 102);
        if (realPayments.length !== parsed.length) {
            localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(realPayments));
        }
        return realPayments;
    } catch {
        return [];
    }
};

export const clearAllPayments = () => {
    localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.NOTIFS, JSON.stringify([]));
    return [];
};

export const addPayment = (paymentData) => {
    const payments = getPayments();
    const newPayment = {
        id: Date.now(),
        ...paymentData,
        status: paymentData.status || 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
    const updated = [newPayment, ...payments];
    localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(updated));

    // Notifikasi
    addNotification({
        type: 'upload',
        student_id: paymentData.student_id,
        payment_id: newPayment.id,
        message: `Bukti transfer baru diunggah untuk bulan ${paymentData.month}/${paymentData.year}`,
        target_role: 'admin'
    });

    return newPayment;
};

export const updatePaymentStatus = (paymentId, status, reason = '') => {
    const payments = getPayments();
    const index = payments.findIndex(p => p.id === paymentId);
    if (index >= 0) {
        payments[index].status = status;
        payments[index].updated_at = new Date().toISOString();
        if (reason) payments[index].reject_reason = reason;
        localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));

        // Add Notification
        const student = getStudents().find(s => s.id === payments[index].student_id);
        addNotification({
            type: status,
            student_id: payments[index].student_id,
            payment_id: paymentId,
            message: `Pembayaran SPP ${payments[index].month}/${payments[index].year} (${student?.name || 'Siswa'}) status: ${status.toUpperCase()} ${reason ? '— ' + reason : ''}`,
            target_role: 'orang_tua'
        });
    }
    return getPayments();
};

export const getNotifications = () => {
    const data = localStorage.getItem(STORAGE_KEYS.NOTIFS);
    return data ? JSON.parse(data) : [];
};

export const addNotification = (notif) => {
    const notifs = getNotifications();
    const item = {
        id: Date.now(),
        ...notif,
        is_read: false,
        created_at: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEYS.NOTIFS, JSON.stringify([item, ...notifs]));
};

export const markNotificationsRead = (role) => {
    const notifs = getNotifications().map(n => n.target_role === role ? { ...n, is_read: true } : n);
    localStorage.setItem(STORAGE_KEYS.NOTIFS, JSON.stringify(notifs));
};

export const getCurrentUser = () => {
    const data = localStorage.getItem(STORAGE_KEYS.USER);
    return data ? JSON.parse(data) : null;
};

export const setCurrentUser = (user) => {
    if (!user) localStorage.removeItem(STORAGE_KEYS.USER);
    else localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
};

