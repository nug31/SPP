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
    console.log('WhatsApp Bot is ready!');
    isReady = true;
});

client.on('authenticated', () => {
    console.log('WhatsApp Authenticated');
});

client.on('auth_failure', msg => {
    console.error('WhatsApp Authentication failure', msg);
});

client.initialize();

const sendMessage = async (number, message) => {
    if (!isReady) {
        console.log('WhatsApp is not ready yet.');
        return false;
    }
    try {
        // Format number to ID format if necessary
        let formattedNumber = number;
        if (formattedNumber.startsWith('0')) {
            formattedNumber = '62' + formattedNumber.substring(1);
        }
        if (!formattedNumber.endsWith('@c.us')) {
            formattedNumber += '@c.us';
        }
        
        await client.sendMessage(formattedNumber, message);
        console.log(`Message sent to ${number}`);
        return true;
    } catch (err) {
        console.error(`Failed to send message to ${number}:`, err);
        return false;
    }
};

module.exports = {
    client,
    sendMessage,
    isReady: () => isReady
};
