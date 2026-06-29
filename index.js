const express = require('express');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// ================================================================
// 1. CẤU HÌNH & BIẾN MÔI TRƯỜNG
// ================================================================
const {
  ZALO_BOT_TOKEN,
  SUPABASE_URL,
  SUPABASE_KEY,
  GROUP_ID,
  ADMIN_NAME = 'Admin',
  VICE_NAME = 'Phó nhóm',
  ADMIN_ID
} = process.env;

if (!ZALO_BOT_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ THIẾU BIẾN MÔI TRƯỜNG: Cần ZALO_BOT_TOKEN, SUPABASE_URL, SUPABASE_KEY');
  process.exit(1);
}

if (!ADMIN_ID) {
  console.error('❌ THIẾU ADMIN_ID: Vui lòng đặt biến môi trường ADMIN_ID');
  process.exit(1);
}

// ================================================================
// 2. KHỞI TẠO SUPABASE & EXPRESS
// ================================================================
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 7860;

// ================================================================
// 3. HÀM GỬI TIN NHẮN
// ================================================================
async function sendZaloMessage(chatId, text) {
  if (!chatId) {
    console.warn('⚠️ Không có chatId, bỏ qua gửi tin nhắn.');
    return;
  }
  const url = `https://bot-api.zaloplatforms.com/bot${ZALO_BOT_TOKEN}/sendMessage`;
  try {
    const response = await axios.post(
      url,
      { chat_id: chatId, text },
      { headers: { 'Content-Type': 'application/json' } }
    );
    console.log(`✅ Đã gửi tin nhắn đến ${chatId}:`, response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Lỗi gửi tin nhắn:', error.response?.data || error.message);
    throw error;
  }
}

// ================================================================
// 4. HÀM TRUY VẤN SUPABASE
// ================================================================
async function getConfig(key) {
  const { data, error } = await supabase
    .from('bot_config')
    .select('value')
    .eq('key', key)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error(`❌ getConfig(${key}) lỗi:`, error);
    return null;
  }
  return data?.value;
}

async function setConfig(key, value) {
  const { error } = await supabase
    .from('bot_config')
    .upsert({ key, value }, { onConflict: 'key' });
  if (error) {
    console.error(`❌ setConfig(${key}) lỗi:`, error);
    return false;
  }
  return true;
}

async function removeConfig(key) {
  const { error } = await supabase
    .from('bot_config')
    .delete()
    .eq('key', key);
  if (error) {
    console.error(`❌ removeConfig(${key}) lỗi:`, error);
    return false;
  }
  return true;
}

// Lấy tất cả các filter key (có prefix 'filter_')
async function getAllFilters() {
  const { data, error } = await supabase
    .from('bot_config')
    .select('key, value')
    .like('key', 'filter_%');
  if (error) {
    console.error('❌ getAllFilters lỗi:', error);
    return [];
  }
  return data || [];
}

async function getAllTriggers() {
  const { data, error } = await supabase
    .from('bot_triggers')
    .select('keyword, response');
  if (error) {
    console.error('❌ getAllTriggers lỗi:', error);
    return [];
  }
  return data || [];
}

async function getTrigger(keyword) {
  const { data, error } = await supabase
    .from('bot_triggers')
    .select('keyword, response')
    .eq('keyword', keyword)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error(`❌ getTrigger(${keyword}) lỗi:`, error);
    return null;
  }
  return data;
}

async function setTrigger(keyword, response) {
  const { error } = await supabase
    .from('bot_triggers')
    .upsert({ keyword, response }, { onConflict: 'keyword' });
  if (error) {
    console.error(`❌ setTrigger(${keyword}) lỗi:`, error);
    return false;
  }
  return true;
}

async function removeTrigger(keyword) {
  const { error } = await supabase
    .from('bot_triggers')
    .delete()
    .eq('keyword', keyword);
  if (error) {
    console.error(`❌ removeTrigger(${keyword}) lỗi:`, error);
    return false;
  }
  return true;
}

// ================================================================
// 5. KIỂM TRA ADMIN (BUFFER HEX)
// ================================================================
function isAdmin(userId) {
  if (!userId) {
    console.log('⚠️ userId không hợp lệ (null/undefined).');
    return false;
  }
  const adminId = process.env.ADMIN_ID;
  if (!adminId) {
    console.error('❌ Biến môi trường ADMIN_ID chưa được thiết lập!');
    return false;
  }
  try {
    const userIdHex = Buffer.from(String(userId), 'utf8').toString('hex');
    const adminIdHex = Buffer.from(String(adminId), 'utf8').toString('hex');
    console.log(`🔍 User ID hex   : ${userIdHex}`);
    console.log(`🔍 Admin ID hex  : ${adminIdHex}`);
    const isMatch = userIdHex === adminIdHex;
    console.log(`🔍 Kết quả        : ${isMatch ? '✅ LÀ ADMIN' : '❌ KHÔNG PHẢI ADMIN'}`);
    return isMatch;
  } catch (error) {
    console.error('❌ Lỗi khi chuyển đổi Buffer:', error);
    return false;
  }
}

// Mảng câu trả lời "bố láo" / cà khịa ngẫu nhiên
const RANDOM_REPLIES = [
  'Kêu bố có việc gì đấy cnn trhi? 😏',
];

function getRandomReply() {
  return RANDOM_REPLIES[Math.floor(Math.random() * RANDOM_REPLIES.length)];
}

const NON_ADMIN_REPLIES = [
  '🤣 Ngáo đá à? Mày không có quyền đâu!',
];

function getRandomInsult() {
  return NON_ADMIN_REPLIES[Math.floor(Math.random() * NON_ADMIN_REPLIES.length)];
}

// ================================================================
// 6. HÀM TRÍCH XUẤT LỆNH (CHỈ KIỂM TRA STARTSWITH('/'))
// ================================================================
function parseCommand(cleanedText) {
  if (!cleanedText || typeof cleanedText !== 'string' || !cleanedText.trim().startsWith('/')) {
    return null;
  }
  const parts = cleanedText.trim().split(/\s+/);
  if (parts.length === 0) return null;
  return {
    command: parts[0].toLowerCase(),
    args: parts.slice(1),
  };
}

// ================================================================
// 7. XỬ LÝ LỆNH
// ================================================================

// Hàm trả về bảng hướng dẫn lỗi cú pháp
function getSyntaxHelp() {
  return (
    '⚠️ Lệnh không hợp lệ hoặc sai cú pháp rồi!\n\n' +
    '📋 Danh sách lệnh hợp lệ:\n' +
    '🔹 Cho mọi người:\n' +
    '   - /help : Xem trợ giúp\n' +
    '   - /link : Xem toàn bộ danh sách link\n' +
    '   - /link [tên_link] : Lấy nội dung link cụ thể\n' +
    '   - /filters : Xem danh sách từ khóa tự động phản hồi\n' +
    '🔹 Cho Admin:\n' +
    '   - /addlink [tên_link] [nội dung]\n' +
    '   - /removelink [tên_link]\n' +
    '   - /filter [từ_khóa] [câu_trả_lời]\n' +
    '   - /stop [từ_khóa]'
  );
}

async function handleCommand(cleanedText, chatId, senderId) {
  // Nếu cleanedText không bắt đầu bằng '/', trả về false để webhook xử lý filter
  const parsed = parseCommand(cleanedText);
  if (!parsed) return false;

  const { command, args } = parsed;

  // Hàm yêu cầu admin
  const requireAdmin = async () => {
    if (!isAdmin(senderId)) {
      await sendZaloMessage(chatId, getRandomInsult());
      return false;
    }
    return true;
  };

  switch (command) {
    // ====== LỆNH CÔNG KHAI ======
    case '/help': {
      const helpMsg =
        '📋 HƯỚNG DẪN SỬ DỤNG BOT:\n\n' +
        '🔹 Lệnh cho mọi người:\n' +
        '   /link : Xem danh sách tất cả link\n' +
        '   /link [tên] : Xem nội dung của link đó\n' +
        '   /filters : Xem danh sách từ khóa tự động phản hồi\n\n' +
        '🔹 Lệnh cho Admin:\n' +
        '   /addlink [tên_link] [nội dung] : Thêm link mới\n' +
        '   /removelink [tên_link] : Xóa link\n' +
        '   /filter [từ_khóa] [câu_trả_lời] : Cài đặt tự động phản hồi\n' +
        '   /stop [từ_khóa] : Xóa từ khóa tự động phản hồi';
      await sendZaloMessage(chatId, helpMsg);
      return true;
    }

    case '/link': {
      if (args.length === 0) {
        const triggers = await getAllTriggers();
        if (triggers.length === 0) {
          await sendZaloMessage(chatId, '📭 Hiện chưa có link nào được lưu.');
        } else {
          let list = '📋 Danh sách các link hiện có:\n';
          triggers.forEach(t => {
            list += `- /link ${t.keyword}\n`;
          });
          await sendZaloMessage(chatId, list);
        }
      } else {
        const keyword = args[0];
        const trigger = await getTrigger(keyword);
        if (trigger) {
          await sendZaloMessage(chatId, `📝 Nội dung của "${keyword}":\n${trigger.response}`);
        } else {
          await sendZaloMessage(chatId, `❌ Không tìm thấy link có tên "${keyword}"`);
        }
      }
      return true;
    }

    case '/filters': {
      const filters = await getAllFilters();
      if (filters.length === 0) {
        await sendZaloMessage(chatId, '📭 Hiện chưa có từ khóa tự động phản hồi nào.');
      } else {
        let list = '📋 Danh sách từ khóa tự động phản hồi:\n';
        filters.forEach(f => {
          const keyword = f.key.replace('filter_', '');
          list += `- ${keyword}\n`;
        });
        await sendZaloMessage(chatId, list);
      }
      return true;
    }

    // ====== LỆNH ADMIN ======
    case '/addlink': {
      if (!(await requireAdmin())) return true;
      if (args.length < 2) {
        await sendZaloMessage(chatId, '⚠️ Sai cú pháp rồi! Vui lòng nhập: /addlink [tên_link] [nội dung văn bản hoặc link]');
        return true;
      }
      const keyword = args[0];
      const response = args.slice(1).join(' ');
      const ok = await setTrigger(keyword, response);
      await sendZaloMessage(
        chatId,
        ok ? `✅ Đã lưu link "${keyword}" thành công!` : '❌ Lỗi lưu link, xem log.'
      );
      return true;
    }

    case '/removelink': {
      if (!(await requireAdmin())) return true;
      if (args.length < 1) {
        await sendZaloMessage(chatId, '⚠️ Nhập tên link cần xóa chứ! Cú pháp: /removelink [tên_link]');
        return true;
      }
      const keyword = args[0];
      const ok = await removeTrigger(keyword);
      await sendZaloMessage(
        chatId,
        ok ? `✅ Đã xóa link "${keyword}"` : '❌ Xóa thất bại (có thể không tồn tại).'
      );
      return true;
    }

    case '/filter': {
      if (!(await requireAdmin())) return true;
      if (args.length < 2) {
        await sendZaloMessage(chatId, '⚠️ Thiếu rồi admin ơi! Cú pháp chuẩn: /filter [từ_khóa] [câu trả lời tự động]');
        return true;
      }
      const keyword = args[0];
      const response = args.slice(1).join(' ');
      const key = `filter_${keyword}`;
      const ok = await setConfig(key, response);
      await sendZaloMessage(
        chatId,
        ok ? `✅ Đã cài tự động phản hồi cho từ khóa "${keyword}"` : '❌ Lỗi lưu filter, xem log.'
      );
      return true;
    }

    case '/stop': {
      if (!(await requireAdmin())) return true;
      if (args.length < 1) {
        await sendZaloMessage(chatId, '⚠️ Hủy cái gì? Cú pháp: /stop [từ_khóa]');
        return true;
      }
      const keyword = args[0];
      const key = `filter_${keyword}`;
      const ok = await removeConfig(key);
      await sendZaloMessage(
        chatId,
        ok ? `✅ Đã xóa từ khóa "${keyword}" khỏi danh sách tự động phản hồi` : '❌ Xóa thất bại (có thể không tồn tại).'
      );
      return true;
    }

    // ====== LỆNH KHÔNG HỢP LỆ (NHƯNG CÓ DẤU '/') ======
    default: {
      await sendZaloMessage(chatId, getSyntaxHelp());
      return true;
    }
  }
}

// ================================================================
// 8. XỬ LÝ TRIGGER TỰ ĐỘNG (FILTER)
// ================================================================
async function handleFilter(rawText, chatId) {
  const filters = await getAllFilters();
  for (const f of filters) {
    const keyword = f.key.replace('filter_', '');
    if (rawText.includes(keyword)) {
      await sendZaloMessage(chatId, f.value);
      return true;
    }
  }
  return false;
}

// ================================================================
// 9. WEBHOOK CHÍNH
// ================================================================
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    const eventName = body.event_name;

    // ---- LOG FULL BODY ----
    console.log('📦 [FULL WEBHOOK BODY]', JSON.stringify(body, null, 2));

    // ---- CHUẨN HÓA EVENT NAME ----
    const eventNameLower = (eventName || '').toLowerCase();

    // ---- XỬ LÝ JOIN ----
    if (eventNameLower.includes('join') || eventNameLower === 'user_join_group') {
      const groupId = body.group_id || body.recipient?.id || GROUP_ID;
      if (!groupId) {
        console.warn('⚠️ Không có groupId, bỏ qua join.');
        return res.status(200).send('OK');
      }
      let userId = null;
      if (body.users && Array.isArray(body.users) && body.users.length > 0) {
        userId = body.users[0].id;
      } else if (body.user_id) {
        userId = body.user_id;
      } else if (body.sender?.id) {
        userId = body.sender.id;
      }
      let userName = body.user_name || body.sender?.name || body.from?.display_name || 'Thành viên mới';
      let welcomeMsg = await getConfig('welcome_message') || '🎉 Chào mừng {name} đã tham gia vào nhóm! Chúc bạn có những trải nghiệm vui vẻ cùng mọi người. ✨';
      const finalMsg = welcomeMsg
        .replace(/\{name\}/g, userName)
        .replace(/\[name\]/g, userName)
        .replace(/\[Tên_Thành_Vien\]/g, userName);
      const tag = userId ? `@(${userId})` : userName;
      await sendZaloMessage(groupId, `Chào ${tag}! ${finalMsg}`);
      return res.status(200).send('OK');
    }

    // ---- XỬ LÝ LEAVE ----
    if (eventNameLower.includes('leave') || eventNameLower === 'user_leave_group') {
      const groupId = body.group_id || body.recipient?.id || GROUP_ID;
      if (!groupId) {
        console.warn('⚠️ Không có groupId, bỏ qua leave.');
        return res.status(200).send('OK');
      }
      let userId = body.user_id || body.sender?.id || null;
      let userName = body.user_name || body.sender?.name || body.from?.display_name || 'Một thành viên';
      let goodbyeMsg = await getConfig('goodbye_message') || '👋 Tạm biệt {name} đã rời khỏi nhóm.';
      const finalMsg = goodbyeMsg
        .replace(/\{name\}/g, userName)
        .replace(/\[name\]/g, userName)
        .replace(/\[Tên_Thành_Vien\]/g, userName);
      const tag = userId ? `@(${userId})` : userName;
      await sendZaloMessage(groupId, `Tạm biệt ${tag}! ${finalMsg}`);
      return res.status(200).send('OK');
    }

    // ---- XỬ LÝ TIN NHẮN ----
    if (eventName === 'message.text.received' || eventName === 'user_send_group_text') {
      const messageData = body.message || {};
      const rawText = messageData.text || body.text || '';
      const chat = messageData.chat || body.chat || {};
      const chatType = chat.chat_type || body.chat_type || 'GROUP';
      const chatId = chat.id || body.recipient?.id || body.group_id || GROUP_ID;

      // Lấy senderId
      let senderId = body.sender?.id || messageData.from?.id || body.from?.id || body.user_id || messageData.sender?.id;
      if (!senderId) {
        console.warn('⚠️ Không tìm thấy senderId trong tin nhắn.');
      }

      if (!chatId) {
        console.warn('⚠️ Không có chatId, bỏ qua tin nhắn.');
        return res.status(200).send('OK');
      }

      // Chỉ xử lý tin nhắn nhóm
      if (chatType !== 'GROUP') {
        console.log('🔇 Tin nhắn riêng, bỏ qua.');
        return res.status(200).send('OK');
      }

      // ---- Kiểm tra xem tin nhắn có tag bot không ----
      const hasTag = /^@\S+/.test(rawText.trim());
      const cleanedText = rawText.replace(/^@\S+\s*/, '').trim();

      // Trường hợp 1: Chỉ tag bot, không nhắn gì thêm
      if (hasTag && cleanedText === '') {
        await sendZaloMessage(chatId, getRandomReply());
        return res.status(200).send('OK');
      }

      // Trường hợp 2: Có tag bot và có nội dung
      if (hasTag) {
        // Kiểm tra nếu cleanedText bắt đầu bằng '/' => đây là lệnh
        if (cleanedText.startsWith('/')) {
          const isCommand = await handleCommand(cleanedText, chatId, senderId);
          if (isCommand) {
            // Đã xử lý lệnh (kể cả lệnh sai), không chạy filter
            return res.status(200).send('OK');
          }
          // Nếu handleCommand trả về false (không xảy ra vì đã startsWith('/')), vẫn cho chạy filter
        }
        // Nếu không bắt đầu bằng '/', đây là tin nhắn thường (không phải lệnh)
        // Chạy filter trên cleanedText
        await handleFilter(cleanedText, chatId);
        return res.status(200).send('OK');
      }

      // Trường hợp 3: Tin nhắn thường không tag bot
      // Chạy filter trên rawText gốc
      await handleFilter(rawText, chatId);
      return res.status(200).send('OK');
    }

    // ---- CÁC SỰ KIỆN KHÁC ----
    console.log(`ℹ️ Sự kiện không hỗ trợ: ${eventName}`);
    res.status(200).send('OK');

  } catch (error) {
    console.error('💥 Lỗi webhook:', error);
    res.status(200).send('Error logged');
  }
});

// ================================================================
// 10. ENDPOINT KIỂM TRA
// ================================================================
app.get('/', (req, res) => {
  res.send('Bot Zalo is Running!');
});

// ================================================================
// 11. KHỞI ĐỘNG SERVER
// ================================================================
app.listen(PORT, () => {
  console.log(`🚀 Bot đang chạy tại cổng ${PORT}`);
});