const express = require('express');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// ================================================================
// 1. ĐỌC CẤU HÌNH TỪ BIẾN MÔI TRƯỜNG (KHÔNG HARDCODE)
// ================================================================
const ZALO_ACCESS_TOKEN = process.env.ZALO_ACCESS_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Kiểm tra các biến bắt buộc, nếu thiếu thì log lỗi và dừng ứng dụng
if (!ZALO_ACCESS_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ THIẾU BIẾN MÔI TRƯỜNG: Vui lòng đặt ZALO_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_KEY');
    process.exit(1); // Thoát với mã lỗi
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

const PORT = process.env.PORT || 7860; // Mặc định 7860 cho Hugging Face

// ================================================================
// 4. HÀM GỬI TIN NHẮN ZALO
// ================================================================
/**
 * Gửi tin nhắn qua Zalo API
 * @param {string} to - ID người nhận (user hoặc group)
 * @param {string} message - Nội dung tin nhắn
 */
async function sendZaloMessage(to, message) {
    try {
        const url = 'https://bot.zapps.me/api/v1/send-message'; // Hoặc endpoint thực tế
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
// 5. HÀM TƯƠNG TÁC VỚI SUPABASE
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
    // Kiểm tra trùng lặp
    const { data: existing } = await supabase
        .from('bot_filters')
        .select('word')
        .eq('word', word)
        .maybeSingle();
    if (existing) {
        console.log(`⚠️ Từ "${word}" đã tồn tại trong danh sách cấm.`);
        return true; // coi như thành công
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
 * Phân tích và thực thi lệnh từ admin
 * @param {string} text - Nội dung tin nhắn (đã bỏ dấu !)
 * @param {string} adminId - ID của admin (để gửi phản hồi)
 */
async function handleAdminCommand(text, adminId) {
    // Tách lệnh và tham số
    const parts = text.trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    let responseMsg = '';

    switch (command) {
        case 'setwelcome': {
            // !setwelcome [nội dung]
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
            // !set [từ khóa] [nội dung phản hồi]
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
            // !unset [từ khóa]
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
            // !addfilter [từ cấm]
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
            // !remfilter [từ cấm]
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
// 7. WEBHOOK CHÍNH
// ================================================================

app.post('/webhook', async (req, res) => {
    try {
        const body = req.body;
        console.log('📩 Webhook nhận:', JSON.stringify(body, null, 2));

        const event = body.event;

        // Xử lý sự kiện thành viên mới
        if (event === 'user_join') {
            const groupId = body.group_id;
            const userId = body.user_id;
            const userName = body.user_name || 'Thành viên mới';

            if (!groupId) {
                console.log('⚠️ Không có group_id, bỏ qua user_join.');
                return res.status(200).send('OK');
            }

            // Lấy lời chào từ Supabase
            const welcomeText = await getWelcomeMessage();
            const message = welcomeText
                ? `👋 Chào mừng @[${userId}] tham gia nhóm!\n\n${welcomeText}`
                : `👋 Chào mừng @[${userId}] tham gia nhóm!`;

            await sendZaloMessage(groupId, message);
            return res.status(200).send('OK');
        }

        // Xử lý sự kiện tin nhắn
        if (event === 'message') {
            const sender = body.sender || {};
            const senderId = sender.id;
            const senderName = sender.name || 'Thành viên';
            const message = body.message || {};
            const text = message.text || '';

            const recipient = body.recipient || {};
            const recipientType = recipient.type; // 'user' hoặc 'group'

            // 1. Trường hợp chat 1-1 (admin)
            if (recipientType === 'user') {
                // Kiểm tra nếu tin nhắn bắt đầu bằng '!'
                if (text.startsWith('!')) {
                    const command = text.substring(1); // bỏ dấu !
                    await handleAdminCommand(command, senderId);
                } else {
                    // Nhắc nhở admin dùng lệnh
                    await sendZaloMessage(
                        senderId,
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

            // 2. Trường hợp chat nhóm
            if (recipientType === 'group') {
                const groupId = recipient.id;

                // Bỏ qua tin nhắn bắt đầu bằng '!' (bảo mật)
                if (text.startsWith('!')) {
                    console.log('🔇 Bỏ qua tin nhắn bắt đầu bằng ! trong nhóm.');
                    return res.status(200).send('OK');
                }

                // Lấy danh sách trigger và filter từ Supabase
                const triggers = await getAllTriggers();
                const filters = await getAllFilters();

                // 2a. Kiểm tra trigger (khớp chính xác)
                const matchedTrigger = triggers.find(t => t.keyword === text.trim());
                if (matchedTrigger) {
                    await sendZaloMessage(groupId, matchedTrigger.response);
                }

                // 2b. Kiểm tra filter (chứa từ cấm)
                const containsForbidden = filters.some(word =>
                    text.toLowerCase().includes(word.toLowerCase())
                );
                if (containsForbidden) {
                    const warnMsg = `🚨 Cảnh báo @[${senderId}] không được vi phạm nội quy! Hành vi của bạn đã bị ghi nhận.`;
                    await sendZaloMessage(groupId, warnMsg);
                }

                return res.status(200).send('OK');
            }

            // Không xác định loại chat
            console.log('⚠️ Loại recipient không xác định:', recipientType);
            return res.status(200).send('OK');
        }

        // Các sự kiện khác không xử lý
        console.log(`ℹ️ Sự kiện không hỗ trợ: ${event}`);
        res.status(200).send('OK');

    } catch (error) {
        console.error('💥 Lỗi xử lý webhook:', error);
        res.status(200).send('Error logged'); // vẫn trả 200 để tránh retry
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