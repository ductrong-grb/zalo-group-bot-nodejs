const express = require('express');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// ================================================================
// 1. ĐỌC CẤU HÌNH TỪ BIẾN MÔI TRƯỜNG (AN TOÀN KHI PUBLIC)
// ================================================================
const ZALO_ACCESS_TOKEN = process.env.ZALO_ACCESS_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!ZALO_ACCESS_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ THIẾU BIẾN MÔI TRƯỜNG: Vui lòng đặt ZALO_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_KEY');
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
// 4. HÀM GỬI TIN NHẮN ZALO
// ================================================================
/**
 * Gửi tin nhắn qua Zalo API (endpoint bot.zapps.me)
 * @param {string} to - ID người nhận (user hoặc group)
 * @param {string} message - Nội dung tin nhắn
 */
async function sendZaloMessage(to, message) {
    try {
        const url = 'https://bot.zapps.me/api/v1/send-message';
        const response = await axios.post(
            url,
            { to, message },
            {
                headers: {
                    'Authorization': `Bearer ${ZALO_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log(`✅ Đã gửi tin nhắn đến ${to}:`, response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Lỗi gửi tin nhắn Zalo:', error.response?.data || error.message);
        throw error;
    }
}

// ================================================================
// 5. HÀM TƯƠNG TÁC VỚI SUPABASE (GIỮ NGUYÊN)
// ================================================================
// ... (các hàm getWelcomeMessage, getAllTriggers, getAllFilters, setWelcomeMessage, setTrigger, removeTrigger, addFilter, removeFilter)
// Tôi sẽ giữ nguyên phần này, chỉ sao chép lại để đảm bảo đầy đủ.

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
        .select('word');
    if (error) {
        console.error('❌ Lỗi lấy filters:', error);
        return [];
    }
    return data.map(row => row.word);
}

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
        console.error('❌ Lỗi xóa trigger:', error);
        return false;
    }
    return true;
}

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
// 6. XỬ LÝ LỆNH ADMIN TRONG CHAT 1-1 (GIỮ NGUYÊN)
// ================================================================
async function handleAdminCommand(text, adminId) {
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
        await sendZaloMessage(adminId, responseMsg);
    }
}

// ================================================================
// 7. WEBHOOK CHÍNH (CẬP NHẬT THEO CẤU TRÚC THỰC TẾ)
// ================================================================
app.post('/webhook', async (req, res) => {
    try {
        const body = req.body;
        console.log('📩 Webhook nhận:', JSON.stringify(body, null, 2));

        const eventName = body.event_name;

        // ---------- XỬ LÝ SỰ KIỆN THÀNH VIÊN MỚI (user.join.group) ----------
        // Dựa trên tài liệu Zalo, có thể event_name là "user.join.group"
        if (eventName === 'user.join.group') {
            const groupId = body.group_id;         // Kiểm tra xem trường này có tồn tại không
            const userId = body.user_id;
            const userName = body.user_name || 'Thành viên mới';

            if (!groupId) {
                console.log('⚠️ Không có group_id, bỏ qua user_join.');
                return res.status(200).send('OK');
            }

            const welcomeText = await getWelcomeMessage();
            const message = welcomeText
                ? `👋 Chào mừng @[${userId}] tham gia nhóm!\n\n${welcomeText}`
                : `👋 Chào mừng @[${userId}] tham gia nhóm!`;

            await sendZaloMessage(groupId, message);
            return res.status(200).send('OK');
        }

        // ---------- XỬ LÝ SỰ KIỆN TIN NHẮN (message.text.received) ----------
        if (eventName === 'message.text.received') {
            const messageData = body.message || {};
            const text = messageData.text || '';
            const chat = messageData.chat || {};
            const chatType = chat.chat_type; // 'PRIVATE' hoặc 'GROUP'
            const chatId = chat.id;          // ID của user (PRIVATE) hoặc group (GROUP)
            const from = messageData.from || {};
            const senderId = from.id;
            const senderName = from.display_name || 'Thành viên';

            if (!chatId) {
                console.log('⚠️ Không tìm thấy chat.id, bỏ qua.');
                return res.status(200).send('OK');
            }

            // -----------------------------
            // 1. CHAT RIÊNG TƯ (PRIVATE) - KHU VỰC QUẢN TRỊ
            // -----------------------------
            if (chatType === 'PRIVATE') {
                // Nếu tin nhắn bắt đầu bằng '!' => xử lý lệnh admin
                if (text.startsWith('!')) {
                    const command = text.substring(1);
                    await handleAdminCommand(command, chatId); // chatId chính là ID của admin
                } else {
                    // Nhắc nhở admin
                    await sendZaloMessage(
                        chatId,
                        '🤖 Chào bạn! Đây là khu vực quản trị. Vui lòng sử dụng các lệnh bắt đầu bằng dấu "!" để cấu hình bot.\n'
                        + 'Danh sách lệnh:\n'
                        + '!setwelcome [nội dung] - Cập nhật lời chào\n'
                        + '!set [từ khóa] [nội dung] - Thêm trigger\n'
                        + '!unset [từ khóa] - Xóa trigger\n'
                        + '!addfilter [từ cấm] - Thêm từ cấm\n'
                        + '!remfilter [từ cấm] - Xóa từ cấm'
                    );
                }
                return res.status(200).send('OK');
            }

            // -----------------------------
            // 2. CHAT NHÓM (GROUP) - TỰ ĐỘNG THỰC THI
            // -----------------------------
            if (chatType === 'GROUP') {
                // Bỏ qua tin nhắn bắt đầu bằng '!' (bảo mật)
                if (text.startsWith('!')) {
                    console.log('🔇 Bỏ qua tin nhắn bắt đầu bằng ! trong nhóm.');
                    return res.status(200).send('OK');
                }

                // Lấy trigger và filter từ Supabase
                const triggers = await getAllTriggers();
                const filters = await getAllFilters();

                // 2a. Kiểm tra trigger (khớp chính xác toàn bộ nội dung)
                const matchedTrigger = triggers.find(t => t.keyword === text.trim());
                if (matchedTrigger) {
                    await sendZaloMessage(chatId, matchedTrigger.response);
                }

                // 2b. Kiểm tra filter (chứa từ cấm) – tag người gửi
                const containsForbidden = filters.some(word =>
                    text.toLowerCase().includes(word.toLowerCase())
                );
                if (containsForbidden) {
                    // Tag người dùng bằng cú pháp @[userId]
                    const warnMsg = `🚨 Cảnh báo @[${senderId}] không được vi phạm nội quy! Hành vi của bạn đã bị ghi nhận.`;
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