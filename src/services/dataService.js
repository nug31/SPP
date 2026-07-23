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

const INITIAL_PAYMENTS = [
    {
        id: 101,
        student_id: 1,
        month: 7,
        year: 2026,
        proof_file: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500&auto=format&fit=crop&q=60',
        status: 'lunas',
        created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
        updated_at: new Date(Date.now() - 4 * 86400000).toISOString()
    },
    {
        id: 102,
        student_id: 2,
        month: 7,
        year: 2026,
        proof_file: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500&auto=format&fit=crop&q=60',
        status: 'pending',
        created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
        updated_at: new Date(Date.now() - 1 * 86400000).toISOString()
    }
];

export const getStudents = () => {
    const data = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    if (!data) {
        localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(INITIAL_STUDENTS));
        return INITIAL_STUDENTS;
    }
    return JSON.parse(data);
};

export const saveStudent = (newStudent) => {
    const students = getStudents();
    const idVal = newStudent.nisn || newStudent.nis;
    const existingIndex = students.findIndex(s => s.nisn === idVal || s.nis === idVal);
    let updated;
    if (existingIndex >= 0) {
        students[existingIndex] = { ...students[existingIndex], ...newStudent, nisn: idVal, nis: idVal };
        updated = students;
    } else {
        const item = {
            id: Date.now(),
            nisn: idVal,
            nis: idVal,
            name: newStudent.name,
            parent_wa: newStudent.parent_wa,
            kelas: newStudent.kelas || 'X TKR 2'
        };
        updated = [...students, item];
    }
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(updated));
    return updated;
};

export const deleteStudent = (id) => {
    const students = getStudents().filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
    return students;
};

export const getPayments = () => {
    const data = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
    if (!data) {
        localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(INITIAL_PAYMENTS));
        return INITIAL_PAYMENTS;
    }
    return JSON.parse(data);
};

export const addPayment = (paymentData) => {
    const payments = getPayments();
    const newPayment = {
        id: Date.now(),
        ...paymentData,
        status: 'pending',
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
