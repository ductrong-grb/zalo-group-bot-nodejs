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
// 4. HÀM GỬI TIN NHẮN QUA ZALO API
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
// 5. HÀM TƯƠNG TÁC VỚI SUPABASE (GIỮ NGUYÊN)
// ================================================================
async function getConfig(key) {
    const { data, error } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', key)
        .single();
    if (error) {
        if (error.code === 'PGRST116') return null;
        console.error(`❌ Lỗi lấy config ${key}:`, error);
        return null;
    }
    return data?.value;
}

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

async function getSpamConfig() {
    const limit = await getConfig('spam_limit') || '5';
    const timeMs = await getConfig('spam_time') || '10000';
    const response = await getConfig('spam_response') || 'Đừng spam bạn êi!';
    return {
        limit: parseInt(limit, 10),
        timeMs: parseInt(timeMs, 10),
        response
    };
}

// ================================================================
// 6. XỬ LÝ LỆNH ADMIN (CHAT PRIVATE) - SỬ DỤNG DẤU "|"
// ================================================================
async function handleAdminCommand(text, chatId) {
    const firstSpace = text.indexOf(' ');
    if (firstSpace === -1) {
        await sendZaloMessage(chatId, '❌ Lệnh không hợp lệ. Xem hướng dẫn sử dụng.');
        return;
    }
    const command = text.substring(0, firstSpace).toLowerCase();
    const argString = text.substring(firstSpace + 1).trim();

    let reply = '';

    switch (command) {
        case 'setwelcome': {
            if (!argString) {
                reply = '⚠️ Vui lòng cung cấp nội dung lời chào.';
                break;
            }
            const ok = await setConfig('welcome_message', argString);
            reply = ok ? '✅ Đã cập nhật lời chào mừng!' : '❌ Cập nhật thất bại.';
            break;
        }
        case 'set': {
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
// 7. BỘ ĐỆM CHỐNG SPAM & DỌN DẸP
// ================================================================
const userChatLog = {}; // { groupId: { senderId: [timestamp, ...] } }

function cleanupChatLog() {
    const now = Date.now();
    const FIFTEEN_MINUTES = 15 * 60 * 1000;
    for (const groupId of Object.keys(userChatLog)) {
        const group = userChatLog[groupId];
        let groupEmpty = true;
        for (const senderId of Object.keys(group)) {
            const timestamps = group[senderId];
            const recent = timestamps.filter(ts => now - ts < FIFTEEN_MINUTES);
            if (recent.length > 0) {
                group[senderId] = recent;
                groupEmpty = false;
            } else {
                delete group[senderId];
            }
        }
        if (groupEmpty) {
            delete userChatLog[groupId];
        }
    }
    console.log('🧹 Đã dọn dẹp bộ nhớ userChatLog.');
}
setInterval(cleanupChatLog, 15 * 60 * 1000);

// ================================================================
// 8. WEBHOOK CHÍNH (CẬP NHẬT BẮT SỰ KIỆN JOIN/ADD GROUP)
// ================================================================

app.post('/webhook', async (req, res) => {
    try {
        const body = req.body;
        // ---- DEBUG: In toàn bộ webhook để xem cấu trúc ----
        console.log('📩 Debug Webhook:', JSON.stringify(body, null, 2));

        const eventName = body.event_name;

        // ---------- Sự kiện thành viên mới (user.join.group & user.add.group) ----------
        if (eventName === 'user.join.group' || eventName === 'user.add.group') {
            // Lấy groupId một cách linh hoạt
            const groupId = body.group_id || body.data?.group_id || body.message?.chat?.id;
            // Lấy userName
            const userName = body.user_name || body.data?.user_name || 'Thành viên mới';
            // Lấy userId (không dùng nhưng có thể lưu log)
            const userId = body.user_id || body.data?.user_id || '';

            if (!groupId) {
                console.log('⚠️ Không tìm thấy groupId, bỏ qua sự kiện join/ add.');
                return res.status(200).send('OK');
            }

            // Lấy lời chào từ Supabase
            const welcomeText = await getConfig('welcome_message') || 'Chào mừng bạn đến với nhóm!';
            const msg = `👋 Chào mừng ${userName} tham gia nhóm!\n\n${welcomeText}`;

            await sendZaloMessage(groupId, msg);
            console.log(`✅ Đã gửi lời chào đến nhóm ${groupId} cho ${userName}`);
            return res.status(200).send('OK');
        }

        // ---------- Sự kiện tin nhắn chữ (message.text.received) ----------
        if (eventName === 'message.text.received') {
            const messageData = body.message || {};
            const text = messageData.text || '';
            const chat = messageData.chat || {};
            const chatType = chat.chat_type;
            const chatId = chat.id;
            const from = messageData.from || {};
            const senderId = from.id;
            const senderName = from.display_name || 'Thành viên';

            if (!chatId) return res.status(200).send('OK');

            // PRIVATE: Khu vực admin
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

            // GROUP: Xử lý tự động
            if (chatType === 'GROUP') {
                if (text.startsWith('!')) {
                    console.log('🔇 Bỏ qua tin nhắn ! trong nhóm.');
                    return res.status(200).send('OK');
                }

                // ---- SPAM ----
                const spamCfg = await getSpamConfig();
                if (!userChatLog[chatId]) userChatLog[chatId] = {};
                if (!userChatLog[chatId][senderId]) userChatLog[chatId][senderId] = [];

                const now = Date.now();
                const timestamps = userChatLog[chatId][senderId];
                const recent = timestamps.filter(ts => now - ts < spamCfg.timeMs);
                recent.push(now);
                userChatLog[chatId][senderId] = recent;

                if (recent.length > spamCfg.limit) {
                    await sendZaloMessage(chatId, spamCfg.response);
                    return res.status(200).send('OK');
                }

                // ---- ƯU TIÊN FILTER (từ cấm) ----
                const filters = await getAllFilters();
                const matchedFilter = filters.find(f => text.includes(f.word));
                if (matchedFilter) {
                    await sendZaloMessage(chatId, matchedFilter.response);
                    return res.status(200).send('OK');
                }

                // ---- TRIGGER (từ khóa thường) ----
                const triggers = await getAllTriggers();
                const matchedTrigger = triggers.find(t => text.includes(t.keyword));
                if (matchedTrigger) {
                    await sendZaloMessage(chatId, matchedTrigger.response);
                    return res.status(200).send('OK');
                }

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
// 9. ENDPOINT KIỂM TRA TRẠNG THÁI
// ================================================================
app.get('/', (req, res) => {
    res.send('Bot Zalo with Supabase is Running!');
});

// ================================================================
// 10. KHỞI ĐỘNG SERVER
// ================================================================
app.listen(PORT, () => {
    console.log(`🚀 Bot đang chạy tại cổng ${PORT}`);
});