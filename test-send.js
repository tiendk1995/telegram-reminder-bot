require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatIdMorning = process.env.TELEGRAM_CHAT_ID;
const chatIdAfternoon = process.env.TELEGRAM_CHAT_ID_AFTERNOON || process.env.TELEGRAM_CHAT_ID;
const chatIdEvening = process.env.TELEGRAM_CHAT_ID_EVENING || process.env.TELEGRAM_CHAT_ID;
const chatIdNight = process.env.TELEGRAM_CHAT_ID_NIGHT || process.env.TELEGRAM_CHAT_ID;
const usernamesStr = process.env.EMPLOYEE_USERNAMES || '';
const usernamesStrNight = process.env.EMPLOYEE_USERNAMES_NIGHT || '';

// Lấy tham số loại test (morning, afternoon, evening, hoặc night) từ dòng lệnh, mặc định là morning
const testType = process.argv[2] || 'morning';

let targetChatId = chatIdMorning;
if (testType === 'evening') {
  targetChatId = chatIdEvening;
} else if (testType === 'afternoon') {
  targetChatId = chatIdAfternoon;
} else if (testType === 'night') {
  targetChatId = chatIdNight;
}

if (!token || token === 'YOUR_BOT_TOKEN_HERE') {
  console.error('LỖI: Vui lòng cấu hình TELEGRAM_BOT_TOKEN trong file .env');
  process.exit(1);
}

if (!targetChatId || targetChatId === 'YOUR_CHAT_ID_HERE') {
  console.error('LỖI: Vui lòng cấu hình ID nhóm tương ứng trong file .env trước khi chạy test.');
  process.exit(1);
}

console.log(`=== CHẠY THỬ NGHIỆM GỬI LỜI NHẮC TELEGRAM (${testType.toUpperCase()}) ===`);
console.log(`Bot Token: ${token.substring(0, 10)}...`);
console.log(`Chat ID target: ${targetChatId}`);

let message = '';

if (testType === 'evening') {
  // Lời nhắc buổi tối
  message = `📋 <b>KIỂM TRA CUỐI NGÀY (THỬ NGHIỆM)</b>\n\n` +
            `1️⃣ Cập nhật và kết thúc App giao hàng\n` +
            `✅ Cập nhật đầy đủ trạng thái đơn hàng.\n` +
            `✅ Kết thúc App giao hàng trước khi hết ca.\n\n` +
            `2️⃣ Nộp COD\n` +
            `💰 Tiến hành nộp COD đúng quy định.\n` +
            `⚠️ Quá 12:00 cùng ngày chưa nộp sẽ bị ghi nhận là chiếm dụng COD.\n\n` +
            `Xin cảm ơn mọi người đã phối hợp!`;
} else if (testType === 'afternoon') {
  // Lời nhắc buổi chiều
  const usernames = usernamesStr
    .split(',')
    .map(name => name.trim())
    .filter(name => name.length > 0)
    .map(name => name.startsWith('@') ? name : `@${name}`);

  const tagList = usernames.join(' ');

  message = `🚚 <b>BOOK XE NGÀY MAI (THỬ NGHIỆM)</b>\n\n` +
            `🚛 NVGH: …… xe\n` +
            `👨💼 FL: …… xe\n\n` +
            `📊 Tổng book: …… xe\n\n` +
            `${tagList ? `Mời các bạn: ${tagList}` : ''}`;
} else if (testType === 'night') {
  // Lời nhắc ca đêm (có tag riêng)
  const usernames = usernamesStrNight
    .split(',')
    .map(name => name.trim())
    .filter(name => name.length > 0)
    .map(name => name.startsWith('@') ? name : `@${name}`);

  const tagList = usernames.join(' ');

  message = `🚚 <b>BÁO CÁO CA ĐÊM (THỬ NGHIỆM)</b>\n\n` +
            `Vui lòng cập nhật các nội dung sau:\n\n` +
            `1. Layout hàng rớt luân chuyển\n` +
            `📦 Tên layout: ………………\n` +
            `📢 Đã báo nhóm Vận tải và nhóm Thảo luận để ca sáng xin xe xuất: ☐ Có / ☐ Chưa\n\n` +
            `2. Đơn treo luân chuyển\n` +
            `📋 Số đơn treo: ………\n` +
            `📝 Lý do treo: ………………\n\n` +
            `3. FL\n` +
            `👨💼 Số lượng FL thực tế / Số lượng FL đã book\n\n` +
            `🏷️ TAG: ${tagList || ''}`;
} else {
  // Lời nhắc buổi sáng (có tag)
  const usernames = usernamesStr
    .split(',')
    .map(name => name.trim())
    .filter(name => name.length > 0)
    .map(name => name.startsWith('@') ? name : `@${name}`);

  const tagList = usernames.join(' ');

  message = `🚚 <b>BÁO CÁO CA SÁNG (THỬ NGHIỆM)</b>\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `1️⃣ <b>NHÂN SỰ</b>\n` +
            `↳ 👥 Đi làm: ...... | Tổng: ......\n\n` +
            `2️⃣ <b>LÁI XE</b>\n` +
            `↳ 🚛 Thực tế: ...... | Đã book: ......\n\n` +
            `3️⃣ <b>FL</b>\n` +
            `↳ 📦 Đi làm: ...... | Đã book: ......\n\n` +
            `4️⃣ <b>ĐƠN TỒN</b>\n` +
            `↳ 📋 Chưa gán: ...... đơn\n\n` +
            `🏷️ TAG: ${tagList || ''}`;
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
