require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatIdMorning = process.env.TELEGRAM_CHAT_ID;
const chatIdEvening = process.env.TELEGRAM_CHAT_ID_EVENING || process.env.TELEGRAM_CHAT_ID;
const usernamesStr = process.env.EMPLOYEE_USERNAMES || '';

// Lấy tham số loại test (morning hoặc evening) từ dòng lệnh, mặc định là morning
const testType = process.argv[2] || 'morning';
const targetChatId = testType === 'evening' ? chatIdEvening : chatIdMorning;

if (!token || token === 'YOUR_BOT_TOKEN_HERE') {
  console.error('LỖI: Vui lòng cấu hình TELEGRAM_BOT_TOKEN trong file .env');
  process.exit(1);
}

if (!targetChatId || targetChatId === 'YOUR_CHAT_ID_HERE') {
  console.error('LỖI: Vui lòng cấu hình TELEGRAM_CHAT_ID hoặc TELEGRAM_CHAT_ID_EVENING trong file .env trước khi chạy test.');
  process.exit(1);
}

console.log(`=== CHẠY THỬ NGHIỆM GỬI LỜI NHẮC TELEGRAM (${testType.toUpperCase()}) ===`);
console.log(`Bot Token: ${token.substring(0, 10)}...`);
console.log(`Chat ID target: ${targetChatId}`);

let message = '';

if (testType === 'evening') {
  // Lời nhắc buổi tối (không tag)
  message = `📋 <b>KIỂM TRA CUỐI NGÀY (THỬ NGHIỆM)</b>\n\n` +
            `1️⃣ Cập nhật và kết thúc App giao hàng\n` +
            `✅ Cập nhật đầy đủ trạng thái đơn hàng.\n` +
            `✅ Kết thúc App giao hàng trước khi hết ca.\n\n` +
            `2️⃣ Nộp COD\n` +
            `💰 Tiến hành nộp COD đúng quy định.\n` +
            `⚠️ Quá 12:00 cùng ngày chưa nộp sẽ bị ghi nhận là chiếm dụng COD.\n\n` +
            `Xin cảm ơn mọi người đã phối hợp!`;
} else {
  // Lời nhắc buổi sáng (có tag)
  const usernames = usernamesStr
    .split(',')
    .map(name => name.trim())
    .filter(name => name.length > 0)
    .map(name => name.startsWith('@') ? name : `@${name}`);

  const tagList = usernames.join(' ');

  message = `🚚 <b>BÁO CÁO ĐẦU CA (THỬ NGHIỆM)</b>\n\n` +
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

const bot = new TelegramBot(token, { polling: false });

console.log('Đang gửi tin nhắn...');

bot.sendMessage(targetChatId, message, { parse_mode: 'HTML' })
  .then((response) => {
    console.log(`✅ GỬI TIN NHẮN THỬ NGHIỆM ${testType.toUpperCase()} THÀNH CÔNG!`);
    console.log(`ID tin nhắn: ${response.message_id}`);
    console.log(`Nhóm nhận: "${response.chat.title || 'N/A'}" (${response.chat.type})`);
    process.exit(0);
  })
  .catch((error) => {
    console.log(`❌ GỬI TIN NHẮN THỬ NGHIỆM ${testType.toUpperCase()} THẤT BẠI!`);
    console.error('Chi tiết lỗi:', error.message);
    process.exit(1);
  });
