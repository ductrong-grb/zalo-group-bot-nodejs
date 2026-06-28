const express = require('express');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// ================================================================
// 1. ĐỌC CẤU HÌNH TỪ BIẾN MÔI TRƯỜNG
// ================================================================
const ZALO_BOT_TOKEN = process.env.ZALO_BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!ZALO_BOT_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ THIẾU BIẾN MÔI TRƯỜNG: Cần đặt ZALO_BOT_TOKEN, SUPABASE_URL, SUPABASE_KEY');
    process.exit(1);
}

// ================================================================
// 2. KHỞI TẠO SUPABASE CLIENT
// ================================================================
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ================================================================
// 3. CẤU HÌNH EXPRESS
// ================================================================
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 7860;

// ================================================================
// 4. HÀM GỬI TIN NHẮN QUA ZALO API (CHUẨN MỚI)
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
        console.error('❌ Lỗi gửi tin nhắn Zalo:', error.response?.data || error.message);
        throw error;
    }
}

// ================================================================
// 5. HÀM TƯƠNG TÁC VỚI SUPABASE (CẤU HÌNH & DỮ LIỆU)
// ================================================================

// ---- Lấy một cấu hình từ bảng bot_config ----
async function getConfig(key) {
    const { data, error } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', key)
        .single();
    if (error) {
        if (error.code === 'PGRST116') return null; // không tìm thấy
        console.error(`❌ Lỗi lấy config ${key}:`, error);
        return null;
    }
    return data?.value;
}

// ---- Cập nhật/Upsert cấu hình ----
async function setConfig(key, value) {
    const { error } = await supabase
        .from('bot_config')
        .upsert({ key, value }, { onConflict: 'key' });
    if (error) {
        console.error(`❌ Lỗi cập nhật config ${key}:`, error);
        return false;
    }
    return true;
}

// ---- Lấy tất cả trigger (từ khóa → phản hồi) ----
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

// ---- Lấy tất cả filter (từ cấm → câu dằn mặt) ----
async function getAllFilters() {
    const { data, error } = await supabase
        .from('bot_filters')
        .select('word, response');
    if (error) {
        console.error('❌ Lỗi lấy filters:', error);
        return [];
    }
    return data || [];
}

// ---- Thêm hoặc cập nhật trigger ----
async function setTrigger(keyword, response) {
    const { error } = await supabase
        .from('bot_triggers')
        .upsert({ keyword, response }, { onConflict: 'keyword' });
    if (error) {
        console.error('❌ Lỗi thêm trigger:', error);
        return false;
    }
    return true;
}

// ---- Xoá trigger ----
async function removeTrigger(keyword) {
    const { error } = await supabase
        .from('bot_triggers')
        .delete()
        .eq('keyword', keyword);
    if (error) {
        console.error('❌ Lỗi xoá trigger:', error);
        return false;
    }
    return true;
}

// ---- Thêm hoặc cập nhật filter (từ cấm + phản hồi) ----
async function addFilter(word, response) {
    const { error } = await supabase
        .from('bot_filters')
        .upsert({ word, response }, { onConflict: 'word' });
    if (error) {
        console.error('❌ Lỗi thêm filter:', error);
        return false;
    }
    return true;
}

// ---- Xoá filter ----
async function removeFilter(word) {
    const { error } = await supabase
        .from('bot_filters')
        .delete()
        .eq('word', word);
    if (error) {
        console.error('❌ Lỗi xoá filter:', error);
        return false;
    }
    return true;
}

// ---- Lấy cấu hình spam (có fallback) ----
async function getSpamConfig() {
    const limit = await getConfig('spam_limit') || '5';
    const timeMs = await getConfig('spam_time') || '10000'; // 10 giây mặc định
    const response = await getConfig('spam_response') || 'Đừng spam bạn êi!';
    return {
        limit: parseInt(limit, 10),
        timeMs: parseInt(timeMs, 10),
        response
    };
}

// ================================================================
// 6. XỬ LÝ LỆNH ADMIN (CHAT PRIVATE) - SỬ DỤNG DẤU "|" LÀM SEPARATOR
// ================================================================

async function handleAdminCommand(text, chatId) {
    // Tách lấy command (từ đầu tiên)
    const firstSpace = text.indexOf(' ');
    if (firstSpace === -1) {
        // Không có tham số
        await sendZaloMessage(chatId, '❌ Lệnh không hợp lệ. Xem hướng dẫn sử dụng.');
        return;
    }
    const command = text.substring(0, firstSpace).toLowerCase();
    const argString = text.substring(firstSpace + 1).trim();

    let reply = '';

    switch (command) {
        case 'setwelcome': {
            // !setwelcome <nội dung>  (không dùng "|")
            if (!argString) {
                reply = '⚠️ Vui lòng cung cấp nội dung lời chào.';
                break;
            }
            const ok = await setConfig('welcome_message', argString);
            reply = ok ? '✅ Đã cập nhật lời chào mừng!' : '❌ Cập nhật thất bại.';
            break;
        }

        case 'set': {
            // !set <từ khóa> | <câu trả lời>
            const parts = argString.split('|').map(s => s.trim());
            if (parts.length < 2 || !parts[0] || !parts[1]) {
                reply = '⚠️ Cú pháp: !set <từ khóa> | <câu trả lời>';
                break;
            }
            const keyword = parts[0];
            const response = parts[1];
            const ok = await setTrigger(keyword, response);
            reply = ok ? `✅ Đã lưu trigger cho từ khóa "${keyword}"` : '❌ Lỗi lưu trigger';
            break;
        }

        case 'unset': {
            // !unset <từ khóa>
            if (!argString) {
                reply = '⚠️ Vui lòng cung cấp từ khóa cần xoá.';
                break;
            }
            const keyword = argString;
            const ok = await removeTrigger(keyword);
            reply = ok ? `✅ Đã xoá trigger cho từ khóa "${keyword}"` : '❌ Xoá thất bại (có thể không tồn tại)';
            break;
        }

        case 'addfilter': {
            // !addfilter <từ cấm> | <câu dằn mặt>
            const parts = argString.split('|').map(s => s.trim());
            if (parts.length < 2 || !parts[0] || !parts[1]) {
                reply = '⚠️ Cú pháp: !addfilter <từ cấm> | <câu dằn mặt>';
                break;
            }
            const word = parts[0];
            const response = parts[1];
            const ok = await addFilter(word, response);
            reply = ok ? `✅ Đã thêm filter cho từ "${word}"` : '❌ Lỗi thêm filter';
            break;
        }

        case 'remfilter': {
            // !remfilter <từ cấm>
            if (!argString) {
                reply = '⚠️ Vui lòng cung cấp từ cần xoá khỏi danh sách cấm.';
                break;
            }
            const word = argString;
            const ok = await removeFilter(word);
            reply = ok ? `✅ Đã xoá từ "${word}" khỏi danh sách cấm` : '❌ Xoá thất bại (có thể không tồn tại)';
            break;
        }

        case 'setspam': {
            // !setspam <số_tin> | <số_giây> | <câu_dằn_mặt>
            const parts = argString.split('|').map(s => s.trim());
            if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) {
                reply = '⚠️ Cú pháp: !setspam <số_tin> | <số_giây> | <câu dằn mặt>';
                break;
            }
            const limit = parseInt(parts[0], 10);
            const seconds = parseInt(parts[1], 10);
            const response = parts[2];
            if (isNaN(limit) || isNaN(seconds) || limit <= 0 || seconds <= 0) {
                reply = '⚠️ Số tin và số giây phải là số nguyên dương.';
                break;
            }
            const timeMs = seconds * 1000;
            const ok1 = await setConfig('spam_limit', String(limit));
            const ok2 = await setConfig('spam_time', String(timeMs));
            const ok3 = await setConfig('spam_response', response);
            if (ok1 && ok2 && ok3) {
                reply = `✅ Đã cập nhật chống spam: ${limit} tin / ${seconds} giây.`;
            } else {
                reply = '❌ Lỗi cập nhật cấu hình spam.';
            }
            break;
        }

        default:
            reply = '❌ Lệnh không hợp lệ. Hỗ trợ: !setwelcome, !set, !unset, !addfilter, !remfilter, !setspam';
    }

    if (reply) {
        await sendZaloMessage(chatId, reply);
    }
}

// ================================================================
// 7. WEBHOOK CHÍNH
// ================================================================

// --- Bộ đệm chống spam (lưu theo nhóm và user) ---
const userChatLog = {}; // { groupId: { senderId: [timestamp1, timestamp2, ...] } }

/**
 * Dọn dẹp bộ nhớ userChatLog:
 * - Xóa các timestamp cũ hơn 15 phút.
 * - Nếu một user không còn timestamp nào, xóa user đó.
 * - Nếu một group không còn user nào, xóa group đó.
 */
function cleanupChatLog() {
    const now = Date.now();
    const FIFTEEN_MINUTES = 15 * 60 * 1000;

    for (const groupId of Object.keys(userChatLog)) {
        const group = userChatLog[groupId];
        let groupEmpty = true;
        for (const senderId of Object.keys(group)) {
            const timestamps = group[senderId];
            // Giữ lại các timestamp trong vòng 15 phút gần đây
            const recent = timestamps.filter(ts => now - ts < FIFTEEN_MINUTES);
            if (recent.length > 0) {
                group[senderId] = recent;
                groupEmpty = false;
            } else {
                delete group[senderId]; // Xóa user nếu không còn timestamp nào
            }
        }
        if (groupEmpty) {
            delete userChatLog[groupId]; // Xóa cả group nếu rỗng
        }
    }
    console.log('🧹 Đã dọn dẹp bộ nhớ userChatLog.');
}

// Chạy dọn dẹp mỗi 15 phút
setInterval(cleanupChatLog, 15 * 60 * 1000);

// ================================================================
// ENDPOINT WEBHOOK
// ================================================================
app.post('/webhook', async (req, res) => {
    try {
        const body = req.body;
        console.log('📩 Webhook nhận:', JSON.stringify(body, null, 2));

        const eventName = body.event_name;

        // ---------- Sự kiện thành viên mới (user.join.group) ----------
        if (eventName === 'user.join.group') {
            const groupId = body.group_id;
            const userId = body.user_id;
            const userName = body.user_name || 'Thành viên mới';
            if (!groupId) {
                console.log('⚠️ Không có group_id, bỏ qua user_join.');
                return res.status(200).send('OK');
            }
            const welcomeText = await getConfig('welcome_message') || 'Chào mừng bạn đến với nhóm!';
            const msg = `👋 Chào mừng @${userName} tham gia nhóm!\n\n${welcomeText}`;
            await sendZaloMessage(groupId, msg);
            return res.status(200).send('OK');
        }

        // ---------- Sự kiện tin nhắn chữ (message.text.received) ----------
        if (eventName === 'message.text.received') {
            const messageData = body.message || {};
            const text = messageData.text || '';
            const chat = messageData.chat || {};
            const chatType = chat.chat_type;   // 'PRIVATE' hoặc 'GROUP'
            const chatId = chat.id;
            const from = messageData.from || {};
            const senderId = from.id;
            const senderName = from.display_name || 'Thành viên';

            if (!chatId) return res.status(200).send('OK');

            // ---------- PRIVATE: khu vực admin ----------
            if (chatType === 'PRIVATE') {
                if (text.startsWith('!')) {
                    const command = text.substring(1).trim();
                    await handleAdminCommand(command, chatId);
                } else {
                    const menu =
                        '🤖 Vui lòng sử dụng lệnh bắt đầu bằng "!" để cấu hình bot:\n' +
                        '!setwelcome <nội dung>\n' +
                        '!set <từ khóa> | <câu trả lời>\n' +
                        '!unset <từ khóa>\n' +
                        '!addfilter <từ cấm> | <câu dằn mặt>\n' +
                        '!remfilter <từ cấm>\n' +
                        '!setspam <số_tin> | <số_giây> | <câu dằn mặt>';
                    await sendZaloMessage(chatId, menu);
                }
                return res.status(200).send('OK');
            }

            // ---------- GROUP: xử lý tự động ----------
            if (chatType === 'GROUP') {
                // Bỏ qua tin nhắn bắt đầu bằng '!' để bảo mật
                if (text.startsWith('!')) {
                    console.log('🔇 Bỏ qua tin nhắn ! trong nhóm.');
                    return res.status(200).send('OK');
                }

                // ---- KIỂM TRA SPAM TRƯỚC ----
                const spamCfg = await getSpamConfig();
                // Khởi tạo log cho nhóm nếu chưa có
                if (!userChatLog[chatId]) userChatLog[chatId] = {};
                if (!userChatLog[chatId][senderId]) userChatLog[chatId][senderId] = [];

                const now = Date.now();
                const timestamps = userChatLog[chatId][senderId];
                // Giữ lại các timestamp trong khoảng thời gian cho phép
                const recent = timestamps.filter(ts => now - ts < spamCfg.timeMs);
                recent.push(now);
                userChatLog[chatId][senderId] = recent;

                if (recent.length > spamCfg.limit) {
                    // Vượt ngưỡng spam → gửi câu dằn mặt và bỏ qua tin nhắn này
                    await sendZaloMessage(chatId, spamCfg.response);
                    return res.status(200).send('OK');
                }

                // ---- ƯU TIÊN KIỂM TRA FILTER (từ cấm) TRƯỚC ----
                const filters = await getAllFilters();
                const matchedFilter = filters.find(f => text.includes(f.word));
                if (matchedFilter) {
                    // Nếu dính từ cấm, gửi câu dằn mặt và ngắt luồng ngay
                    await sendZaloMessage(chatId, matchedFilter.response);
                    return res.status(200).send('OK');
                }

                // ---- SAU ĐÓ KIỂM TRA TRIGGER (từ khóa thường) ----
                const triggers = await getAllTriggers();
                const matchedTrigger = triggers.find(t => text.includes(t.keyword));
                if (matchedTrigger) {
                    await sendZaloMessage(chatId, matchedTrigger.response);
                    // Ngắt luồng để tránh xử lý thêm
                    return res.status(200).send('OK');
                }

                // Nếu không khớp gì, im lặng
                return res.status(200).send('OK');
            }

            console.log(`⚠️ Chat_type không xác định: ${chatType}`);
            return res.status(200).send('OK');
        }

        console.log(`ℹ️ Sự kiện không hỗ trợ: ${eventName}`);
        res.status(200).send('OK');

    } catch (error) {
        console.error('💥 Lỗi xử lý webhook:', error);
        res.status(200).send('Error logged');
    }
});

// ================================================================
// 8. ENDPOINT KIỂM TRA TRẠNG THÁI
// ================================================================
app.get('/', (req, res) => {
    res.send('Bot Zalo with Supabase is Running!');
});

// ================================================================
// 9. KHỞI ĐỘNG SERVER
// ================================================================
app.listen(PORT, () => {
    console.log(`🚀 Bot đang chạy tại cổng ${PORT}`);
});