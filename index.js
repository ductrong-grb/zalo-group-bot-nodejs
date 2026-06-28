const express = require('express');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// ================================================================
// 1. CẤU HÌNH & BIẾN MÔI TRƯỜNG
// ================================================================
const ZALO_BOT_TOKEN = process.env.ZALO_BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const MY_GROUP_ID = process.env.GROUP_ID; // ID nhóm (để lọc nếu cần)

// Danh sách Admin ID - HARDCODE
const ADMIN_IDS = ['c7d3be1b0946e918b957'];

// Tên admin (có thể lấy từ biến môi trường nếu muốn)
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin';
const VICE_NAME = process.env.VICE_NAME || 'Phó nhóm';

if (!ZALO_BOT_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ THIẾU BIẾN MÔI TRƯỜNG: Cần đặt ZALO_BOT_TOKEN, SUPABASE_URL, SUPABASE_KEY');
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
// 6. XỬ LÝ LỆNH TRONG NHÓM
// ================================================================
async function handleGroupCommand(rawText, chatId, senderId) {
    // Lấy vị trí dấu '/' đầu tiên
    const slashIndex = rawText.indexOf('/');
    if (slashIndex === -1) {
        // Không có dấu '/' -> không phải lệnh
        return false;
    }

    // Cắt từ dấu '/' đến hết
    const commandPart = rawText.slice(slashIndex).trim();
    // Tách các phần bởi khoảng trắng
    const parts = commandPart.split(/\s+/);
    if (parts.length === 0) return false;

    const command = parts[0].toLowerCase(); // ví dụ: /help
    const args = parts.slice(1);

    // Hàm trả lời từ chối (không phải admin)
    const notAdminReply = () => {
        const insults = [
            "🤡 Mày tstưởng mayst lsvà ági mág dshám dúgng lệhsnh admhsin ?",
            "😂 Cút mẹ mày đi, đóe dùng đc đâu"
        ];
        return insults[Math.floor(Math.random() * insults.length)];
    };

    switch (command) {
        case '/help': {
            let help = '📋 Danh sách lệnh:\n';
            help += '🔹 /help - Hiển thị trợ giúp\n';
            help += '🔹 /addlink <từ khóa> <nội dung> - Thêm trigger (Admin)\n';
            help += '🔹 /removelink <từ khóa> - Xóa trigger (Admin)\n';
            help += '🔹 /setupwelcome <nội dung> - Cập nhật lời chào (Admin)\n';
            await sendZaloMessage(chatId, help);
            return true;
        }

        case '/addlink': {
            if (!isAdmin(senderId)) {
                await sendZaloMessage(chatId, notAdminReply());
                return true;
            }
            if (args.length < 2) {
                await sendZaloMessage(chatId, '⚠️ Cú pháp: /addlink <từ khóa> <nội dung phản hồi>');
                return true;
            }
            const keyword = args[0];
            const response = args.slice(1).join(' ');
            const ok = await setTrigger(keyword, response);
            if (ok) {
                await sendZaloMessage(chatId, `✅ Đã lưu trigger cho từ khóa "${keyword}"`);
            } else {
                await sendZaloMessage(chatId, '❌ Lỗi lưu trigger, vui lòng kiểm tra log.');
            }
            return true;
        }

        case '/removelink': {
            if (!isAdmin(senderId)) {
                await sendZaloMessage(chatId, notAdminReply());
                return true;
            }
            if (args.length < 1) {
                await sendZaloMessage(chatId, '⚠️ Cú pháp: /removelink <từ khóa>');
                return true;
            }
            const keyword = args[0];
            const ok = await removeTrigger(keyword);
            if (ok) {
                await sendZaloMessage(chatId, `✅ Đã xóa trigger cho từ khóa "${keyword}"`);
            } else {
                await sendZaloMessage(chatId, '❌ Xóa thất bại (có thể từ khóa không tồn tại).');
            }
            return true;
        }

        case '/setupwelcome': {
            if (!isAdmin(senderId)) {
                await sendZaloMessage(chatId, notAdminReply());
                return true;
            }
            if (args.length < 1) {
                await sendZaloMessage(chatId, '⚠️ Cú pháp: /setupwelcome <nội dung lời chào>');
                return true;
            }
            const content = args.join(' ');
            const ok = await setConfig('welcome_message', content);
            if (ok) {
                await sendZaloMessage(chatId, `✅ Đã cập nhật lời chào mừng!`);
            } else {
                await sendZaloMessage(chatId, '❌ Lỗi cập nhật lời chào.');
            }
            return true;
        }

        default:
            // Không khớp lệnh
            return false;
    }
}

// ================================================================
// 7. XỬ LÝ TRIGGER TỰ ĐỘNG
// ================================================================
async function handleTrigger(rawText, chatId) {
    // Lấy tất cả triggers
    const triggers = await getAllTriggers();
    // Kiểm tra từng trigger: nếu rawText chứa keyword
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

        // ---------- SỰ KIỆN JOIN GROUP ----------
        if (eventName === 'user_join_group' || eventName === 'user.join.group') {
            const groupId = body.group_id || body.recipient?.id || MY_GROUP_ID;
            if (!groupId) {
                console.log('⚠️ Không có groupId, bỏ qua.');
                return res.status(200).send('OK');
            }
            let userName = 'Thành viên mới';
            if (body.users && Array.isArray(body.users) && body.users.length > 0) {
                // Nếu có nhiều user, lấy user đầu tiên (tên không có, dùng id tạm)
                userName = `Thành viên (${body.users[0].id})`;
            } else if (body.sender?.name) {
                userName = body.sender.name;
            } else if (body.user_name) {
                userName = body.user_name;
            }
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
                userName = `Thành viên (${body.user_id})`;
            }
            await sendZaloMessage(groupId, `Tạm biệt ${userName} nhé, cút rồi!`);
            return res.status(200).send('OK');
        }

        // ---------- SỰ KIỆN TIN NHẮN ----------
        if (eventName === 'message.text.received') {
            const messageData = body.message || {};
            const rawText = messageData.text || '';
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

            // ---- XỬ LÝ LỆNH (có dấu '/') ----
            const isCommand = await handleGroupCommand(rawText, chatId, senderId);
            if (isCommand) {
                // Đã xử lý lệnh, không cần trigger
                return res.status(200).send('OK');
            }

            // ---- XỬ LÝ TRIGGER TỰ ĐỘNG ----
            await handleTrigger(rawText, chatId);
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