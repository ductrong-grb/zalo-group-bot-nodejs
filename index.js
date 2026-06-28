const express = require('express');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// ================================================================
// 1. ĐỌC CẤU HÌNH TỪ BIẾN MÔI TRƯỜNG (AN TOÀN KHI PUBLIC)
// ================================================================
const ZALO_BOT_TOKEN = process.env.ZALO_BOT_TOKEN;       // Token của bot (lấy từ Zalo Bot Platform)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!ZALO_BOT_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ THIẾU BIẾN MÔI TRƯỜNG: Vui lòng đặt ZALO_BOT_TOKEN, SUPABASE_URL, SUPABASE_KEY');
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
// 4. HÀM GỬI TIN NHẮN ZALO (THEO TÀI LIỆU MỚI)
// ================================================================
/**
 * Gửi tin nhắn chữ tới một cuộc trò chuyện (cá nhân hoặc nhóm)
 * @param {string} chatId - ID của cuộc trò chuyện (lấy từ webhook)
 * @param {string} text - Nội dung tin nhắn
 */
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
// 5. HÀM TƯƠNG TÁC VỚI SUPABASE (LƯU CẤU HÌNH)
// ================================================================

/** Lấy nội dung tin nhắn chào mừng từ bảng bot_config */
async function getWelcomeMessage() {
    const { data, error } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', 'welcome_message')
        .single();
    if (error) {
        console.error('❌ Lỗi lấy welcome_message:', error);
        return null;
    }
    return data?.value || null;
}

/** Lấy tất cả trigger (từ khóa -> phản hồi) từ bảng bot_triggers */
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

/** Lấy tất cả từ cấm từ bảng bot_filters */
async function getAllFilters() {
    const { data, error } = await supabase
        .from('bot_filters')
        .select('word');
    if (error) {
        console.error('❌ Lỗi lấy filters:', error);
        return [];
    }
    return data.map(row => row.word);
}

/** Cập nhật hoặc tạo mới welcome_message trong bot_config */
async function setWelcomeMessage(content) {
    const { error } = await supabase
        .from('bot_config')
        .upsert({ key: 'welcome_message', value: content }, { onConflict: 'key' });
    if (error) {
        console.error('❌ Lỗi cập nhật welcome_message:', error);
        return false;
    }
    return true;
}

/** Thêm một trigger mới (upsert) */
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

/** Xóa một trigger theo từ khóa */
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

/** Thêm một từ cấm (nếu chưa tồn tại) */
async function addFilter(word) {
    const { data: existing } = await supabase
        .from('bot_filters')
        .select('word')
        .eq('word', word)
        .maybeSingle();
    if (existing) {
        console.log(`⚠️ Từ "${word}" đã tồn tại trong danh sách cấm.`);
        return true;
    }
    const { error } = await supabase
        .from('bot_filters')
        .insert({ word });
    if (error) {
        console.error('❌ Lỗi thêm filter:', error);
        return false;
    }
    return true;
}

/** Xóa một từ cấm */
async function removeFilter(word) {
    const { error } = await supabase
        .from('bot_filters')
        .delete()
        .eq('word', word);
    if (error) {
        console.error('❌ Lỗi xóa filter:', error);
        return false;
    }
    return true;
}

// ================================================================
// 6. XỬ LÝ LỆNH ADMIN TRONG CHAT 1-1
// ================================================================

/**
 * Phân tích và thực thi lệnh từ admin (chat PRIVATE)
 * @param {string} text - Nội dung tin nhắn (đã bỏ dấu !)
 * @param {string} adminChatId - ID cuộc trò chuyện của admin (để gửi phản hồi)
 */
async function handleAdminCommand(text, adminChatId) {
    const parts = text.trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    let responseMsg = '';

    switch (command) {
        case 'setwelcome': {
            const content = args.join(' ');
            if (!content) {
                responseMsg = '⚠️ Vui lòng cung cấp nội dung lời chào. Ví dụ: !setwelcome Chào mừng bạn đến nhóm!';
                break;
            }
            const ok = await setWelcomeMessage(content);
            responseMsg = ok ? '✅ Đã cập nhật lời chào mừng!' : '❌ Cập nhật thất bại, vui lòng kiểm tra log.';
            break;
        }
        case 'set': {
            if (args.length < 2) {
                responseMsg = '⚠️ Cú pháp: !set <từ khóa> <nội dung phản hồi>. Ví dụ: !set #huongdan Link hướng dẫn...';
                break;
            }
            const keyword = args[0];
            const responseContent = args.slice(1).join(' ');
            const ok = await setTrigger(keyword, responseContent);
            responseMsg = ok ? `✅ Đã lưu trigger cho từ khóa "${keyword}"!` : '❌ Lưu thất bại.';
            break;
        }
        case 'unset': {
            if (args.length < 1) {
                responseMsg = '⚠️ Cú pháp: !unset <từ khóa>. Ví dụ: !unset #huongdan';
                break;
            }
            const keyword = args[0];
            const ok = await removeTrigger(keyword);
            responseMsg = ok ? `✅ Đã xóa trigger cho từ khóa "${keyword}"!` : '❌ Xóa thất bại (có thể từ khóa không tồn tại).';
            break;
        }
        case 'addfilter': {
            if (args.length < 1) {
                responseMsg = '⚠️ Cú pháp: !addfilter <từ cấm>. Ví dụ: !addfilter spam';
                break;
            }
            const word = args[0];
            const ok = await addFilter(word);
            responseMsg = ok ? `✅ Đã thêm từ "${word}" vào danh sách cấm!` : '❌ Thêm thất bại.';
            break;
        }
        case 'remfilter': {
            if (args.length < 1) {
                responseMsg = '⚠️ Cú pháp: !remfilter <từ cấm>. Ví dụ: !remfilter spam';
                break;
            }
            const word = args[0];
            const ok = await removeFilter(word);
            responseMsg = ok ? `✅ Đã xóa từ "${word}" khỏi danh sách cấm!` : '❌ Xóa thất bại (có thể từ không tồn tại).';
            break;
        }
        default:
            responseMsg = '❌ Lệnh không hợp lệ. Các lệnh hỗ trợ: !setwelcome, !set, !unset, !addfilter, !remfilter';
    }

    if (responseMsg) {
        await sendZaloMessage(adminChatId, responseMsg);
    }
}

// ================================================================
// 7. WEBHOOK CHÍNH (XỬ LÝ SỰ KIỆN TỪ ZALO)
// ================================================================

app.post('/webhook', async (req, res) => {
    try {
        const body = req.body;
        console.log('📩 Webhook nhận:', JSON.stringify(body, null, 2));

        const eventName = body.event_name;

        // ---------- SỰ KIỆN THÀNH VIÊN MỚI (user.join.group) ----------
        // Theo tài liệu Zalo, event_name có thể là "user.join.group"
        if (eventName === 'user.join.group') {
            const groupId = body.group_id;        // ID nhóm
            const userId = body.user_id;          // ID thành viên mới
            const userName = body.user_name || 'Thành viên mới';

            if (!groupId) {
                console.log('⚠️ Không có group_id, bỏ qua user_join.');
                return res.status(200).send('OK');
            }

            // Lấy lời chào từ Supabase
            const welcomeText = await getWelcomeMessage();
            // Gửi tin nhắn chào mừng (có thể tag tên bằng @[userId] hoặc @userName)
            const message = welcomeText
                ? `👋 Chào mừng @${userName} tham gia nhóm!\n\n${welcomeText}`
                : `👋 Chào mừng @${userName} tham gia nhóm!`;

            await sendZaloMessage(groupId, message);
            return res.status(200).send('OK');
        }

        // ---------- SỰ KIỆN TIN NHẮN CHỮ (message.text.received) ----------
        if (eventName === 'message.text.received') {
            const messageData = body.message || {};
            const text = messageData.text || '';
            const chat = messageData.chat || {};
            const chatType = chat.chat_type;   // 'PRIVATE' hoặc 'GROUP'
            const chatId = chat.id;            // ID cuộc trò chuyện
            const from = messageData.from || {};
            const senderId = from.id;
            const senderName = from.display_name || 'Thành viên';

            if (!chatId) {
                console.log('⚠️ Không tìm thấy chat.id, bỏ qua.');
                return res.status(200).send('OK');
            }

            // ==========================================
            // 1. TRƯỜNG HỢP CHAT RIÊNG TƯ (PRIVATE) - ADMIN
            // ==========================================
            if (chatType === 'PRIVATE') {
                // Nếu tin nhắn bắt đầu bằng '!' -> xử lý lệnh cấu hình
                if (text.startsWith('!')) {
                    const command = text.substring(1).trim();
                    await handleAdminCommand(command, chatId);
                } else {
                    // Gửi menu hướng dẫn
                    const menu = 
                        '🤖 Chào bạn! Đây là khu vực quản trị. Vui lòng sử dụng các lệnh bắt đầu bằng dấu "!" để cấu hình bot.\n' +
                        'Danh sách lệnh:\n' +
                        '!setwelcome [nội dung] - Cập nhật lời chào\n' +
                        '!set [từ khóa] [nội dung] - Thêm trigger\n' +
                        '!unset [từ khóa] - Xóa trigger\n' +
                        '!addfilter [từ cấm] - Thêm từ cấm\n' +
                        '!remfilter [từ cấm] - Xóa từ cấm';
                    await sendZaloMessage(chatId, menu);
                }
                return res.status(200).send('OK');
            }

            // ==========================================
            // 2. TRƯỜNG HỢP CHAT NHÓM (GROUP) - TỰ ĐỘNG
            // ==========================================
            if (chatType === 'GROUP') {
                // Bỏ qua tin nhắn bắt đầu bằng '!' (bảo mật cấu hình)
                if (text.startsWith('!')) {
                    console.log('🔇 Bỏ qua tin nhắn bắt đầu bằng ! trong nhóm.');
                    return res.status(200).send('OK');
                }

                // Lấy danh sách trigger và filter từ Supabase
                const triggers = await getAllTriggers();
                const filters = await getAllFilters();

                // 2a. Kiểm tra trigger (khớp chính xác toàn bộ nội dung)
                const matchedTrigger = triggers.find(t => t.keyword === text.trim());
                if (matchedTrigger) {
                    await sendZaloMessage(chatId, matchedTrigger.response);
                }

                // 2b. Kiểm tra filter (chứa từ cấm) -> cảnh báo và tag tên
                const containsForbidden = filters.some(word =>
                    text.toLowerCase().includes(word.toLowerCase())
                );
                if (containsForbidden) {
                    const warnMsg = `🚨 Cảnh báo @${senderName} không được vi phạm nội quy! Hành vi của bạn đã bị ghi nhận.`;
                    await sendZaloMessage(chatId, warnMsg);
                }

                return res.status(200).send('OK');
            }

            // Nếu chat_type không xác định
            console.log(`⚠️ Chat_type không xác định: ${chatType}`);
            return res.status(200).send('OK');
        }

        // Các sự kiện khác không xử lý
        console.log(`ℹ️ Sự kiện không hỗ trợ: ${eventName}`);
        res.status(200).send('OK');

    } catch (error) {
        console.error('💥 Lỗi xử lý webhook:', error);
        res.status(200).send('Error logged');
    }
});

// ================================================================
// 8. ENDPOINT KIỂM TRA TRẠNG THÁI (CHO HUGGING FACE)
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