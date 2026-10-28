# 📱 HƯỚNG DẪN CHẠY RINQ SHOP TRÊN TERMUX ANDROID

---

## 1. Giải pháp kết nối Database giữa Điện thoại và Web

SQLite (`dev.db`) là file nằm cục bộ trong bộ nhớ máy, máy chủ ngoài (như Vercel) **không thể đọc trực tiếp** file trên điện thoại.

Có 2 giải pháp tối ưu:

### Cách 1: Chạy toàn bộ (Web + Bot) trực tiếp trên Termux (Khuyên dùng)
- Cả Web lẫn Bot chạy chung trong Termux -> Dùng chung file `dev.db` mượt mà.
- Dùng **Cloudflare Tunnel** (miễn phí) để cấp tên miền HTTPS công khai cho Web chạy ra ngoài Internet.
- **Ưu điểm:** Giữ nguyên 100% code, không cần cấu hình database cloud.

### Cách 2: Dùng Database Cloud (Web ở Vercel, Bot ở Termux)
- Đăng ký Database PostgreSQL / SQLite Cloud miễn phí: **Supabase**, **Neon.tech** hoặc **Turso**.
- Thay `DATABASE_URL` trong file `.env` ở cả Web và Termux bằng URL Cloud.
- **Ưu điểm:** Web và Bot chạy ở 2 nơi riêng biệt vẫn đồng bộ dữ liệu tức thì.

---

## 2. Các bước cài đặt trên Termux Android (Theo Cách 1)

### Bước 1: Cài đặt môi trường cơ bản
Mở Termux và dán lần lượt các lệnh:
```bash
# Cập nhật package Termux
pkg update && pkg upgrade -y

# Cài đặt Node.js, Git và công cụ build
pkg install nodejs-lts git clang make python -y

# Cấp quyền bộ nhớ cho Termux
termux-setup-storage
```

---

### Bước 2: Tải Source Code về Termux
```bash
# Clone dự án từ GitHub
git clone https://github.com/rinq-dev/RINQ.git

# Di chuyển vào thư mục dự án
cd RINQ

# Cài đặt thư viện dependencies
npm install
```

---

### Bước 3: Cấu hình file `.env`
Tạo file `.env` từ file mẫu:
```bash
cp .env.example .env
nano .env
```
Điền các thông tin:
- `BOT_TOKEN`: Token bot từ @BotFather.
- `ADMIN_TELEGRAM_ID`: ID Telegram của bạn.
- `BANK_ID`, `BANK_ACCOUNT_NO`, `BANK_ACCOUNT_NAME`: Thông tin VietQR.
- `ADMIN_PASSWORD`: Mật khẩu đăng nhập Web Admin.
- `STOCK_ENCRYPTION_KEY`: Khóa mã hóa 64 ký tự ngẫu nhiên.

*Bấm `Ctrl + O` -> `Enter` để lưu, `Ctrl + X` để thoát nano.*

Khởi tạo Database:
```bash
npx prisma generate
npx prisma db push
```

---

### Bước 4: Mở Public Web ra Internet bằng Cloudflare Tunnel
Cài đặt `cloudflared` trên Termux:
```bash
pkg install cloudflared -y
```

Mở tunnel phát cổng 3000 ra Internet:
```bash
cloudflared tunnel --url http://localhost:3000
```
*Màn hình sẽ hiển thị link dạng `https://xxxx.trycloudflare.com` -> Đây chính là link Web Shop công khai.*

Copy link này gán vào biến `WEB_APP_URL` trong `.env`.

---

### Bước 5: Chạy Web và Bot song song 24/7 trên Termux

Cài công cụ quản lý tiến trình nền `pm2`:
```bash
npm install -g pm2
```

Build Web:
```bash
npm run build
```

Khởi chạy cả Web và Bot chạy nền:
```bash
# Chạy Web Next.js
pm2 start npm --name "rinq-web" -- start

# Chạy Bot Telegram
pm2 start "npx tsx src/bot/index.ts" --name "rinq-bot"

# Lưu tiến trình tự khởi động lại
pm2 save
```

Kiểm tra trạng thái:
```bash
pm2 status
pm2 logs
```

---

## 3. Chống Android tự tắt Termux khi tắt màn hình
1. Kéo thanh thông báo Termux xuống -> Bấm **Acquire WakeLock**.
2. Vào Cài đặt điện thoại -> **Ứng dụng** -> **Termux** -> **Pin/Tiết kiệm pin** -> Chọn **Không hạn chế (No restrictions)**.
