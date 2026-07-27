import { supabase } from './supabaseClient';

export const getStudents = async () => {
    try {
        const { data, error } = await supabase.from('students').select('*').order('name', { ascending: true });
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Error fetching students:', err);
        return [];
    }
};

export const saveStudent = async (newStudent) => {
    try {
        const idVal = String(newStudent.nisn || newStudent.nis || '').trim();
        const { data, error } = await supabase
            .from('students')
            .upsert({
                nisn: idVal,
                nis: idVal,
                name: String(newStudent.name || '').trim(),
                parent_wa: String(newStudent.parent_wa || '').trim(),
                kelas: String(newStudent.kelas || 'X TKR 2').trim()
            }, { onConflict: 'nisn' })
            .select();
        if (error) throw error;
        return await getStudents();
    } catch (err) {
        console.error('Error saving student:', err);
        return [];
    }
};

export const deleteStudent = async (id) => {
    try {
        await supabase.from('payments').delete().eq('student_id', id);
        const { error } = await supabase.from('students').delete().eq('id', id);
        if (error) throw error;
        return await getStudents();
    } catch (err) {
        console.error('Error deleting student:', err);
        return [];
    }
};

export const deduplicateStudents = async () => {
    return await getStudents();
};

export const getPayments = async () => {
    try {
        const { data, error } = await supabase
            .from('payments')
            .select('*, students(name, nisn, nis, kelas, parent_wa)')
            .order('created_at', { ascending: false });
        if (error) throw error;
        
        return (data || []).map(p => ({
            ...p,
            name: p.students?.name || '-',
            nisn: p.students?.nisn || p.students?.nis || '-',
            nis: p.students?.nisn || p.students?.nis || '-',
            kelas: p.students?.kelas || '-',
            parent_wa: p.students?.parent_wa || ''
        }));
    } catch (err) {
        console.error('Error fetching payments:', err);
        return [];
    }
};

export const clearAllPayments = async () => {
    try {
        await supabase.from('payments').delete().neq('id', 0);
        return [];
    } catch (err) {
        console.error('Error clearing payments:', err);
        return [];
    }
};

export const deletePayment = async (id) => {
    try {
        const { error } = await supabase.from('payments').delete().eq('id', id);
        if (error) throw error;
        return await getPayments();
    } catch (err) {
        console.error('Error deleting payment:', err);
        return [];
    }
};

export const addPayment = async (paymentData) => {
    try {
        const newPayment = {
            student_id: paymentData.student_id,
            month: paymentData.month,
            year: paymentData.year,
            proof_file: paymentData.proof_file,
            status: paymentData.status || 'pending'
        };
        const { data, error } = await supabase.from('payments').insert([newPayment]).select();
        if (error) throw error;
        
        await addNotification({
            type: 'upload',
            student_id: paymentData.student_id,
            payment_id: data[0].id,
            message: `Bukti transfer baru diunggah untuk bulan ${paymentData.month}/${paymentData.year}`,
            target_role: 'admin'
        });

        return data[0];
    } catch (err) {
        console.error('Error adding payment:', err);
        return null;
    }
};

export const updatePaymentStatus = async (paymentId, status, reason = '') => {
    try {
        const updateData = { status, updated_at: new Date().toISOString() };
        if (reason) updateData.reject_reason = reason;
        
        const { error } = await supabase.from('payments').update(updateData).eq('id', paymentId);
        if (error) throw error;

        // Fetch payment to get student details for notification
        const { data: payment } = await supabase.from('payments').select('*, students(name)').eq('id', paymentId).single();
        if (payment) {
            await addNotification({
                type: status,
                student_id: payment.student_id,
                payment_id: paymentId,
                message: `Pembayaran SPP ${payment.month}/${payment.year} (${payment.students?.name || 'Siswa'}) status: ${status.toUpperCase()} ${reason ? '— ' + reason : ''}`,
                target_role: 'orang_tua'
            });
        }
        return await getPayments();
    } catch (err) {
        console.error('Error updating payment status:', err);
        return [];
    }
};

export const getNotifications = async () => {
    try {
        const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Error fetching notifications:', err);
        return [];
    }
};

export const addNotification = async (notif) => {
    try {
        const item = {
            type: notif.type,
            student_id: notif.student_id,
            payment_id: notif.payment_id,
            message: notif.message,
            target_role: notif.target_role,
            is_read: false
        };
        await supabase.from('notifications').insert([item]);
    } catch (err) {
        console.error('Error adding notification:', err);
    }
};

export const markNotificationsRead = async (role) => {
    try {
        await supabase.from('notifications').update({ is_read: true }).eq('target_role', role);
    } catch (err) {
        console.error('Error marking notifications as read:', err);
    }
};

export const getCurrentUser = () => {
    // User session remains in localStorage for simplicity on frontend
    const data = localStorage.getItem('satuspp_user');
    return data ? JSON.parse(data) : null;
};

export const setCurrentUser = (user) => {
    if (!user) localStorage.removeItem('satuspp_user');
    else localStorage.setItem('satuspp_user', JSON.stringify(user));
};
