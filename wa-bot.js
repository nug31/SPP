const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

let isReady = false;

client.on('qr', (qr) => {
    console.log('SCAN QR CODE INI DENGAN WHATSAPP ANDA:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ WhatsApp Bot is ready!');
    isReady = true;
});

client.on('authenticated', () => {
    console.log('WhatsApp Authenticated');
});

client.on('auth_failure', msg => {
    console.error('WhatsApp Authentication failure', msg);
});

client.initialize();

// Format nomor ke format WhatsApp
const formatNumber = (number) => {
    let n = String(number).trim();
    if (n.startsWith('0')) n = '62' + n.substring(1);
    if (!n.endsWith('@c.us')) n += '@c.us';
    return n;
};

// Kirim pesan WA umum
const sendMessage = async (number, message) => {
    if (!isReady) {
        console.log('WhatsApp is not ready yet.');
        return false;
    }
    try {
        await client.sendMessage(formatNumber(number), message);
        console.log(`📨 WA sent to ${number}`);
        return true;
    } catch (err) {
        console.error(`❌ WA failed to ${number}:`, err.message);
        return false;
    }
};

const bulanNama = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// Notifikasi: Pembayaran dikonfirmasi LUNAS
const sendPaymentApproved = (number, studentName, month, year) => {
    const msg = `✅ *PEMBAYARAN SPP DIKONFIRMASI LUNAS*\n\n` +
        `Halo Bapak/Ibu Wali Murid dari *${studentName}*.\n\n` +
        `Pembayaran SPP bulan *${bulanNama[month]} ${year}* sebesar *Rp 700.000* telah kami konfirmasi *LUNAS*.\n\n` +
        `Anda dapat mengunduh bukti lunas melalui Portal SPP Sekolah.\n\n` +
        `Terima kasih atas kepercayaan Anda 🙏`;
    return sendMessage(number, msg);
};

// Notifikasi: Pembayaran DITOLAK
const sendPaymentRejected = (number, studentName, month, year, reason) => {
    const msg = `❌ *PEMBAYARAN SPP DITOLAK*\n\n` +
        `Halo Bapak/Ibu Wali Murid dari *${studentName}*.\n\n` +
        `Mohon maaf, bukti pembayaran SPP bulan *${bulanNama[month]} ${year}* yang Anda kirimkan *tidak dapat diterima*.\n\n` +
        `*Alasan:* ${reason || 'Bukti tidak jelas / tidak valid'}\n\n` +
        `Mohon unggah ulang bukti transfer yang valid melalui Portal SPP Sekolah.\n\n` +
        `Jika ada pertanyaan, hubungi pihak sekolah. Terima kasih 🙏`;
    return sendMessage(number, msg);
};

// Reminder belum bayar
const sendPaymentReminder = (number, studentName, daysLeft) => {
    const msg = `⏰ *PENGINGAT PEMBAYARAN SPP*\n\n` +
        `Halo Bapak/Ibu Wali Murid dari *${studentName}*.\n\n` +
        `Pembayaran SPP bulan ini sebesar *Rp 700.000* akan jatuh tempo pada tanggal *8* ` +
        `(_${daysLeft} hari lagi_).\n\n` +
        `Mohon segera melakukan pembayaran dan mengunggah bukti melalui Portal SPP Sekolah.\n\n` +
        `Terima kasih 🙏`;
    return sendMessage(number, msg);
};

// Reminder masih pending (menunggu verifikasi)
const sendPendingReminder = (number, studentName) => {
    const msg = `🔄 *INFO STATUS PEMBAYARAN SPP*\n\n` +
        `Halo Bapak/Ibu Wali Murid dari *${studentName}*.\n\n` +
        `Bukti pembayaran SPP bulan ini sudah kami terima dan *sedang dalam proses verifikasi* oleh admin.\n\n` +
        `Kami akan menginformasikan hasilnya segera. Terima kasih atas kesabaran Anda 🙏`;
    return sendMessage(number, msg);
};

module.exports = {
    client,
    sendMessage,
    sendPaymentApproved,
    sendPaymentRejected,
    sendPaymentReminder,
    sendPendingReminder,
    isReady: () => isReady
};
