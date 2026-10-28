import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "RINQ SHOP - Hệ Thống Tài Nguyên Số Tự Động 24/7",
  description: "Bán tài nguyên số, key bản quyền, tài khoản tự động nhận hàng tức thì qua VietQR & Telegram",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-[#f1f3f5] text-slate-800 antialiased selection:bg-[#0e704b] selection:text-white"
      >
        {children}
      </body>
    </html>
  );
}
