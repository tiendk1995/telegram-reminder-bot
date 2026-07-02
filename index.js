require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const moment = require('moment-timezone');

// Đọc cấu hình từ .env
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const timezone = process.env.TIMEZONE || 'Asia/Ho_Chi_Minh';
const cronTime = process.env.CRON_TIME || '30 8 * * *';

// Kiểm tra xem cấu hình đã hợp lệ chưa
if (!token || token === 'YOUR_BOT_TOKEN_HERE') {
  console.error('LỖI: Vui lòng cấu hình TELEGRAM_BOT_TOKEN trong file .env');
  process.exit(1);
}

if (!chatId || chatId === 'YOUR_CHAT_ID_HERE') {
  console.error('CẢNH BÁO: TELEGRAM_CHAT_ID chưa được cấu hình chính xác. Hãy dùng script get-chat-id.js để lấy Chat ID nhóm.');
}

// Khởi tạo bot với chế độ polling (cho phép nhận tin nhắn/lệnh từ người dùng)
const bot = new TelegramBot(token, { polling: true });

console.log('=== Telegram Reminder Bot Đang Khởi Động ===');
console.log(`Múi giờ hoạt động: ${timezone}`);
console.log(`Thời gian lập lịch: ${cronTime} (theo định dạng cron)`);
console.log(`Thời gian hiện tại của hệ thống bot: ${moment().tz(timezone).format('YYYY-MM-DD HH:mm:ss')}`);

// Hàm sinh nội dung tin nhắn nhắc nhở và tag nhân viên
function generateReminderMessage() {
  const usernamesStr = process.env.EMPLOYEE_USERNAMES || '';
  // Xử lý danh sách username để đảm bảo đúng định dạng tag
  const usernames = usernamesStr
    .split(',')
    .map(name => name.trim())
    .filter(name => name.length > 0)
    .map(name => name.startsWith('@') ? name : `@${name}`);

  const tagList = usernames.join(' ');

  return `🔔 <b>THÔNG BÁO LỜI NHẮC HÀNG NGÀY</b> 🔔\n\n` +
         `Chào buổi sáng mọi người! ☀️\n` +
         `Đã đến 8:30 sáng rồi, chúc mọi người một ngày làm việc tràn đầy năng lượng!\n\n` +
         `${tagList ? `Xin chào các bạn: ${tagList}` : 'Chúc cả nhóm làm việc hiệu quả!'}`;
}

// Hàm gửi tin nhắn nhắc nhở
async function sendReminder() {
  const currentChatId = process.env.TELEGRAM_CHAT_ID;
  if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
    console.error('Không thể gửi nhắc nhở vì chưa cấu hình TELEGRAM_CHAT_ID trong file .env');
    return;
  }

  const message = generateReminderMessage();
  
  try {
    console.log(`[${moment().tz(timezone).format()}] Đang gửi tin nhắn nhắc nhở đến Chat ID: ${currentChatId}...`);
    await bot.sendMessage(currentChatId, message, { parse_mode: 'HTML' });
    console.log('Gửi tin nhắn nhắc nhở thành công!');
  } catch (error) {
    console.error('Gửi tin nhắn nhắc nhở thất bại:', error.message);
  }
}

// Thiết lập cron job
cron.schedule(cronTime, () => {
  console.log(`[${moment().tz(timezone).format()}] Kích hoạt cron job nhắc nhở...`);
  sendReminder();
}, {
  scheduled: true,
  timezone: timezone
});

// Phản hồi lệnh /status để kiểm tra xem bot còn sống hay không
bot.onText(/\/status/, (msg) => {
  const responseChatId = msg.chat.id;
  const currentTime = moment().tz(timezone).format('DD-MM-YYYY HH:mm:ss');
  const statusMsg = `✅ <b>Telegram Reminder Bot đang hoạt động bình thường!</b>\n\n` +
                    `• Múi giờ: <code>${timezone}</code>\n` +
                    `• Giờ hiện tại: <code>${currentTime}</code>\n` +
                    `• Lịch gửi nhắc nhở: <code>${cronTime}</code> (8h30 sáng hàng ngày)\n` +
                    `• Nhóm nhận tin nhắn (ID): <code>${chatId}</code>\n` +
                    `• Thử nghiệm gửi ngay lập tức: /test_send`;
  
  bot.sendMessage(responseChatId, statusMsg, { parse_mode: 'HTML' });
});

// Phản hồi lệnh /test_send để chạy thử gửi tin nhắn nhắc nhở ngay lập tức
bot.onText(/\/test_send/, async (msg) => {
  const responseChatId = msg.chat.id;
  
  // Kiểm tra quyền (chỉ cho phép thử nghiệm nếu gửi trong nhóm cấu hình hoặc chat riêng với bot)
  bot.sendMessage(responseChatId, '🔄 Đang chạy thử nghiệm gửi tin nhắn nhắc nhở...');
  
  const currentChatId = process.env.TELEGRAM_CHAT_ID;
  if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
    bot.sendMessage(responseChatId, '❌ Lỗi: Bạn chưa cấu hình TELEGRAM_CHAT_ID trong file .env');
    return;
  }

  const message = generateReminderMessage();
  try {
    await bot.sendMessage(currentChatId, message, { parse_mode: 'HTML' });
    bot.sendMessage(responseChatId, `✅ Gửi thành công đến Chat ID: <code>${currentChatId}</code>`, { parse_mode: 'HTML' });
  } catch (error) {
    bot.sendMessage(responseChatId, `❌ Gửi thất bại: ${error.message}`);
  }
});

// Tạo một HTTP server đơn giản để Render có thể ping kiểm tra trạng thái hoạt động (Health Check)
// Điều này giúp tránh lỗi Deploy thất bại do Render yêu cầu port binding
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Telegram Reminder Bot đang hoạt động!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`HTTP server đang lắng nghe trên cổng: ${PORT}`);
});

console.log('Bot đã sẵn sàng và đang chạy ngầm...');

