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
const chatIdMorning = process.env.TELEGRAM_CHAT_ID;
const chatIdAfternoon = process.env.TELEGRAM_CHAT_ID_AFTERNOON || process.env.TELEGRAM_CHAT_ID;
const chatIdEvening = process.env.TELEGRAM_CHAT_ID_EVENING || process.env.TELEGRAM_CHAT_ID;
const chatIdNight = process.env.TELEGRAM_CHAT_ID_NIGHT || process.env.TELEGRAM_CHAT_ID;
const chatIdAssignedOrders = process.env.TELEGRAM_CHAT_ID_ASSIGNED_ORDERS || process.env.TELEGRAM_CHAT_ID_EVENING || process.env.TELEGRAM_CHAT_ID;
const chatIdSundayRegistration = process.env.TELEGRAM_CHAT_ID_SUNDAY_REGISTRATION || process.env.TELEGRAM_CHAT_ID_ASSIGNED_ORDERS || process.env.TELEGRAM_CHAT_ID_AFTERNOON || process.env.TELEGRAM_CHAT_ID;
const chatIdFLReport = process.env.TELEGRAM_CHAT_ID_FL_REPORT || process.env.TELEGRAM_CHAT_ID_ASSIGNED_ORDERS || process.env.TELEGRAM_CHAT_ID_AFTERNOON || process.env.TELEGRAM_CHAT_ID;

const timezone = process.env.TIMEZONE || 'Asia/Ho_Chi_Minh';

const cronTimeMorning = process.env.CRON_TIME || '0 10 * * *';
const cronTimeAfternoon = process.env.CRON_TIME_AFTERNOON || '30 16 * * *';
const cronTimeEvening = process.env.CRON_TIME_EVENING || '0 20 * * *';
const cronTimeNight = process.env.CRON_TIME_NIGHT || '0 1 * * *';
const cronTimeSundayStats = process.env.CRON_TIME_SUNDAY_STATS || '5 23 * * 0';
const cronTimeSundayRegistration = process.env.CRON_TIME_SUNDAY_REGISTRATION || '0 0 * * 0';
const cronTimeAssignedOrders = process.env.CRON_TIME_ASSIGNED_ORDERS || '30 23 * * *';
const cronTimeBacklog = process.env.CRON_TIME_BACKLOG || '30 10 * * *';
const cronTimeRotationBacklog = process.env.CRON_TIME_ROTATION_BACKLOG || '15 1 * * *';


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

console.log('=== Telegram Reminder Bot Đang Khởi Động ===');
console.log(`Múi giờ hoạt động: ${timezone}`);
console.log(`Lịch gửi SÁNG (10h00): ${cronTimeMorning} (Nhóm ID: ${chatIdMorning})`);
console.log(`Lịch gửi CHIỀU (16h30): ${cronTimeAfternoon} (Nhóm ID: ${chatIdAfternoon})`);
console.log(`Lịch gửi TỐI (20h00): ${cronTimeEvening} (Nhóm ID: ${chatIdEvening})`);
console.log(`Lịch gửi ĐĂNG KÝ LỊCH (Chủ Nhật 00h00): ${cronTimeSundayRegistration} (Nhóm ID: ${chatIdSundayRegistration})`);
console.log(`Lịch gửi ĐƠN GÁN (23h30): ${cronTimeAssignedOrders} (Nhóm ID: ${chatIdAssignedOrders})`);
console.log(`Lịch gửi BACKLOG (10h30): ${cronTimeBacklog} (Nhóm ID: ${chatIdAfternoon})`);
console.log(`Lịch gửi BACKLOG LUÂN CHUYỂN (01h15): ${cronTimeRotationBacklog} (Nhóm ID: ${chatIdAfternoon})`);
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

// Hàm thống kê không trả lời bot TUẦN
async function sendWeeklyUnrepliedStats(targetChatId, startStr, endStr, statusCallback) {
  const history = loadHistory();
  
  const startDate = moment(startStr, 'YYYY-MM-DD');
  const endDate = moment(endStr, 'YYYY-MM-DD');
  
  const reportDays = [];
  let currentDate = startDate.clone();
  while (currentDate.isSameOrBefore(endDate)) {
    reportDays.push(currentDate.format('YYYY-MM-DD'));
    currentDate.add(1, 'days');
  }

  const vnDaysOfWeek = {
    'Monday': 'Thứ Hai',
    'Tuesday': 'Thứ Ba',
    'Wednesday': 'Thứ Tư',
    'Thursday': 'Thứ Năm',
    'Friday': 'Thứ Sáu',
    'Saturday': 'Thứ Bảy',
    'Sunday': 'Chủ Nhật'
  };

  let unrepliedText = '';
  let totalSentAllWeek = 0;
  let totalUnrepliedAllWeek = 0;
  let violationDaysCount = 0;

  reportDays.forEach(dateStr => {
    const dayData = history[dateStr] || {};
    const unrepliedShifts = [];
    
    for (const shiftName in dayData) {
      const item = dayData[shiftName];
      if (Number(item.chatId) === Number(targetChatId)) {
        totalSentAllWeek++;
        if (!item.replied) {
          unrepliedShifts.push(shiftName);
          totalUnrepliedAllWeek++;
        }
      }
    }

    if (unrepliedShifts.length > 0) {
      violationDaysCount++;
      const displayDayName = vnDaysOfWeek[moment(dateStr, 'YYYY-MM-DD').format('dddd')] || moment(dateStr, 'YYYY-MM-DD').format('dddd');
      const displayDate = moment(dateStr, 'YYYY-MM-DD').format('DD/MM');
      
      unrepliedText += `📅 <b>${displayDayName} (${displayDate})</b>:\n`;
      unrepliedShifts.forEach(shift => {
        unrepliedText += ` • ${shift}: ❌ Không trả lời -> <b>Phạt 100k</b>\n`;
      });
      unrepliedText += `\n`;
    }
  });

  const displayStart = startDate.format('DD/MM/YYYY');
  const displayEnd = endDate.format('DD/MM/YYYY');
  
  let message = `📋 <b>THỐNG KÊ KHÔNG TRẢ LỜI BOT TUẦN QUA</b>\n` +
                `📅 Tuần: <b>${displayStart} - ${displayEnd}</b>\n\n`;

  if (totalSentAllWeek === 0) {
    message += `ℹ️ Không ghi nhận khung giờ nhắc nhở nào được gửi đến nhóm này trong tuần qua.`;
  } else if (totalUnrepliedAllWeek === 0) {
    message += `✅ Tuyệt vời! Tuần qua tất cả các khung giờ nhắc nhở đều đã được phản hồi đầy đủ!`;
  } else {
    const totalFine = totalUnrepliedAllWeek * 100;
    message += `📊 <b>TỔNG HỢP VI PHẠM:</b>\n` +
               `• Số ngày không trả lời: <b>${violationDaysCount} ngày</b>\n` +
               `• Số lần/ca không trả lời: <b>${totalUnrepliedAllWeek} lần</b>\n` +
               `• Tổng tiền phạt: <b>${totalFine}.000đ</b>\n\n` +
               `📝 <b>Danh sách chi tiết:</b>\n` + unrepliedText;
    message += `⚠️ <i>Yêu cầu các nhân sự nghiêm túc phản hồi đầy đủ các thông báo của bot!</i>`;
  }

  try {
    console.log(`[${moment().tz(timezone).format()}] Gửi thống kê tuần không trả lời đến Chat ID: ${targetChatId}...`);
    await bot.sendMessage(targetChatId, message, { parse_mode: 'HTML' });
    console.log('Gửi thống kê tuần không trả lời thành công!');
    if (statusCallback) statusCallback(true, 'Gửi thống kê tuần không trả lời thành công!');
  } catch (error) {
    console.error('Gửi thống kê tuần không trả lời thất bại:', error.message);
    if (statusCallback) statusCallback(false, `Lỗi gửi tin nhắn Telegram: ${error.message}`);
  }
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
    recordReminderSent('SÁNG (10h00)', currentChatId);
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
    recordReminderSent('CHIỀU (16h30)', currentChatId);
  } catch (error) {
    console.error('Gửi tin nhắn nhắc nhở CHIỀU thất bại:', error.message);
  }
}

// Hm gi tin nhn nhc nh TI (Chay python bot de quet GHN va chup anh, sau do gui kem text caption)
const { exec } = require('child_process');

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
  const jsonPath = 'C:\\Users\\tiendk\\.gemini\\antigravity\\scratch\\pickup-tracking\\unfinished_staff.json';

  // Xoa cac file bao cao cu neu co
  if (fs.existsSync(reportPath)) {
    try { fs.unlinkSync(reportPath); } catch(e) {}
  }
  if (fs.existsSync(photoPath)) {
    try { fs.unlinkSync(photoPath); } catch(e) {}
  }
  if (fs.existsSync(jsonPath)) {
    try { fs.unlinkSync(jsonPath); } catch(e) {}
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
      let todayUnfinished = [];
      if (fs.existsSync(jsonPath)) {
        try {
          todayUnfinished = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        } catch (e) {
          console.error('Lỗi đọc file unfinished_staff.json:', e.message);
        }
      }

      // Đọc lịch sử app_history.json để đếm số ngày trễ app của tuần này
      const historyPath = path.join(__dirname, 'app_history.json');
      let history = {};
      if (fs.existsSync(historyPath)) {
        try {
          history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
        } catch (err) {
          console.error('Lỗi đọc file app_history.json:', err.message);
        }
      }

      // Lấy các ngày của tuần hiện tại (Từ Thứ Hai đến Chủ Nhật)
      const todayMoment = moment().tz(timezone);
      const startOfWeek = todayMoment.clone().startOf('isoWeek');
      const weekDates = [];
      for (let i = 0; i < 7; i++) {
        weekDates.push(startOfWeek.clone().add(i, 'days').format('YYYY-MM-DD'));
      }

      const todayStr = todayMoment.format('YYYY-MM-DD');
      const counts = {};

      // 1. Đếm số ngày trễ trong tuần qua các ngày trước đó
      for (const dStr of weekDates) {
        if (dStr === todayStr) continue; // Ngày hôm nay tính riêng từ dữ liệu vừa quét
        const list = history[dStr];
        if (list && Array.isArray(list)) {
          for (const item of list) {
            const name = (typeof item === 'string') ? item : (item && item.name);
            if (name) {
              counts[name] = (counts[name] || 0) + 1;
            }
          }
        }
      }

      // 2. Cộng thêm trạng thái chưa kết thúc app của ngày hôm nay nếu có
      for (const item of todayUnfinished) {
        if (item && item.unfinished_app === true && item.name) {
          counts[item.name] = (counts[item.name] || 0) + 1;
        }
      }

      // 3. Tìm các nhân viên có số ngày trễ app trong tuần > 3 ngày
      const lateStaffNames = Object.keys(counts).filter(name => counts[name] > 3);

      // 4. Tạo danh sách báo cáo kết hợp
      const combinedMap = new Map();

      // Đưa các nhân sự chưa hoàn thành hôm nay vào trước
      for (const item of todayUnfinished) {
        combinedMap.set(item.name, {
          name: item.name,
          reasons: [...item.reasons],
          isTodayUnfinished: true
        });
      }

      // Đưa thêm các nhân sự trễ > 3 ngày (báo đến hết tuần) vào danh sách
      for (const name of lateStaffNames) {
        const count = counts[name];
        if (combinedMap.has(name)) {
          // Nếu hôm nay họ cũng chưa hoàn thành, thêm ghi chú cảnh báo vào lý do
          const existing = combinedMap.get(name);
          if (!existing.reasons.some(r => r.includes('Trễ >3 ngày tuần này'))) {
            existing.reasons.push(`Trễ >3 ngày tuần này (${count} ngày)`);
          }
        } else {
          // Nếu hôm nay họ đã hoàn thành (hoặc không có ca), nhưng vì trễ > 3 ngày nên vẫn cảnh báo đến hết tuần
          combinedMap.set(name, {
            name: name,
            reasons: [`Trễ >3 ngày tuần này (${count} ngày)`],
            isTodayUnfinished: false
          });
        }
      }

      const combinedList = Array.from(combinedMap.values());

      // Rebuild reportText
      let reportText = "📋 <b>KIỂM TRA CUỐI NGÀY</b>\n\n" +
                       "1️⃣ <b>Cập nhật và kết thúc App giao hàng</b>\n" +
                       "✅ Cập nhật đầy đủ trạng thái đơn hàng.\n" +
                       "✅ Kết thúc App giao hàng trước khi hết ca.\n\n" +
                       "2️⃣ <b>Nộp COD</b>\n" +
                       "💰 Tiến hành nộp COD đúng quy định.\n" +
                       "⚠️ Quá 12:00 cùng ngày chưa nộp sẽ bị ghi nhận là chiếm dụng COD.\n\n";

      if (combinedList.length > 0) {
        reportText += "<b>Nhờ các bạn sau hoàn thành gấp:</b>\n";
        for (const item of combinedList) {
          reportText += `- <b>${item.name}</b> (${item.reasons.join(', ')})\n`;
        }
      } else {
        reportText += "<b>Tất cả nhân viên đã hoàn thành và kết thúc ca. Xin cảm ơn!</b>\n";
      }
      reportText += "\nXin cảm ơn mọi người đã phối hợp!\n";

      // Bang anh xa ten tren GHN sang Telegram ID (so) hoac Username (chu) de tag
      const staffMapping = {
        "Lê Viết Lực": "6281487432",
        "lê viết lực": "6281487432",
        "Nguyễn Thị Huyền": "719990341",
        "nguyễn thị huyền": "719990341",
        "Nguyễn Ngọc Duy": "8403744896",
        "nguyễn ngọc duy": "8403744896",
        "Trần Thị Thu Trang": "7708350872",
        "trần thị thu trang": "7708350872",
        "Nguyễn Trung Kiên": "7304483491",
        "nguyễn trung kiên": "7304483491",
        "Nguyễn Thị Trang": "3170505",
        "nguyễn thị trang": "3170505",
        "Hoàng Quốc Việt": "868743297",
        "hoàng quốc việt": "868743297",
        "Nguyễn Xuân Hùng": "8711123602",
        "nguyễn xuân hùng": "8711123602",
        "Vũ Thế Sơn": "1617730207",
        "vũ thế sơn": "1617730207",
        "Nguyễn Như Hà": "1748264109",
        "nguyễn như hà": "1748264109",
        "Nguyễn Mạnh Hà": "1725476265",
        "nguyễn mạnh hà": "1725476265",
        "Dương Văn Đức": "5600166410",
        "dương văn đức": "5600166410",
        "Nghiêm Tuấn Hiệp": "1646953895",
        "nghiêm tuấn hiệp": "1646953895",
        "Nguyễn Tuấn Mạnh Đức": "967937134",
        "nguyễn tuấn mạnh đức": "967937134",
        "Nguyễn Thế Duy": "7857172639",
        "nguyễn thế duy": "7857172639",
        "Nguyễn Văn Linh": "7590771051",
        "nguyễn văn linh": "7590771051",
        "Nguyễn Tiến Thành": "1478287224",
        "nguyễn tiến thành": "1478287224",
        "Ngô Tiến Nam": "5899662464",
        "ngô tiến nam": "5899662464",
        "Tiến Nam": "5899662464",
        "tiến nam": "5899662464",
        "Nguyễn Cao Sơn": "8414659971",
        "nguyễn cao sơn": "8414659971",
        "Lưu Thiên Kiệt": "7316177616",
        "lưu thiên kiệt": "7316177616",
        "Nguyễn Văn Vững": "8709372325",
        "nguyễn văn vững": "8709372325",
        "Hà Tuấn Đạt": "5245179531",
        "hà tuấn đạt": "5245179531",
        "Lê Đức Anh": "8927608603",
        "lê đức anh": "8927608603"
      };

      let finalReport = reportText;
      for (const [ghnName, tgIdentifier] of Object.entries(staffMapping)) {
        if (tgIdentifier && tgIdentifier.trim() !== '') {
          const val = tgIdentifier.trim();
          if (/^\d+$/.test(val)) {
            // Neu la ID dang so: Tao the HTML tag an
            finalReport = finalReport.split(`<b>${ghnName}</b>`).join(`<a href="tg://user?id=${val}">${ghnName}</a>`);
          } else {
            // Neu la Username dang chu: Chem them @username
            const usernameFormatted = val.startsWith('@') ? val : `@${val}`;
            finalReport = finalReport.split(`<b>${ghnName}</b>`).join(`<b>${ghnName}</b> (${usernameFormatted})`);
          }
        }
      }

      if (fs.existsSync(photoPath)) {
        console.log(`Sending report with screenshot to Chat ID: ${targetChatId}`);
        await bot.sendPhoto(targetChatId, photoPath, { caption: finalReport, parse_mode: 'HTML' });
      } else {
        console.log(`Sending text-only report to Chat ID: ${targetChatId}`);
        await bot.sendMessage(targetChatId, finalReport, { parse_mode: 'HTML' });
      }
      
      recordReminderSent('TỐI (20h00)', targetChatId);
      
      console.log('Gui bao cao TI thanh cong!');
      
      // MỚI: Nếu đang là khung giờ 23h, thực hiện lưu lịch sử chưa kết thúc App
      const currentHour = moment().tz(timezone).hour();
      if (currentHour === 23) {
        saveAppUnfinishedHistory(jsonPath);
      }
      
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

// Đã thay thế báo cáo ca đêm bằng Thống kê không trả lời bot (sendDailyUnrepliedStats)

// Hàm lưu lịch sử nhân viên chưa kết thúc App lúc 23h
function saveAppUnfinishedHistory(jsonPath) {
  try {
    if (!fs.existsSync(jsonPath)) {
      console.warn('Không tìm thấy file unfinished_staff.json để lưu lịch sử.');
      return;
    }
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const staffList = JSON.parse(rawData);
    
    // Lọc ra những người có unfinished_app === true và lưu tên kèm số lượng đơn
    const unfinishedData = staffList
      .filter(item => item.unfinished_app === true)
      .map(item => ({
        name: item.name,
        count: item.unfinished_app_count || 0
      }));
      
    const historyPath = path.join(__dirname, 'app_history.json');
    let history = {};
    if (fs.existsSync(historyPath)) {
      try {
        history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      } catch (err) {
        console.error('Lỗi phân tích cú pháp app_history.json:', err.message);
      }
    }
    
    const todayStr = moment().tz(timezone).format('YYYY-MM-DD');
    history[todayStr] = unfinishedData;
    
    // Giới hạn lịch sử lưu tối đa 60 ngày để tránh phình dung lượng file
    const dates = Object.keys(history).sort();
    if (dates.length > 60) {
      const toDelete = dates.slice(0, dates.length - 60);
      for (const d of toDelete) {
        delete history[d];
      }
    }
    
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
    console.log(`[Lịch sử] Đã lưu danh sách chưa kết thúc App cho ngày ${todayStr}:`, unfinishedData);
  } catch (error) {
    console.error('Lỗi khi lưu lịch sử chưa kết thúc App:', error.message);
  }
}

// Hàm gửi tin nhắn nhắc nhở ĐĂNG KÝ LỊCH TUẦN MỚI vào chiều Chủ Nhật
async function sendSundayRegistrationReminder() {
  const currentChatId = chatIdSundayRegistration;
  if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
    console.error('Không thể gửi nhắc nhở đăng ký vì chưa cấu hình TELEGRAM_CHAT_ID_SUNDAY_REGISTRATION');
    return;
  }

  // Tính toán ngày Thứ Hai và Chủ Nhật của tuần tiếp theo
  const nextMonday = moment().tz(timezone).add(1, 'days').format('DD/MM');
  const nextSunday = moment().tz(timezone).add(7, 'days').format('DD/MM');

  const message = `📋 <b>ĐĂNG KÝ LỊCH TUẦN MỚI (Long Biên - Nhóm 1)</b>\n` +
                  `📅 Thời gian: Từ <b>Thứ Hai ${nextMonday}</b> đến <b>Chủ Nhật ${nextSunday}</b>\n\n` +
                  `Mời các anh em tranh thủ đăng ký lịch làm việc tuần tiếp theo:\n` +
                  `• 🚚 <b>NVGH</b> (Nhân viên giao hàng)\n` +
                  `• 🌅 <b>NVXL SÁNG</b>\n` +
                  `• 🌆 <b>NVXL CHIỀU</b>\n\n` +
                  `<i>Mọi người nhanh chóng cập nhật nhé! Xin cảm ơn!</i>`;

  try {
    console.log(`[${moment().tz(timezone).format()}] Đang gửi nhắc nhở đăng ký lịch tuần mới đến Chat ID: ${currentChatId}...`);
    await bot.sendMessage(currentChatId, message, { parse_mode: 'HTML' });
    console.log('Gửi nhắc nhở đăng ký lịch tuần mới thành công!');
  } catch (error) {
    console.error('Gửi nhắc nhở đăng ký lịch tuần mới thất bại:', error.message);
  }
}

// Hàm gửi báo cáo thống kê tuần vào Chủ Nhật hàng tuần
async function sendSundayStats() {
  const currentChatId = process.env.TELEGRAM_CHAT_ID_EVENING || process.env.TELEGRAM_CHAT_ID;
  if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
    console.error('Không thể gửi thống kê tuần vì chưa cấu hình TELEGRAM_CHAT_ID_EVENING trong file .env');
    return;
  }
  
  const historyPath = path.join(__dirname, 'app_history.json');
  if (!fs.existsSync(historyPath)) {
    console.log('Không có file lịch sử app_history.json để làm thống kê tuần.');
    await bot.sendMessage(currentChatId, `📊 <b>THỐNG KÊ TUẦN (Chủ Nhật)</b>\n\nChưa có dữ liệu lịch sử để thực hiện thống kê.`, { parse_mode: 'HTML' });
    return;
  }
  
  let history = {};
  try {
    history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  } catch (e) {
    console.error('Lỗi đọc file app_history.json:', e.message);
    await bot.sendMessage(currentChatId, `📊 <b>THỐNG KÊ TUẦN (Chủ Nhật)</b>\n\nLỗi hệ thống khi đọc dữ liệu lịch sử.`, { parse_mode: 'HTML' });
    return;
  }
  
  // Lấy các ngày của tuần hiện tại (Từ Thứ 2 đến Chủ Nhật)
  // Vì job chạy lúc 23h05 tối Chủ Nhật, nên ngày hiện tại đang là Chủ Nhật.
  const today = moment().tz(timezone);
  const weekDates = [];
  
  for (let i = 0; i < 7; i++) {
    const dStr = today.clone().subtract(i, 'days').format('YYYY-MM-DD');
    weekDates.push(dStr);
  }
  weekDates.reverse();
  
  const counts = {};
  const details = {};
  
  for (const dStr of weekDates) {
    const list = history[dStr];
    if (list && Array.isArray(list)) {
      for (const item of list) {
        let name = '';
        let count = 0;
        if (typeof item === 'string') {
          name = item;
        } else if (item && typeof item === 'object') {
          name = item.name;
          count = item.count;
        }
        
        if (name) {
          counts[name] = (counts[name] || 0) + 1;
          if (!details[name]) details[name] = [];
          
          const countStr = count > 0 ? ` (${count} ĐH)` : '';
          details[name].push(`${moment(dStr).format('DD/MM')}${countStr}`);
        }
      }
    }
  }
  
  const staffMapping = {
    "Lê Viết Lực": "6281487432",
    "lê viết lực": "6281487432",
    "Nguyễn Thị Huyền": "719990341",
    "nguyễn thị huyền": "719990341",
    "Nguyễn Ngọc Duy": "8403744896",
    "nguyễn ngọc duy": "8403744896",
    "Trần Thị Thu Trang": "7708350872",
    "trần thị thu trang": "7708350872",
    "Nguyễn Trung Kiên": "7304483491",
    "nguyễn trung kiên": "7304483491",
    "Nguyễn Thị Trang": "3170505",
    "nguyễn thị trang": "3170505",
    "Hoàng Quốc Việt": "868743297",
    "hoàng quốc việt": "868743297",
    "Nguyễn Xuân Hùng": "8711123602",
    "nguyễn xuân hùng": "8711123602",
    "Vũ Thế Sơn": "1617730207",
    "vũ thế sơn": "1617730207",
    "Nguyễn Như Hà": "1748264109",
    "nguyễn như hà": "1748264109",
    "Nguyễn Mạnh Hà": "1725476265",
    "nguyễn mạnh hà": "1725476265",
    "Dương Văn Đức": "5600166410",
    "dương văn đức": "5600166410",
    "Nghiêm Tuấn Hiệp": "1646953895",
    "nghiêm tuấn hiệp": "1646953895",
    "Nguyễn Tuấn Mạnh Đức": "967937134",
    "nguyễn tuấn mạnh đức": "967937134",
    "Nguyễn Thế Duy": "7857172639",
    "nguyễn thế duy": "7857172639",
    "Nguyễn Văn Linh": "7590771051",
    "nguyễn văn linh": "7590771051",
    "Nguyễn Tiến Thành": "1478287224",
    "nguyễn tiến thành": "1478287224",
    "Ngô Tiến Nam": "5899662464",
    "ngô tiến nam": "5899662464",
    "Tiến Nam": "5899662464",
    "tiến nam": "5899662464",
    "Nguyễn Cao Sơn": "8414659971",
    "nguyễn cao sơn": "8414659971",
    "Lưu Thiên Kiệt": "7316177616",
    "lưu thiên kiệt": "7316177616",
    "Nguyễn Văn Vững": "8709372325",
    "nguyễn văn vững": "8709372325",
    "Hà Tuấn Đạt": "5245179531",
    "hà tuấn đạt": "5245179531",
    "Lê Đức Anh": "8927608603",
    "lê đức anh": "8927608603"
  };
  
  // Lọc ra những người trễ > 3 ngày (từ 4 ngày trở lên)
  const targetStaff = Object.entries(counts)
    .filter(([name, count]) => count > 3)
    .sort((a, b) => b[1] - a[1]);
    
  const lines = [];
  lines.push(`📊 <b>THỐNG KÊ TUẦN - CHƯA HOÀN TẤT APP (>3 NGÀY)</b>`);
  lines.push(`━━━━━━━━━━━━━━━━━━`);
  lines.push(`<i>Dữ liệu thống kê lúc 23h hàng ngày từ Thứ 2 đến Chủ Nhật tuần này.</i>\n`);
  
  if (targetStaff.length > 0) {
    lines.push(`⚠️ <b>Danh sách nhân sự chưa hoàn tất app trên 3 ngày:</b>\n`);
    for (const [name, count] of targetStaff) {
      const tgIdentifier = staffMapping[name];
      let displayName = `<b>${name}</b>`;
      if (tgIdentifier && tgIdentifier.trim() !== '') {
        const val = tgIdentifier.trim();
        if (/^\d+$/.test(val)) {
          displayName = `<a href="tg://user?id=${val}">${name}</a>`;
        } else {
          const usernameFormatted = val.startsWith('@') ? val : `@${val}`;
          displayName = `<b>${name}</b> (${usernameFormatted})`;
        }
      }
      
      const dateItems = details[name];
      const formattedPairs = [];
      for (let i = 0; i < dateItems.length; i += 2) {
        if (i + 1 < dateItems.length) {
          const left = dateItems[i];
          const paddedLeft = left + ' '.repeat(Math.max(0, 14 - left.length));
          formattedPairs.push(`• ${paddedLeft} | • ${dateItems[i+1]}`);
        } else {
          formattedPairs.push(`• ${dateItems[i]}`);
        }
      }
      
      lines.push(`<blockquote>👤 ${displayName} — <b>${count} ngày trễ</b>\n<code>${formattedPairs.join('\n')}</code></blockquote>`);
    }
  } else {
    lines.push(`🎉 Không có nhân sự nào chưa hoàn tất app trên 3 ngày trong tuần này. Xin cảm ơn mọi người!`);
  }
  
  try {
    console.log(`[${moment().tz(timezone).format()}] Đang gửi báo cáo thống kê tuần đến Chat ID: ${currentChatId}...`);
    await bot.sendMessage(currentChatId, lines.join('\n'), { parse_mode: 'HTML' });
    console.log('Gửi báo cáo thống kê tuần thành công!');
  } catch (error) {
    console.error('Gửi báo cáo thống kê tuần thất bại:', error.message);
  }
}
async function sendDailyAssignedOrdersReport(targetChatId, statusCallback) {
  if (isRender) {
    console.log(`[${moment().tz(timezone).format()}] Chạy trên Render: Bỏ qua quét Selenium trip list.`);
    if (statusCallback) statusCallback(false, 'Render không hỗ trợ chạy Selenium quét trip list');
    return;
  }

  const scriptPath = 'C:\\Users\\tiendk\\.gemini\\antigravity\\scratch\\pickup-tracking\\ghn_trip_list_bot.py';
  const reportPath = 'C:\\Users\\tiendk\\.gemini\\antigravity\\scratch\\pickup-tracking\\assigned_orders_report.txt';

  // Xóa file báo cáo cũ nếu có
  if (fs.existsSync(reportPath)) {
    try { fs.unlinkSync(reportPath); } catch(e) {}
  }

  console.log(`[${moment().tz(timezone).format()}] Đang chạy script quét GHN trip list cho báo cáo đơn gán...`);
  
  exec(`python "${scriptPath}"`, async (error, stdout, stderr) => {
    if (error) {
      console.error('Lỗi chạy python trip list bot:', error.message);
      if (statusCallback) statusCallback(false, `Lỗi chạy script Python: ${error.message}`);
      return;
    }

    try {
      if (!fs.existsSync(reportPath)) {
        console.error('Không tìm thấy file báo cáo assigned_orders_report.txt');
        if (statusCallback) statusCallback(false, 'Không tìm thấy file kết quả báo cáo');
        return;
      }

      const reportText = fs.readFileSync(reportPath, 'utf8');

      // Bảng ánh xạ tên trên GHN sang Telegram ID (số) hoặc Username (chữ) để tag
      const staffMapping = {
        "Lê Viết Lực": "6281487432",
        "lê viết lực": "6281487432",
        "Nguyễn Thị Huyền": "719990341",
        "nguyễn thị huyền": "719990341",
        "Nguyễn Ngọc Duy": "8403744896",
        "nguyễn ngọc duy": "8403744896",
        "Trần Thị Thu Trang": "7708350872",
        "trần thị thu trang": "7708350872",
        "Nguyễn Trung Kiên": "7304483491",
        "nguyễn trung kiên": "7304483491",
        "Nguyễn Thị Trang": "3170505",
        "nguyễn thị trang": "3170505",
        "Hoàng Quốc Việt": "868743297",
        "hoàng quốc việt": "868743297",
        "Nguyễn Xuân Hùng": "8711123602",
        "nguyễn xuân hùng": "8711123602",
        "Vũ Thế Sơn": "1617730207",
        "vũ thế sơn": "1617730207",
        "Nguyễn Như Hà": "1748264109",
        "nguyễn như hà": "1748264109",
        "Nguyễn Mạnh Hà": "1725476265",
        "nguyễn mạnh hà": "1725476265",
        "Dương Văn Đức": "5600166410",
        "dương văn đức": "5600166410",
        "Nghiêm Tuấn Hiệp": "1646953895",
        "nghiêm tuấn hiệp": "1646953895",
        "Nguyễn Tuấn Mạnh Đức": "967937134",
        "nguyễn tuấn mạnh đức": "967937134",
        "Nguyễn Thế Duy": "7857172639",
        "nguyễn thế duy": "7857172639",
        "Nguyễn Văn Linh": "7590771051",
        "nguyễn văn linh": "7590771051",
        "Nguyễn Tiến Thành": "1478287224",
        "nguyễn tiến thành": "1478287224",
        "Ngô Tiến Nam": "5899662464",
        "ngô tiến nam": "5899662464",
        "Tiến Nam": "5899662464",
        "tiến nam": "5899662464",
        "Nguyễn Cao Sơn": "8414659971",
        "nguyễn cao sơn": "8414659971",
        "Lưu Thiên Kiệt": "7316177616",
        "lưu thiên kiệt": "7316177616",
        "Nguyễn Văn Vững": "8709372325",
        "nguyễn văn vững": "8709372325",
        "Hà Tuấn Đạt": "5245179531",
        "hà tuấn đạt": "5245179531",
        "Lê Đức Anh": "8927608603",
        "lê đức anh": "8927608603"
      };

      let finalReport = reportText;
      for (const [ghnName, tgIdentifier] of Object.entries(staffMapping)) {
        if (tgIdentifier && tgIdentifier.trim() !== '') {
          const val = tgIdentifier.trim();
          if (/^\d+$/.test(val)) {
            // Nếu là ID dạng số: Tạo thẻ HTML tag ẩn
            finalReport = finalReport.split(`<b>${ghnName}</b>`).join(`<a href="tg://user?id=${val}">${ghnName}</a>`);
          } else {
            // Nếu là Username dạng chữ: Chèn thêm @username
            const usernameFormatted = val.startsWith('@') ? val : `@${val}`;
            finalReport = finalReport.split(`<b>${ghnName}</b>`).join(`<b>${ghnName}</b> (${usernameFormatted})`);
          }
        }
      }

      console.log(`Gửi báo cáo đơn gán đến Chat ID: ${targetChatId}`);
      await bot.sendMessage(targetChatId, finalReport, { parse_mode: 'HTML' });
      recordReminderSent('ĐƠN GÁN (23h30)', targetChatId);
      console.log('Gửi báo cáo đơn gán thành công!');
      
      if (statusCallback) statusCallback(true, 'Gửi báo cáo đơn gán thành công!');
    } catch (sendErr) {
      console.error('Gửi báo cáo đơn gán thất bại:', sendErr.message);
      if (statusCallback) statusCallback(false, `Lỗi gửi tin nhắn Telegram: ${sendErr.message}`);
    }
  });
}

async function sendDailyBacklogReport(targetChatId, statusCallback) {
  if (isRender) {
    console.log(`[${moment().tz(timezone).format()}] Chạy trên Render: Bỏ qua quét Selenium backlog.`);
    if (statusCallback) statusCallback(false, 'Render không hỗ trợ chạy Selenium quét backlog');
    return;
  }

  const scriptPath = 'C:\\Users\\tiendk\\.gemini\\antigravity\\scratch\\pickup-tracking\\get_backlog.py';
  const reportPath = 'C:\\Users\\tiendk\\.gemini\\antigravity\\scratch\\pickup-tracking\\backlog_report.txt';
  const photoPath = 'C:\\Users\\tiendk\\.gemini\\antigravity\\scratch\\pickup-tracking\\backlog_page.png';

  // Xóa file báo cáo cũ nếu có
  if (fs.existsSync(reportPath)) {
    try { fs.unlinkSync(reportPath); } catch(e) {}
  }
  if (fs.existsSync(photoPath)) {
    try { fs.unlinkSync(photoPath); } catch(e) {}
  }

  console.log(`[${moment().tz(timezone).format()}] Đang chạy script quét GHN backlog...`);
  
  exec(`python "${scriptPath}"`, async (error, stdout, stderr) => {
    if (error) {
      console.error('Lỗi chạy python backlog bot:', error.message);
      if (statusCallback) statusCallback(false, `Lỗi chạy script Python: ${error.message}`);
      return;
    }

    try {
      if (!fs.existsSync(reportPath)) {
        console.error('Không tìm thấy file báo cáo backlog_report.txt');
        if (statusCallback) statusCallback(false, 'Không tìm thấy file kết quả báo cáo');
        return;
      }

      const reportText = fs.readFileSync(reportPath, 'utf8');

      if (fs.existsSync(photoPath)) {
        console.log(`Gửi báo cáo backlog kèm ảnh đến Chat ID: ${targetChatId}`);
        await bot.sendPhoto(targetChatId, photoPath, { caption: reportText, parse_mode: 'HTML' });
      } else {
        console.log(`Gửi báo cáo backlog dạng text đến Chat ID: ${targetChatId}`);
        await bot.sendMessage(targetChatId, reportText, { parse_mode: 'HTML' });
      }
      
      recordReminderSent('BACKLOG (10h30)', targetChatId);
      
      console.log('Gửi báo cáo backlog thành công!');
      if (statusCallback) statusCallback(true, 'Gửi báo cáo backlog thành công!');
    } catch (sendErr) {
      console.error('Gửi báo cáo backlog thất bại:', sendErr.message);
      if (statusCallback) statusCallback(false, `Lỗi gửi tin nhắn Telegram: ${sendErr.message}`);
    }
  });
}

async function sendDailyRotationBacklogReport(targetChatId, statusCallback) {
  if (isRender) {
    console.log(`[${moment().tz(timezone).format()}] Chạy trên Render: Bỏ qua quét Selenium rotation backlog.`);
    if (statusCallback) statusCallback(false, 'Render không hỗ trợ chạy Selenium quét rotation backlog');
    return;
  }

  const scriptPath = 'C:\\Users\\tiendk\\.gemini\\antigravity\\scratch\\pickup-tracking\\get_rotation_backlog.py';
  const reportPath = 'C:\\Users\\tiendk\\.gemini\\antigravity\\scratch\\pickup-tracking\\rotation_backlog_report.txt';
  const photoPath = 'C:\\Users\\tiendk\\.gemini\\antigravity\\scratch\\pickup-tracking\\rotation_backlog_page.png';

  // Xóa file báo cáo cũ nếu có
  if (fs.existsSync(reportPath)) {
    try { fs.unlinkSync(reportPath); } catch(e) {}
  }
  if (fs.existsSync(photoPath)) {
    try { fs.unlinkSync(photoPath); } catch(e) {}
  }

  console.log(`[${moment().tz(timezone).format()}] Đang chạy script quét GHN rotation backlog...`);
  
  exec(`python "${scriptPath}"`, async (error, stdout, stderr) => {
    if (error) {
      console.error('Lỗi chạy python rotation backlog bot:', error.message);
      if (statusCallback) statusCallback(false, `Lỗi chạy script Python: ${error.message}`);
      return;
    }

    try {
      if (!fs.existsSync(reportPath)) {
        console.error('Không tìm thấy file báo cáo rotation_backlog_report.txt');
        if (statusCallback) statusCallback(false, 'Không tìm thấy file kết quả báo cáo');
        return;
      }

      const reportText = fs.readFileSync(reportPath, 'utf8');

      if (fs.existsSync(photoPath)) {
        console.log(`Gửi báo cáo rotation backlog kèm ảnh đến Chat ID: ${targetChatId}`);
        await bot.sendPhoto(targetChatId, photoPath, { caption: reportText, parse_mode: 'HTML' });
      } else {
        console.log(`Gửi báo cáo rotation backlog dạng text đến Chat ID: ${targetChatId}`);
        await bot.sendMessage(targetChatId, reportText, { parse_mode: 'HTML' });
      }
      
      recordReminderSent('BACKLOG LUÂN CHUYỂN (01h15)', targetChatId);
      
      console.log('Gửi báo cáo rotation backlog thành công!');
      if (statusCallback) statusCallback(true, 'Gửi báo cáo rotation backlog thành công!');
    } catch (sendErr) {
      console.error('Gửi báo cáo rotation backlog thất bại:', sendErr.message);
      if (statusCallback) statusCallback(false, `Lỗi gửi tin nhắn Telegram: ${sendErr.message}`);
    }
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
    }
  };
  if (fs.existsSync(flStatePath)) {
    try {
      const state = JSON.parse(fs.readFileSync(flStatePath, 'utf8'));
      if (state.date === todayStr) {
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

// Hàm kiểm tra và nhắc nhở nếu chưa gửi ảnh báo cáo FL vào ca sau 15 phút
async function checkFLReportAndRemind(shiftTime, shiftName) {
  if (!chatIdFLReport || chatIdFLReport === 'YOUR_CHAT_ID_HERE') {
    console.error(`Không thể gửi nhắc nhở FL ca ${shiftName} vì chưa cấu hình Chat ID phù hợp.`);
    return;
  }

  const state = loadFLState();
  if (!state.reported[shiftTime]) {
    const message = `📸 <b>CẢNH BÁO: CHƯA BÁO CÁO ẢNH VÀO CA</b>\n\n` +
                    `⚠️ Đã quá 15 phút nhưng hệ thống chưa nhận được ảnh báo cáo FL vào ca <b>${shiftName}</b>.\n\n` +
                    `💸 <a href="tg://user?id=8403744896">@Duy</a>: Thu 100.000đ theo quy định.`;
    try {
      console.log(`[FL Report] Gửi nhắc nhở chưa có ảnh báo cáo ca ${shiftTime} đến nhóm ${chatIdFLReport}`);
      await bot.sendMessage(chatIdFLReport, message, { parse_mode: 'HTML' });
    } catch (e) {
      console.error(`[FL Report] Gửi nhắc nhở thất bại cho ca ${shiftTime}:`, e.message);
    }
  } else {
    console.log(`[FL Report] Ca ${shiftTime} đã gửi ảnh báo cáo đầy đủ.`);
  }
}

// Phản hồi lệnh /test_send_fl để chạy thử gửi tin nhắn cảnh báo nhắc nhở FL
bot.onText(/\/test_send_fl(@\w+)?$/, async (msg) => {
  const responseChatId = msg.chat.id;
  if (!chatIdFLReport || chatIdFLReport === 'YOUR_CHAT_ID_HERE') {
    bot.sendMessage(responseChatId, '❌ Lỗi: Chưa cấu hình TELEGRAM_CHAT_ID_FL_REPORT trong file .env');
    return;
  }

  const message = `📸 <b>CẢNH BÁO: CHƯA BÁO CÁO ẢNH VÀO CA (THỬ NGHIỆM)</b>\n\n` +
                  `⚠️ Đã quá 15 phút nhưng hệ thống chưa nhận được ảnh báo cáo FL vào ca <b>08h00</b>.\n\n` +
                  `💸 <a href="tg://user?id=8403744896">@Duy</a>: Thu 100.000đ theo quy định.`;
  try {
    await bot.sendMessage(chatIdFLReport, message, { parse_mode: 'HTML' });
    bot.sendMessage(responseChatId, `✅ Đã gửi thử nghiệm nhắc nhở FL đến nhóm ID: ${chatIdFLReport}`);
  } catch (e) {
    bot.sendMessage(responseChatId, `❌ Gửi thất bại: ${e.message}`);
  }
});


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

// Thiết lập cron job gửi thống kê TUẦN (Chủ Nhật lúc 23h05)
cron.schedule(cronTimeSundayStats, () => {
  console.log(`[${moment().tz(timezone).format()}] Kích hoạt cron job gửi thống kê TUẦN...`);
  sendSundayStats();
}, {
  scheduled: true,
  timezone: timezone
});

// Thiết lập cron job gửi nhắc nhở ĐĂNG KÝ LỊCH TUẦN MỚI (Chủ Nhật lúc 00h00)
cron.schedule(cronTimeSundayRegistration, () => {
  console.log(`[${moment().tz(timezone).format()}] Kích hoạt cron job nhắc nhở ĐĂNG KÝ LỊCH TUẦN MỚI...`);
  sendSundayRegistrationReminder();
}, {
  scheduled: true,
  timezone: timezone
});

// Thiết lập cron job gửi báo cáo ĐƠN GÁN HÀNG NGÀY (23h30)
cron.schedule(cronTimeAssignedOrders, () => {
  console.log(`[${moment().tz(timezone).format()}] Kích hoạt cron job gửi báo cáo ĐƠN GÁN HÀNG NGÀY...`);
  if (!chatIdAssignedOrders || chatIdAssignedOrders === 'YOUR_CHAT_ID_HERE') {
    console.error('Không thể gửi báo cáo đơn gán vì chưa cấu hình Chat ID phù hợp trong file .env');
    return;
  }
  sendDailyAssignedOrdersReport(chatIdAssignedOrders);
}, {
  scheduled: true,
  timezone: timezone
});

// Thiết lập cron job gửi báo cáo BACKLOG HÀNG NGÀY (10h30)
cron.schedule(cronTimeBacklog, () => {
  console.log(`[${moment().tz(timezone).format()}] Kích hoạt cron job gửi báo cáo BACKLOG HÀNG NGÀY...`);
  const currentChatId = process.env.TELEGRAM_CHAT_ID_AFTERNOON || process.env.TELEGRAM_CHAT_ID;
  if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
    console.error('Không thể gửi báo cáo backlog vì chưa cấu hình Chat ID phù hợp trong file .env');
    return;
  }
  sendDailyBacklogReport(currentChatId);
}, {
  scheduled: true,
  timezone: timezone
});

// Thiết lập cron job gửi báo cáo BACKLOG LUÂN CHUYỂN HÀNG NGÀY (01h15)
cron.schedule(cronTimeRotationBacklog, () => {
  console.log(`[${moment().tz(timezone).format()}] Kích hoạt cron job gửi báo cáo BACKLOG LUÂN CHUYỂN HÀNG NGÀY...`);
  const currentChatId = process.env.TELEGRAM_CHAT_ID_AFTERNOON || process.env.TELEGRAM_CHAT_ID;
  if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
    console.error('Không thể gửi báo cáo rotation backlog vì chưa cấu hình Chat ID phù hợp trong file .env');
    return;
  }
  sendDailyRotationBacklogReport(currentChatId);
}, {
  scheduled: true,
  timezone: timezone
});

// Thiết lập các cron job nhắc nhở ảnh báo cáo FL vào ca (Kiểm tra sau ca 15 phút)
cron.schedule('15 5 * * *', () => {
  console.log(`[${moment().tz(timezone).format()}] Kích hoạt cron job kiểm tra ảnh báo cáo FL ca 05h00...`);
  checkFLReportAndRemind('05:00', '05h00');
}, {
  scheduled: true,
  timezone: timezone
});

cron.schedule('15 8 * * *', () => {
  console.log(`[${moment().tz(timezone).format()}] Kích hoạt cron job kiểm tra ảnh báo cáo FL ca 08h00...`);
  checkFLReportAndRemind('08:00', '08h00');
}, {
  scheduled: true,
  timezone: timezone
});

cron.schedule('15 17 * * *', () => {
  console.log(`[${moment().tz(timezone).format()}] Kích hoạt cron job kiểm tra ảnh báo cáo FL ca 17h00...`);
  checkFLReportAndRemind('17:00', '17h00');
}, {
  scheduled: true,
  timezone: timezone
});

cron.schedule('15 18 * * *', () => {
  console.log(`[${moment().tz(timezone).format()}] Kích hoạt cron job kiểm tra ảnh báo cáo FL ca 18h00...`);
  checkFLReportAndRemind('18:00', '18h00');
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
                    `• Hẹn giờ ĐƠN GÁN (23h30): <code>${cronTimeAssignedOrders}</code> (Nhóm ID: <code>${chatIdAssignedOrders}</code>)\n` +
                    `• Hẹn giờ THỐNG KÊ TUẦN (Chủ Nhật): <code>${cronTimeSundayStats}</code> (Nhóm ID: <code>${chatIdEvening}</code>)\n` +
                    `• Hẹn giờ ĐĂNG KÝ LỊCH (Chủ Nhật): <code>${cronTimeSundayRegistration}</code> (Nhóm ID: <code>${chatIdSundayRegistration}</code>)\n` +
                    `• Hẹn giờ BACKLOG (10h30): <code>${cronTimeBacklog}</code> (Nhóm ID: <code>${chatIdAfternoon}</code>)\n` +
                    `• Hẹn giờ BACKLOG LUÂN CHUYỂN (01h15): <code>${cronTimeRotationBacklog}</code> (Nhóm ID: <code>${chatIdAfternoon}</code>)\n` +
                    `• Nhắc ảnh FL vào ca (5:00, 8:00, 17:00, 18:00 - Nhắc sau 15p) (Nhóm ID: <code>${chatIdFLReport}</code>)\n\n` +
                    `• Thử nghiệm SÁNG: /test_send\n` +
                    `• Thử nghiệm CHIỀU: /test_send_afternoon\n` +
                    `• Thử nghiệm TỐI: /test_send_evening\n` +
                    `• Thử nghiệm ĐƠN GÁN: /test_send_assigned_orders\n` +
                    `• Thử nghiệm NHẮC ẢNH FL: /test_send_fl\n` +
                    `• Thử nghiệm BACKLOG: /test_send_backlog\n` +
                    `• Thử nghiệm BACKLOG LUÂN CHUYỂN: /test_send_rotation_backlog\n` +
                    `• Thử nghiệm THỐNG KÊ TUẦN: /test_send_stats\n` +
                    `• Thử nghiệm ĐĂNG KÝ LỊCH: /test_send_registration`;
  
  bot.sendMessage(responseChatId, statusMsg, { parse_mode: 'HTML' });
});

// Phản hồi lệnh /test_send_stats để chạy thử gửi thống kê tuần
bot.onText(/\/test_send_stats(@\w+)?$/, async (msg) => {
  const responseChatId = msg.chat.id;
  bot.sendMessage(responseChatId, '🔄 Đang chạy thử nghiệm tổng hợp thống kê tuần (Chủ Nhật)...');
  await sendSundayStats();
});

// Phản hồi lệnh /test_send_assigned_orders để chạy thử gửi báo cáo đơn gán hàng ngày
bot.onText(/\/test_send_assigned_orders(@\w+)?$/, async (msg) => {
  const responseChatId = msg.chat.id;
  bot.sendMessage(responseChatId, '🔄 Đang chạy thử nghiệm quét dữ liệu GHN và gửi báo cáo ĐƠN GÁN (khoảng 30 giây)...');

  if (!chatIdAssignedOrders || chatIdAssignedOrders === 'YOUR_CHAT_ID_HERE') {
    bot.sendMessage(responseChatId, '❌ Lỗi: Bạn chưa cấu hình TELEGRAM_CHAT_ID_ASSIGNED_ORDERS trong file .env');
    return;
  }

  await sendDailyAssignedOrdersReport(chatIdAssignedOrders, (success, statusMsg) => {
    bot.sendMessage(responseChatId, `Kết quả quét đơn gán: <b>${statusMsg}</b>`, { parse_mode: 'HTML' });
  });
});

// Phản hồi lệnh /test_send_backlog để chạy thử gửi báo cáo backlog hàng ngày
bot.onText(/\/test_send_backlog(@\w+)?$/, async (msg) => {
  const responseChatId = msg.chat.id;
  bot.sendMessage(responseChatId, '🔄 Đang chạy thử nghiệm quét dữ liệu GHN và gửi báo cáo BACKLOG (khoảng 30 giây)...');

  const currentChatId = process.env.TELEGRAM_CHAT_ID_AFTERNOON || process.env.TELEGRAM_CHAT_ID;
  if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
    bot.sendMessage(responseChatId, '❌ Lỗi: Bạn chưa cấu hình TELEGRAM_CHAT_ID_AFTERNOON trong file .env');
    return;
  }

  await sendDailyBacklogReport(currentChatId, (success, statusMsg) => {
    bot.sendMessage(responseChatId, `Kết quả quét backlog: <b>${statusMsg}</b>`, { parse_mode: 'HTML' });
  });
});

// Phản hồi lệnh /test_send_rotation_backlog để chạy thử gửi báo cáo backlog luân chuyển hàng ngày
bot.onText(/\/test_send_rotation_backlog(@\w+)?$/, async (msg) => {
  const responseChatId = msg.chat.id;
  bot.sendMessage(responseChatId, '🔄 Đang chạy thử nghiệm quét dữ liệu GHN và gửi báo cáo BACKLOG LUÂN CHUYỂN (khoảng 30 giây)...');

  const currentChatId = process.env.TELEGRAM_CHAT_ID_AFTERNOON || process.env.TELEGRAM_CHAT_ID;
  if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
    bot.sendMessage(responseChatId, '❌ Lỗi: Bạn chưa cấu hình TELEGRAM_CHAT_ID_AFTERNOON trong file .env');
    return;
  }

  await sendDailyRotationBacklogReport(currentChatId, (success, statusMsg) => {
    bot.sendMessage(responseChatId, `Kết quả quét backlog luân chuyển: <b>${statusMsg}</b>`, { parse_mode: 'HTML' });
  });
});


// Phản hồi lệnh /test_send_registration để chạy thử gửi nhắc nhở đăng ký lịch
bot.onText(/\/test_send_registration(@\w+)?$/, async (msg) => {
  const responseChatId = msg.chat.id;
  bot.sendMessage(responseChatId, '🔄 Đang chạy thử nghiệm gửi nhắc nhở ĐĂNG KÝ LỊCH TUẦN MỚI...');
  
  const currentChatId = process.env.TELEGRAM_CHAT_ID_AFTERNOON || process.env.TELEGRAM_CHAT_ID;
  if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
    bot.sendMessage(responseChatId, '❌ Lỗi: Bạn chưa cấu hình TELEGRAM_CHAT_ID_AFTERNOON trong file .env');
    return;
  }

  const nextMonday = moment().tz(timezone).add(1, 'days').format('DD/MM');
  const nextSunday = moment().tz(timezone).add(7, 'days').format('DD/MM');

  const message = `📋 <b>ĐĂNG KÝ LỊCH TUẦN MỚI (Long Biên - Nhóm 1) (THỬ NGHIỆM)</b>\n` +
                  `📅 Thời gian: Từ <b>Thứ Hai ${nextMonday}</b> đến <b>Chủ Nhật ${nextSunday}</b>\n\n` +
                  `Mời các anh em tranh thủ đăng ký lịch làm việc tuần tiếp theo:\n` +
                  `• 🚚 <b>NVGH</b> (Nhân viên giao hàng)\n` +
                  `• 🌅 <b>NVXL SÁNG</b>\n` +
                  `• 🌆 <b>NVXL CHIỀU</b>\n\n` +
                  `<i>Mọi người nhanh chóng cập nhật nhé! Xin cảm ơn!</i>`;

  try {
    await bot.sendMessage(currentChatId, message, { parse_mode: 'HTML' });
    bot.sendMessage(responseChatId, `✅ Gửi thành công đến Chat ID: <code>${currentChatId}</code>`, { parse_mode: 'HTML' });
  } catch (error) {
    bot.sendMessage(responseChatId, `❌ Gửi thất bại: ${error.message}`);
  }
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

// Phản hồi lệnh /test_send_evening để chạy thử gửi tin nhắn TỐI
bot.onText(/\/test_send_evening(@\w+)?$/, async (msg) => {
  const responseChatId = msg.chat.id;
  bot.sendMessage(responseChatId, '🔄 Đang chạy thử nghiệm quét dữ liệu GHN và gửi báo cáo TỐI (khoảng 30 giây)...');

  const currentChatId = process.env.TELEGRAM_CHAT_ID_EVENING || process.env.TELEGRAM_CHAT_ID;
  if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
    bot.sendMessage(responseChatId, '❌ Lỗi: Bạn chưa cấu hình TELEGRAM_CHAT_ID_EVENING trong file .env');
    return;
  }

  await sendEveningPickupReport(currentChatId, (success, statusMsg) => {
    bot.sendMessage(responseChatId, `Kết quả quét: <b>${statusMsg}</b>`, { parse_mode: 'HTML' });
  });
});

// Phản hồi lệnh /get_chat_id để lấy ID của nhóm/chat hiện tại
bot.onText(/\/get_chat_id(@\w+)?$/, (msg) => {
  bot.sendMessage(msg.chat.id, `ID của nhóm/chat này là: <code>${msg.chat.id}</code>`, { parse_mode: 'HTML' });
});

// Phản hồi lệnh /test_send_unreplied_stats hoặc /test_send_night để chạy thử gửi thống kê không trả lời bot tuần này
bot.onText(/\/(test_send_unreplied_stats|test_send_night)(@\w+)?$/, async (msg) => {
  const responseChatId = msg.chat.id;
  bot.sendMessage(responseChatId, '🔄 Đang chạy thử nghiệm tổng hợp THỐNG KÊ KHÔNG TRẢ LỜI BOT của tuần này (từ Thứ Hai đến hiện tại)...');
  
  const currentChatId = process.env.TELEGRAM_CHAT_ID_AFTERNOON || process.env.TELEGRAM_CHAT_ID;
  if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
    bot.sendMessage(responseChatId, '❌ Lỗi: Bạn chưa cấu hình TELEGRAM_CHAT_ID_AFTERNOON trong file .env');
    return;
  }

  const startOfWeek = moment().tz(timezone).startOf('isoWeek').format('YYYY-MM-DD');
  const today = moment().tz(timezone).format('YYYY-MM-DD');
  await sendWeeklyUnrepliedStats(currentChatId, startOfWeek, today, (success, statusMsg) => {
    bot.sendMessage(responseChatId, `Kết quả gửi: <b>${statusMsg}</b>`, { parse_mode: 'HTML' });
  });
});

// Lắng nghe tất cả các tin nhắn để ghi nhận phản hồi của nhân viên và theo dõi ảnh báo cáo FL vào ca
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
