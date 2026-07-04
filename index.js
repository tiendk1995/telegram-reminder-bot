require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const moment = require('moment-timezone');

// Đọc cấu hình từ .env
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatIdMorning = process.env.TELEGRAM_CHAT_ID;
const chatIdEvening = process.env.TELEGRAM_CHAT_ID_EVENING || process.env.TELEGRAM_CHAT_ID;
const timezone = process.env.TIMEZONE || 'Asia/Ho_Chi_Minh';
const cronTimeMorning = process.env.CRON_TIME || '30 8 * * *';
const cronTimeEvening = process.env.CRON_TIME_EVENING || '0 20 * * *';

// Kiểm tra xem cấu hình đã hợp lệ chưa
if (!token || token === 'YOUR_BOT_TOKEN_HERE') {
  console.error('LỖI: Vui lòng cấu hình TELEGRAM_BOT_TOKEN trong file .env');
  process.exit(1);
}

if (!chatIdMorning || chatIdMorning === 'YOUR_CHAT_ID_HERE') {
  console.error('CẢNH BÁO: TELEGRAM_CHAT_ID chưa được cấu hình chính xác. Hãy dùng script get-chat-id.js để lấy Chat ID nhóm.');
}

// Khởi tạo bot với chế độ polling (cho phép nhận tin nhắn/lệnh từ người dùng)
const bot = new TelegramBot(token, { polling: true });

bot.on('polling_error', (error) => {
  console.error('Lỗi Polling Telegram:', error.message);
});

bot.on('error', (error) => {
  console.error('Lỗi Bot Telegram:', error.message);
});

console.log('=== Telegram Reminder Bot Đang Khởi Động ===');
console.log(`Múi giờ hoạt động: ${timezone}`);
console.log(`Lịch gửi SÁNG (8h30): ${cronTimeMorning} (Nhóm ID: ${chatIdMorning})`);
console.log(`Lịch gửi TỐI (20h00): ${cronTimeEvening} (Nhóm ID: ${chatIdEvening})`);
console.log(`Thời gian hiện tại của hệ thống bot: ${moment().tz(timezone).format('YYYY-MM-DD HH:mm:ss')}`);

// Hàm sinh nội dung tin nhắn nhắc nhở SÁNG và tag nhân viên
function generateMorningReminderMessage() {
  const usernamesStr = process.env.EMPLOYEE_USERNAMES || '';
  // Xử lý danh sách username để đảm bảo đúng định dạng tag
  const usernames = usernamesStr
    .split(',')
    .map(name => name.trim())
    .filter(name => name.length > 0)
    .map(name => name.startsWith('@') ? name : `@${name}`);

  const tagList = usernames.join(' ');

  return `🚚 <b>BÁO CÁO ĐẦU CA</b>\n\n` +
         `Vui lòng cập nhật các nội dung sau:\n\n` +
         `1. Nhân sự\n` +
         `👥 Số nhân sự đi làm / Tổng số nhân sự\n\n` +
         `2. Lái xe\n` +
         `🚛 Số lượng lái xe thực tế / Tổng số lái xe đã book\n\n` +
         `3. FL\n` +
         `📦 Số lượng FL đi làm / Tổng số FL đã book\n\n` +
         `4. Mục tiêu trong ca\n` +
         `🎯 Hoàn thành việc gán 100% hàng giao trong buổi sáng.\n\n` +
         `Xin cảm ơn mọi người đã phối hợp. Chúc cả đội có một ca làm việc an toàn, hiệu quả và hoàn thành tốt các mục tiêu!\n\n` +
         `${tagList ? `Mời các bạn: ${tagList}` : ''}`;
}

// Hàm sinh nội dung tin nhắn nhắc nhở TỐI (không tag ai)
function generateEveningReminderMessage() {
  return `📋 <b>KIỂM TRA CUỐI NGÀY</b>\n\n` +
         `1️⃣ Cập nhật và kết thúc App giao hàng\n` +
         `✅ Cập nhật đầy đủ trạng thái đơn hàng.\n` +
         `✅ Kết thúc App giao hàng trước khi hết ca.\n\n` +
         `2️⃣ Nộp COD\n` +
         `💰 Tiến hành nộp COD đúng quy định.\n` +
         `⚠️ Quá 12:00 cùng ngày chưa nộp sẽ bị ghi nhận là chiếm dụng COD.\n\n` +
         `Xin cảm ơn mọi người đã phối hợp!`;
}

// Hàm gửi tin nhắn nhắc nhở SÁNG
async function sendMorningReminder() {
  const currentChatId = process.env.TELEGRAM_CHAT_ID;
  if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
    console.error('Không thể gửi nhắc nhở sáng vì chưa cấu hình TELEGRAM_CHAT_ID trong file .env');
    return;
  }

  const message = generateMorningReminderMessage();
  
  try {
    console.log(`[${moment().tz(timezone).format()}] Đang gửi tin nhắn nhắc nhở SÁNG đến Chat ID: ${currentChatId}...`);
    await bot.sendMessage(currentChatId, message, { parse_mode: 'HTML' });
    console.log('Gửi tin nhắn nhắc nhở SÁNG thành công!');
  } catch (error) {
    console.error('Gửi tin nhắn nhắc nhở SÁNG thất bại:', error.message);
  }
}

// Hàm gửi tin nhắn nhắc nhở TỐI (gửi đến Chat ID tối riêng biệt nếu có)
async function sendEveningReminder() {
  const currentChatId = process.env.TELEGRAM_CHAT_ID_EVENING || process.env.TELEGRAM_CHAT_ID;
  if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
    console.error('Không thể gửi nhắc nhở tối vì chưa cấu hình TELEGRAM_CHAT_ID_EVENING trong file .env');
    return;
  }

  const message = generateEveningReminderMessage();
  
  try {
    console.log(`[${moment().tz(timezone).format()}] Đang gửi tin nhắn nhắc nhở TỐI đến Chat ID: ${currentChatId}...`);
    await bot.sendMessage(currentChatId, message, { parse_mode: 'HTML' });
    console.log('Gửi tin nhắn nhắc nhở TỐI thành công!');
  } catch (error) {
    console.error('Gửi tin nhắn nhắc nhở TỐI thất bại:', error.message);
  }
}

// Thiết lập cron job nhắc nhở SÁNG (8h30)
cron.schedule(cronTimeMorning, () => {
  console.log(`[${moment().tz(timezone).format()}] Kích hoạt cron job nhắc nhở SÁNG...`);
  sendMorningReminder();
}, {
  scheduled: true,
  timezone: timezone
});

// Thiết lập cron job nhắc nhở TỐI (20h00)
cron.schedule(cronTimeEvening, () => {
  console.log(`[${moment().tz(timezone).format()}] Kích hoạt cron job nhắc nhở TỐI...`);
  sendEveningReminder();
}, {
  scheduled: true,
  timezone: timezone
});

// Phản hồi lệnh /status để kiểm tra xem bot còn sống hay không
bot.onText(/\/status(@\w+)?$/, (msg) => {
  const responseChatId = msg.chat.id;
  const currentTime = moment().tz(timezone).format('DD-MM-YYYY HH:mm:ss');
  const statusMsg = `✅ <b>Telegram Reminder Bot đang hoạt động bình thường!</b>\n\n` +
                    `• Múi giờ: <code>${timezone}</code>\n` +
                    `• Giờ hiện tại: <code>${currentTime}</code>\n` +
                    `• Hẹn giờ SÁNG: <code>${cronTimeMorning}</code> (Nhóm ID: <code>${chatIdMorning}</code>)\n` +
                    `• Hẹn giờ TỐI: <code>${cronTimeEvening}</code> (Nhóm ID: <code>${chatIdEvening}</code>)\n\n` +
                    `• Thử nghiệm gửi SÁNG: /test_send\n` +
                    `• Thử nghiệm gửi TỐI: /test_send_evening`;
  
  bot.sendMessage(responseChatId, statusMsg, { parse_mode: 'HTML' });
});

// Phản hồi lệnh /test_send (hoặc /test_send_morning) để chạy thử gửi tin nhắn SÁNG
bot.onText(/\/test_send(_morning)?(@\w+)?$/, async (msg) => {
  const responseChatId = msg.chat.id;
  bot.sendMessage(responseChatId, '🔄 Đang chạy thử nghiệm gửi tin nhắn nhắc nhở SÁNG...');
  
  const currentChatId = process.env.TELEGRAM_CHAT_ID;
  if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
    bot.sendMessage(responseChatId, '❌ Lỗi: Bạn chưa cấu hình TELEGRAM_CHAT_ID trong file .env');
    return;
  }

  const message = generateMorningReminderMessage();
  try {
    await bot.sendMessage(currentChatId, message, { parse_mode: 'HTML' });
    bot.sendMessage(responseChatId, `✅ Gửi thành công đến Chat ID: <code>${currentChatId}</code>`, { parse_mode: 'HTML' });
  } catch (error) {
    bot.sendMessage(responseChatId, `❌ Gửi thất bại: ${error.message}`);
  }
});

// Phản hồi lệnh /test_send_evening để chạy thử gửi tin nhắn TỐI
bot.onText(/\/test_send_evening(@\w+)?$/, async (msg) => {
  const responseChatId = msg.chat.id;
  bot.sendMessage(responseChatId, '🔄 Đang chạy thử nghiệm gửi tin nhắn nhắc nhở TỐI...');
  
  const currentChatId = process.env.TELEGRAM_CHAT_ID_EVENING || process.env.TELEGRAM_CHAT_ID;
  if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
    bot.sendMessage(responseChatId, '❌ Lỗi: Bạn chưa cấu hình TELEGRAM_CHAT_ID_EVENING trong file .env');
    return;
  }

  const message = generateEveningReminderMessage();
  try {
    await bot.sendMessage(currentChatId, message, { parse_mode: 'HTML' });
    bot.sendMessage(responseChatId, `✅ Gửi thành công đến Chat ID: <code>${currentChatId}</code>`, { parse_mode: 'HTML' });
  } catch (error) {
    bot.sendMessage(responseChatId, `❌ Gửi thất bại: ${error.message}`);
  }
});

// Tạo một HTTP server đơn giản để Render có thể ping kiểm tra trạng thái hoạt động (Health Check)
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
