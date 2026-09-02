require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;

// Lấy tham số loại test từ dòng lệnh, mặc định là morning
const testType = (process.argv[2] || 'morning').toLowerCase();

let targetChatId = process.env.TELEGRAM_CHAT_ID;
let message = '';

// Hàm sinh danh sách tag từ biến môi trường hoặc danh sách mặc định
function generateTagList(envValue, defaultVal) {
  const value = envValue !== undefined ? envValue : defaultVal;
  if (!value) return '';
  return value
    .split(',')
    .map(name => name.trim())
    .filter(name => name.length > 0)
    .map(name => {
      if (/^\d+$/.test(name)) {
        return `<a href="tg://user?id=${name}">@${name}</a>`;
      }
      return name.startsWith('@') ? name : `@${name}`;
    })
    .join(' ');
}

// Hàm sinh nội dung tin nhắn nhắc nhở SÁNG
function generateMorningReminderMessage() {
  const tags = generateTagList(process.env.TAG_MORNING, '719990341, 8403744896, 7708350872, 3170505');
  return `🚚 <b>BÁO CÁO CA SÁNG</b>\n` +
         `━━━━━━━━━━━━━━━━━━\n\n` +
         `1️⃣ <b>NHÂN SỰ</b>\n` +
         `↳ 👥 Đi làm: ...... | Tổng: ......\n\n` +
         `2️⃣ <b>LÁI XE</b>\n` +
         `↳ 🚛 Thực tế: ...... | Book: ......\n\n` +
         `3️⃣ <b>FL</b>\n` +
         `↳ 📦 Đi làm: ...... | Book: ......\n\n` +
         `4️⃣ <b>ĐƠN TỒN</b>\n` +
         `↳ 📋 Chưa gán: ...... đơn\n` +
         `Lý do:\n\n` +
         `......\n\n` +
         `🏷️ TAG: ${tags}`;
}

// Hàm sinh nội dung tin nhắn nhắc nhở báo cáo FL
function generateFLReminderMessage() {
  const tags = generateTagList(process.env.TAG_FL, '719990341, 8403744896, 7708350872, 3170505, 6281487432, 868743297, 8711123602');
  return `📸 <b>NHẮC NHỞ BÁO CÁO ẢNH FL</b>\n\n` +
         `⚠️ Đã đến thời gian báo cáo ảnh vào ca.\n\n` +
         `Vui lòng gửi ảnh báo cáo FL theo đúng quy định để bộ phận vận hành tổng hợp và theo dõi.\n\n` +
         `⏰ Nếu đã báo cáo, vui lòng bỏ qua thông báo này.\n\n` +
         `🏷️ TAG: ${tags}`;
}

// Hàm sinh nội dung tin nhắn nhắc nhở book xe giao hàng
function generateBookTruckReminderMessage() {
  const tags = generateTagList(process.env.TAG_BOOK_TRUCK, '719990341, 8403744896, Tú29N1, NVTHANGDP');
  return `🚚 <b>BOOK XE GIAO NGÀY MAI</b>\n` +
         `━━━━━━━━━━━━━━━━━━\n\n` +
         `🚛 NVGH: …… xe\n` +
         `🚛 NVGH đi Hưng Yên: …… xe\n\n` +
         `📊 <b>TỔNG BOOK: …… xe</b>\n\n` +
         `🏷️ TAG: ${tags}`;
}

// Hàm sinh nội dung tin nhắn nhắc nhở báo cáo tồn Con Cưng
function generateConCungReminderMessage() {
  const tags = generateTagList(process.env.TAG_CON_CUNG, '7708350872, 3170505');
  return `📋 <b>BÁO CÁO TỒN CON CƯNG</b>\n` +
         `━━━━━━━━━━━━━━━━━━\n\n` +
         `📦 Tổng đơn tồn: ...... đơn\n\n` +
         `STT  Mã đơn  Địa chỉ\n` +
         `1    ......  ......\n` +
         `2    ......  ......\n` +
         `3    ......  ......\n\n` +
         `🏷️ TAG: ${tags}`;
}

// Hàm sinh nội dung tin nhắn nhắc nhở báo cáo backlog
function generateBacklogReminderMessage() {
  const tags = generateTagList(process.env.TAG_BACKLOG, '7708350872, 3170505, 8403744896, 719990341');
  return `📋 <b>BÁO CÁO ĐƠN TỒN TRÊN 36H</b>\n` +
         `━━━━━━━━━━━━━━━━━━\n\n` +
         `🚚 Đơn tồn giao: ...... đơn\n` +
         `📝 Giải trình:\n\n` +
         `......\n\n` +
         `🔄 Đơn tồn trả: ...... đơn\n` +
         `📝 Giải trình:\n\n` +
         `......\n\n` +
         `🏷️ TAG: ${tags}`;
}

// Hàm sinh nội dung tin nhắn nhắc nhở báo cáo luân chuyển backlog
function generateRotationBacklogReminderMessage() {
  const tags = generateTagList(process.env.TAG_ROTATION_BACKLOG, '6281487432, 7304483491, 868743297, 8711123602');
  return `📋 <b>BÁO CÁO ĐƠN TỒN LUÂN CHUYỂN TRÊN 36H</b>\n\n` +
         `🚚 Luân chuyển giao:\n` +
         `📝 Giải trình: ……\n\n` +
         `🔄 Luân chuyển trả:\n` +
         `📝 Giải trình: ……\n\n` +
         `🏷️ Tag: ${tags}`;
}

// Hàm sinh nội dung tin nhắn nhắc nhở CHIỀU
function generateAfternoonReminderMessage() {
  const tags = generateTagList(process.env.TAG_AFTERNOON || process.env.EMPLOYEE_USERNAMES, '');
  return `🚚 <b>BOOK XE NGÀY MAI</b>\n\n` +
         `🚛 NVGH: …… xe\n` +
         `👨💼 FL: …… xe\n\n` +
         `📊 Tổng book: …… xe\n\n` +
         `${tags ? `Mời các bạn: ${tags}` : ''}`;
}

// Hàm sinh nội dung tin nhắn nhắc nhở GÁN ĐƠN (18h00)
function generateAssignOrder18hReminderMessage() {
  const tags = generateTagList(process.env.TAG_ASSIGNED_ORDERS || process.env.TAG_ASSIGN_ORDER_18H || process.env.EMPLOYEE_USERNAMES, '');
  return `⏰ <b>18H HẰNG NGÀY</b>\n\n` +
         `Yêu cầu các bạn nhân viên thực hiện gán đơn đầy đủ trước/sau 18h theo quy định.\n\n` +
         `Sau khi gán xong, phản hồi “Đã gán đơn” để xác nhận hoàn thành.` +
         (tags ? `\n\n🏷️ TAG: ${tags}` : '');
}

// Lựa chọn tin nhắn và nhóm ID gửi tương ứng
if (testType === 'morning') {
  targetChatId = process.env.TELEGRAM_CHAT_ID;
  message = generateMorningReminderMessage();
} else if (testType === 'fl') {
  targetChatId = process.env.TELEGRAM_CHAT_ID_FL_REPORT || process.env.TELEGRAM_CHAT_ID;
  message = generateFLReminderMessage();
} else if (testType === 'book_truck') {
  targetChatId = process.env.TELEGRAM_CHAT_ID_BOOK_TRUCK || process.env.TELEGRAM_CHAT_ID;
  message = generateBookTruckReminderMessage();
} else if (testType === 'con_cung') {
  targetChatId = process.env.TELEGRAM_CHAT_ID_CON_CUNG || process.env.TELEGRAM_CHAT_ID;
  message = generateConCungReminderMessage();
} else if (testType === 'backlog') {
  targetChatId = process.env.TELEGRAM_CHAT_ID_BACKLOG || process.env.TELEGRAM_CHAT_ID;
  message = generateBacklogReminderMessage();
} else if (testType === 'rotation_backlog') {
  targetChatId = process.env.TELEGRAM_CHAT_ID_ROTATION_BACKLOG || process.env.TELEGRAM_CHAT_ID;
  message = generateRotationBacklogReminderMessage();
} else if (testType === 'afternoon') {
  targetChatId = process.env.TELEGRAM_CHAT_ID_AFTERNOON || process.env.TELEGRAM_CHAT_ID;
  message = generateAfternoonReminderMessage();
} else if (testType === 'assign_order_18h' || testType === 'gan_don') {
  targetChatId = process.env.TELEGRAM_CHAT_ID_ASSIGNED_ORDERS || process.env.TELEGRAM_CHAT_ID_ASSIGN_ORDER || process.env.TELEGRAM_CHAT_ID;
  message = generateAssignOrder18hReminderMessage();
} else {
  console.error(`Lỗi: Loại test "${testType}" không hợp lệ. Các loại hợp lệ: morning, fl, book_truck, con_cung, backlog, rotation_backlog, afternoon, assign_order_18h (hoặc gan_don)`);
  process.exit(1);
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
