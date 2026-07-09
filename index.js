require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const moment = require('moment-timezone');

// Đọc cấu hình từ .env
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatIdMorning = process.env.TELEGRAM_CHAT_ID;
const chatIdAfternoon = process.env.TELEGRAM_CHAT_ID_AFTERNOON || process.env.TELEGRAM_CHAT_ID;
const chatIdEvening = process.env.TELEGRAM_CHAT_ID_EVENING || process.env.TELEGRAM_CHAT_ID;
const chatIdNight = process.env.TELEGRAM_CHAT_ID_NIGHT || process.env.TELEGRAM_CHAT_ID;
const timezone = process.env.TIMEZONE || 'Asia/Ho_Chi_Minh';

const cronTimeMorning = process.env.CRON_TIME || '0 10 * * *';
const cronTimeAfternoon = process.env.CRON_TIME_AFTERNOON || '30 16 * * *';
const cronTimeEvening = process.env.CRON_TIME_EVENING || '0 20 * * *';
const cronTimeNight = process.env.CRON_TIME_NIGHT || '0 1 * * *';

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

// Khởi tạo bot với chế độ polling (chỉ cho phép long-polling nếu không chạy trên Render)
const bot = new TelegramBot(token, { polling: !isRender });

bot.on('polling_error', (error) => {
  console.error('Lỗi Polling Telegram:', error.message);
});

bot.on('error', (error) => {
  console.error('Lỗi Bot Telegram:', error.message);
});

console.log('=== Telegram Reminder Bot Đang Khởi Động ===');
console.log(`Múi giờ hoạt động: ${timezone}`);
console.log(`Lịch gửi SÁNG (10h00): ${cronTimeMorning} (Nhóm ID: ${chatIdMorning})`);
console.log(`Lịch gửi CHIỀU (16h30): ${cronTimeAfternoon} (Nhóm ID: ${chatIdAfternoon})`);
console.log(`Lịch gửi TỐI (20h00): ${cronTimeEvening} (Nhóm ID: ${chatIdEvening})`);
console.log(`Lịch gửi ĐÊM (01h00): ${cronTimeNight} (Nhóm ID: ${chatIdNight})`);
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

  return `🚚 <b>BÁO CÁO CA SÁNG</b>\n` +
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

// Hàm sinh nội dung tin nhắn nhắc nhở CHIỀU (có tag)
function generateAfternoonReminderMessage() {
  const usernamesStr = process.env.EMPLOYEE_USERNAMES || '';
  const usernames = usernamesStr
    .split(',')
    .map(name => name.trim())
    .filter(name => name.length > 0)
    .map(name => name.startsWith('@') ? name : `@${name}`);

  const tagList = usernames.join(' ');

  return `🚚 <b>BOOK XE NGÀY MAI</b>\n\n` +
         `🚛 NVGH: …… xe\n` +
         `👨💼 FL: …… xe\n\n` +
         `📊 Tổng book: …… xe\n\n` +
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

// Hàm sinh nội dung tin nhắn nhắc nhở ĐÊM (có tag riêng)
function generateNightReminderMessage() {
  const usernamesStr = process.env.EMPLOYEE_USERNAMES_NIGHT || '';
  const usernames = usernamesStr
    .split(',')
    .map(name => name.trim())
    .filter(name => name.length > 0)
    .map(name => name.startsWith('@') ? name : `@${name}`);

  const tagList = usernames.join(' ');

  return `🚚 <b>BÁO CÁO CA ĐÊM</b>\n` +
         `━━━━━━━━━━━━━━━━━━\n` +
         `1️⃣ <b>HÀNG RỚT LUÂN CHUYỂN</b>\n` +
         `↳ 📦 Tên layout: ......\n` +
         `↳ 📢 Đã báo Vận tải & Thảo luận xin xe: ☐ Có / ☐ Chưa\n\n` +
         `2️⃣ <b>ĐƠN TREO LUÂN CHUYỂN</b>\n` +
         `↳ 📋 Số đơn: ......\n` +
         `↳ 📝 Lý do: ......\n\n` +
         `3️⃣ <b>FL</b>\n` +
         `↳ 👨💼 Thực tế: ...... | Đã book: ......\n\n` +
         `🏷️ TAG: ${tagList || ''}`;
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
    console.error('Gửi tin nhắn nhắc nhở sáng thất bại:', error.message);
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
    await bot.sendMessage(currentChatId, message, { parse_mode: 'HTML' });
    console.log('Gửi tin nhắn nhắc nhở CHIỀU thành công!');
  } catch (error) {
    console.error('Gửi tin nhắn nhắc nhở CHIỀU thất bại:', error.message);
  }
}

// Hm gi tin nhn nhc nh TI (Chay python bot de quet GHN va chup anh, sau do gui kem text caption)
const { exec } = require('child_process');
const fs = require('fs');

async function sendEveningPickupReport(targetChatId, statusCallback) {
  if (isRender) {
    console.log(`[${moment().tz(timezone).format()}] Chạy trên Render: Bỏ qua quét Selenium, gửi tin nhắn nhắc nhở mặc định...`);
    const message = generateEveningReminderMessage();
    try {
      await bot.sendMessage(targetChatId, message, { parse_mode: 'HTML' });
      console.log('Gửi nhắc nhở mẫu mặc định thành công (chế độ Render)!');
      if (statusCallback) statusCallback(true, 'Đã gửi nhắc nhở mặc định (Render)');
    } catch (err) {
      console.error('Render fallback send failed:', err.message);
      if (statusCallback) statusCallback(false, `Lỗi gửi tin nhắn Render: ${err.message}`);
    }
    return;
  }

  const scriptPath = 'C:\\Users\\tiendk\\.gemini\\antigravity\\scratch\\pickup-tracking\\ghn_bot.py';
  const reportPath = 'C:\\Users\\tiendk\\.gemini\\antigravity\\scratch\\pickup-tracking\\unfinished_report.txt';
  const photoPath = 'C:\\Users\\tiendk\\.gemini\\antigravity\\scratch\\pickup-tracking\\collect_money_page.png';

  // Xoa cac file bao cao cu neu co
  if (fs.existsSync(reportPath)) {
    try { fs.unlinkSync(reportPath); } catch(e) {}
  }
  if (fs.existsSync(photoPath)) {
    try { fs.unlinkSync(photoPath); } catch(e) {}
  }

  console.log(`[${moment().tz(timezone).format()}] dang chay script quet GHN cho bao cao TI...`);
  
  exec(`python "${scriptPath}"`, async (error, stdout, stderr) => {
    if (error) {
      console.error('Loi chay python bot:', error.message);
      if (statusCallback) statusCallback(false, `Lỗi chạy script Python: ${error.message}`);
      
      // Fallback gui tin nhan mac dinh neu script loi
      const message = generateEveningReminderMessage();
      try {
        await bot.sendMessage(targetChatId, message, { parse_mode: 'HTML' });
      } catch (err) {
        console.error('Fallback send failed:', err.message);
      }
      return;
    }

    try {
      let reportText = '';
      if (fs.existsSync(reportPath)) {
        reportText = fs.readFileSync(reportPath, 'utf8');
      } else {
        reportText = generateEveningReminderMessage();
      }

      if (fs.existsSync(photoPath)) {
        console.log(`Sending report with screenshot to Chat ID: ${targetChatId}`);
        await bot.sendPhoto(targetChatId, photoPath, { caption: reportText, parse_mode: 'HTML' });
      } else {
        console.log(`Sending text-only report to Chat ID: ${targetChatId}`);
        await bot.sendMessage(targetChatId, reportText, { parse_mode: 'HTML' });
      }
      
      console.log('Gui bao cao TI thanh cong!');
      if (statusCallback) statusCallback(true, 'Quét dữ liệu và gửi báo cáo thành công!');
    } catch (sendErr) {
      console.error('Failed to send report:', sendErr.message);
      if (statusCallback) statusCallback(false, `Lỗi gửi tin nhắn Telegram: ${sendErr.message}`);
    }
  });
}

async function sendEveningReminder() {
  const currentChatId = process.env.TELEGRAM_CHAT_ID_EVENING || process.env.TELEGRAM_CHAT_ID;
  if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
    console.error('Khng th gi nhc nh ti v cha cu hnh TELEGRAM_CHAT_ID_EVENING trong file .env');
    return;
  }
  await sendEveningPickupReport(currentChatId);
}

// Hàm gửi tin nhắn nhắc nhở ĐÊM
async function sendNightReminder() {
  const currentChatId = process.env.TELEGRAM_CHAT_ID_NIGHT || process.env.TELEGRAM_CHAT_ID;
  if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
    console.error('Không thể gửi nhắc nhở đêm vì chưa cấu hình TELEGRAM_CHAT_ID_NIGHT trong file .env');
    return;
  }

  const message = generateNightReminderMessage();
  try {
    console.log(`[${moment().tz(timezone).format()}] Đang gửi tin nhắn nhắc nhở ĐÊM đến Chat ID: ${currentChatId}...`);
    await bot.sendMessage(currentChatId, message, { parse_mode: 'HTML' });
    console.log('Gửi tin nhắn nhắc nhở ĐÊM thành công!');
  } catch (error) {
    console.error('Gửi tin nhắn nhắc nhở ĐÊM thất bại:', error.message);
  }
}

// Thiết lập cron job nhắc nhở SÁNG (10h00)
cron.schedule(cronTimeMorning, () => {
  console.log(`[${moment().tz(timezone).format()}] Kích hoạt cron job nhắc nhở SÁNG...`);
  sendMorningReminder();
}, {
  scheduled: true,
  timezone: timezone
});

// Thiết lập cron job nhắc nhở CHIỀU (16h30)
cron.schedule(cronTimeAfternoon, () => {
  console.log(`[${moment().tz(timezone).format()}] Kích hoạt cron job nhắc nhở CHIỀU...`);
  sendAfternoonReminder();
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

// Thiết lập cron job nhắc nhở ĐÊM (01h00 sáng hôm sau)
cron.schedule(cronTimeNight, () => {
  console.log(`[${moment().tz(timezone).format()}] Kích hoạt cron job nhắc nhở ĐÊM...`);
  sendNightReminder();
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
                    `• Hẹn giờ SÁNG (10h00): <code>${cronTimeMorning}</code> (Nhóm ID: <code>${chatIdMorning}</code>)\n` +
                    `• Hẹn giờ CHIỀU (16h30): <code>${cronTimeAfternoon}</code> (Nhóm ID: <code>${chatIdAfternoon}</code>)\n` +
                    `• Hẹn giờ TỐI (20h00): <code>${cronTimeEvening}</code> (Nhóm ID: <code>${chatIdEvening}</code>)\n` +
                    `• Hẹn giờ ĐÊM (01h00): <code>${cronTimeNight}</code> (Nhóm ID: <code>${chatIdNight}</code>)\n\n` +
                    `• Thử nghiệm SÁNG: /test_send\n` +
                    `• Thử nghiệm CHIỀU: /test_send_afternoon\n` +
                    `• Thử nghiệm TỐI: /test_send_evening\n` +
                    `• Thử nghiệm ĐÊM: /test_send_night`;
  
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

// Phản hồi lệnh /test_send_afternoon để chạy thử gửi tin nhắn CHIỀU
bot.onText(/\/test_send_afternoon(@\w+)?$/, async (msg) => {
  const responseChatId = msg.chat.id;
  bot.sendMessage(responseChatId, '🔄 Đang chạy thử nghiệm gửi tin nhắn nhắc nhở CHIỀU...');
  
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

// Phn hi lnh /test_send_evening  chy th gi tin nhn TI
bot.onText(/\/test_send_evening(@\w+)?$/, async (msg) => {
  const responseChatId = msg.chat.id;
  bot.sendMessage(responseChatId, ' Đang chạy thử nghiệm quét dữ liệu GHN và gửi báo cáo TỐI (khoảng 30 giây)...');

  const currentChatId = process.env.TELEGRAM_CHAT_ID_EVENING || process.env.TELEGRAM_CHAT_ID;
  if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
    bot.sendMessage(responseChatId, ' Lỗi: Bạn chưa cấu hình TELEGRAM_CHAT_ID_EVENING trong file .env');
    return;
  }

  await sendEveningPickupReport(currentChatId, (success, statusMsg) => {
    bot.sendMessage(responseChatId, `Kết quả quét: <b>${statusMsg}</b>`, { parse_mode: 'HTML' });
  });
});

// Phản hồi lệnh /test_send_night để chạy thử gửi tin nhắn ĐÊM
bot.onText(/\/test_send_night(@\w+)?$/, async (msg) => {
  const responseChatId = msg.chat.id;
  bot.sendMessage(responseChatId, '🔄 Đang chạy thử nghiệm gửi tin nhắn nhắc nhở ĐÊM...');
  
  const currentChatId = process.env.TELEGRAM_CHAT_ID_NIGHT || process.env.TELEGRAM_CHAT_ID;
  if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
    bot.sendMessage(responseChatId, '❌ Lỗi: Bạn chưa cấu hình TELEGRAM_CHAT_ID_NIGHT trong file .env');
    return;
  }

  const message = generateNightReminderMessage();
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
