import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RINQ SHOP — Quản trị",
  description: "Quản lý sản phẩm, kho, đơn hàng và hoạt động Telegram của RINQ SHOP.",
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
      <body
        suppressHydrationWarning
        className="min-h-screen bg-[#f1f3f5] text-slate-800 antialiased selection:bg-[#0e704b] selection:text-white"
      >
        {children}
      </body>
    </html>
  );
}
