require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token || token === 'YOUR_BOT_TOKEN_HERE') {
  console.error('LỖI: Vui lòng cấu hình TELEGRAM_BOT_TOKEN trong file .env trước khi chạy script này.');
  process.exit(1);
}

console.log('=== ĐANG KHỞI CHẠY TIỆN ÍCH LẤY CHAT ID ===');
console.log('1. Đảm bảo bạn đã thêm Bot vào nhóm Telegram cần cấu hình.');
console.log('2. Hãy gửi một tin nhắn bất kỳ vào nhóm đó (ví dụ: "@TenBot_bot hello").');
console.log('3. Xem log bên dưới để copy Chat ID của nhóm.\n');
console.log('Đang kết nối tới Telegram...');

const bot = new TelegramBot(token, { polling: true });

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const chatType = msg.chat.type;
  const chatTitle = msg.chat.title || 'Chat riêng tư (Private)';
  const senderName = msg.from.username ? `@${msg.from.username}` : `${msg.from.first_name} ${msg.from.last_name || ''}`;

  console.log('\n----------------------------------------');
  console.log(`💬 Nhận được tin nhắn từ: ${senderName}`);
  console.log(`📂 Loại chat: ${chatType}`);
  console.log(`🏷️ Tên nhóm/người gửi: "${chatTitle}"`);
  console.log(`🆔 CHAT ID CỦA BẠN: ${chatId}`);
  console.log('----------------------------------------');
  console.log('👉 Hãy copy ID trên (bao gồm cả dấu trừ "-") và dán vào biến TELEGRAM_CHAT_ID trong file .env');
});

bot.on('polling_error', (error) => {
  console.error('Lỗi kết nối (polling_error):', error.message);
});

console.log('Bot đang lắng nghe tin nhắn... (Nhấn Ctrl+C để dừng)');
