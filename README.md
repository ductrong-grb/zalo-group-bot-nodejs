# Zalo Group Bot

Bot quản lý và hỗ trợ nhóm Zalo, được viết bằng **Node.js**, sử dụng **Express** để nhận webhook từ Zalo và **Supabase** để lưu cấu hình, liên kết cùng các từ khóa tự động phản hồi.

> **Lưu ý:** Đây là source bot dùng webhook và Bot API tương thích với cấu trúc code hiện tại. Bot được thiết kế để xử lý tin nhắn trong nhóm; tin nhắn riêng không được xử lý. Bạn cần tự chuẩn bị token, dự án Supabase và nơi chạy ứng dụng.

## Mục lục

- [Tính năng](#tính-năng)
- [Danh sách lệnh](#danh-sách-lệnh)
- [Cách bot hoạt động](#cách-bot-hoạt-động)
- [Yêu cầu](#yêu-cầu)
- [Cài đặt Supabase](#cài-đặt-supabase)
- [Cấu hình biến môi trường](#cấu-hình-biến-môi-trường)
- [Chạy bot trên máy tính](#chạy-bot-trên-máy-tính)
- [Cấu hình webhook Zalo](#cấu-hình-webhook-zalo)
- [Chạy bằng Docker](#chạy-bằng-docker)
- [Tùy chỉnh lời chào và lời tạm biệt](#tùy-chỉnh-lời-chào-và-lời-tạm-biệt)
- [Lịch nhắc đồng phục có sẵn](#lịch-nhắc-đồng-phục-có-sẵn)
- [Bảo mật khi public source](#bảo-mật-khi-public-source)
- [Xử lý lỗi thường gặp](#xử-lý-lỗi-thường-gặp)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Giấy phép](#giấy-phép)

---

## Tính năng

- Nhận sự kiện từ Zalo thông qua webhook `POST /webhook`.
- Trả lời các lệnh quản lý link và từ khóa tự động.
- Chỉ định một tài khoản quản trị bằng `ADMIN_ID`.
- Tự động phản hồi khi nội dung tin nhắn nhóm chứa từ khóa đã cấu hình.
- Gửi lời chào khi có thành viên mới tham gia nhóm.
- Gửi lời tạm biệt khi thành viên rời nhóm.
- Lưu dữ liệu cấu hình và nội dung phản hồi trong Supabase, không phụ thuộc vào bộ nhớ tạm của tiến trình.
- Có endpoint `/` để kiểm tra ứng dụng và `/ping` để kiểm tra kết nối Supabase.
- Có lịch nhắc đồng phục theo giờ Việt Nam (UTC+7). **Đây là lịch được viết cố định trong source, xem phần lưu ý bên dưới trước khi triển khai.**

## Danh sách lệnh

Các lệnh được xử lý trong tin nhắn nhóm **khi người gửi tag/nhắc đến bot**. Ví dụ: tag bot rồi gửi `/help`.

### Lệnh dành cho thành viên

| Lệnh | Chức năng |
|---|---|
| `/help` | Hiển thị hướng dẫn sử dụng bot. |
| `/link` | Hiển thị danh sách tên các link/nội dung đã lưu. |
| `/link <tên>` | Hiển thị nội dung đã lưu theo tên. |
| `/filters` | Hiển thị danh sách từ khóa tự động phản hồi. |

### Lệnh dành cho Admin

| Lệnh | Chức năng | Ví dụ |
|---|---|---|
| `/addlink <tên> <nội dung>` | Thêm hoặc cập nhật một nội dung/link. | `/addlink facebook https://facebook.com` |
| `/removelink <tên>` | Xóa nội dung/link theo tên. | `/removelink facebook` |
| `/filter <từ_khóa> <câu_trả_lời>` | Thêm hoặc cập nhật câu trả lời tự động. | `/filter xin_chào Chào bạn nhé!` |
| `/stop <từ_khóa>` | Xóa một từ khóa tự động phản hồi. | `/stop xin_chào` |

**Quy tắc sử dụng:**

- `ADMIN_ID` là ID tài khoản duy nhất được cấp quyền dùng các lệnh quản trị trong phiên bản hiện tại.
- Tên link và từ khóa nên viết liền, không có dấu cách. Phần nội dung/câu trả lời phía sau có thể có dấu cách.
- Bộ lọc hiện tìm chuỗi con bằng `includes()`, có phân biệt chữ hoa và chữ thường. Ví dụ từ khóa `hello` không tự khớp với `Hello`.
- Khi một tin nhắn khớp nhiều bộ lọc, bot chỉ gửi phản hồi của bộ lọc đầu tiên mà Supabase trả về.
- Lệnh và xử lý tin nhắn riêng không được hỗ trợ trong phiên bản source này.

## Cách bot hoạt động

1. Zalo gửi sự kiện đến địa chỉ webhook công khai của ứng dụng.
2. Ứng dụng nhận sự kiện tại `POST /webhook`.
3. Với tin nhắn văn bản trong nhóm, bot kiểm tra nội dung và xử lý lệnh nếu tin nhắn có tag bot; nếu không phải lệnh thì kiểm tra từ khóa tự động.
4. Dữ liệu link được lưu trong bảng `bot_triggers`; cấu hình và bộ lọc được lưu trong bảng `bot_config` của Supabase.
5. Khi cần gửi phản hồi, bot gọi API `sendMessage` của Zalo.

Bot bỏ qua tin nhắn riêng. Việc bot có nhận được sự kiện hay không còn phụ thuộc vào cấu hình webhook, quyền và loại sự kiện được bật ở phía Zalo.

## Yêu cầu

- Node.js phiên bản LTS (khuyến nghị Node.js 20 hoặc 22).
- npm.
- Một bot Zalo có token sử dụng được với Bot API mà source đang gọi.
- Một project Supabase.
- Một máy chủ hoặc nền tảng hosting có thể chạy ứng dụng Node.js liên tục và cung cấp URL HTTPS công khai để Zalo gọi webhook.

## Cài đặt Supabase

Tạo project tại [Supabase](https://supabase.com/), mở **SQL Editor**, sau đó chạy đoạn SQL sau để tạo hai bảng mà source đang sử dụng:

```sql
-- Lưu cấu hình chung và các bộ lọc tự động.
create table if not exists public.bot_config (
  key text primary key,
  value text
);

-- Lưu tên link và nội dung tương ứng.
create table if not exists public.bot_triggers (
  keyword text primary key,
  response text
);
```

### Hai bảng được sử dụng như thế nào?

| Bảng | Cột | Mục đích |
|---|---|---|
| `bot_config` | `key`, `value` | Lưu bộ lọc với key dạng `filter_<từ_khóa>`, nội dung lời chào/tạm biệt và trạng thái lịch nhắc. |
| `bot_triggers` | `keyword`, `response` | Lưu tên và nội dung của các mục được quản lý bằng `/addlink`, `/link` và `/removelink`. |

**Quyền truy cập:** Giá trị `SUPABASE_KEY` phải có quyền đọc/ghi hai bảng này. Nếu dùng khóa có quyền cao ở phía server (ví dụ secret/service role key), chỉ đặt khóa đó trong biến môi trường của máy chủ; tuyệt đối không đưa vào mã frontend hoặc repository. Nếu dùng khóa public/anon trong khi bật Row Level Security (RLS), bạn phải tự cấu hình policy phù hợp để các truy vấn của bot được phép thực hiện.

## Cấu hình biến môi trường

Tạo file `.env` ở thư mục gốc (cùng cấp với `index.js` và `package.json`) khi chạy local.

```env
# Token của Zalo Bot
ZALO_BOT_TOKEN=YOUR_ZALO_BOT_TOKEN

# Thông tin project Supabase
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_KEY=YOUR_SUPABASE_SERVER_KEY

# ID nhóm mặc định; cần thiết cho lịch nhắc đồng phục
GROUP_ID=YOUR_ZALO_GROUP_ID

# ID tài khoản quản trị được phép dùng lệnh admin
ADMIN_ID=YOUR_ZALO_USER_ID

# Cổng chạy ứng dụng (mặc định 7860 nếu không khai báo)
PORT=7860
```

### Giải thích biến môi trường

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `ZALO_BOT_TOKEN` | Có | Token dùng để gọi Zalo Bot API gửi tin nhắn. |
| `SUPABASE_URL` | Có | URL project Supabase. |
| `SUPABASE_KEY` | Có | Khóa Supabase có quyền truy cập cần thiết vào hai bảng. |
| `ADMIN_ID` | Có | ID Zalo của tài khoản quản trị. Source sẽ dừng khởi động nếu thiếu biến này. |
| `GROUP_ID` | Không bắt buộc để khởi động | ID nhóm mặc định; được dùng làm nhóm nhận lịch nhắc và làm giá trị dự phòng khi webhook không cung cấp group ID. |
| `PORT` | Không | Cổng HTTP. Mặc định là `7860`. Hosting có thể tự cấp biến này. |

`ADMIN_NAME` và `VICE_NAME` hiện được khai báo trong source nhưng chưa được dùng trong logic xử lý, vì vậy không cần cấu hình chúng.

> Không thay các giá trị `YOUR_...` bằng thông tin thật trong README. Hãy nhập giá trị thật vào phần Environment/Secrets của hosting hoặc file `.env` local.

## Chạy bot trên máy tính

Tải source về máy hoặc clone repository:

```bash
git clone <URL_REPOSITORY>
cd <TEN_THU_MUC>
```

Cài các thư viện:

```bash
npm install
```

Tạo file `.env` theo mẫu ở trên, điền đầy đủ token và thông tin Supabase, sau đó chạy:

```bash
npm start
```

Nếu chạy thành công, log sẽ hiển thị cổng mà ứng dụng đang lắng nghe. Mở trình duyệt tại:

```text
http://localhost:7860/
```

Kết quả mong đợi:

```text
Bot Zalo is Running!
```

Nếu bạn đã đặt `PORT` khác `7860`, hãy sử dụng cổng đó.

## Cấu hình webhook Zalo

Sau khi triển khai ứng dụng lên hosting có URL HTTPS công khai, cấu hình webhook của bot trỏ đến đường dẫn:

```text
https://YOUR_PUBLIC_DOMAIN/webhook
```

Thay `YOUR_PUBLIC_DOMAIN` bằng domain thực tế của bạn. Đường dẫn `/webhook` trong source là **POST endpoint** nhận sự kiện từ Zalo.

Có thể kiểm tra ứng dụng bằng cách mở URL gốc:

```text
https://YOUR_PUBLIC_DOMAIN/
```

Endpoint kiểm tra kết nối Supabase:

```text
https://YOUR_PUBLIC_DOMAIN/ping
```

`/ping` thực hiện một truy vấn nhẹ đến bảng `bot_config`; endpoint này giúp kiểm tra kết nối cơ sở dữ liệu, không phải cam kết rằng hosting sẽ không tự dừng ứng dụng.

## Chạy bằng Docker

Repository có sẵn `Dockerfile`. Tại thư mục chứa Dockerfile, chạy:

```bash
docker build -t zalo-group-bot .
```

Khởi chạy container với file `.env` đã chuẩn bị:

```bash
docker run -d \
  --name zalo-group-bot \
  --restart unless-stopped \
  --env-file .env \
  -p 7860:7860 \
  zalo-group-bot
```

Nếu sử dụng cổng khác, hãy đồng bộ biến `PORT` và port mapping của Docker. Không đưa file `.env` vào image hoặc commit lên GitHub.

## Tùy chỉnh lời chào và lời tạm biệt

Khi phát hiện thành viên tham gia hoặc rời nhóm, bot đọc hai key sau trong bảng `bot_config`:

- `welcome_message`: mẫu nội dung chào thành viên mới.
- `goodbye_message`: mẫu nội dung khi thành viên rời nhóm.

Nếu chưa có key, bot sẽ sử dụng nội dung mặc định trong source. Có thể thêm hoặc cập nhật mẫu bằng SQL:

```sql
insert into public.bot_config (key, value)
values
  ('welcome_message', 'Chào mừng bạn đến với nhóm!'),
  ('goodbye_message', 'Cảm ơn bạn đã đồng hành cùng nhóm.')
on conflict (key)
do update set value = excluded.value;
```

Các mẫu hỗ trợ placeholder tên thành viên: `{name}`, `[name]` và `[Tên_Thành_Vien]`.

Lưu ý: code hiện tự thêm phần mở đầu `Chào ...!` hoặc `Tạm biệt ...!` trước nội dung mẫu. Vì vậy, không cần lặp lại phần mở đầu này trong giá trị cấu hình.

## Lịch nhắc đồng phục có sẵn

Source hiện có một scheduler cố định theo múi giờ `Asia/Ho_Chi_Minh` (UTC+7), gửi tin nhắn đến `GROUP_ID` theo lịch:

| Thời điểm | Nội dung nhắc |
|---|---|
| Chủ nhật 21:00 | Nhắc thứ Hai mặc áo trắng. |
| Thứ Hai 06:00 và 06:30 | Nhắc mặc áo trắng. |
| Thứ Tư 21:00 | Nhắc thứ Năm mặc áo xanh cam. |
| Thứ Năm 06:00 và 06:30 | Nhắc mặc áo xanh cam. |

Lịch này được viết trực tiếp trong `index.js`, không phải tính năng cấu hình chung và hiện không có lệnh bật/tắt. Bot kiểm tra lịch định kỳ mỗi 15 giây, đồng thời lưu ngày đã gửi vào Supabase để hạn chế gửi trùng sau khi tiến trình khởi động lại.

**Nếu bạn triển khai bot cho nhóm khác và không muốn gửi các tin nhắc này, hãy chỉnh sửa hoặc xóa phần scheduler tương ứng trong `index.js` trước khi chạy.** Nếu để nguyên và khai báo `GROUP_ID`, bot sẽ tiếp tục gửi các tin nhắc theo lịch trên vào nhóm đó.

## Bảo mật khi public source

Repository public đồng nghĩa với việc bất kỳ ai cũng có thể xem mã nguồn. Điều đó **không có nghĩa** bạn nên công khai thông tin kết nối hoặc token.

1. **Không commit token và khóa bí mật.** Không đưa `ZALO_BOT_TOKEN`, `SUPABASE_KEY`, ID riêng tư hoặc nội dung `.env` thật vào GitHub.
2. **Thêm `.gitignore`.** Tối thiểu nên có:

   ```gitignore
   .env
   .env.*
   !.env.example
   node_modules/
   ```

3. **Nếu đã lỡ đẩy token lên GitHub:** xóa token khỏi source là chưa đủ vì lịch sử Git có thể vẫn lưu lại. Hãy thu hồi/tạo token mới ở dịch vụ tương ứng và cập nhật lại Secrets trên hosting.
4. **Không chia sẻ khóa Supabase có quyền cao.** Khóa server-side phải chỉ nằm trong môi trường chạy bot.
5. **Cân nhắc dữ liệu trong log.** Source hiện ghi toàn bộ nội dung webhook và ID Admin dạng hex ra log. Log có thể chứa nội dung tin nhắn hoặc thông tin định danh; nên giới hạn hoặc loại bỏ các log này nếu triển khai cho nhóm có dữ liệu riêng tư.
6. **Chỉ cấp quyền Admin cho tài khoản tin cậy.** Phiên bản này dùng một `ADMIN_ID`; người khác không nên được cung cấp token hoặc quyền truy cập môi trường hosting.

## Xử lý lỗi thường gặp

### Bot khởi động rồi thoát ngay

Kiểm tra đã khai báo đủ `ZALO_BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_KEY` và `ADMIN_ID` chưa. Bốn biến này được kiểm tra khi ứng dụng khởi động.

### Truy cập `/webhook` trên trình duyệt thấy `Cannot GET /webhook`

Điều này có thể là bình thường: source khai báo `POST /webhook`, không khai báo `GET /webhook`. Zalo cần gửi webhook bằng POST. Để kiểm tra ứng dụng đang chạy, mở `/` thay vì `/webhook`.

### Webhook đã cấu hình nhưng bot không phản hồi

- Kiểm tra URL webhook có đúng dạng `https://YOUR_PUBLIC_DOMAIN/webhook` không.
- Kiểm tra dịch vụ hosting còn chạy và có thể truy cập công khai qua HTTPS.
- Kiểm tra log để xem server có nhận request POST hay không.
- Đảm bảo đang thử trong nhóm, không phải tin nhắn riêng.
- Với lệnh, hãy tag bot trong tin nhắn rồi mới nhập lệnh.
- Kiểm tra token và quyền/API của bot ở phía Zalo.

### Lệnh Admin báo không có quyền

Kiểm tra `ADMIN_ID` có đúng ID của tài khoản gửi lệnh không. Sau khi sửa Environment/Secrets trên hosting, khởi động lại ứng dụng để nạp giá trị mới.

### Không lưu được link hoặc filter

Kiểm tra đã tạo đủ hai bảng `bot_config`, `bot_triggers` với đúng tên cột chưa. Sau đó kiểm tra `SUPABASE_URL`, `SUPABASE_KEY`, quyền đọc/ghi và log lỗi Supabase.

### `/ping` trả lỗi Supabase

Kiểm tra kết nối project, key và quyền truy cập bảng `bot_config`. Endpoint này không kiểm tra trực tiếp trạng thái webhook Zalo.

---

## Công nghệ sử dụng

- [Node.js](https://nodejs.org/)
- [Express](https://expressjs.com/)
- [Axios](https://axios-http.com/)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Zalo Bot API](https://docs.zaloplatforms.com/)
- [Docker](https://www.docker.com/) (tùy chọn)

## Đóng góp

Bạn có thể fork repository, tạo nhánh riêng, thực hiện thay đổi và gửi Pull Request. Khi báo lỗi, hãy mô tả các bước tái hiện và log liên quan; nhớ che token, khóa bí mật, ID người dùng và nội dung riêng tư trước khi chia sẻ.

## Giấy phép

Repository cần có file `LICENSE` để xác định rõ người khác được phép sử dụng, chỉnh sửa và phân phối source đến mức nào. **Public repository không tự động đồng nghĩa với việc source được cấp phép sử dụng lại.** Chỉ thêm giấy phép (ví dụ MIT) khi bạn có quyền cấp phép đối với toàn bộ phần mã nguồn mà bạn đăng tải.
