const express = require('express');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// ================================================================
// 1. CẤU HÌNH & BIẾN MÔI TRƯỜNG
// ================================================================
const ZALO_BOT_TOKEN = process.env.ZALO_BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const MY_GROUP_ID = process.env.GROUP_ID; // ID nhóm để bot hoạt động

// Danh sách Admin ID (thay bằng ID thật của bạn)
const ADMIN_IDS = ['id_admin_1', 'id_admin_2']; // 👈 THAY THẾ BẰNG ID THỰC TẾ

// Tên admin và phó nhóm (có thể lấy từ biến môi trường hoặc config)
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin';
const VICE_NAME = process.env.VICE_NAME || 'Phó nhóm';

// Biến để lưu tên người dùng join/leave (sẽ được cập nhật từ webhook)
let userNameCache = {};

if (!ZALO_BOT_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ THIẾU BIẾN MÔI TRƯỜNG: Cần đặt ZALO_BOT_TOKEN, SUPABASE_URL, SUPABASE_KEY');
    process.exit(1);
}

if (!MY_GROUP_ID) {
    console.warn('⚠️ Chưa đặt GROUP_ID, bot sẽ chỉ xử lý khi có group_id trong webhook.');
}

// ================================================================
// 2. KHỞI TẠO SUPABASE & EXPRESS
// ================================================================
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 7860;

// ================================================================
// 3. HÀM GỬI TIN NHẮN ZALO
// ================================================================
async function sendZaloMessage(chatId, text) {
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
// 4. HÀM TƯƠNG TÁC SUPABASE
// ================================================================
async function getConfig(key) {
    const { data, error } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', key)
        .single();
    if (error) {
        if (error.code === 'PGRST116') return null;
        console.error(`❌ Lỗi getConfig ${key}:`, error);
        return null;
    }
    return data?.value;
}

async function setConfig(key, value) {
    const { error } = await supabase
        .from('bot_config')
        .upsert({ key, value }, { onConflict: 'key' });
    if (error) {
        console.error(`❌ Lỗi setConfig ${key}:`, error);
        return false;
    }
    return true;
}

async function getAllTriggers() {
    const { data, error } = await supabase
        .from('bot_triggers')
        .select('keyword, response');
    if (error) {
        console.error('❌ Lỗi lấy triggers:', error);
        return [];
    }
    return data || [];
}

async function setTrigger(keyword, response) {
    const { error } = await supabase
        .from('bot_triggers')
        .upsert({ keyword, response }, { onConflict: 'keyword' });
    if (error) {
        console.error('❌ Lỗi upsert trigger:', error);
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
        console.error('❌ Lỗi xóa trigger:', error);
        return false;
    }
    return true;
}

// ================================================================
// 5. HÀM KIỂM TRA ADMIN
// ================================================================
function isAdmin(userId) {
    return ADMIN_IDS.includes(userId);
}

// ================================================================
// 6. XỬ LÝ LỆNH TRONG NHÓM (CÔNG KHAI)
// ================================================================
async function handleGroupCommand(text, chatId, senderId) {
    // Cắt bỏ phần @ tag (nếu có) để lấy nội dung lệnh thực sự
    // Zalo tag có dạng @[user_id] hoặc @Tên
    // Ta tách lấy phần sau dấu cách hoặc ngay sau tag
    let cleanText = text;
    // Loại bỏ @[xxx] hoặc @Tên (phần tag bot)
    const tagPattern = /@\[.*?\]\s*/;
    cleanText = cleanText.replace(tagPattern, '').trim();
    // Nếu sau khi cắt tag mà rỗng thì bỏ qua
    if (!cleanText) return;

    const parts = cleanText.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Hàm trả lời lỗi nếu không phải admin
    function notAdminReply() {
        const insults = [
            "🤡 Mày tưởng mày là ai mà dám dùng lệnh admin hả?",
            "😂 Cút mẹ mày đi, không phải admin mà đòi xài lệnh?",
            "🤣 Ngáo đá à? Mày không có quyền đâu!",
            "😏 Thôi đi ông ơi, về học lại đi rồi hẵng nói."
        ];
        const randomInsult = insults[Math.floor(Math.random() * insults.length)];
        return randomInsult;
    }

    switch (command) {
        case '/help': {
            let helpMsg = '📋 Danh sách lệnh:\n';
            helpMsg += '🔹 /help - Hiển thị trợ giúp\n';
            helpMsg += '🔹 /addlink <từ khóa> <nội dung> - Thêm trigger (Admin)\n';
            helpMsg += '🔹 /removelink <từ khóa> - Xóa trigger (Admin)\n';
            helpMsg += '🔹 /setupwelcome <nội dung> - Cập nhật lời chào (Admin)\n';
            await sendZaloMessage(chatId, helpMsg);
            return;
        }

        case '/addlink': {
            if (!isAdmin(senderId)) {
                await sendZaloMessage(chatId, notAdminReply());
                return;
            }
            if (args.length < 2) {
                await sendZaloMessage(chatId, '⚠️ Cú pháp: /addlink <từ khóa> <nội dung phản hồi>');
                return;
            }
            const keyword = args[0];
            const response = args.slice(1).join(' ');
            const ok = await setTrigger(keyword, response);
            if (ok) {
                await sendZaloMessage(chatId, `✅ Đã lưu trigger cho từ khóa "${keyword}"`);
            } else {
                await sendZaloMessage(chatId, '❌ Lỗi lưu trigger, vui lòng kiểm tra log.');
            }
            return;
        }

        case '/removelink': {
            if (!isAdmin(senderId)) {
                await sendZaloMessage(chatId, notAdminReply());
                return;
            }
            if (args.length < 1) {
                await sendZaloMessage(chatId, '⚠️ Cú pháp: /removelink <từ khóa>');
                return;
            }
            const keyword = args[0];
            const ok = await removeTrigger(keyword);
            if (ok) {
                await sendZaloMessage(chatId, `✅ Đã xóa trigger cho từ khóa "${keyword}"`);
            } else {
                await sendZaloMessage(chatId, '❌ Xóa thất bại (có thể từ khóa không tồn tại).');
            }
            return;
        }

        case '/setupwelcome': {
            if (!isAdmin(senderId)) {
                await sendZaloMessage(chatId, notAdminReply());
                return;
            }
            if (args.length < 1) {
                await sendZaloMessage(chatId, '⚠️ Cú pháp: /setupwelcome <nội dung lời chào>');
                return;
            }
            const content = args.join(' ');
            const ok = await setConfig('welcome_message', content);
            if (ok) {
                await sendZaloMessage(chatId, `✅ Đã cập nhật lời chào mừng!`);
            } else {
                await sendZaloMessage(chatId, '❌ Lỗi cập nhật lời chào.');
            }
            return;
        }

        default:
            // Không khớp lệnh, bỏ qua
            return;
    }
}

// ================================================================
// 7. XỬ LÝ TRIGGER TỰ ĐỘNG
// ================================================================
async function handleTrigger(text, chatId) {
    // Loại bỏ tag bot trước khi kiểm tra trigger
    const cleanText = text.replace(/@\[.*?\]\s*/, '').trim();
    if (!cleanText) return;

    const triggers = await getAllTriggers();
    const matched = triggers.find(t => cleanText.includes(t.keyword));
    if (matched) {
        await sendZaloMessage(chatId, matched.response);
        return true;
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

        // ---------- SỰ KIỆN JOIN GROUP ----------
        if (eventName === 'user_join_group' || eventName === 'user.join.group') {
            const groupId = body.group_id || body.recipient?.id || MY_GROUP_ID;
            if (!groupId) {
                console.log('⚠️ Không có groupId, bỏ qua.');
                return res.status(200).send('OK');
            }
            // Lấy tên người dùng (có thể lấy từ body.users hoặc sender)
            let userName = 'Thành viên mới';
            if (body.users && Array.isArray(body.users) && body.users.length > 0) {
                // Nếu có nhiều user, lấy user đầu tiên (có thể xử lý lần lượt)
                // Nhưng tên không có trong payload, chỉ có id
                // Có thể gọi API lấy tên nhưng tạm thời dùng tên mặc định
                userName = `Thành viên mới (${body.users[0].id})`;
            } else if (body.sender?.name) {
                userName = body.sender.name;
            } else if (body.user_name) {
                userName = body.user_name;
            }
            // Lưu cache tên (nếu có)
            userNameCache[groupId] = userName;

            // Lấy lời chào từ config
            const welcomeMsg = await getConfig('welcome_message') || '';
            const fullMsg = `Chào ${userName} gia nhập nhóm! Trưởng nhóm: ${ADMIN_NAME}, Phó nhóm: ${VICE_NAME}. ${welcomeMsg}`;
            await sendZaloMessage(groupId, fullMsg);
            return res.status(200).send('OK');
        }

        // ---------- SỰ KIỆN LEAVE GROUP ----------
        if (eventName === 'user_leave_group' || eventName === 'user.leave.group') {
            const groupId = body.group_id || body.recipient?.id || MY_GROUP_ID;
            if (!groupId) {
                console.log('⚠️ Không có groupId, bỏ qua.');
                return res.status(200).send('OK');
            }
            let userName = 'Thành viên';
            if (body.sender?.name) {
                userName = body.sender.name;
            } else if (body.user_name) {
                userName = body.user_name;
            } else if (body.user_id) {
                // Có thể lấy từ cache hoặc mặc định
                userName = `Thành viên (${body.user_id})`;
            }
            await sendZaloMessage(groupId, `Tạm biệt ${userName} nhé, cút rồi!`);
            return res.status(200).send('OK');
        }

        // ---------- SỰ KIỆN TIN NHẮN ----------
        if (eventName === 'message.text.received') {
            const messageData = body.message || {};
            const text = messageData.text || '';
            const chat = messageData.chat || {};
            const chatType = chat.chat_type; // 'PRIVATE' hoặc 'GROUP'
            const chatId = chat.id || body.recipient?.id || MY_GROUP_ID;
            const sender = messageData.from || body.sender || {};
            const senderId = sender.id || body.user_id;

            if (!chatId) {
                console.log('⚠️ Không có chatId, bỏ qua.');
                return res.status(200).send('OK');
            }

            // Chỉ xử lý tin nhắn trong nhóm (GROUP)
            if (chatType !== 'GROUP') {
                console.log('🔇 Tin nhắn riêng, bỏ qua.');
                return res.status(200).send('OK');
            }

            // Kiểm tra nếu tin nhắn là lệnh (bắt đầu bằng '/')
            if (text.includes('/')) {
                await handleGroupCommand(text, chatId, senderId);
                // Sau khi xử lý lệnh, không xử lý trigger nữa (tránh trùng)
                return res.status(200).send('OK');
            }

            // Xử lý trigger tự động (nếu không phải lệnh)
            await handleTrigger(text, chatId);
            return res.status(200).send('OK');
        }

        // Các sự kiện khác bỏ qua
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

app.listen(PORT, () => {
    console.log(`🚀 Bot đang chạy tại cổng ${PORT}`);
});