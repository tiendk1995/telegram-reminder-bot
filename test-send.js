require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatIdMorning = process.env.TELEGRAM_CHAT_ID;
const chatIdAfternoon = process.env.TELEGRAM_CHAT_ID_AFTERNOON || process.env.TELEGRAM_CHAT_ID;
const chatIdEvening = process.env.TELEGRAM_CHAT_ID_EVENING || process.env.TELEGRAM_CHAT_ID;
const chatIdNight = process.env.TELEGRAM_CHAT_ID_NIGHT || process.env.TELEGRAM_CHAT_ID;
const usernamesStr = process.env.EMPLOYEE_USERNAMES || '';
const usernamesStrNight = process.env.EMPLOYEE_USERNAMES_NIGHT || '';

const chatIdAssignedOrders = process.env.TELEGRAM_CHAT_ID_ASSIGNED_ORDERS || process.env.TELEGRAM_CHAT_ID_EVENING || process.env.TELEGRAM_CHAT_ID;

// Lấy tham số loại test (morning, afternoon, evening, hoặc night) từ dòng lệnh, mặc định là morning
const testType = process.argv[2] || 'morning';

let targetChatId = chatIdMorning;
if (testType === 'evening') {
  targetChatId = chatIdEvening;
} else if (testType === 'afternoon') {
  targetChatId = chatIdAfternoon;
} else if (testType === 'night') {
  targetChatId = chatIdNight;
} else if (testType === 'assigned_orders') {
  targetChatId = chatIdAssignedOrders;
} else if (testType === 'backlog') {
  targetChatId = chatIdAfternoon;
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

  message = `🚚 <b>BÁO CÁO CA ĐÊM (THỬ NGHIỆM)</b>\n` +
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
} else if (testType === 'backlog') {
  const fs = require('fs');
  const path = require('path');
  const { exec } = require('child_process');
  
  const scriptPath = 'C:\\Users\\tiendk\\.gemini\\antigravity\\scratch\\pickup-tracking\\get_backlog.py';
  const reportPath = 'C:\\Users\\tiendk\\.gemini\\antigravity\\scratch\\pickup-tracking\\backlog_report.txt';
  const photoPath = 'C:\\Users\\tiendk\\.gemini\\antigravity\\scratch\\pickup-tracking\\backlog_page.png';
  
  if (fs.existsSync(reportPath)) {
    try { fs.unlinkSync(reportPath); } catch(e) {}
  }
  if (fs.existsSync(photoPath)) {
    try { fs.unlinkSync(photoPath); } catch(e) {}
  }
  
  console.log('Đang chạy script quét GHN backlog...');
  exec(`python "${scriptPath}"`, (error, stdout, stderr) => {
    if (error) {
      console.error('Lỗi chạy python backlog bot:', error.message);
      process.exit(1);
    }
    
    if (!fs.existsSync(reportPath)) {
      console.error('Không tìm thấy file báo cáo backlog_report.txt');
      process.exit(1);
    }
    
    const reportText = fs.readFileSync(reportPath, 'utf8');
    const bot = new TelegramBot(token, { polling: false });
    
    console.log('Đang gửi tin nhắn...');
    if (fs.existsSync(photoPath)) {
      bot.sendPhoto(targetChatId, photoPath, { caption: reportText, parse_mode: 'HTML' })
        .then((resMsg) => {
          console.log(`✅ GỬI TIN NHẮN THỬ NGHIỆM BACKLOG THÀNH CÔNG!`);
          process.exit(0);
        })
        .catch((err) => {
          console.error('Lỗi gửi ảnh backlog:', err.message);
          process.exit(1);
        });
    } else {
      bot.sendMessage(targetChatId, reportText, { parse_mode: 'HTML' })
        .then((resMsg) => {
          console.log(`✅ GỬI TIN NHẮN THỬ NGHIỆM BACKLOG THÀNH CÔNG!`);
          process.exit(0);
        })
        .catch((err) => {
          console.error('Lỗi gửi text backlog:', err.message);
          process.exit(1);
        });
    }
  });
  return;
} else if (testType === 'assigned_orders') {
  const fs = require('fs');

  const path = require('path');
  const { exec } = require('child_process');
  
  const scriptPath = 'C:\\Users\\tiendk\\.gemini\\antigravity\\scratch\\pickup-tracking\\ghn_trip_list_bot.py';
  const reportPath = 'C:\\Users\\tiendk\\.gemini\\antigravity\\scratch\\pickup-tracking\\assigned_orders_report.txt';
  
  if (fs.existsSync(reportPath)) {
    try { fs.unlinkSync(reportPath); } catch(e) {}
  }
  
  console.log('Đang chạy script quét GHN trip list...');
  exec(`python "${scriptPath}"`, (error, stdout, stderr) => {
    if (error) {
      console.error('Lỗi chạy python trip list bot:', error.message);
      process.exit(1);
    }
    
    if (!fs.existsSync(reportPath)) {
      console.error('Không tìm thấy file báo cáo assigned_orders_report.txt');
      process.exit(1);
    }
    
    const reportText = fs.readFileSync(reportPath, 'utf8');
    
    // Bảng ánh xạ tên trên GHN sang Telegram ID hoặc Username
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
          finalReport = finalReport.split(`<b>${ghnName}</b>`).join(`<a href="tg://user?id=${val}">${ghnName}</a>`);
        } else {
          const usernameFormatted = val.startsWith('@') ? val : `@${val}`;
          finalReport = finalReport.split(`<b>${ghnName}</b>`).join(`<b>${ghnName}</b> (${usernameFormatted})`);
        }
      }
    }

    const bot = new TelegramBot(token, { polling: false });
    console.log('Đang gửi tin nhắn...');
    bot.sendMessage(targetChatId, finalReport, { parse_mode: 'HTML' })
      .then((resMsg) => {
        console.log(`✅ GỬI TIN NHẮN THỬ NGHIỆM ASSIGNED_ORDERS THÀNH CÔNG!`);
        console.log(`ID tin nhắn: ${resMsg.message_id}`);
        console.log(`Nhóm nhận: "${resMsg.chat.title || 'N/A'}" (${resMsg.chat.type})`);
        process.exit(0);
      })
      .catch((err) => {
        console.log(`❌ GỬI TIN NHẮN THỬ NGHIỆM ASSIGNED_ORDERS THẤT BẠI!`);
        console.error('Chi tiết lỗi:', err.message);
        process.exit(1);
      });
  });
  return;
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
