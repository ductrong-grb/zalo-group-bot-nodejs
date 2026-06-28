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
  ADMIN_ID  // 👈 Đọc ADMIN_ID từ biến môi trường
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
// 4. HÀM TRUY VẤN SUPABASE (GIỮ NGUYÊN)
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
// 5. KIỂM TRA ADMIN (SỬ DỤNG BUFFER HEX SO SÁNH)
// ================================================================

/**
 * So sánh hai chuỗi bằng cách chuyển sang Buffer hex
 * Tránh lỗi ký tự ẩn, khoảng trắng, mã hóa khác
 */
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
    // Chuyển cả hai sang Buffer và lấy hex
    const userIdHex = Buffer.from(String(userId), 'utf8').toString('hex');
    const adminIdHex = Buffer.from(String(adminId), 'utf8').toString('hex');

    console.log(`🔍 User ID hex   : ${userIdHex}`);
    console.log(`🔍 Admin ID hex  : ${adminIdHex}`);
    console.log(`🔍 Độ dài hex    : user=${userIdHex.length}, admin=${adminIdHex.length}`);

    const isMatch = userIdHex === adminIdHex;
    console.log(`🔍 Kết quả        : ${isMatch ? '✅ LÀ ADMIN' : '❌ KHÔNG PHẢI ADMIN'}`);
    return isMatch;
  } catch (error) {
    console.error('❌ Lỗi khi chuyển đổi Buffer:', error);
    return false;
  }
}

// Mảng câu trả lời cà khịa
const NON_ADMIN_REPLIES = [
  '🤡 Mày tưởng mày là ai mà dám dùng lệnh admin hả?',
  '😂 Cút mẹ mày đi, không phải admin mà đòi xài lệnh?',
  '🤣 Ngáo đá à? Mày không có quyền đâu!',
  '😏 Thôi đi ông ơi, về học lại đi rồi hẵng nói.',
  '🙄 Nhìn mặt mày mà đòi làm admin hả?',
];

function getRandomInsult() {
  return NON_ADMIN_REPLIES[Math.floor(Math.random() * NON_ADMIN_REPLIES.length)];
}

// ================================================================
// 6. XỬ LÝ LỆNH
// ================================================================
function parseCommand(rawText) {
  const cleaned = rawText.replace(/^@\S+\s*/, '').trim();
  const slashIndex = cleaned.indexOf('/');
  if (slashIndex === -1) return null;
  const commandPart = cleaned.slice(slashIndex).trim();
  const parts = commandPart.split(/\s+/);
  if (parts.length === 0) return null;
  return {
    command: parts[0].toLowerCase(),
    args: parts.slice(1),
  };
}

async function handleCommand(rawText, chatId, senderId) {
  const parsed = parseCommand(rawText);
  if (!parsed) return false;

  const { command, args } = parsed;

  const requireAdmin = async () => {
    if (!isAdmin(senderId)) {
      await sendZaloMessage(chatId, getRandomInsult());
      return false;
    }
    return true;
  };

  switch (command) {
    case '/listcommands': {
      const commands =
        '📋 Danh sách tất cả lệnh:\n\n' +
        '🔹 Lệnh cho mọi người:\n' +
        '/help - Trợ giúp\n' +
        '/link - Xem danh sách từ khóa\n' +
        '/link <từ khóa> - Xem nội dung trigger\n' +
        '/listcommands - Hiển thị danh sách lệnh\n' +
        '/info - Thông tin nhóm\n' +
        '/ping - Kiểm tra độ trễ\n\n' +
        '🔹 Lệnh Admin:\n' +
        '/addlink <từ khóa> <nội dung> - Thêm trigger\n' +
        '/removetrigger <từ khóa> - Xóa trigger\n' +
        '/setupwelcome <nội dung> - Cập nhật lời chào\n' +
        '/removewelcome - Xóa lời chào\n' +
        '/setgoodbye <nội dung> - Cập nhật lời tạm biệt\n' +
        '/removegoodbye - Xóa lời tạm biệt';
      await sendZaloMessage(chatId, commands);
      return true;
    }

    case '/info': {
      const infoMsg = `👥 Thông tin nhóm:\nTrưởng nhóm: ${ADMIN_NAME}\nPhó nhóm: ${VICE_NAME}`;
      await sendZaloMessage(chatId, infoMsg);
      return true;
    }

    case '/ping': {
      const start = Date.now();
      const latency = Date.now() - start;
      await sendZaloMessage(chatId, `🏓 Pong! (Độ trễ: ${latency}ms)`);
      return true;
    }

    // ===== LỆNH ADMIN =====
    case '/addlink': {
      if (!(await requireAdmin())) return true;
      if (args.length < 2) {
        await sendZaloMessage(chatId, '⚠️ Cú pháp: /addlink <từ khóa> <nội dung phản hồi>');
        return true;
      }
      const keyword = args[0];
      const response = args.slice(1).join(' ');
      const ok = await setTrigger(keyword, response);
      await sendZaloMessage(
        chatId,
        ok ? `✅ Đã lưu trigger cho từ khóa "${keyword}"` : '❌ Lỗi lưu trigger, xem log.'
      );
      return true;
    }

    case '/removetrigger': {
      if (!(await requireAdmin())) return true;
      if (args.length < 1) {
        await sendZaloMessage(chatId, '⚠️ Cú pháp: /removetrigger <từ khóa>');
        return true;
      }
      const keyword = args[0];
      const ok = await removeTrigger(keyword);
      await sendZaloMessage(
        chatId,
        ok ? `✅ Đã xóa trigger cho từ khóa "${keyword}"` : '❌ Xóa thất bại (có thể không tồn tại).'
      );
      return true;
    }

    case '/setupwelcome': {
      if (!(await requireAdmin())) return true;
      if (args.length < 1) {
        await sendZaloMessage(chatId, '⚠️ Cú pháp: /setupwelcome <nội dung lời chào>');
        return true;
      }
      const content = args.join(' ');
      const ok = await setConfig('welcome_message', content);
      await sendZaloMessage(
        chatId,
        ok ? '✅ Đã cập nhật lời chào mừng!' : '❌ Lỗi cập nhật lời chào.'
      );
      return true;
    }

    case '/removewelcome': {
      if (!(await requireAdmin())) return true;
      const ok = await removeConfig('welcome_message');
      await sendZaloMessage(
        chatId,
        ok ? '✅ Đã xóa lời chào mừng!' : '❌ Xóa thất bại (có thể không tồn tại).'
      );
      return true;
    }

    case '/setgoodbye': {
      if (!(await requireAdmin())) return true;
      if (args.length < 1) {
        await sendZaloMessage(chatId, '⚠️ Cú pháp: /setgoodbye <nội dung lời tạm biệt>');
        return true;
      }
      const content = args.join(' ');
      const ok = await setConfig('goodbye_message', content);
      await sendZaloMessage(
        chatId,
        ok ? '✅ Đã cập nhật lời tạm biệt!' : '❌ Lỗi cập nhật lời tạm biệt.'
      );
      return true;
    }

    case '/removegoodbye': {
      if (!(await requireAdmin())) return true;
      const ok = await removeConfig('goodbye_message');
      await sendZaloMessage(
        chatId,
        ok ? '✅ Đã xóa lời tạm biệt!' : '❌ Xóa thất bại (có thể không tồn tại).'
      );
      return true;
    }

    case '/help': {
      const helpMsg =
        '📋 Danh sách lệnh:\n' +
        '🔹 /help - Trợ giúp\n' +
        '🔹 /link - Xem danh sách từ khóa\n' +
        '🔹 /link <từ khóa> - Xem nội dung trigger\n' +
        '🔹 /listcommands - Xem tất cả lệnh\n' +
        '🔹 /info - Thông tin nhóm\n' +
        '🔹 /ping - Kiểm tra độ trễ\n' +
        '(Các lệnh Admin chỉ dành cho quản trị viên)';
      await sendZaloMessage(chatId, helpMsg);
      return true;
    }

    default:
      return false;
  }
}

// ================================================================
// 7. XỬ LÝ TRIGGER TỰ ĐỘNG
// ================================================================
async function handleTrigger(rawText, chatId) {
  const triggers = await getAllTriggers();
  for (const t of triggers) {
    if (rawText.includes(t.keyword)) {
      await sendZaloMessage(chatId, t.response);
      return true;
    }
  }
  return false;
}

// ================================================================
// 8. WEBHOOK CHÍNH
// ================================================================
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    const eventName = body.event_name;

    console.log(`🔍 [WEBHOOK] event: ${eventName}`);
    console.log(`📦 [BODY]`, JSON.stringify(body, null, 2));

    // ----- LẤY SENDER ID -----
    let senderId = null;
    if (body.sender?.id) senderId = body.sender.id;
    else if (body.message?.from?.id) senderId = body.message.from.id;
    else if (body.from?.id) senderId = body.from.id;
    else if (body.user_id) senderId = body.user_id;
    else if (body.message?.sender?.id) senderId = body.message.sender.id;

    if (!senderId) {
      console.warn('⚠️ Không tìm thấy senderId trong webhook.');
    } else {
      console.log(`📌 Sender ID: "${senderId}"`);
    }

    // ----- JOIN -----
    if (eventName === 'user_join_group' || eventName === 'user.join.group') {
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

      const userTag = userId ? `@(${userId})` : (body.user_name || 'Thành viên mới');
      const welcomeMsg = await getConfig('welcome_message') || '';
      const fullMsg = `Chào ${userTag} gia nhập nhóm! Trưởng nhóm: ${ADMIN_NAME}, Phó nhóm: ${VICE_NAME}. ${welcomeMsg}`;
      await sendZaloMessage(groupId, fullMsg);
      return res.status(200).send('OK');
    }

    // ----- LEAVE -----
    if (eventName === 'user_leave_group' || eventName === 'user.leave.group') {
      const groupId = body.group_id || body.recipient?.id || GROUP_ID;
      if (!groupId) {
        console.warn('⚠️ Không có groupId, bỏ qua leave.');
        return res.status(200).send('OK');
      }

      let userId = body.user_id || body.sender?.id || null;
      const userTag = userId ? `@(${userId})` : (body.user_name || 'Thành viên');
      const goodbyeMsg = await getConfig('goodbye_message') || 'Tạm biệt nhé, cút rồi!';
      const fullMsg = `Tạm biệt ${userTag} nhé! ${goodbyeMsg}`;
      await sendZaloMessage(groupId, fullMsg);
      return res.status(200).send('OK');
    }

    // ----- TIN NHẮN -----
    if (eventName === 'message.text.received' || eventName === 'user_send_group_text') {
      const messageData = body.message || {};
      const rawText = messageData.text || body.text || '';
      const chat = messageData.chat || body.chat || {};
      const chatType = chat.chat_type || body.chat_type || 'GROUP';
      const chatId = chat.id || body.recipient?.id || body.group_id || GROUP_ID;

      // Nếu chưa có senderId, thử lấy từ message
      if (!senderId) {
        if (messageData.from?.id) senderId = messageData.from.id;
        else if (body.sender?.id) senderId = body.sender.id;
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

      // Xử lý lệnh
      const isCommand = await handleCommand(rawText, chatId, senderId);
      if (isCommand) {
        return res.status(200).send('OK');
      }

      // Xử lý trigger
      await handleTrigger(rawText, chatId);
      return res.status(200).send('OK');
    }

    console.log(`ℹ️ Sự kiện không hỗ trợ: ${eventName}`);
    res.status(200).send('OK');

  } catch (error) {
    console.error('💥 Lỗi webhook:', error);
    res.status(200).send('Error logged');
  }
});

// ================================================================
// 9. ENDPOINT KIỂM TRA
// ================================================================
app.get('/', (req, res) => {
  res.send('Bot Zalo is Running!');
});

// ================================================================
// 10. KHỞI ĐỘNG SERVER
// ================================================================
app.listen(PORT, () => {
  console.log(`🚀 Bot đang chạy tại cổng ${PORT}`);
});