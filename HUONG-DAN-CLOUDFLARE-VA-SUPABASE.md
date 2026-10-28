# ☁️ HƯỚNG DẪN TRIỂN KHAI CLOUDFLARE PAGES (WEB) + TERMUX ANDROID (BOT)

Hệ thống hoạt động theo mô hình:
- **Web Storefront + Web Admin:** Chạy trên **Cloudflare Pages** (Serverless Edge toàn cầu, tốc độ cao tại Việt Nam).
- **Telegram Bot 24/7:** Chạy trên **Termux (Điện thoại Android)**.
- **Cơ sở dữ liệu chung:** Dùng **Supabase PostgreSQL** (Cloud miễn phí) để Web và Bot đồng bộ dữ liệu tức thì.

---

## BƯỚC 1: TẠO DATABASE MIỄN PHÍ TRÊN SUPABASE (2 PHÚT)

1. Truy cập [https://supabase.com](https://supabase.com) -> Đăng ký / Đăng nhập (bằng GitHub).
2. Bấm **"New Project"**:
   - **Name:** `rinq-shop`
   - **Database Password:** Đặt mật khẩu an toàn (ghi nhớ mật khẩu này).
   - **Region:** Chọn `Singapore (ap-southeast-1)` (gần Việt Nam nhất, tốc độ nhanh nhất).
3. Sau khi dự án tạo xong, vào mục **Project Settings** (biểu tượng bánh răng) -> **Database**:
   - Kéo xuống phần **Connection string** -> Chọn tab **URI**:
   - Chọn chế độ **Mode: Session** (cổng 5432) hoặc **Transaction / Connection pooling** (cổng 6543).
   - Copy chuỗi kết nối và thay `[YOUR-PASSWORD]` bằng mật khẩu vừa đặt.

---

## BƯỚC 2: ĐẨY CẤU TRÚC BẢNG LÊN SUPABASE

Trên máy tính hoặc trên Termux, dán connection string vào file `.env`:
```env
DATABASE_URL="postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
```

Chạy lệnh để tự động tạo toàn bộ bảng dữ liệu trên Supabase:
```bash
npx prisma db push
```

---

## BƯỚC 3: ĐƯA WEB LÊN CLOUDFLARE PAGES

1. Truy cập [Cloudflare Dashboard](https://dash.cloudflare.com/) -> Chọn **Workers & Pages** -> **Create application** -> Tab **Pages**.
2. Chọn **Connect to Git** -> Chọn tài khoản GitHub `rinq-dev` -> Chọn repository **RINQ**.
3. Cấu hình Build Settings:
   - **Framework preset:** `Next.js`
   - **Build command:** `npx prisma generate && next build`
   - **Build output directory:** `.next`
4. Cấu hình **Environment variables** (Biến môi trường) trên Cloudflare Pages:
   - `DATABASE_URL`: Chuỗi kết nối Supabase (pooling 6543).
   - `DIRECT_URL`: Chuỗi kết nối Supabase (direct 5432).
   - `BOT_TOKEN`: Token bot từ @BotFather.
   - `ADMIN_TELEGRAM_ID`: ID Telegram của bạn.
   - `ADMIN_PASSWORD`: Mật khẩu đăng nhập Web Admin.
   - `BANK_ID`, `BANK_ACCOUNT_NO`, `BANK_ACCOUNT_NAME`: Thông tin ngân hàng VietQR.
   - `SEPAY_API_KEY`: API Key SePay (nếu có).
   - `STOCK_ENCRYPTION_KEY`: Khóa mã hóa kho 64 ký tự.
5. Bấm **Save and Deploy**. Cloudflare Pages sẽ cấp cho bạn tên miền miễn phí dạng `https://rinq-shop.pages.dev`.

---

## BƯỚC 4: KÍCH HOẠT BOT TRÊN TERMUX ANDROID

1. Mở Termux trên điện thoại:
```bash
cd RINQ
git pull origin main
```
2. Chỉnh sửa file `.env` trên Termux:
```bash
nano .env
```
Điền cùng dòng `DATABASE_URL` của Supabase đã tạo ở Bước 1.
3. Chạy Bot 24/7 trên Termux:
```bash
pm2 start "npx tsx src/bot/index.ts" --name "rinq-bot"
pm2 save
```

Khi Bot trên Termux hoạt động, nó sẽ tự động gửi nhịp tim (heartbeat) lên Supabase Database -> Web trên Cloudflare Pages nhận diện Bot đang Online và mở khóa cho khách mua hàng bình thường.
