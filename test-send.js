require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const usernamesStr = process.env.EMPLOYEE_USERNAMES || '';

if (!token || token === 'YOUR_BOT_TOKEN_HERE') {
  console.error('LỖI: Vui lòng cấu hình TELEGRAM_BOT_TOKEN trong file .env');
  process.exit(1);
}

if (!chatId || chatId === 'YOUR_CHAT_ID_HERE') {
  console.error('LỖI: Vui lòng cấu hình TELEGRAM_CHAT_ID trong file .env trước khi chạy test.');
  process.exit(1);
}

console.log('=== CHẠY THỬ NGHIỆM GỬI LỜI NHẮC TELEGRAM ===');
console.log(`Bot Token: ${token.substring(0, 10)}...`);
console.log(`Chat ID target: ${chatId}`);

const usernames = usernamesStr
  .split(',')
  .map(name => name.trim())
  .filter(name => name.length > 0)
  .map(name => name.startsWith('@') ? name : `@${name}`);

const tagList = usernames.join(' ');

const message = `🔔 **THÔNG BÁO LỜI NHẮC HÀNG NGÀY (THỬ NGHIỆM)** 🔔\n\n` +
               `Chào buổi sáng mọi người! ☀️\n` +
               `Đây là tin nhắn chạy thử nghiệm hệ thống nhắc nhở.\n\n` +
               `${tagList ? `Xin chào các bạn: ${tagList}` : 'Chúc cả nhóm làm việc hiệu quả!'}`;

const bot = new TelegramBot(token, { polling: false });

console.log('Đang gửi tin nhắn...');

bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
  .then((response) => {
    console.log('✅ GỬI TIN NHẮN THỬ NGHIỆM THÀNH CÔNG!');
    console.log(`ID tin nhắn: ${response.message_id}`);
    console.log(`Nhóm nhận: "${response.chat.title || 'N/A'}" (${response.chat.type})`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ GỬI TIN NHẮN THẤT BẠI!');
    console.error('Chi tiết lỗi:', error.message);
    if (error.code === 'ETELEGRAM') {
      console.error('Lưu ý: Hãy đảm bảo bot đã được thêm vào nhóm và có quyền gửi tin nhắn.');
    }
    process.exit(1);
  });
