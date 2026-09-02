process.env.NTBA_FIX_319 = 1;
process.env.NTBA_FIX_350 = 1;
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const moment = require('moment-timezone');
const path = require('path');
const fs = require('fs');

const historyPath = path.join(__dirname, 'reminder_history.json');

function loadHistory() {
  if (fs.existsSync(historyPath)) {
    try {
      return JSON.parse(fs.readFileSync(historyPath, 'utf8'));
    } catch (e) {
      return {};
    }
  }
  return {};
}

function saveHistory(history) {
  try {
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save history:', e);
  }
}

function recordReminderSent(shiftName, chatId) {
  const history = loadHistory();
  const today = moment().tz(timezone).format('YYYY-MM-DD');
  if (!history[today]) {
    history[today] = {};
  }
  history[today][shiftName] = {
    sent: true,
    sentTime: moment().tz(timezone).format('HH:mm:ss'),
    replied: false,
    chatId: Number(chatId)
  };
  saveHistory(history);
}

function recordMessageReceived(chatId) {
  const history = loadHistory();
  const today = moment().tz(timezone).format('YYYY-MM-DD');
  if (history[today]) {
    let updated = false;
    for (const shiftName in history[today]) {
      const item = history[today][shiftName];
      if (Number(item.chatId) === Number(chatId) && !item.replied) {
        item.replied = true;
        item.replyTime = moment().tz(timezone).format('HH:mm:ss');
        updated = true;
        console.log(`[History] Marked shift "${shiftName}" as REPLIED in chat ${chatId}`);
      }
    }
    if (updated) {
      saveHistory(history);
    }
  }
}

// Đọc cấu hình từ .env
const token = process.env.TELEGRAM_BOT_TOKEN;
const botType = (process.env.BOT_TYPE || 'all').toLowerCase();
const chatIdMorning = process.env.TELEGRAM_CHAT_ID;
const chatIdAfternoon = process.env.TELEGRAM_CHAT_ID_AFTERNOON || process.env.TELEGRAM_CHAT_ID;
const chatIdFLReport = process.env.TELEGRAM_CHAT_ID_FL_REPORT || process.env.TELEGRAM_CHAT_ID;

const timezone = process.env.TIMEZONE || 'Asia/Ho_Chi_Minh';

const cronTimeMorning = process.env.CRON_TIME || '0 10 * * *';
const cronTimeAfternoon = process.env.CRON_TIME_AFTERNOON || '30 16 * * *';


// Kiểm tra xem cấu hình đã hợp lệ chưa
if (!token || token === 'YOUR_BOT_TOKEN_HERE') {
  console.error('LỖI: Vui lòng cấu hình TELEGRAM_BOT_TOKEN trong file .env');
  process.exit(1);
}

if (!chatIdMorning || chatIdMorning === 'YOUR_CHAT_ID_HERE') {
  console.error('CẢNH BÁO: TELEGRAM_CHAT_ID chưa được cấu hình chính xác. Hãy dùng script get-chat-id.js để lấy Chat ID nhóm.');
}

// Kiểm tra xem có đang chạy trên môi trường Render không
const isRender = process.env.RENDER === 'true' || process.env.RENDER !== undefined;

// Khởi tạo bot với chế độ polling kèm Keep-Alive để tránh lỗi ECONNRESET
const bot = new TelegramBot(token, {
  polling: !isRender,
  request: {
    agentOptions: {
      keepAlive: true,
      family: 4
    }
  }
});

bot.on('polling_error', (error) => {
  const errMsg = error.message || '';
  if (
    errMsg.includes('ECONNRESET') || 
    errMsg.includes('ETIMEDOUT') || 
    errMsg.includes('ENOTFOUND') || 
    errMsg.includes('EAI_AGAIN') ||
    errMsg.includes('socket hang up')
  ) {
    console.warn(`[Cảnh báo kết nối] Telegram API tạm thời gián đoạn (${error.message}). Bot đang tự kết nối lại...`);
  } else {
    console.error('Lỗi Polling Telegram:', error.message);
  }
});

bot.on('error', (error) => {
  console.error('Lỗi Bot Telegram:', error.message);
});

// Hàm bọc gửi tin nhắn an toàn tự động thử lại nếu gặp lỗi kết nối
async function safeSendMessage(chatId, text, options = {}, retries = 3, delay = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await bot.sendMessage(chatId, text, options);
    } catch (error) {
      const errMsg = error.message || '';
      const isTransient = 
        errMsg.includes('ECONNRESET') ||
        errMsg.includes('ETIMEDOUT') ||
        errMsg.includes('ENOTFOUND') ||
        errMsg.includes('EAI_AGAIN') ||
        errMsg.includes('socket hang up') ||
        errMsg.includes('EFATAL');
      
      if (isTransient && attempt < retries) {
        console.warn(`[Gửi tin nhắn thất bại, đang thử lại lần ${attempt}/${retries}] Lỗi: ${error.message}. Chờ ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

// Hàm bọc gửi ảnh báo cáo an toàn tự động thử lại nếu gặp lỗi kết nối
async function safeSendPhoto(chatId, photo, options = {}, fileOptions = {}, retries = 3, delay = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      let photoData = photo;
      let actualFileOptions = { ...fileOptions };
      
      if (typeof photo === 'string') {
        if (fs.existsSync(photo)) {
          // Tạo một read stream mới trong mỗi lần thử
          photoData = fs.createReadStream(photo);
          if (!actualFileOptions.filename) {
            actualFileOptions.filename = path.basename(photo);
          }
          if (!actualFileOptions.contentType) {
            actualFileOptions.contentType = 'image/png';
          }
        }
      }
      
      return await bot.sendPhoto(chatId, photoData, options, actualFileOptions);
    } catch (error) {
      const errMsg = error.message || '';
      const isTransient = 
        errMsg.includes('ECONNRESET') ||
        errMsg.includes('ETIMEDOUT') ||
        errMsg.includes('ENOTFOUND') ||
        errMsg.includes('EAI_AGAIN') ||
        errMsg.includes('socket hang up') ||
        errMsg.includes('EFATAL');
        
      if (isTransient && attempt < retries) {
        console.warn(`[Gửi ảnh thất bại, đang thử lại lần ${attempt}/${retries}] Lỗi: ${error.message}. Chờ ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

console.log('=== Telegram Reminder Bot Đang Khởi Động ===');
console.log(`Múi giờ hoạt động: ${timezone}`);
console.log(`Lịch gửi SÁNG (10h00): ${cronTimeMorning} (Nhóm ID: ${chatIdMorning})`);
console.log(`Lịch gửi FL (8h, 17h, 18h): 08:00, 17:00, 18:00 (Nhóm ID: ${chatIdFLReport})`);
console.log(`Lịch gửi BOOK XE (16h00): 0 16 * * * (Nhóm ID: ${process.env.TELEGRAM_CHAT_ID_BOOK_TRUCK || '-5599911868'})`);
console.log(`Lịch gửi TỒN CON CƯNG (16h00): 0 16 * * * (Nhóm ID: ${process.env.TELEGRAM_CHAT_ID_CON_CUNG || chatIdMorning})`);
console.log(`Lịch gửi BACKLOG (10h00): 0 10 * * * (Nhóm ID: ${process.env.TELEGRAM_CHAT_ID_BACKLOG || '-1004372456405'})`);
console.log(`Lịch gửi TỒN LC ĐÊM (01h00): 0 1 * * * (Nhóm ID: ${process.env.TELEGRAM_CHAT_ID_ROTATION_BACKLOG || '-1004372456405'})`);
console.log(`Lịch gửi CHIỀU (16h30): ${cronTimeAfternoon} (Nhóm ID: ${chatIdAfternoon})`);
console.log(`Lịch gửi GÁN ĐƠN (18h00): 0 18 * * * (Nhóm ID: ${process.env.TELEGRAM_CHAT_ID_ASSIGNED_ORDERS || '-5018964680'})`);
console.log(`Lịch QUÉT UNASSIGNED SHOPS (19h00): 0 19 * * * (Nhóm ID: ${process.env.TELEGRAM_CHAT_ID_ASSIGNED_ORDERS || '-5018964680'})`);
console.log(`Thời gian hiện tại của hệ thống bot: ${moment().tz(timezone).format('YYYY-MM-DD HH:mm:ss')}`);


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

// Hàm sinh nội dung tin nhắn nhắc nhở SÁNG và tag nhân viên
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

// Hàm sinh nội dung tin nhắn nhắc nhở CHIỀU (có tag)
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
    await safeSendMessage(currentChatId, message, { parse_mode: 'HTML' });
    console.log('Gửi tin nhắn nhắc nhở SÁNG thành công!');
    recordReminderSent('SÁNG (10h00)', currentChatId);
  } catch (error) {
    console.error('Gửi tin nhắn nhắc nhở sáng thất bại:', error.message);
  }
}

// Hàm gửi nhắc nhở báo cáo FL
async function sendFLReminder() {
  const currentChatId = process.env.TELEGRAM_CHAT_ID_FL_REPORT || '-4877524742';
  if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
    console.error('Không thể gửi nhắc nhở FL vì chưa cấu hình TELEGRAM_CHAT_ID_FL_REPORT trong file .env');
    return;
  }

  const message = generateFLReminderMessage();
  try {
    console.log(`[${moment().tz(timezone).format()}] Đang gửi tin nhắn nhắc nhở FL đến Chat ID: ${currentChatId}...`);
    await safeSendMessage(currentChatId, message, { parse_mode: 'HTML' });
    console.log('Gửi tin nhắn nhắc nhở FL thành công!');
    recordReminderSent('NHẮC ẢNH FL', currentChatId);
  } catch (error) {
    console.error('Gửi tin nhắn nhắc nhở FL thất bại:', error.message);
  }
}

// Hàm gửi nhắc nhở book xe giao hàng
async function sendBookTruckReminder() {
  const currentChatId = process.env.TELEGRAM_CHAT_ID_BOOK_TRUCK || '-5599911868';
  if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
    console.error('Không thể gửi nhắc nhở book xe vì chưa cấu hình TELEGRAM_CHAT_ID_BOOK_TRUCK trong file .env');
    return;
  }

  const message = generateBookTruckReminderMessage();
  try {
    console.log(`[${moment().tz(timezone).format()}] Đang gửi tin nhắn nhắc nhở book xe đến Chat ID: ${currentChatId}...`);
    await safeSendMessage(currentChatId, message, { parse_mode: 'HTML' });
    console.log('Gửi tin nhắn nhắc nhở book xe thành công!');
    recordReminderSent('BOOK XE GIAO', currentChatId);
  } catch (error) {
    console.error('Gửi tin nhắn nhắc nhở book xe thất bại:', error.message);
  }
}

// Hàm gửi nhắc nhở báo cáo tồn Con Cưng
async function sendConCungReminder() {
  const currentChatId = process.env.TELEGRAM_CHAT_ID_CON_CUNG || process.env.TELEGRAM_CHAT_ID || '-5018964680';
  if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
    console.error('Không thể gửi nhắc nhở tồn Con Cưng vì chưa cấu hình TELEGRAM_CHAT_ID_CON_CUNG trong file .env');
    return;
  }

  const message = generateConCungReminderMessage();
  try {
    console.log(`[${moment().tz(timezone).format()}] Đang gửi tin nhắn nhắc nhở tồn Con Cưng đến Chat ID: ${currentChatId}...`);
    await safeSendMessage(currentChatId, message, { parse_mode: 'HTML' });
    console.log('Gửi tin nhắn nhắc nhở tồn Con Cưng thành công!');
    recordReminderSent('TỒN CON CƯNG', currentChatId);
  } catch (error) {
    console.error('Gửi tin nhắn nhắc nhở tồn Con Cưng thất bại:', error.message);
  }
}

// Hàm gửi nhắc nhở báo cáo backlog
async function sendBacklogReminder() {
  const currentChatId = process.env.TELEGRAM_CHAT_ID_BACKLOG || '-1004372456405';
  if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
    console.error('Không thể gửi nhắc nhở backlog vì chưa cấu hình TELEGRAM_CHAT_ID_BACKLOG trong file .env');
    return;
  }

  const message = generateBacklogReminderMessage();
  try {
    console.log(`[${moment().tz(timezone).format()}] Đang gửi tin nhắn nhắc nhở backlog đến Chat ID: ${currentChatId}...`);
    await safeSendMessage(currentChatId, message, { parse_mode: 'HTML' });
    console.log('Gửi tin nhắn nhắc nhở backlog thành công!');
    recordReminderSent('BACKLOG HÀNG NGÀY', currentChatId);
  } catch (error) {
    console.error('Gửi tin nhắn nhắc nhở backlog thất bại:', error.message);
  }
}

// Hàm gửi nhắc nhở luân chuyển backlog
async function sendRotationBacklogReminder() {
  const currentChatId = process.env.TELEGRAM_CHAT_ID_ROTATION_BACKLOG || '-1004372456405';
  if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
    console.error('Không thể gửi nhắc nhở luân chuyển backlog vì chưa cấu hình TELEGRAM_CHAT_ID_ROTATION_BACKLOG trong file .env');
    return;
  }

  const message = generateRotationBacklogReminderMessage();
  try {
    console.log(`[${moment().tz(timezone).format()}] Đang gửi tin nhắn nhắc nhở luân chuyển backlog đến Chat ID: ${currentChatId}...`);
    await safeSendMessage(currentChatId, message, { parse_mode: 'HTML' });
    console.log('Gửi tin nhắn nhắc nhở luân chuyển backlog thành công!');
    recordReminderSent('LUÂN CHUYỂN BACKLOG', currentChatId);
  } catch (error) {
    console.error('Gửi tin nhắn nhắc nhở luân chuyển backlog thất bại:', error.message);
  }
}

// Hàm gửi tin nhắn nhắc nhở CHIỀU
async function sendAfternoonReminder() {
  const currentChatId = process.env.TELEGRAM_CHAT_ID_AFTERNOON || process.env.TELEGRAM_CHAT_ID;
  if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
    console.error('Không thể gửi nhắc nhở chiều vì chưa cấu hình TELEGRAM_CHAT_ID_AFTERNOON trong file .env');
    return;
  }

  const message = generateAfternoonReminderMessage();
  try {
    console.log(`[${moment().tz(timezone).format()}] Đang gửi tin nhắn nhắc nhở CHIỀU đến Chat ID: ${currentChatId}...`);
    await safeSendMessage(currentChatId, message, { parse_mode: 'HTML' });
    console.log('Gửi tin nhắn nhắc nhở CHIỀU thành công!');
    recordReminderSent('CHIỀU (16h30)', currentChatId);
  } catch (error) {
    console.error('Gửi tin nhắn nhắc nhở CHIỀU thất bại:', error.message);
  }
}

// Hàm gửi tin nhắn nhắc nhở GÁN ĐƠN 18H
async function sendAssignOrder18hReminder() {
  const currentChatId = process.env.TELEGRAM_CHAT_ID_ASSIGNED_ORDERS || process.env.TELEGRAM_CHAT_ID_ASSIGN_ORDER || process.env.TELEGRAM_CHAT_ID;
  if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
    console.error('Không thể gửi nhắc nhở gán đơn 18h vì chưa cấu hình Chat ID trong file .env');
    return;
  }

  const message = generateAssignOrder18hReminderMessage();
  try {
    console.log(`[${moment().tz(timezone).format()}] Đang gửi tin nhắn nhắc nhở GÁN ĐƠN 18H đến Chat ID: ${currentChatId}...`);
    await safeSendMessage(currentChatId, message, { parse_mode: 'HTML' });
    console.log('Gửi tin nhắn nhắc nhở GÁN ĐƠN 18H thành công!');
    recordReminderSent('GÁN ĐƠN (18h00)', currentChatId);
  } catch (error) {
    console.error('Gửi tin nhắn nhắc nhở GÁN ĐƠN 18H thất bại:', error.message);
  }
}

// Hàm thực thi script Python kiểm tra 10 shop trọng điểm chưa gán chuyến đi (19h00)
function runUnassignedShops19hCheck() {
  const { exec } = require('child_process');
  const path = require('path');
  const scriptPath = path.join(__dirname, '..', 'pickup-tracking', 'check_unassigned_shops.py');
  
  console.log(`[${moment().tz(timezone).format()}] Đang chạy script Python kiểm tra shop chưa gán chuyến đi 19h00...`);
  exec(`python "${scriptPath}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`[Lỗi 19h00 Check] Lỗi khi chạy script check_unassigned_shops.py: ${error.message}`);
      return;
    }
    console.log(`[19h00 Check Completed]\n${stdout}`);
  });
}



// Thiết lập cron jobs theo loại bot (BOT_TYPE)
if (botType === 'reminder' || botType === 'all') {
  console.log('[Khởi động] Đang thiết lập các cron job BÁO TỰ ĐỘNG HÀNG NGÀY...');

  // Thiết lập cron job nhắc nhở SÁNG (10h00)
  cron.schedule(cronTimeMorning, () => {
    console.log(`[${moment().tz(timezone).format()}] Kích hoạt cron job nhắc nhở SÁNG...`);
    sendMorningReminder();
  }, {
    scheduled: true,
    timezone: timezone
  });

  // Thiết lập các cron job nhắc nhở FL (ca 8h, 17h, 18h)
  cron.schedule('0 8 * * *', () => {
    console.log(`[${moment().tz(timezone).format()}] Kích hoạt cron job nhắc nhở FL ca 08h00...`);
    sendFLReminder();
  }, {
    scheduled: true,
    timezone: timezone
  });

  cron.schedule('0 17 * * *', () => {
    console.log(`[${moment().tz(timezone).format()}] Kích hoạt cron job nhắc nhở FL ca 17h00...`);
    sendFLReminder();
  }, {
    scheduled: true,
    timezone: timezone
  });

  cron.schedule('0 18 * * *', () => {
    console.log(`[${moment().tz(timezone).format()}] Kích hoạt cron job nhắc nhở FL ca 18h00...`);
    sendFLReminder();
  }, {
    scheduled: true,
    timezone: timezone
  });
  // Thiết lập cron job nhắc nhở book xe giao hàng ca 16h00
  cron.schedule('0 16 * * *', () => {
    console.log(`[${moment().tz(timezone).format()}] Kích hoạt cron job nhắc nhở book xe...\n`);
    sendBookTruckReminder();
  }, {
    scheduled: true,
    timezone: timezone
  });

  // Thiết lập cron job nhắc nhở tồn Con Cưng ca 16h00
  cron.schedule('0 16 * * *', () => {
    console.log(`[${moment().tz(timezone).format()}] Kích hoạt cron job nhắc nhở tồn Con Cưng...\n`);
    sendConCungReminder();
  }, {
    scheduled: true,
    timezone: timezone
  });

  // Thiết lập cron job nhắc nhở backlog ca 10h00
  cron.schedule('0 10 * * *', () => {
    console.log(`[${moment().tz(timezone).format()}] Kích hoạt cron job nhắc nhở backlog...\n`);
    sendBacklogReminder();
  }, {
    scheduled: true,
    timezone: timezone
  });

  // Thiết lập cron job nhắc nhở luân chuyển backlog đêm ca 01h00
  cron.schedule('0 1 * * *', () => {
    console.log(`[${moment().tz(timezone).format()}] Kích hoạt cron job nhắc nhở luân chuyển backlog đêm...\n`);
    sendRotationBacklogReminder();
  }, {
    scheduled: true,
    timezone: timezone
  });

  // Thiết lập cron job nhắc nhở ca chiều ca 16h30
  cron.schedule(cronTimeAfternoon, () => {
    console.log(`[${moment().tz(timezone).format()}] Kích hoạt cron job nhắc nhở ca chiều...\n`);
    sendAfternoonReminder();
  }, {
    scheduled: true,
    timezone: timezone
  });

  // Thiết lập cron job nhắc nhở GÁN ĐƠN ca 18h00
  cron.schedule('0 18 * * *', () => {
    console.log(`[${moment().tz(timezone).format()}] Kích hoạt cron job nhắc nhở GÁN ĐƠN 18H...\n`);
    sendAssignOrder18hReminder();
  }, {
    scheduled: true,
    timezone: timezone
  });

  // Thiết lập cron job quét kiểm tra 10 shop chưa gán chuyến đi ca 19h00
  cron.schedule('0 19 * * *', () => {
    console.log(`[${moment().tz(timezone).format()}] Kích hoạt cron job quét kiểm tra shop chưa gán chuyến đi 19H...\n`);
    runUnassignedShops19hCheck();
  }, {
    scheduled: true,
    timezone: timezone
  });


}


// Phản hồi lệnh /status để kiểm tra xem bot còn sống hay không
bot.onText(/\/status(@\w+)?$/, (msg) => {
  const responseChatId = msg.chat.id;
  const currentTime = moment().tz(timezone).format('DD-MM-YYYY HH:mm:ss');
  
  let statusMsg = `✅ <b>Telegram Bot [${botType.toUpperCase()}] đang hoạt động bình thường!</b>\n\n` +
                    `• Múi giờ: <code>${timezone}</code>\n` +
                    `• Giờ hiện tại: <code>${currentTime}</code>\n\n`;
                    
  if (botType === 'reminder' || botType === 'all') {
    const bookTruckGroup = process.env.TELEGRAM_CHAT_ID_BOOK_TRUCK || '-5599911868';
    const conCungGroup = process.env.TELEGRAM_CHAT_ID_CON_CUNG || process.env.TELEGRAM_CHAT_ID || '-5018964680';
    const backlogGroup = process.env.TELEGRAM_CHAT_ID_BACKLOG || '-1004372456405';
    const rotationBacklogGroup = process.env.TELEGRAM_CHAT_ID_ROTATION_BACKLOG || '-1004372456405';
    const assignOrderGroup = process.env.TELEGRAM_CHAT_ID_ASSIGNED_ORDERS || process.env.TELEGRAM_CHAT_ID_ASSIGN_ORDER || '-5018964680';
    statusMsg += `<b>[Cấu hình Báo Tự Động Hàng Ngày]</b>\n` +
                 `• Hẹn giờ SÁNG (10h00): <code>${cronTimeMorning}</code> (Nhóm ID: <code>${chatIdMorning}</code>)\n` +
                 `• Hẹn giờ FL (8h, 17h, 18h): <code>08:00, 17:00, 18:00</code> (Nhóm ID: <code>${chatIdFLReport}</code>)\n` +
                 `• Hẹn giờ BOOK XE (16h00): <code>16:00</code> (Nhóm ID: <code>${bookTruckGroup}</code>)\n` +
                 `• Hẹn giờ TỒN CON CƯNG (16h00): <code>16:00</code> (Nhóm ID: <code>${conCungGroup}</code>)\n` +
                 `• Hẹn giờ BACKLOG (10h00): <code>10:00</code> (Nhóm ID: <code>${backlogGroup}</code>)\n` +
                 `• Hẹn giờ TỒN LC ĐÊM (01h00): <code>01:00</code> (Nhóm ID: <code>${rotationBacklogGroup}</code>)\n` +
                 `• Hẹn giờ CHIỀU (16h30): <code>${cronTimeAfternoon}</code> (Nhóm ID: <code>${chatIdAfternoon}</code>)\n` +
                 `• Hẹn giờ GÁN ĐƠN (18h00): <code>18:00</code> (Nhóm ID: <code>${assignOrderGroup}</code>)\n` +
                 `• Hẹn giờ QUÉT SHOP (19h00): <code>19:00</code> (Nhóm ID: <code>${assignOrderGroup}</code>)\n\n` +
                 `• Thử nghiệm SÁNG: /test_send\n` +
                 `• Thử nghiệm FL: /test_send_fl\n` +
                 `• Thử nghiệm BOOK XE: /test_send_book_truck\n` +
                 `• Thử nghiệm TỒN CON CƯNG: /test_send_con_cung\n` +
                 `• Thử nghiệm BACKLOG: /test_send_backlog\n` +
                 `• Thử nghiệm TỒN LC ĐÊM: /test_send_rotation_backlog\n` +
                 `• Thử nghiệm CHIỀU: /test_send_afternoon\n` +
                 `• Thử nghiệm GÁN ĐƠN 18H: /test_send_assign_order_18h\n` +
                 `• Thử nghiệm QUÉT SHOP 19H: /test_send_unassigned_shops_19h\n`;
  }
  
  bot.sendMessage(responseChatId, statusMsg, { parse_mode: 'HTML' });
});

// Phản hồi lệnh /get_chat_id để lấy ID của nhóm/chat hiện tại
bot.onText(/\/get_chat_id(@\w+)?$/, (msg) => {
  bot.sendMessage(msg.chat.id, `ID của nhóm/chat này là: <code>${msg.chat.id}</code>`, { parse_mode: 'HTML' });
});

// Đăng ký các lệnh thử nghiệm dựa trên loại bot (BOT_TYPE)
if (botType === 'reminder' || botType === 'all') {
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

  // Phản hồi lệnh /test_send_fl để chạy thử gửi nhắc nhở FL
  bot.onText(/\/test_send_fl(@\w+)?$/, async (msg) => {
    const responseChatId = msg.chat.id;
    bot.sendMessage(responseChatId, '🔄 Đang chạy thử nghiệm gửi nhắc nhở FL...');
    
    const currentChatId = process.env.TELEGRAM_CHAT_ID_FL_REPORT || '-4877524742';
    if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
      bot.sendMessage(responseChatId, '❌ Lỗi: Bạn chưa cấu hình TELEGRAM_CHAT_ID_FL_REPORT trong file .env');
      return;
    }

    const message = generateFLReminderMessage();
    try {
      await bot.sendMessage(currentChatId, message, { parse_mode: 'HTML' });
      bot.sendMessage(responseChatId, `✅ Gửi thành công đến Chat ID: <code>${currentChatId}</code>`, { parse_mode: 'HTML' });
    } catch (error) {
      bot.sendMessage(responseChatId, `❌ Gửi thất bại: ${error.message}`);
    }
  });

  // Phản hồi lệnh /test_send_book_truck để chạy thử gửi nhắc nhở book xe
  bot.onText(/\/test_send_book_truck(@\w+)?$/, async (msg) => {
    const responseChatId = msg.chat.id;
    bot.sendMessage(responseChatId, '🔄 Đang chạy thử nghiệm gửi nhắc nhở book xe...');
    
    const currentChatId = process.env.TELEGRAM_CHAT_ID_BOOK_TRUCK || '-5599911868';
    if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
      bot.sendMessage(responseChatId, '❌ Lỗi: Bạn chưa cấu hình TELEGRAM_CHAT_ID_BOOK_TRUCK trong file .env');
      return;
    }

    const message = generateBookTruckReminderMessage();
    try {
      await bot.sendMessage(currentChatId, message, { parse_mode: 'HTML' });
      bot.sendMessage(responseChatId, `✅ Gửi thành công đến Chat ID: <code>${currentChatId}</code>`, { parse_mode: 'HTML' });
    } catch (error) {
      bot.sendMessage(responseChatId, `❌ Gửi thất bại: ${error.message}`);
    }
  });

  // Phản hồi lệnh /test_send_con_cung để chạy thử gửi nhắc nhở tồn Con Cưng
  bot.onText(/\/test_send_con_cung(@\w+)?$/, async (msg) => {
    const responseChatId = msg.chat.id;
    bot.sendMessage(responseChatId, '🔄 Đang chạy thử nghiệm gửi nhắc nhở tồn Con Cưng...');
    
    const currentChatId = process.env.TELEGRAM_CHAT_ID_CON_CUNG || process.env.TELEGRAM_CHAT_ID || '-5018964680';
    if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
      bot.sendMessage(responseChatId, '❌ Lỗi: Bạn chưa cấu hình TELEGRAM_CHAT_ID_CON_CUNG trong file .env');
      return;
    }

    const message = generateConCungReminderMessage();
    try {
      await bot.sendMessage(currentChatId, message, { parse_mode: 'HTML' });
      bot.sendMessage(responseChatId, `✅ Gửi thành công đến Chat ID: <code>${currentChatId}</code>`, { parse_mode: 'HTML' });
    } catch (error) {
      bot.sendMessage(responseChatId, `❌ Gửi thất bại: ${error.message}`);
    }
  });

  // Phản hồi lệnh /test_send_backlog để chạy thử gửi nhắc nhở backlog
  bot.onText(/\/test_send_backlog(@\w+)?$/, async (msg) => {
    const responseChatId = msg.chat.id;
    bot.sendMessage(responseChatId, '🔄 Đang chạy thử nghiệm gửi nhắc nhở backlog...');
    
    const currentChatId = process.env.TELEGRAM_CHAT_ID_BACKLOG || '-1004372456405';
    if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
      bot.sendMessage(responseChatId, '❌ Lỗi: Bạn chưa cấu hình TELEGRAM_CHAT_ID_BACKLOG trong file .env');
      return;
    }

    const message = generateBacklogReminderMessage();
    try {
      await bot.sendMessage(currentChatId, message, { parse_mode: 'HTML' });
      bot.sendMessage(responseChatId, `✅ Gửi thành công đến Chat ID: <code>${currentChatId}</code>`, { parse_mode: 'HTML' });
    } catch (error) {
      bot.sendMessage(responseChatId, `❌ Gửi thất bại: ${error.message}`);
    }
  });

  // Phản hồi lệnh /test_send_rotation_backlog để chạy thử gửi nhắc nhở luân chuyển backlog
  bot.onText(/\/test_send_rotation_backlog(@\w+)?$/, async (msg) => {
    const responseChatId = msg.chat.id;
    bot.sendMessage(responseChatId, '🔄 Đang chạy thử nghiệm gửi nhắc nhở luân chuyển backlog...');
    
    const currentChatId = process.env.TELEGRAM_CHAT_ID_ROTATION_BACKLOG || '-1004372456405';
    if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
      bot.sendMessage(responseChatId, '❌ Lỗi: Bạn chưa cấu hình TELEGRAM_CHAT_ID_ROTATION_BACKLOG trong file .env');
      return;
    }

    const message = generateRotationBacklogReminderMessage();
    try {
      await bot.sendMessage(currentChatId, message, { parse_mode: 'HTML' });
      bot.sendMessage(responseChatId, `✅ Gửi thành công đến Chat ID: <code>${currentChatId}</code>`, { parse_mode: 'HTML' });
    } catch (error) {
      bot.sendMessage(responseChatId, `❌ Gửi thất bại: ${error.message}`);
    }
  });

  // Phản hồi lệnh /test_send_afternoon để chạy thử gửi nhắc nhở CHIỀU
  bot.onText(/\/test_send_afternoon(@\w+)?$/, async (msg) => {
    const responseChatId = msg.chat.id;
    bot.sendMessage(responseChatId, '🔄 Đang chạy thử nghiệm gửi nhắc nhở CHIỀU...');
    
    const currentChatId = process.env.TELEGRAM_CHAT_ID_AFTERNOON || process.env.TELEGRAM_CHAT_ID;
    if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
      bot.sendMessage(responseChatId, '❌ Lỗi: Bạn chưa cấu hình TELEGRAM_CHAT_ID_AFTERNOON trong file .env');
      return;
    }

    const message = generateAfternoonReminderMessage();
    try {
      await bot.sendMessage(currentChatId, message, { parse_mode: 'HTML' });
      bot.sendMessage(responseChatId, `✅ Gửi thành công đến Chat ID: <code>${currentChatId}</code>`, { parse_mode: 'HTML' });
    } catch (error) {
      bot.sendMessage(responseChatId, `❌ Gửi thất bại: ${error.message}`);
    }
  });

  // Phản hồi lệnh /test_send_assign_order_18h để chạy thử gửi nhắc nhở GÁN ĐƠN 18H
  bot.onText(/\/test_send_assign_order_18h(@\w+)?$/, async (msg) => {
    const responseChatId = msg.chat.id;
    bot.sendMessage(responseChatId, '🔄 Đang chạy thử nghiệm gửi nhắc nhở GÁN ĐƠN 18H...');
    
    const currentChatId = process.env.TELEGRAM_CHAT_ID_ASSIGNED_ORDERS || process.env.TELEGRAM_CHAT_ID_ASSIGN_ORDER || process.env.TELEGRAM_CHAT_ID;
    if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
      bot.sendMessage(responseChatId, '❌ Lỗi: Bạn chưa cấu hình TELEGRAM_CHAT_ID_ASSIGNED_ORDERS trong file .env');
      return;
    }

    const message = generateAssignOrder18hReminderMessage();
    try {
      await bot.sendMessage(currentChatId, message, { parse_mode: 'HTML' });
      bot.sendMessage(responseChatId, `✅ Gửi thành công đến Chat ID: <code>${currentChatId}</code>`, { parse_mode: 'HTML' });
    } catch (error) {
      bot.sendMessage(responseChatId, `❌ Gửi thất bại: ${error.message}`);
    }
  });

  // Phản hồi lệnh /test_send_unassigned_shops_19h để chạy thử quét shop chưa gán chuyến đi 19h00
  bot.onText(/\/test_send_unassigned_shops_19h(@\w+)?$/, async (msg) => {
    const responseChatId = msg.chat.id;
    bot.sendMessage(responseChatId, '🔄 Đang kích hoạt tiến trình quét kiểm tra 10 shop trọng điểm tại <code>nhanh.ghn.vn/lastmile/assign-order</code>...', { parse_mode: 'HTML' });
    runUnassignedShops19hCheck();
  });
}

// ==========================================
// CẤU HÌNH VÀ LOGIC NHẮC ẢNH BÁO CÁO FL VÀO CA
// ==========================================
const flStatePath = path.join(__dirname, 'fl_report_state.json');

function loadFLState() {
  const todayStr = moment().tz(timezone).format('YYYY-MM-DD');
  const defaultState = {
    date: todayStr,
    reported: {
      '05:00': false,
      '08:00': false,
      '17:00': false,
      '18:00': false
    },
    warningSent: {
      '05:00': false,
      '08:00': false,
      '17:00': false,
      '18:00': false
    }
  };
  if (fs.existsSync(flStatePath)) {
    try {
      const state = JSON.parse(fs.readFileSync(flStatePath, 'utf8'));
      if (state.date === todayStr) {
        if (!state.warningSent) {
          state.warningSent = { ...defaultState.warningSent };
        }
        return state;
      }
    } catch (e) {
      console.error('Lỗi đọc file fl_report_state.json:', e.message);
    }
  }
  return defaultState;
}

function saveFLState(state) {
  try {
    fs.writeFileSync(flStatePath, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    console.error('Lỗi lưu file fl_report_state.json:', e.message);
  }
}

// Lắng nghe tất cả các tin nhắn để ghi nhận phản hồi của nhân viên và theo dõi ảnh báo cáo FL vào ca
if (botType === 'reminder' || botType === 'all') {
  bot.on('message', (msg) => {
    if (msg.from && msg.from.is_bot) return;
    console.log(`[Tin nhắn nhận được] Chat ID: ${msg.chat.id} | Người gửi: ${msg.from ? (msg.from.username || msg.from.first_name) : 'Unknown'} | Nội dung: ${msg.text || '[Không có text]'}`);
    
    // Ghi nhận phản hồi cho nhắc nhở thông thường
    if (!msg.text || !msg.text.startsWith('/')) {
      recordMessageReceived(msg.chat.id);
    }

    // Theo dõi ảnh báo cáo FL vào ca gửi vào nhóm
    if (Number(msg.chat.id) === Number(chatIdFLReport)) {
      const hasPhoto = msg.photo || (msg.document && msg.document.mime_type && msg.document.mime_type.startsWith('image/'));
      if (hasPhoto) {
        const now = moment().tz(timezone);
        const state = loadFLState();
        let updated = false;

        const shifts = [
          { time: '05:00', start: '04:30', end: '05:15' },
          { time: '08:00', start: '07:30', end: '08:15' },
          { time: '17:00', start: '16:30', end: '17:15' },
          { time: '18:00', start: '17:30', end: '18:15' }
        ];

        for (const shift of shifts) {
          const startTime = moment().tz(timezone).hour(Number(shift.start.split(':')[0])).minute(Number(shift.start.split(':')[1])).second(0);
          const endTime = moment().tz(timezone).hour(Number(shift.end.split(':')[0])).minute(Number(shift.end.split(':')[1])).second(59);
          
          if (now.isBetween(startTime, endTime)) {
            if (!state.reported[shift.time]) {
              state.reported[shift.time] = true;
              updated = true;
              console.log(`[FL Report] Đã ghi nhận ảnh báo cáo cho ca ${shift.time} hôm nay.`);
            }
          }
        }

        if (updated) {
          saveFLState(state);
        }
      }
    }
  });
}

// Hàm kiểm tra và tự động gửi bù các báo cáo bị bỏ lỡ do máy tính tắt/ngủ
async function checkAndRunMissedJobs() {
  // Lịch nhắc tự động đã được gỡ bỏ
}

// Tạo một HTTP server đơn giản để Render có thể ping kiểm tra trạng thái hoạt động (Health Check)
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Telegram Reminder Bot đang hoạt động!\n');
});

const PORT = process.env.PORT || 58392;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`HTTP server đang lắng nghe trên cổng: ${PORT}`);
});

console.log('Bot đã sẵn sàng và đang chạy ngầm...');

// Tự động kiểm tra và chạy bù các báo cáo bị bỏ lỡ
console.log('Đang khởi động tiến trình kiểm tra báo cáo bị bỏ lỡ...');
setTimeout(() => {
  checkAndRunMissedJobs().catch(err => console.error('Lỗi khi chạy bù báo cáo lần đầu:', err));
}, 10000); // Chạy sau khi khởi động 10 giây

setInterval(() => {
  checkAndRunMissedJobs().catch(err => console.error('Lỗi khi quét báo cáo bị bỏ lỡ định kỳ:', err));
}, 5 * 60 * 1000); // Quét định kỳ mỗi 5 phút
