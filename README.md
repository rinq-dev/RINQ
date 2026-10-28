`README.md` (tích hợp sẵn Master Prompt cho AI)** và **1 đoạn lệnh PowerShell tự động đóng gói toàn bộ source code + `README.md` thành file `rinq-shop.zip**` ngay trên máy tính của bạn.

---

## 1. File `README.md` (Bản thiết kế & Master Prompt cho AI)

Bạn chỉ cần tạo thư mục dự án, lưu nội dung dưới đây vào file `README.md`, sau đó mở AI Agent trong IDE và gõ: **"Đọc file `README.md` và code hoàn chỉnh toàn bộ dự án theo đúng cấu trúc yêu cầu"**.

```markdown
# 🤖 RINQ SHOP (Next.js Web Admin + Telegram Bot Auto-Delivery)

Hệ thống bán tài nguyên số tự động (Account, Key, Link, Tool) hoạt động khép kín trên Telegram kết hợp Web Admin quản lý kho và cổng thanh toán tự động qua VietQR (SePay).

---

## 🧠 MASTER PROMPT DÀNH CHO AI CODING AGENT

> **Chỉ thị cho AI:** Hãy đọc kỹ toàn bộ tài liệu thiết kế này và xây dựng hoàn chỉnh hệ thống **Full-Stack Telegram Auto-Shop** theo đúng Tech Stack, Database Schema, giao diện Bot và các tính năng Web Admin được mô tả bên dưới. Ưu tiên hoàn thiện luồng chạy thử nghiệm trên máy tính (Local PC: Web + Bot chạy song song) trước khi deploy lên Vercel và Android.

### 1. Mục tiêu hệ thống
Xây dựng hệ thống bán hàng tự động 100% qua Telegram giống mô hình `@scoopyvn_bot`:
- **Khách hàng trên Telegram:** Bấm menu chọn sản phẩm -> Xem số lượng tồn kho thực tế -> Bấm mua -> Nhận ảnh mã VietQR kèm nội dung chuyển khoản tự động -> Chuyển khoản -> Nhận tài khoản/key ngay lập tức trong khung chat.
- **Chủ shop trên Web Admin (Next.js):** Thêm/sửa/xóa sản phẩm, nạp kho hàng loạt (mỗi dòng 1 tài khoản/key), theo dõi danh sách đơn hàng, xem thống kê doanh thu, và có **nút "Giả lập thanh toán (Test Webhook)"** để test luồng bot trả hàng ngay trên máy tính mà không cần chuyển tiền thật.

### 2. Tech Stack bắt buộc
- **Framework Web & API:** Next.js (App Router), TypeScript, Tailwind CSS, Lucide Icons.
- **Telegram Bot:** `grammY` (chạy bằng `tsx` ở chế độ Long Polling tại `src/bot/index.ts`).
- **Database & ORM:** SQLite (Nội bộ `prisma/dev.db`, không cần setup cloud) + **Prisma ORM** (dùng chung 1 `schema.prisma` cho cả Web và Bot).
- **Chạy đồng thời trên PC:** Cấu hình `package.json` sử dụng `concurrently` (hoặc 2 script tách biệt `npm run dev` và `npm run bot`) để test cả Web lẫn Bot trên máy tính.

### 3. Cấu trúc thư mục chuẩn
```text
rinq-shop/
├── prisma/
│   └── schema.prisma                  # Schema PostgreSQL (Supabase)
├── src/
│   ├── lib/
│   │   └── prisma.ts                  # Prisma Client Singleton
│   ├── bot/
│   │   └── index.ts                   # Bot Telegram (grammY)
│   └── app/
│       ├── layout.tsx
│       ├── page.tsx                   # Redirect về /admin hoặc trang giới thiệu
│       ├── admin/
│       │   └── page.tsx               # Dashboard quản lý SP, Nạp kho, Đơn hàng & Test Webhook
│       └── api/
│           ├── admin/
│           │   └── route.ts           # CRUD Sản phẩm, Nạp kho, Lấy danh sách Đơn hàng
│           └── webhook/
│               └── sepay/
│                   └── route.ts       # Nhận Webhook thanh toán & gọi Telegram API trả hàng
├── .env
├── package.json
└── README.md

```

### 4. Thiết kế Database (`prisma/schema.prisma`)

* **Bảng `Product**`: `id` (Int, autoincrement), `name` (String), `price` (Int), `description` (String?), `category` (String? - VD: "AI", "Mail", "Tool"), `isActive` (Boolean, default true), `createdAt` (DateTime).
* **Bảng `StockItem**`: `id` (Int, autoincrement), `productId` (Int), `data` (String - chứa `user|pass|token` hoặc link), `isSold` (Boolean, default false), `orderId` (String?), `createdAt` (DateTime). Có index `[productId, isSold]`.
* **Bảng `Order**`: `id` (String, `@id` - mã `DH` + 128 bit ngẫu nhiên), `telegramId` (String), `username` (String?), `productId` (Int), `totalAmount` (Int), `status` (String: `"PENDING"` | `"PAID"` | `"EXPIRED"`), `createdAt` (DateTime), `paidAt` (DateTime?).

### 5. Yêu cầu chi tiết cho Telegram Bot (`src/bot/index.ts`)

1. **Menu cố định dưới đáy (`ReplyKeyboardMarkup` - 2 cột x 3 hàng):**
* Hàng 1: `🗂 Xem sản phẩm` | `📦 Đơn hàng của tôi`
* Hàng 2: `🛠 Tool nhà làm` | `🎁 Giveaway`
* Hàng 3: `❓ Cách mua` | `🎧 Liên hệ hỗ trợ`


2. **Tin nhắn `/start`:**
* Gửi lời chào cửa hàng, hướng dẫn ngắn gọn và kích hoạt `ReplyKeyboardMarkup` cố định, sau đó gọi luôn hàm hiển thị danh mục sản phẩm.


3. **Hiển thị Danh mục (`🗂 Xem sản phẩm`):**
* Query toàn bộ `Product` đang `isActive = true` kèm số lượng `StockItem` có `isSold = false`.
* Nội dung tin nhắn hiển thị:
* Tổng số sản phẩm.
* Số sản phẩm `🟢 X còn hàng · 🔴 Y hết hàng`.
* Thời gian cập nhật: `🕒 Cập nhật: HH:mm:ss DD-MM`.


* Danh sách nút bấm (`InlineKeyboardMarkup`), mỗi sản phẩm 1 hàng:
`[Tên sản phẩm] · [Giá format VNĐ] · 🟢 Còn [Số lượng]` (Nếu hết hàng hiển thị `🔴 Hết hàng`).


4. **Chi tiết sản phẩm & Mua hàng:**
* Bấm vào sản phẩm -> Hiện tên, giá, số lượng tồn kho, mô tả chi tiết và nút `💳 Mua ngay` + `🔙 Quay lại`.
* Bấm `💳 Mua ngay` -> Kiểm tra tồn kho > 0 -> Tạo bản ghi `Order` trạng thái `PENDING` với mã ngẫu nhiên -> Gửi ảnh mã QR từ VietQR:
`https://img.vietqr.io/image/${BANK_ID}-${BANK_ACCOUNT_NO}-compact2.png?amount=${price}&addInfo=${orderId}&accountName=${BANK_ACCOUNT_NAME}`
kèm caption hướng dẫn giữ nguyên nội dung chuyển khoản theo mã đơn.


5. **Mục `📦 Đơn hàng của tôi`:**
* Liệt kê 10 đơn hàng `PAID` gần nhất của `ctx.from.id` kèm dữ liệu tài khoản/key (`StockItem.data`) trong thẻ `<code>` để khách bấm vào là tự copy.



### 6. Yêu cầu chi tiết cho Web Admin & Webhook (Chạy trên Next.js)

1. **Giao diện `/admin` (Dark Mode hiện đại, rõ ràng):**
* **Xác thực:** Đăng nhập bằng `ADMIN_PASSWORD`; phiên được ký phía server và lưu trong cookie `HttpOnly`, tự hết hạn sau 8 giờ.
* **Tab 1 - Quản lý Sản phẩm & Kho hàng:**
* Form tạo sản phẩm mới (Tên, Giá, Mô tả), nút Bật/Tắt hiển thị hoặc Xóa sản phẩm.
* Bảng danh sách sản phẩm hiển thị rõ: Tên, Giá, Số lượng **Tồn kho (Chưa bán)** và **Đã bán**.
* Form **Nạp kho hàng loạt (Bulk Import)**: Chọn sản phẩm -> Dán nhiều dòng text vào `textarea` (mỗi dòng 1 sản phẩm) -> Bấm nạp -> Tự động tách dòng, loại bỏ dòng trống và lưu vào `StockItem`.


* **Tab 2 - Quản lý Đơn hàng & Giả lập Thanh toán (Quan trọng để test trên PC):**
* Hiển thị danh sách các đơn hàng (`PENDING`, `PAID`) theo thời gian thực.
* Với các đơn đang `PENDING`, có nút **"⚡ Duyệt / Giả lập TT"**: Khi bấm vào nút này, Web sẽ gọi thẳng vào logic Webhook (`/api/webhook/sepay`) với đúng mã đơn và số tiền của đơn đó để kích hoạt luồng trừ kho + bắn tin nhắn Telegram trả hàng cho khách ngay lập tức.




2. **Endpoint `/api/webhook/sepay` (`POST`):**
* Xác thực `Authorization: Apikey ...` từ SePay hoặc phiên Admin cùng origin trước khi xử lý giao dịch.
* Chỉ nhận giao dịch tiền vào có mã đơn hợp lệ và số tiền ít nhất bằng tổng đơn.
* Tách mã đơn hiện tại có 32 ký tự hex sau tiền tố `DH`; mã số ngắn cũ chỉ được xử lý khi webhook đã xác thực.
* Sử dụng `prisma.$transaction` để tìm 1 `StockItem` (`isSold: false`), cập nhật `isSold: true`, `orderId: order.id`, và đổi trạng thái `Order` sang `PAID`.
* Dùng `fetch` gọi thẳng HTTP API của Telegram (`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`) để gửi tài khoản/key về `order.telegramId` của khách.



### 7. Scripts trong `package.json`

Cấu hình đầy đủ các script sau để tiện chạy thử trên máy tính Windows và sau này chạy trên Android:

* `"dev"`: `"next dev"` (Chạy Web Admin ở `http://localhost:3000`)
* `"bot"`: `"tsx watch src/bot/index.ts"` (Chạy Bot Telegram tự reload khi sửa code trên PC)
* `"bot:prod"`: `"tsx src/bot/index.ts"` (Dùng khi chạy PM2 trên Android)
* `"dev:all"`: `"concurrently \"npm run dev\" \"npm run bot\""` (Chạy cả Web và Bot trong 1 cửa sổ Terminal trên PC)

```

---

## 2. Lệnh PowerShell 1-Click: Tự tạo toàn bộ Project + Nén thành `rinq-shop.zip`

Mở **PowerShell** trên máy tính của bạn (ví dụ tại ổ `D:\PROJECT`), copy và dán toàn bộ khối lệnh dưới đây vào rồi bấm **Enter**. Script sẽ tự động tạo thư mục `rinq-shop`, ghi đầy đủ các file (`README.md`, `package.json`, `.env.example`, `schema.prisma`, code khung) và nén sẵn thành file **`rinq-shop.zip`** cho bạn:

```powershell
$projectDir = "rinq-shop"
New-Item -ItemType Directory -Force -Path "$projectDir/prisma", "$projectDir/src/lib", "$projectDir/src/bot", "$projectDir/src/app/admin", "$projectDir/src/app/api/admin", "$projectDir/src/app/api/webhook/sepay" | Out-Null

# 1. Tạo package.json
@'
{
  "name": "rinq-shop",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "prisma generate && next build",
    "start": "next start",
    "bot": "tsx watch src/bot/index.ts",
    "bot:prod": "tsx src/bot/index.ts",
    "dev:all": "concurrently \"npm run dev\" \"npm run bot\"",
    "db:push": "prisma db push"
  },
  "dependencies": {
    "@prisma/client": "^5.20.0",
    "dotenv": "^16.4.5",
    "grammy": "^1.30.0",
    "lucide-react": "^0.446.0",
    "next": "14.2.13",
    "react": "^18",
    "react-dom": "^18"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "concurrently": "^9.0.1",
    "postcss": "^8",
    "prisma": "^5.20.0",
    "tailwindcss": "^3.4.1",
    "tsx": "^4.19.1",
    "typescript": "^5"
  }
}
'@ | Set-Content -Path "$projectDir/package.json" -Encoding UTF8

# 2. Tạo .env.example
@'
# Database Supabase (PostgreSQL)
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

# Telegram Bot (@BotFather)
BOT_TOKEN="789123456:AAHxxxxxxxxxxxxxxxxxxxxxxxx"
ADMIN_TELEGRAM_ID="123456789"

# Cấu hình VietQR
BANK_ID="MB"
BANK_ACCOUNT_NO="0123456789"
BANK_ACCOUNT_NAME="NGUYEN TAI PHAT"

# Bảo mật Web Admin & Webhook
ADMIN_PASSWORD="<random password, at least 16 characters>"
ADMIN_SESSION_SECRET="<random secret, at least 32 characters>"
SEPAY_API_KEY="<same key configured in SePay webhook authentication>"
STOCK_ENCRYPTION_KEY="<random key, at least 32 characters; preserve it for existing stock>"
STOCK_ENCRYPTION_KEY_PREVIOUS="<only during a key rotation; run npm run db:rotate-stock-key before removing>"
'@ | Set-Content -Path "$projectDir/.env.example" -Encoding UTF8

# 3. Tạo prisma/schema.prisma
@'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model Product {
  id          Int         @id @default(autoincrement())
  name        String
  price       Int
  description String?
  category    String?
  isActive    Boolean     @default(true)
  stocks      StockItem[]
  orders      Order[]
  createdAt   DateTime    @default(now())
}

model StockItem {
  id        Int      @id @default(autoincrement())
  productId Int
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  data      String
  isSold    Boolean  @default(false)
  orderId   String?
  order     Order?   @relation(fields: [orderId], references: [id])
  createdAt DateTime @default(now())

  @@index([productId, isSold])
}

model Order {
  id          String      @id
  telegramId  String
  username    String?
  productId   Int
  product     Product     @relation(fields: [productId], references: [id])
  totalAmount Int
  status      String      @default("PENDING")
  stocks      StockItem[]
  createdAt   DateTime    @default(now())
  paidAt      DateTime?

  @@index([telegramId, status])
}
'@ | Set-Content -Path "$projectDir/prisma/schema.prisma" -Encoding UTF8

# 4. Tạo README.md hướng dẫn quy trình & Prompt cho AI
@'
# RINQ SHOP - HƯỚNG DẪN CHẠY TRÊN PC & PROMPT CHO AI

## Cách bảo AI hoàn thiện toàn bộ dự án
Mở dự án này trong IDE (Antigravity / Cursor / VS Code) và gửi câu lệnh sau cho AI Agent:
> "Hãy đọc cấu trúc hiện tại trong dự án và xây dựng hoàn chỉnh:
> 1. `src/lib/prisma.ts`: Prisma Singleton.
> 2. `src/app/api/admin/route.ts`: API quản lý sản phẩm (thêm/xóa/ẩn), nạp kho hàng loạt (tách theo dòng `\n`), lấy danh sách đơn hàng.
> 3. `src/app/api/webhook/sepay/route.ts`: API nhận Webhook từ SePay (hoặc từ nút Giả lập thanh toán của Admin), trừ kho trong Transaction và dùng `BOT_TOKEN` gọi Telegram API gửi hàng cho khách.
> 4. `src/app/admin/page.tsx`: Giao diện Admin Dark Mode có bảng quản lý SP, form nạp kho hàng loạt, bảng danh sách đơn hàng kèm nút '⚡ Giả lập thanh toán' cho các đơn PENDING để test trực tiếp trên PC.
> 5. `src/bot/index.ts`: Bot Telegram dùng `grammY` có ReplyKeyboard cố định 6 nút (Xem sản phẩm, Đơn hàng của tôi, Tool nhà làm, Giveaway, Cách mua, Liên hệ hỗ trợ), InlineKeyboard hiển thị danh sách sản phẩm kèm số lượng tồn kho (🟢 Còn X / 🔴 Hết), xuất ảnh VietQR khi khách bấm mua."

## Các bước chạy thử trên Máy tính (Windows PC)
1. Điền `BOT_TOKEN` vào `.env`; đặt `ADMIN_PASSWORD` (ít nhất 16 ký tự ngẫu nhiên), `ADMIN_SESSION_SECRET` (ít nhất 32 ký tự ngẫu nhiên), `SEPAY_API_KEY` và `STOCK_ENCRYPTION_KEY`. Chọn API Key trong phần bảo mật webhook SePay và dùng cùng giá trị `SEPAY_API_KEY`. Không commit `.env`.
2. Cài đặt thư viện & khởi tạo DB:
   ```bash
   npm install
   npx prisma db push

```

   Nếu đổi `STOCK_ENCRYPTION_KEY` cho database đã có stock mã hóa, đặt khóa cũ vào `STOCK_ENCRYPTION_KEY_PREVIOUS`, chạy `npm run db:rotate-stock-key`, rồi xóa khóa cũ khỏi biến môi trường.

3. Chạy đồng thời cả Web Admin (`http://localhost:3000/admin`) và Bot Telegram trên PC:
```bash
npm run dev:all

```


4. Mở Telegram nhắn `/start` vào Bot -> Chọn mua thử 1 sản phẩm -> Lên `http://localhost:3000/admin` bấm nút **"Giả lập thanh toán"** -> Kiểm tra Bot tự động bắn tài khoản về Telegram.
'@ | Set-Content -Path "$projectDir/README.md" -Encoding UTF8

# 5. Nén thành file rinq-shop.zip

Compress-Archive -Path $projectDir -DestinationPath "$projectDir.zip" -Force
Write-Host "✅ Đã tạo xong thư mục '$projectDir' và đóng gói thành '$projectDir.zip'!" -ForegroundColor Green

```

---

## 3. Quy trình làm việc chuẩn (Làm trên PC trước ➔ Đưa lên Điện thoại sau)

1. **Bước 1 (Khởi tạo trên PC):** Chạy lệnh PowerShell ở trên (hoặc copy phần `README.md` ở Mục 1 vào thư mục dự án của bạn), mở trong IDE để AI generate đầy đủ UI Web Admin và Bot.
2. **Bước 2 (Test luồng mua hàng trên PC):**
   * Chạy `npm run dev:all` để bật cả Web (`localhost:3000/admin`) và Bot trên máy tính.
   * Vào `localhost:3000/admin` tạo thử sản phẩm (ví dụ: *Gemini Pro 5TB*[cite: 1]) và nạp vài dòng tài khoản ảo (`user1|pass1`).
   * Mở Telegram trên máy tính bấm `/start` ➔ Chọn sản phẩm ➔ Nhận mã QR[cite: 1].
   * Quay lại tab Web Admin bấm nút **"⚡ Giả lập thanh toán"** để xem Bot trả tài khoản ngay trong khung chat Telegram[cite: 1].
3. **Bước 3 (Khi mọi thứ đã mượt trên PC):**
   * Push code lên GitHub ➔ Đẩy phần Web lên **Vercel** và gắn link Webhook vào SePay.
   * Kéo repo đó về **Termux (Ubuntu)** trên điện thoại Android và chỉ chạy duy nhất lệnh `pm2 start npm --name "bot" -- run bot:prod`. Lúc này tắt máy tính đi thì Bot và Web vẫn chạy 24/7.

```
