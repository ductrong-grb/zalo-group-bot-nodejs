<div align="center">

# 🤖 Zalo Group Bot — bản lỏ

### Một con bot nhóm Zalo được AI phụ viết, người viết phụ... lười dọn.

[![Status](https://img.shields.io/badge/status-experimental-orange?style=for-the-badge)](#trang-thai-du-an)
[![AI Assisted](https://img.shields.io/badge/AI-assisted-blueviolet?style=for-the-badge)](#vi-sao-source-lo)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Supabase](https://img.shields.io/badge/database-Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)

**Có vài chức năng đang dùng được. Có vài chức năng chỉ tồn tại trong code. Có vài chỗ mình biết chưa ổn nhưng chưa sửa vì... lười.**

Không phải sản phẩm hoàn chỉnh · Không cam kết uptime · Không khuyến nghị chạy production nguyên trạng

</div>

---

## 🧭 Mục lục

<details open>
<summary><b>Nhấn để thu gọn / mở rộng</b></summary>

1. [Giới thiệu](#gioi-thieu)
2. [Trạng thái dự án](#trang-thai-du-an)
3. [Vì sao source lỏ?](#vi-sao-source-lo)
4. [Công nghệ và cấu trúc source](#cong-nghe-va-cau-truc-source)
5. [Các chức năng có trong code](#cac-chuc-nang-co-trong-code)
6. [Các lệnh bot](#cac-lenh-bot)
7. [Cách bot đang nhận và xử lý tin nhắn](#cach-bot-xu-ly-tin-nhan)
8. [Những thứ không nên hiểu nhầm là tính năng](#nhung-thu-khong-nen-hieu-nham)
9. [Chuẩn bị trước khi chạy](#chuan-bi)
10. [Tạo database Supabase](#supabase)
11. [Cấu hình biến môi trường](#bien-moi-truong)
12. [Cài đặt và chạy local](#cai-dat-local)
13. [Cấu hình Zalo Bot Webhook](#cau-hinh-webhook)
14. [Chạy bằng Docker](#docker)
15. [Lịch nhắc đồng phục](#lich-dong-phuc)
16. [Lỗi thường gặp](#loi-thuong-gap)
17. [Bảo mật trước khi public](#bao-mat)
18. [Hướng phát triển / việc còn nợ](#todo)
19. [Đóng góp](#dong-gop)
20. [License và ghi công](#license)
21. [Tài liệu tham khảo](#tai-lieu)

</details>

---

<a id="gioi-thieu"></a>

## 📌 Giới thiệu

Đây là source bot dùng **Zalo Bot API** để nhận tin nhắn qua Webhook, xử lý một số lệnh trong nhóm và gửi phản hồi. Dữ liệu cấu hình được lưu bằng Supabase. Source được viết bằng Node.js và Express.

### Đọc kỹ: đây là loại bot nào?

Project này dùng **Zalo Bot / Bot Token / Bot API** của Zalo Platform. Nó **không gọi Zalo OA OpenAPI** kiểu doanh nghiệp, không dùng OA access token và không gọi các endpoint `openapi.zalo.me/v3.0/oa/...`.

Theo hướng dẫn Zalo, luồng tạo Bot đi qua ứng dụng **Zalo Bot Creator** (được mở từ Bot Manager), sau khi tạo sẽ nhận `Bot Token` qua tin nhắn Zalo. Vì vậy, dù bạn dùng bot cho nhóm bạn bè/cá nhân, về mặt kỹ thuật nó vẫn là một Bot được tạo trên nền tảng Zalo Bot — **không phải script đăng nhập và tự điều khiển tài khoản Zalo cá nhân thông thường**.

> **Đừng nhầm tài liệu:** nếu bạn đang đọc hướng dẫn OA OpenAPI có `access_token`, `openapi.zalo.me` hoặc API dành cho Official Account thì đó không phải API mà source này đang gọi. Source hiện gọi `https://bot-api.zaloplatforms.com/bot<TOKEN>/...` bằng `ZALO_BOT_TOKEN`.

<a id="trang-thai-du-an"></a>

## 🚦 Trạng thái dự án

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Server Express | Có trong source | Mặc định nghe cổng `7860` |
| Nhận webhook | Có trong source | Route `POST /webhook` |
| Gửi tin nhắn văn bản | Có trong source | Gọi API `sendMessage` |
| Lệnh quản lý link / nội dung | Có trong source | Lưu ở bảng `bot_triggers` |
| Filter tự động trả lời | Có trong source | Dò chuỗi con bằng `includes()` |
| Phân quyền Admin | Có trong source | So khớp ID với `ADMIN_ID` |
| Lịch nhắc  | Có trong source | Lịch cố định, gửi đến `GROUP_ID` |
| Endpoint `/ping` | Có trong source | Chỉ kiểm tra truy vấn Supabase |
| Chào thành viên mới | Chưa xác minh / không cam kết | Có nhánh code nhưng event không nằm trong danh sách webhook công khai đang được tài liệu mô tả |
| Tạm biệt thành viên rời nhóm | Chưa xác minh / không cam kết | Tương tự phần chào thành viên |
| Hiển thị trạng thái đang nhập (`sendChatAction`) | Chưa tích hợp | API có tài liệu, nhưng source hiện tại không gọi API này |
| Xác thực secret của Webhook | Chưa có | Source chưa kiểm tra header `X-Bot-Api-Secret-Token` |
| Test tự động | Chưa có | ZIP không có test suite |

**Lưu ý:** “Có trong source” chỉ có nghĩa là code có viết chức năng đó. Nó không đồng nghĩa tính năng đã được kiểm thử trên mọi tài khoản, mọi nhóm hoặc mọi phiên bản Zalo.

---

<a id="vi-sao-source-lo"></a>

## 🗑️ Vì sao gọi source này là source lỏ?

Nói trước cho đỡ mất công kỳ vọng:

- **AI có tham gia viết code.** Source được tạo và chỉnh qua nhiều lần yêu cầu AI, sau đó ghép thêm chức năng. Không nên hiểu đây là một sản phẩm được thiết kế, review và kiểm thử bài bản.
- **Phần lớn logic bị nhét vào một file `index.js`.** Web server, webhook, kiểm tra quyền, lệnh, truy vấn Supabase và lịch nhắc đều nằm chung trong một file hơn hai chục KB. Không có cấu trúc module rõ ràng.
- **Có code thừa và tính năng ma.** Một số nhánh được viết theo ý tưởng nhưng chưa có cơ sở chắc chắn rằng nền tảng gửi event tương ứng.
- **Có chỗ đặt tên gây hiểu nhầm.** Ví dụ `/addlink` nghe như quản lý URL, nhưng code chỉ lưu một cặp `keyword` và `response`; nó không xác thực nội dung có phải URL hay không.
- **Có chỗ xử lý khá ngây thơ.** Filter dùng `includes()` nên dễ khớp nhầm, phân biệt chữ hoa/chữ thường, và kết quả phụ thuộc thứ tự bản ghi Supabase trả về.
- **Chưa có test suite, chưa có `.env.example`, chưa có quy trình release tử tế.** Người tải source phải tự cấu hình và tự kiểm tra.
- **Mình lười dọn.** Những đoạn chưa dùng hoặc chưa xác minh vẫn còn nằm trong source. Đó là lý do README này phải nói rõ đâu là chức năng thật, đâu chỉ là code còn sót.

### Một đính chính về Next.js

Gói ZIP được gửi để viết README này **không dùng Next.js**. Kiểm tra `package.json` cho thấy nó dùng `express`, `axios` và `@supabase/supabase-js`; entry point là `index.js`. Không có dependency hay cấu hình Next.js trong ZIP này.

Vấn đề kiến trúc thực tế của bản này là: **Node.js + Express nhưng dồn phần lớn logic vào một file**. Nếu repository GitHub của bạn đã thay bằng một source khác có Next.js thì cần kiểm tra lại repository đó; README này mô tả đúng ZIP `Bot_zalol-main (2).zip` đã được gửi trong cuộc trò chuyện.

---

<a id="cong-nghe-va-cau-truc-source"></a>

## 🧱 Công nghệ và cấu trúc source

### Công nghệ

| Thành phần | Vai trò |
|---|---|
| Node.js | Runtime chạy ứng dụng |
| Express 4 | HTTP server và route webhook |
| Axios | Gửi HTTP request đến Zalo Bot API |
| `@supabase/supabase-js` | Đọc / ghi dữ liệu Supabase |
| Supabase | Lưu cấu hình, filter, nội dung đã lưu và trạng thái lịch nhắc |
| Docker | Đóng gói ứng dụng để triển khai |

### Cấu trúc thư mục trong ZIP

```text
Bot_zalol-main/
├── index.js       # Hầu hết logic của bot nằm ở đây
├── package.json   # Dependencies và npm script
├── Dockerfile     # Cấu hình build Docker
├── .gitattributes
└── README.md      # README gốc rất ngắn
```

Trong ZIP này **không có**:

- `src/` hoặc thư mục module tách riêng.
- `.env.example`.
- Test tự động.
- Migration SQL của Supabase.
- File `LICENSE`.
- Cấu hình Next.js.

---

<a id="cac-chuc-nang-co-trong-code"></a>

## ✅ Các chức năng có trong code

### 1. Nhận tin nhắn nhóm

Webhook nhận event `message.text.received`, sau đó lấy nội dung, ID người gửi, ID chat và loại chat. Code chỉ tiếp tục xử lý khi `chat_type` là `GROUP`; tin nhắn `PRIVATE` bị bỏ qua.

### 2. Gửi phản hồi văn bản

Hàm `sendZaloMessage(chatId, text)` gọi endpoint `sendMessage` của Zalo Bot API. Nếu API lỗi, code ghi lỗi vào log và ném lỗi để webhook bắt.

### 3. Quản lý nội dung bằng lệnh

Nhóm lệnh `/addlink`, `/link` và `/removelink` đọc/ghi bảng `bot_triggers`. Tên `link` chỉ là tên gọi — trường `response` có thể là một đoạn văn bản bất kỳ, không bắt buộc phải là URL.

### 4. Filter tự động trả lời

Nhóm lệnh `/filter`, `/stop`, `/filters` dùng bảng `bot_config`. Từ khóa được lưu với tiền tố `filter_`. Khi nhận tin nhắn, code quét danh sách từ khóa và trả về phản hồi đầu tiên khớp.

### 5. Phân quyền Admin

Các lệnh thêm/xóa nội dung và filter chỉ chạy khi ID người gửi trùng `ADMIN_ID`. ID được so sánh dưới dạng chuỗi UTF-8 chuyển sang hex; thao tác này không làm tăng độ bảo mật, chỉ là cách so sánh hơi vòng vèo của source hiện tại.

### 6. Lịch nhắc đồng phục

Có một scheduler dùng múi giờ `Asia/Ho_Chi_Minh`, chạy kiểm tra mỗi 15 giây và gửi thông báo vào `GROUP_ID` theo lịch cố định. Chi tiết ở [Lịch nhắc đồng phục](#lich-dong-phuc).

### 7. Endpoint kiểm tra

| URL | Method | Tác dụng |
|---|---|---|
| `/` | GET | Trả về `Bot Zalo is Running!` |
| `/ping` | GET | Thử truy vấn bảng `bot_config` để kiểm tra Supabase |
| `/webhook` | POST | Nhận event từ Zalo |

`/ping` **không** phải công cụ giữ hosting luôn hoạt động. Nó chỉ gửi một truy vấn nhẹ đến Supabase và trả trạng thái tương ứng.

---

<a id="cac-lenh-bot"></a>

## ⌨️ Các lệnh bot

### Điều kiện quan trọng trước khi dùng lệnh

Trong code, bộ xử lý command chỉ được gọi khi chuỗi `message.text` sau khi `trim()` **bắt đầu bằng ký tự `@`**. Code không kiểm tra một object mention chính thức; nó chỉ dùng regex `^@\S+` trên nội dung text.

Vì vậy, các ví dụ dưới đây minh họa cấu trúc mà code đang mong đợi:

```text
@TenBot /help
@TenBot /link
@TenBot /addlink github https://github.com
```

`@TenBot` chỉ là chữ minh họa. Hãy tag đúng bot theo cách Zalo gửi mention trong payload thực tế. Tài liệu webhook mẫu của Zalo không đảm bảo rằng mọi kiểu mention đều được chuyển thành chuỗi text có dạng `@TênBot`. Nếu lệnh không chạy, hãy xem payload webhook thực tế trong log trước khi kết luận.

> **Gửi riêng `/help` không đủ điều kiện trong logic hiện tại.** Tin nhắn không bắt đầu bằng `@` sẽ không đi vào `handleCommand()`.

### Lệnh cho mọi người

| Lệnh sau khi tag bot | Chức năng | Ghi chú |
|---|---|---|
| `/help` | Hiện hướng dẫn sử dụng | Không cần quyền Admin |
| `/link` | Liệt kê các tên mục đã lưu | Đọc từ `bot_triggers` |
| `/link <tên>` | Hiện nội dung của mục | Chỉ lấy từ khóa đầu tiên sau `/link` |
| `/filters` | Liệt kê filter đang lưu | Đọc các key có tiền tố `filter_` trong `bot_config` |

### Lệnh chỉ dành cho Admin

| Lệnh sau khi tag bot | Ví dụ | Chức năng |
|---|---|---|
| `/addlink <tên> <nội dung>` | `/addlink github https://github.com` | Thêm hoặc cập nhật nội dung |
| `/removelink <tên>` | `/removelink github` | Xóa nội dung theo tên |
| `/filter <từ_khóa> <câu_trả_lời>` | `/filter hello Xin chào!` | Tạo hoặc cập nhật phản hồi tự động |
| `/stop <từ_khóa>` | `/stop hello` | Xóa filter theo từ khóa |

### Cách dùng cụ thể

**Thêm một nội dung:**

```text
@TenBot /addlink github https://github.com
```

Bot lưu `github` vào cột `keyword`, và `https://github.com` vào cột `response` trong `bot_triggers`.

**Xem nội dung vừa lưu:**

```text
@TenBot /link github
```

**Tạo filter:**

```text
@TenBot /filter xin_chao Chào bạn nha!
```

Khi tin nhắn nhóm có chứa chuỗi `xin_chao`, bot sẽ gửi `Chào bạn nha!`.

**Xóa filter:**

```text
@TenBot /stop xin_chao
```

### Các hạn chế của command và filter

- Tên mục và từ khóa chỉ lấy đối số đầu tiên; nên viết liền, không có dấu cách.
- Phần nội dung sau tên có thể chứa dấu cách vì code ghép các đối số còn lại lại với nhau.
- Filter dùng `String.includes()`, không phải so khớp từ hoàn chỉnh.
- Filter phân biệt chữ hoa/chữ thường: `Hello` và `hello` có thể được xem là hai chuỗi khác nhau.
- Nếu nhiều filter cùng khớp một tin nhắn, code trả lời filter đầu tiên trong kết quả truy vấn. Không có cơ chế ưu tiên theo độ dài hoặc mức độ cụ thể.
- Khi tin nhắn có `@...`, code kiểm tra command trước; nếu không nhận ra command thì mới thử filter trên phần text đã bỏ tiền tố `@...`.
- Khi tin nhắn không có `@...`, code vẫn thử filter trên toàn bộ nội dung, nhưng không chạy command.
- `/addlink` không kiểm tra URL, không kiểm tra trùng theo cách riêng; nó dùng `upsert` nên cùng keyword sẽ ghi đè nội dung cũ.

---

<a id="cach-bot-xu-ly-tin-nhan"></a>

## 🔄 Cách bot đang nhận và xử lý tin nhắn

Luồng trong `index.js` có thể tóm tắt như sau:

```text
Zalo Bot Platform
       │
       │ POST event JSON
       ▼
POST /webhook
       │
       ├── event_name = message.text.received ?
       │        │
       │        ├── chat_type = GROUP ?
       │        │       │
       │        │       ├── text bắt đầu bằng @ ?
       │        │       │       ├── Có lệnh hợp lệ → xử lý command
       │        │       │       └── Không phải command → thử filter
       │        │       │
       │        │       └── Không bắt đầu bằng @ → thử filter
       │        │
       │        └── PRIVATE → bỏ qua
       │
       └── event khác → log sự kiện không hỗ trợ
```

### Payload webhook quan trọng

Tài liệu Zalo mô tả event văn bản `message.text.received` với các trường như:

- `event_name`: tên loại sự kiện.
- `message.from.id`: ID người gửi.
- `message.from.display_name`: tên hiển thị người gửi.
- `message.chat.id`: ID cuộc trò chuyện.
- `message.chat.chat_type`: `PRIVATE` hoặc `GROUP`.
- `message.text`: nội dung tin nhắn.

Code lấy dữ liệu từ một số đường dẫn dự phòng như `body.text`, `body.chat`, `body.group_id`... để tương thích với payload khác, nhưng format chính nên đối chiếu với tài liệu webhook chính thức và log thực tế.

### Một điểm cần chú ý về chat nhóm

Tài liệu webhook hiện mô tả `GROUP` là loại chat **Beta**. Do đó, việc bot hoạt động trong chat riêng không chứng minh nó sẽ nhận và gửi tin nhắn nhóm ổn định. Cần kiểm tra khả năng join group của Bot Token và thử trực tiếp trong nhóm mục tiêu.

---

<a id="nhung-thu-khong-nen-hieu-nham"></a>

## 🧟 Những thứ không nên hiểu nhầm là tính năng

### 1. Chào thành viên mới và tạm biệt thành viên rời nhóm

Trong `index.js` có hai nhánh:

- Tên event chứa `join` hoặc bằng `user_join_group` thì tìm `welcome_message` trong `bot_config` và gửi lời chào.
- Tên event chứa `leave` hoặc bằng `user_leave_group` thì tìm `goodbye_message` trong `bot_config` và gửi lời tạm biệt.

Vấn đề: danh sách `event_name` được tài liệu Webhook Zalo Bot hiện công bố gồm các event tin nhắn như text, image, sticker, voice và unsupported message. Tài liệu đó **không liệt kê event thành viên tham gia/rời nhóm**.

Ngoài ra, source không có command để cấu hình `welcome_message` hoặc `goodbye_message`; chúng chỉ được đọc từ database nếu ai đó tự thêm thủ công.

**Kết luận:** coi hai đoạn này là code sót lại / tính năng ma. Không quảng cáo đây là chức năng chào mừng hoặc tạm biệt đã hoạt động. Mình để nguyên vì lười dọn, không phải vì đã xác nhận nó chạy.

### 2. `sendChatAction` / trạng thái đang nhập

Zalo có tài liệu API `sendChatAction` với hành động `typing`. Tuy nhiên, trong source này không có hàm gọi endpoint đó. Có tài liệu API không có nghĩa bot đã tích hợp API.

### 3. `/ping` không giữ máy chủ sống mãi

Endpoint `/ping` chỉ truy vấn Supabase. Việc gọi endpoint này không thể đảm bảo nền tảng hosting không sleep, không restart hoặc không thu hồi máy ảo.

### 4. `/link` không phải trình quản lý URL hoàn chỉnh

Code lưu keyword và nội dung tùy ý. Không có kiểm tra URL, không có xác minh an toàn link, không có mô tả, tag, phân quyền theo từng người dùng hay tìm kiếm nâng cao.

---

<a id="chuan-bi"></a>

## 🛠️ Chuẩn bị trước khi chạy

Bạn cần:

- Node.js **20.6 trở lên** nếu muốn chạy local bằng `node --env-file=.env index.js`.
- npm.
- Bot Token lấy từ luồng tạo **Zalo Bot**, không phải OA access token.
- Một project Supabase.
- Hosting hoặc máy chủ có thể chạy Node.js và cung cấp URL HTTPS công khai để Zalo gửi Webhook.
- Một nhóm Zalo mà Bot có thể tham gia, nếu bạn cần dùng các lệnh nhóm.

**Không có Bot Token thì source không thể gọi Zalo Bot API. Không có Supabase URL/key thì source dừng ngay khi khởi động. Không có `ADMIN_ID` thì source cũng dừng.**

### Tạo Zalo Bot đúng loại

Tham khảo hướng dẫn chính thức [Tạo Bot](https://docs.zaloplatforms.com/docs/BOT/create_bot). Tóm tắt theo tài liệu:

1. Mở Zalo và tìm ứng dụng Zalo Bot Manager.
2. Chọn tạo Bot để mở Zalo Bot Creator.
3. Điền thông tin và tạo Bot.
4. Lấy Bot Token do hệ thống gửi cho tài khoản Zalo của bạn.
5. Dùng token này làm `ZALO_BOT_TOKEN`.

Không lấy token OA OpenAPI để điền vào biến `ZALO_BOT_TOKEN`.

---

<a id="supabase"></a>

## 🗄️ Tạo database Supabase

Source cần hai bảng: `bot_config` và `bot_triggers`.

### Bước 1 — tạo project

1. Mở [Supabase](https://supabase.com/).
2. Tạo một project mới.
3. Mở **SQL Editor**.
4. Chạy SQL bên dưới.

### Bước 2 — tạo bảng

```sql
create table if not exists public.bot_config (
  key text primary key,
  value text
);

create table if not exists public.bot_triggers (
  keyword text primary key,
  response text
);
```

### Bước 3 — hiểu dữ liệu được lưu ở đâu

| Bảng | Cột | Dùng để |
|---|---|---|
| `bot_config` | `key`, `value` | Lưu filter với key `filter_<từ_khóa>`; lưu ngày đã gửi từng lịch nhắc; có thể lưu `welcome_message` / `goodbye_message` nếu tự thêm |
| `bot_triggers` | `keyword`, `response` | Lưu tên mục và nội dung cho `/addlink`, `/link`, `/removelink` |

Ví dụ dữ liệu filter:

| key | value |
|---|---|
| `filter_hello` | `Xin chào bạn!` |

Ví dụ dữ liệu mục:

| keyword | response |
|---|---|
| `github` | `https://github.com` |
| `rules` | `Vui lòng đọc nội quy nhóm.` |

### Bước 4 — quyền truy cập

`SUPABASE_KEY` phải có quyền đọc/ghi hai bảng. Nếu bạn bật Row Level Security (RLS), hãy cấu hình policy phù hợp với cách key của backend được sử dụng. Source gọi Supabase từ server Node.js, không phải frontend.

Không đưa service-role key lên website frontend, ứng dụng client hoặc repository public. Không chia sẻ key thật trong ảnh chụp màn hình/log.

---

<a id="bien-moi-truong"></a>

## 🔐 Cấu hình biến môi trường

Tạo file `.env` trong thư mục gốc, cùng cấp với `index.js`:

```env
# Zalo Bot Token lấy từ Bot Creator
ZALO_BOT_TOKEN=YOUR_ZALO_BOT_TOKEN

# Thông tin Supabase
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_KEY=YOUR_SUPABASE_KEY

# ID nhóm nhận lịch nhắc đồng phục (không bắt buộc để khởi động)
GROUP_ID=YOUR_GROUP_ID

# ID Zalo của người được cấp quyền Admin (bắt buộc)
ADMIN_ID=YOUR_ZALO_USER_ID

# Cổng HTTP; hosting có thể tự cung cấp giá trị PORT
PORT=7860
```

### Bảng giải thích biến

| Biến | Bắt buộc để khởi động? | Mô tả |
|---|---:|---|
| `ZALO_BOT_TOKEN` | Có | Token của Zalo Bot dùng để gọi Bot API |
| `SUPABASE_URL` | Có | URL project Supabase |
| `SUPABASE_KEY` | Có | Key backend có quyền truy cập các bảng cần thiết |
| `ADMIN_ID` | Có | ID người dùng được xem là Admin; thiếu biến này bot thoát khi khởi động |
| `GROUP_ID` | Không | ID nhóm dùng làm đích gửi dự phòng và gửi nhắc đồng phục |
| `PORT` | Không | Cổng Express; mặc định `7860` |

### Biến có trong code nhưng không có tác dụng hiện tại

| Biến | Giá trị mặc định | Ghi chú |
|---|---|---|
| `ADMIN_NAME` | `Admin` | Được lấy từ `process.env` nhưng hiện không được sử dụng |
| `VICE_NAME` | `Phó nhóm` | Được lấy từ `process.env` nhưng hiện không được sử dụng |

### Biến bảo mật Webhook chưa được source hỗ trợ

Source hiện tại **không đọc `WEBHOOK_SECRET`** và không xác minh header `X-Bot-Api-Secret-Token`. Đừng chỉ thêm biến này vào hosting rồi tưởng webhook đã được bảo vệ. Bạn phải sửa code để so sánh header trước khi xử lý request.

### Không commit `.env`

Thêm `.gitignore` ở thư mục gốc:

```gitignore
node_modules/
.env
.env.*
!.env.example
npm-debug.log*
```

Nếu token hoặc key từng bị commit lên GitHub, hãy thu hồi/đổi token đó. Xóa file ở commit mới không xóa bí mật khỏi lịch sử Git.

---

<a id="cai-dat-local"></a>

## 🚀 Cài đặt và chạy local

### 1. Clone source

```bash
git clone <URL_REPOSITORY>
cd <TEN_THU_MUC>
```

### 2. Cài package

```bash
npm install
```

### 3. Tạo `.env`

Điền các biến theo bảng ở phần [Cấu hình biến môi trường](#bien-moi-truong).

### 4. Chạy bot

Với Node.js 20.6 trở lên:

```bash
node --env-file=.env index.js
```

Nếu bạn khai báo biến trong giao diện Environment của hosting thay vì file `.env`, có thể chạy:

```bash
npm start
```

**Chú ý:** script `start` trong `package.json` là `node index.js`; nó không tự nạp file `.env`. Vì thế, nếu chạy `npm start` ở máy cá nhân mà chưa export biến môi trường, ứng dụng sẽ báo thiếu biến.

### 5. Kiểm tra server

Mở:

```text
http://localhost:7860/
```

Nếu server chạy, kết quả sẽ là:

```text
Bot Zalo is Running!
```

Kiểm tra Supabase:

```text
http://localhost:7860/ping
```

Nếu trả JSON `status: "ok"`, truy vấn kiểm tra Supabase đã chạy thành công. Đây không phải bài kiểm tra việc Zalo đã gửi được webhook.

---

<a id="cau-hinh-webhook"></a>

## 🌐 Cấu hình Zalo Bot Webhook

Webhook là địa chỉ để Zalo Bot gửi HTTP POST tới server của bạn khi có sự kiện. Source này khai báo route `POST /webhook`.

### 1. Triển khai server và lấy HTTPS URL

Ví dụ URL webhook:

```text
https://your-domain.example/webhook
```

URL phải truy cập công khai từ Internet và dùng HTTPS. `localhost`, IP nội bộ hoặc địa chỉ chỉ máy của bạn truy cập được sẽ không dùng làm webhook production.

> Mở `https://your-domain.example/webhook` bằng trình duyệt có thể thấy `Cannot GET /webhook`. Điều đó không đủ để kết luận webhook hỏng, vì source chỉ khai báo route **POST**, không khai báo GET cho đường dẫn này.

### 2. Đăng ký webhook bằng Zalo Bot API

Theo tài liệu `setWebhook`, request cần `url` và `secret_token`:

```bash
curl -X POST "https://bot-api.zaloplatforms.com/botYOUR_ZALO_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.example/webhook",
    "secret_token": "REPLACE_WITH_RANDOM_SECRET_8_TO_256_CHARS"
  }'
```

Thay token, domain và secret bằng giá trị của bạn. Secret token theo tài liệu phải dài từ 8 đến 256 ký tự.

**Cảnh báo rất quan trọng:** Zalo sẽ gửi secret trong header `X-Bot-Api-Secret-Token`, nhưng source hiện tại không xác minh header này. Đăng ký secret ở Zalo không tự động bảo vệ route của bạn. Cần bổ sung kiểm tra phía Express trước khi dùng công khai.

Ví dụ phần kiểm tra cần được thêm vào code (đây là hướng sửa, không phải code hiện có):

```js
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

app.post('/webhook', async (req, res) => {
  const receivedSecret = req.get('X-Bot-Api-Secret-Token');

  if (!WEBHOOK_SECRET || receivedSecret !== WEBHOOK_SECRET) {
    return res.status(403).json({ message: 'Unauthorized' });
  }

  // Chỉ xử lý body sau khi xác thực thành công.
});
```

Bạn cần tích hợp đoạn kiểm tra vào route hiện tại, không tạo thêm một route trùng `/webhook`. Đồng thời khai báo `WEBHOOK_SECRET` trong Environment của hosting. Không copy nguyên đoạn ví dụ này đè lên route hiện tại vì phần thân xử lý webhook sẽ bị mất.

### 3. Kiểm tra webhook

Sau khi gọi `setWebhook`:

1. Xem response có `ok: true` hay không.
2. Đọc phần `verification` nếu response có trả về — đây là kết quả request kiểm tra Zalo tự gửi sau khi lưu webhook.
3. Dùng API `getWebhookInfo` để xem URL hiện tại.
4. Dùng API `testWebhook` khi cần kiểm tra kết nối.
5. Xem log hosting để xác nhận server đã nhận `POST /webhook`.
6. Đối chiếu `event_name`, `message.chat.chat_type`, `message.chat.id` và `message.text` trong payload thực tế.

Lưu ý: tài liệu `setWebhook` ghi rõ URL vẫn được lưu ngay cả khi `verification` thất bại. Vì vậy, việc API báo đã cập nhật webhook **không đồng nghĩa server nhận event thành công**.

### 4. Kiểm tra Bot Token và khả năng tham gia nhóm

Gọi `getMe`:

```bash
curl -X POST "https://bot-api.zaloplatforms.com/botYOUR_ZALO_BOT_TOKEN/getMe"
```

Xem `result.can_join_groups`. Đây là trường cho biết Bot có thể tham gia nhóm hay không theo phản hồi API. Nếu không thể tham gia nhóm thì bot không thể xử lý luồng nhóm như bạn mong đợi.

### 5. Chọn đúng cơ chế nhận update

Zalo Bot có cơ chế Webhook và `getUpdates` (long polling) để nhận update. Đừng cấu hình hai cơ chế song song rồi cho rằng cả hai sẽ đồng thời nhận cùng một luồng sự kiện; hãy làm theo hướng dẫn chính thức của API bạn đang sử dụng.

---

<a id="docker"></a>

## 🐳 Chạy bằng Docker

Source có sẵn Dockerfile dùng `node:lts-alpine`, cài package bằng `npm install`, expose cổng `7860` và khởi chạy `node index.js`.

### Build image

```bash
docker build -t zalo-group-bot .
```

### Chạy container

```bash
docker run -d \
  --name zalo-group-bot \
  --restart unless-stopped \
  --env-file .env \
  -p 7860:7860 \
  zalo-group-bot
```

Nếu server dùng cổng khác, hãy bảo đảm `PORT` bên trong container và cổng map của Docker tương thích. Không copy `.env` vào image và không đưa secret vào Dockerfile.

Xem log:

```bash
docker logs -f zalo-group-bot
```

Dừng container:

```bash
docker stop zalo-group-bot
```

---

<a id="lich-dong-phuc"></a>

## 👕 Lịch nhắc đồng phục

Đây là tính năng viết cứng trong `index.js`, theo múi giờ `Asia/Ho_Chi_Minh` (UTC+7). Không có lệnh để bật/tắt hoặc cấu hình lịch từ chat.

| Ngày | Giờ | Nội dung trong source |
|---|---|---|
| Chủ nhật | 21:00 | Nhắc ngày mai (thứ Hai) mặc áo trắng |
| Thứ Hai | 06:00 | Nhắc mặc áo trắng |
| Thứ Hai | 06:30 | Nhắc lại mặc áo trắng |
| Thứ Tư | 21:00 | Nhắc ngày mai (thứ Năm) mặc áo xanh cam |
| Thứ Năm | 06:00 | Nhắc mặc áo xanh cam |
| Thứ Năm | 06:30 | Nhắc lại mặc áo xanh cam |

### Lịch hoạt động thế nào?

- `setInterval()` gọi `checkUniformSchedule()` mỗi 15 giây.
- Khi giờ hiện tại khớp một mốc lịch, hàm `sendUniformReminder()` gửi tin nhắn tới `GROUP_ID`.
- Sau khi gửi, code lưu ngày gửi vào `bot_config` với key dạng `uniform_reminder_<slot>_last_sent` để hạn chế gửi trùng trong cùng ngày.
- Nếu thiếu `GROUP_ID`, scheduler chỉ ghi cảnh báo và không gửi.
- Nếu bot tắt đúng thời điểm nhắc, code không có cơ chế gửi bù sau đó.
- Nếu gửi tin thành công nhưng việc lưu trạng thái vào Supabase thất bại, có khả năng lần kiểm tra kế tiếp gửi lại vì code không kiểm tra kết quả `setConfig()`.

**Đừng bỏ qua phần này khi đem source sang nhóm khác.** Nếu nhóm của bạn không cần nhắc đồng phục, hãy xóa hoặc sửa lịch và nội dung trong `checkUniformSchedule()` trước khi chạy. Không ai muốn vừa thêm bot vào nhóm bạn bè xong thì nó tự nhắc áo trắng lúc 6 giờ sáng.

---

<a id="loi-thuong-gap"></a>

## 🧯 Lỗi thường gặp

| Hiện tượng | Nguyên nhân có thể | Cần kiểm tra |
|---|---|---|
| Bot không khởi động | Thiếu biến môi trường | `ZALO_BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_KEY`, `ADMIN_ID` |
| `GET /webhook` báo `Cannot GET` | Route chỉ nhận POST | Kiểm tra bằng `setWebhook`, `testWebhook` và log request POST |
| Zalo báo đã set webhook nhưng bot không nhận tin | URL verification thất bại, URL sai, server không online, route lỗi | Đọc trường `verification`, gọi `getWebhookInfo` / `testWebhook`, xem log hosting |
| Bot nhận tin riêng nhưng không phản hồi | Source bỏ qua `PRIVATE` | Kiểm tra `message.chat.chat_type`; code chỉ xử lý `GROUP` |
| Bot không thấy tin nhóm | Group của Zalo Bot được tài liệu đánh dấu Beta hoặc Bot không có quyền join | Kiểm tra `getMe` và `can_join_groups`; thử trong nhóm thật |
| Gửi `/help` nhưng bot im lặng | Command chỉ chạy khi text bắt đầu bằng `@...` | Xem raw webhook body; xác nhận mention được đưa vào text như code mong đợi |
| Lệnh Admin bị từ chối | `ADMIN_ID` không trùng `message.from.id` thực tế | In/đối chiếu ID từ payload; không thêm khoảng trắng |
| `/filter` lưu nhưng không trả lời | Sai keyword, chữ hoa/thường khác nhau, filter không có trong bảng hoặc tin nhắn không chứa chuỗi | Kiểm tra `bot_config` và chuỗi khớp |
| `/addlink` báo lỗi | Supabase không truy cập được hoặc bảng sai cấu trúc | Kiểm tra `bot_triggers`, key và quyền truy cập |
| `/ping` trả lỗi | Supabase URL/key, bảng hoặc quyền truy cập sai | Kiểm tra `bot_config` và log Supabase |
| Không có tin nhắc đồng phục | Thiếu `GROUP_ID`, bot không gửi được, app không chạy vào đúng thời điểm | Kiểm tra `GROUP_ID`, log và key lịch trong `bot_config` |

### Mẹo debug có ích nhất

Trong webhook hiện có log toàn bộ payload:

```js
console.log('📦 [FULL WEBHOOK BODY]', JSON.stringify(body, null, 2));
```

Nó giúp kiểm tra cấu trúc thật của event, nhưng cũng có thể lưu nội dung tin nhắn và ID người dùng vào log hosting. Khi debug xong, nên bỏ hoặc che dữ liệu nhạy cảm.

---

<a id="bao-mat"></a>

## 🔒 Bảo mật — đọc trước khi public repository

Repository public có nghĩa người khác có thể đọc source. Điều đó không có nghĩa họ được phép sử dụng token hoặc thông tin bí mật của bạn.

- **Không commit `.env`.** Thêm vào `.gitignore`.
- **Không để Bot Token trong source code.** Chỉ dùng Environment/Secrets của hosting.
- **Không công khai Supabase key có quyền cao.** Chỉ backend được giữ key cần thiết.
- **Xác thực `X-Bot-Api-Secret-Token`.** Source hiện tại chưa làm việc này, đây là việc cần sửa trước khi public endpoint.
- **Hạn chế log toàn bộ webhook.** Payload có thể chứa tin nhắn và ID cá nhân.
- **Đừng paste log chứa token/key lên Issue công khai.** Che các giá trị nhạy cảm trước khi hỏi trợ giúp.
- **Nếu lỡ push secret lên GitHub, hãy rotate/thu hồi secret.** Xóa khỏi file mới không xóa khỏi Git history.
- **Không chạy source lạ với token thật ngay lập tức.** Đọc code và hiểu quyền truy cập trước.
- **Không dùng source này cho dữ liệu quan trọng khi chưa review.** Webhook hiện phản hồi HTTP 200 kể cả trong nhánh catch lỗi; hệ thống gửi event có thể hiểu request đã được nhận dù logic xử lý thất bại.

### Checklist trước khi đổi repository sang Public

- [ ] Đã rà soát toàn bộ file, commit và lịch sử Git để tìm `.env`, token, key.
- [ ] Đã thêm `.gitignore`.
- [ ] Đã thu hồi token/key từng bị lộ (nếu có).
- [ ] Đã sửa xác thực webhook secret.
- [ ] Đã cân nhắc bỏ log full payload.
- [ ] Đã ghi rõ tính năng nào đang thử nghiệm và tính năng nào không hoạt động.
- [ ] Đã thêm `LICENSE` nếu thực sự muốn cấp quyền sử dụng lại source.

---

<a id="todo"></a>

## 🧰 Hướng phát triển / việc còn nợ

Đây là danh sách việc nên làm nếu muốn biến source lỏ thành một project đàng hoàng hơn:

- [ ] Tách `index.js` thành các module: config, webhook, commands, Supabase, scheduler và Zalo API.
- [ ] Thêm xác thực `X-Bot-Api-Secret-Token`.
- [ ] Xác minh chính xác cách Zalo gửi mention trong webhook; không dựa duy nhất vào regex `@`.
- [ ] Kiểm tra và chuẩn hóa quyền truy cập nhóm, xử lý riêng `PRIVATE` / `GROUP`.
- [ ] Bỏ event `join` / `leave` nếu không có nguồn event được hỗ trợ và kiểm thử thực tế.
- [ ] Thêm xử lý lỗi, logging có che dữ liệu và cơ chế retry phù hợp.
- [ ] Sửa webhook không trả HTTP 200 giả khi xử lý thất bại (cần cân nhắc cơ chế retry của nền tảng).
- [ ] Thêm test cho parser, phân quyền Admin và filter.
- [ ] Thêm `.env.example` chỉ chứa placeholder.
- [ ] Bỏ lịch nhắc đồng phục khỏi code cứng, chuyển sang cấu hình.
- [ ] Thêm hướng dẫn backup / restore Supabase.
- [ ] Thêm `LICENSE` và hướng dẫn đóng góp.

Không có cam kết rằng các mục trong checklist sẽ được triển khai. Đây là roadmap gợi ý, không phải lời hứa cập nhật.

---

<a id="dong-gop"></a>

## 🤝 Đóng góp

Bạn bè hoặc người tải source có thể fork repository, tự sửa và gửi Pull Request nếu muốn chia sẻ cải tiến.

Khi báo lỗi, nên gửi:

1. Phiên bản Node.js đang dùng.
2. Log lỗi đã che token và thông tin riêng tư.
3. Payload webhook đã ẩn ID và nội dung nhạy cảm.
4. Các bước tái hiện lỗi.
5. Mô tả hành vi mong đợi và hành vi thực tế.

Đừng gửi Bot Token, Supabase key, webhook secret hoặc dữ liệu riêng tư vào Issue/PR công khai.

---

<a id="license"></a>

## 📄 License và ghi công

Trong ZIP source được cung cấp **chưa có file `LICENSE`**. Public repository không tự động cấp quyền cho người khác sao chép, sửa đổi, phân phối hoặc sử dụng source theo ý muốn. Nếu muốn bạn bè tải và dùng lại hợp pháp theo một bộ điều khoản rõ ràng, hãy chọn và thêm license phù hợp.

Source được phát triển với sự hỗ trợ của AI; người đăng repository chịu trách nhiệm kiểm tra code, cấu hình, token và cách triển khai của bản mình công bố.

---

<a id="tai-lieu"></a>

## 📚 Tài liệu tham khảo

### Zalo Bot — tài liệu đúng loại API của project

- [Zalo Bot — Tổng quan](https://docs.zaloplatforms.com/zalo-bot)
- [Tạo Bot / lấy Bot Token](https://docs.zaloplatforms.com/docs/BOT/create_bot)
- [Webhook — event và payload](https://docs.zaloplatforms.com/docs/BOT/webhook)
- [setWebhook](https://docs.zaloplatforms.com/docs/BOT/apis/setWebhook)
- [getWebhookInfo](https://docs.zaloplatforms.com/docs/BOT/apis/getWebhookInfo)
- [testWebhook](https://docs.zaloplatforms.com/docs/BOT/apis/testWebhook)
- [getMe](https://docs.zaloplatforms.com/docs/BOT/apis/getMe)
- [getUpdates](https://docs.zaloplatforms.com/docs/BOT/apis/getUpdates)
- [sendMessage](https://docs.zaloplatforms.com/docs/BOT/apis/sendMessage)
- [sendChatAction](https://docs.zaloplatforms.com/docs/BOT/apis/sendChatAction) — tài liệu API có, nhưng chưa được tích hợp trong source này.

### GitHub / README

- [GitHub Docs — About repository README files](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes)
- [Best-README-Template](https://github.com/othneildrew/Best-README-Template) — tham khảo cách tổ chức tiêu đề, badges, mục lục, cài đặt, cách dùng và license.

---

<div align="center">

### 💀 Một con bot nhỏ, một đống code, và một người lười dọn.

**Dùng để học, nghịch và tự sửa thì được. Đừng coi README là giấy bảo hành phần mềm.**

</div>


README.md cũng là AI viết
