"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  X,
  Check,
  Maximize2,
  Minimize2,
  Copy,
  RotateCcw,
  Bold,
  Italic,
  Code,
  List,
  Quote,
  Smartphone,
  Globe,
  HelpCircle,
  FileText,
  Layers,
} from "lucide-react";

interface DescriptionStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  value: string;
  onSave: (val: string) => void;
  productName?: string;
  price?: number | string;
  warranty?: string;
}

interface TemplateItem {
  id: string;
  title: string;
  tag: string;
  description: string;
  content: string;
}

const TEMPLATES: TemplateItem[] = [
  {
    id: "mail_otp",
    title: "Acc Mail + Link Lấy OTP",
    tag: "Phổ biến",
    description: "Cho các loại tài khoản đăng nhập bằng mã OTP qua web/mail temp",
    content: `- Định dạng: email | link_lay_otp
- Đăng nhập bằng OTP (không cần mật khẩu), nhập email rồi lấy mã OTP tại link
👉 Bước 1: Mở ứng dụng/trang chủ và nhập email được hệ thống cấp, sau đó bấm Tiếp tục
👉 Bước 2: Mở một tab trình duyệt mới, dán link lấy OTP để nhận mã xác thực 6 số
👉 Bước 3: Nhập mã OTP vào trang dịch vụ để hoàn tất đăng nhập
⚠️ Lưu ý: Bảo hành đăng nhập thành công trong vòng 1 giờ từ khi mua. Vui lòng kiểm tra tài khoản ngay sau khi nhận hàng.`,
  },
  {
    id: "mail_pass_2fa",
    title: "Acc Mail : Pass : 2FA",
    tag: "Bảo mật cao",
    description: "Cho tài khoản có mật khẩu và mã bảo mật 2 lớp Authenticator",
    content: `- Định dạng: email | mat_khau | ma_2fa_secret
👉 Bước 1: Đăng nhập bằng Email và Mật khẩu được cấp
👉 Bước 2: Tại màn hình yêu cầu mã 2FA, truy cập trang https://2fa.live (hoặc app Google Authenticator)
👉 Bước 3: Dán mã 2FA Secret vào để lấy mã 6 chữ số đang chạy
👉 Bước 4: Nhập mã 6 số để đăng nhập thành công
⚠️ Lưu ý: Không tự ý thay đổi email/mật khẩu để được bảo hành toàn thời gian.`,
  },
  {
    id: "license_key",
    title: "Key Bản Quyền / License",
    tag: "Phần mềm / Key",
    description: "Cho key kích hoạt phần mềm, tool, VPN, bản quyền Windows/Office",
    content: `- Định dạng: Mã bản quyền License Key (XXXXX-XXXXX-XXXXX-XXXXX)
👉 Bước 1: Tải bộ cài đặt phần mềm chính hãng từ trang chủ nhà phát hành
👉 Bước 2: Cài đặt và mở ứng dụng, tìm mục "Cài đặt" -> "Kích hoạt bản quyền" (Activate License)
👉 Bước 3: Dán mã bản quyền đã mua và bấm Xác nhận
⚠️ Lưu ý: Mỗi key sử dụng cho 1 thiết bị/tài khoản theo gói đã chọn. Cam kết bảo hành 1 đổi 1 suốt thời hạn gói.`,
  },
  {
    id: "upgrade_direct",
    title: "Nâng Cấp Tài Khoản Chính Chủ",
    tag: "Nâng cấp",
    description: "Nâng cấp trực tiếp trên email của khách hàng không cần mật khẩu",
    content: `- Hình thức: Nâng cấp trực tiếp trên tài khoản email chính chủ của Quý khách
👉 Bước 1: Sau khi thanh toán, gửi email tài khoản của Quý khách cho Admin/Bot
👉 Bước 2: Kiểm tra hòm thư đến (hoặc hòm thư Spam/Rác) để nhận email lời mời
👉 Bước 3: Bấm vào đường link trong email để chấp nhận tham gia gói dịch vụ
⚠️ Lưu ý: RINQ SHOP tuyệt đối không yêu cầu mật khẩu tài khoản của Quý khách. Đảm bảo an toàn 100%.`,
  },
];

export default function DescriptionStudioModal({
  isOpen,
  onClose,
  value,
  onSave,
  productName = "Sản phẩm",
  price = 0,
  warranty = "",
}: DescriptionStudioModalProps) {
  const [text, setText] = useState(value);
  const [previewTab, setPreviewTab] = useState<"telegram" | "web">("telegram");
  const [isCopied, setIsCopied] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText(value);
  }, [value, isOpen]);

  if (!isOpen) return null;

  const handleApply = () => {
    onSave(text);
    onClose();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const insertFormatting = (tagStart: string, tagEnd: string = "") => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = text.substring(start, end);
    const replacement = selected ? `${tagStart}${selected}${tagEnd}` : `${tagStart}${tagEnd}`;
    const next = text.substring(0, start) + replacement + text.substring(end);
    setText(next);
    setTimeout(() => {
      el.focus();
      const newCursor = selected ? start + replacement.length : start + tagStart.length;
      el.setSelectionRange(newCursor, newCursor);
    }, 0);
  };

  const applyTemplate = (tpl: TemplateItem) => {
    if (text.trim() && text.trim() !== tpl.content.trim()) {
      const confirmReplace = window.confirm(
        "Mô tả hiện tại đã có nội dung. Bạn có muốn THAY THẾ toàn bộ bằng mẫu này không?\n(Bấm 'OK' để thay thế, bấm 'Cancel' để nối tiếp vào cuối)"
      );
      if (confirmReplace) {
        setText(tpl.content);
      } else {
        setText((prev) => `${prev.trim()}\n\n${tpl.content}`);
      }
    } else {
      setText(tpl.content);
    }
    setShowTemplates(false);
  };

  const numPrice = typeof price === "number" ? price : parseInt(String(price).replace(/\D/g, ""), 10) || 0;
  const priceDisplay = numPrice.toLocaleString("vi-VN") + " đ";

  // Biến đổi mô tả sang HTML trực quan an toàn
  const renderFormattedDescription = (raw: string) => {
    if (!raw.trim()) {
      return (
        <div className="py-8 text-center text-slate-500 italic text-sm">
          Chưa có nội dung mô tả... Kính mời bạn gõ nội dung hoặc bấm các mẫu nhanh bên trái!
        </div>
      );
    }

    const lines = raw.split("\n");
    return (
      <div className="space-y-1.5 leading-relaxed text-sm text-slate-100">
        {lines.map((line, idx) => {
          if (!line.trim()) {
            return <div key={idx} className="h-2" />;
          }

          // Check if bullet point or step
          const isStep = line.trim().startsWith("👉") || /^\d+\./.test(line.trim());
          const isBullet = line.trim().startsWith("- ") || line.trim().startsWith("• ");
          const isWarning = line.trim().startsWith("⚠️") || line.trim().startsWith("*");

          // Parse basic tags <b>, <i>, <code>
          const formattedParts = parseInlineTags(line);

          if (isStep) {
            return (
              <div key={idx} className="flex items-start gap-2 bg-emerald-950/30 border border-emerald-500/20 rounded-xl px-3 py-1.5 text-emerald-200">
                <span className="font-semibold text-emerald-400">👉</span>
                <div className="flex-1 text-slate-100 text-xs sm:text-sm">{formattedParts}</div>
              </div>
            );
          }

          if (isWarning) {
            return (
              <div key={idx} className="flex items-start gap-2 bg-amber-950/30 border border-amber-500/20 rounded-xl px-3 py-1.5 text-amber-200 text-xs sm:text-sm">
                <span className="text-amber-400 font-bold">⚠️</span>
                <div className="flex-1">{formattedParts}</div>
              </div>
            );
          }

          if (isBullet) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-2 text-slate-200 text-xs sm:text-sm">
                <span className="text-emerald-400 font-bold">•</span>
                <div className="flex-1">{formattedParts}</div>
              </div>
            );
          }

          return (
            <p key={idx} className="text-xs sm:text-sm text-slate-200">
              {formattedParts}
            </p>
          );
        })}
      </div>
    );
  };

  const parseInlineTags = (str: string) => {
    // Regex splits by <b>...</b>, <code>...</code>, <i>...</i>, **...**, `...`
    const parts = [];
    let remaining = str;
    let keyIdx = 0;

    const regex = /(<b>(.*?)<\/b>|<code>(.*?)<\/code>|<i>(.*?)<\/i>|\*\*(.*?)\*\*|`([^`]+)`)/i;

    while (remaining) {
      const match = remaining.match(regex);
      if (!match || match.index === undefined) {
        parts.push(<span key={keyIdx++}>{remaining}</span>);
        break;
      }

      if (match.index > 0) {
        parts.push(<span key={keyIdx++}>{remaining.substring(0, match.index)}</span>);
      }

      const fullMatch = match[0];
      if (fullMatch.startsWith("<b>") || fullMatch.startsWith("**")) {
        const inner = match[2] || match[5] || "";
        parts.push(
          <strong key={keyIdx++} className="font-bold text-white">
            {inner}
          </strong>
        );
      } else if (fullMatch.startsWith("<code>") || fullMatch.startsWith("`")) {
        const inner = match[3] || match[6] || "";
        parts.push(
          <code
            key={keyIdx++}
            className="bg-black/50 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono text-xs mx-0.5"
          >
            {inner}
          </code>
        );
      } else if (fullMatch.startsWith("<i>")) {
        const inner = match[4] || "";
        parts.push(
          <em key={keyIdx++} className="italic text-slate-300">
            {inner}
          </em>
        );
      }

      remaining = remaining.substring(match.index + fullMatch.length);
    }

    return parts;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-2 sm:p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-6xl h-[92vh] max-h-[900px] flex flex-col rounded-3xl border border-slate-700/60 bg-slate-900 text-slate-100 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* HEADER BAR */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/90 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Studio Soạn Thảo & Xem Trước Mô Tả
                </h3>
                <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30 uppercase tracking-wide">
                  Live Preview
                </span>
              </div>
              <p className="text-xs text-slate-400 line-clamp-1">
                Sản phẩm: <span className="text-slate-200 font-semibold">{productName || "Chưa đặt tên"}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setText(value)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs text-slate-300 font-medium transition"
              title="Khôi phục lại nội dung lúc mới mở"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Khôi phục gốc
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs text-slate-300 font-medium transition"
              title="Sao chép toàn bộ văn bản"
            >
              <Copy className="h-3.5 w-3.5" />
              {isCopied ? "Đã copy!" : "Sao chép"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Đóng không lưu"
            >
              <X className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex items-center gap-1.5 bg-[#0e704b] hover:bg-[#0b5a3c] text-white text-xs sm:text-sm font-bold px-4 py-2 rounded-xl shadow-lg shadow-emerald-900/40 transition active:scale-95"
            >
              <Check className="h-4 w-4" />
              Áp dụng mô tả
            </button>
          </div>
        </div>

        {/* WORKSPACE BODY (SPLIT VIEW) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 overflow-hidden">
          {/* CỘT TRÁI: SOẠN THẢO */}
          <div className="flex flex-col h-full bg-slate-900/60 overflow-hidden">
            {/* Quick Templates bar */}
            <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-950/40 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold">
                <FileText className="h-3.5 w-3.5 text-emerald-400" />
                <span>Mẫu nhanh:</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-emerald-950/60 hover:text-emerald-300 hover:border-emerald-600/40 border border-slate-700 text-slate-300 transition"
                  >
                    + {tpl.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Toolbar format */}
            <div className="px-4 py-2 border-b border-slate-800 bg-slate-900 flex flex-wrap items-center gap-1 text-slate-300">
              <button
                type="button"
                onClick={() => insertFormatting("<b>", "</b>")}
                className="p-1.5 hover:bg-slate-800 hover:text-white rounded-lg transition"
                title="In đậm (Bold)"
              >
                <Bold className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("<i>", "</i>")}
                className="p-1.5 hover:bg-slate-800 hover:text-white rounded-lg transition"
                title="In nghiêng (Italic)"
              >
                <Italic className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("<code>", "</code>")}
                className="p-1.5 hover:bg-slate-800 hover:text-white rounded-lg transition"
                title="Mã hoặc Key (Code block)"
              >
                <Code className="h-4 w-4" />
              </button>
              <div className="h-4 w-px bg-slate-800 mx-1" />
              <button
                type="button"
                onClick={() => insertFormatting("- ")}
                className="p-1.5 hover:bg-slate-800 hover:text-white rounded-lg transition flex items-center gap-1 text-xs font-medium"
                title="Gạch đầu dòng"
              >
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">Gạch đầu dòng</span>
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("👉 Bước : ")}
                className="px-2 py-1 hover:bg-slate-800 hover:text-white rounded-lg transition text-xs font-semibold text-emerald-400"
                title="Thêm bước thực hiện"
              >
                👉 Bước
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("⚠️ Lưu ý: ")}
                className="px-2 py-1 hover:bg-slate-800 hover:text-white rounded-lg transition text-xs font-semibold text-amber-400"
                title="Thêm lưu ý"
              >
                ⚠️ Lưu ý
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("<blockquote>", "</blockquote>")}
                className="p-1.5 hover:bg-slate-800 hover:text-white rounded-lg transition"
                title="Trích dẫn (Quote)"
              >
                <Quote className="h-4 w-4" />
              </button>
            </div>

            {/* Textarea editor */}
            <div className="flex-1 p-4 overflow-hidden flex flex-col">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Nhập thông tin chi tiết, định dạng tài khoản, hướng dẫn sử dụng và lưu ý tại đây..."
                className="w-full flex-1 resize-none rounded-2xl border border-slate-700/80 bg-slate-950/80 p-4 font-mono text-sm leading-relaxed text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 custom-scrollbar"
              />
            </div>

            {/* Bottom editor footer */}
            <div className="px-4 py-2 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between text-[11px] text-slate-400">
              <div className="flex items-center gap-3">
                <span>{text.length} ký tự</span>
                <span>•</span>
                <span>{text.split(/\s+/).filter(Boolean).length} từ</span>
                <span>•</span>
                <span>{text.split("\n").length} dòng</span>
              </div>
              <div className="text-slate-500 hidden sm:block">
                Hỗ trợ thẻ HTML: <code>&lt;b&gt;</code>, <code>&lt;i&gt;</code>, <code>&lt;code&gt;</code>, <code>&lt;blockquote&gt;</code>
              </div>
            </div>
          </div>

          {/* CỘT PHẢI: XEM TRƯỚC (LIVE PREVIEW) */}
          <div className="flex flex-col h-full bg-slate-950 overflow-hidden">
            {/* Preview switcher tab */}
            <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
              <div className="flex items-center gap-1.5 bg-slate-800/80 p-0.5 rounded-xl border border-slate-700">
                <button
                  type="button"
                  onClick={() => setPreviewTab("telegram")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    previewTab === "telegram"
                      ? "bg-[#0e704b] text-white shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  Mô phỏng Telegram Bot
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab("web")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    previewTab === "web"
                      ? "bg-slate-700 text-white shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Globe className="h-3.5 w-3.5" />
                  Giao diện Web
                </button>
              </div>

              <span className="text-[11px] text-emerald-400/90 font-medium flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Đồng bộ trực tiếp
              </span>
            </div>

            {/* Preview Content Area */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scrollbar">
              {previewTab === "telegram" ? (
                /* GIAO DIỆN MÔ PHỎNG TELEGRAM */
                <div className="max-w-md mx-auto">
                  {/* Telegram Chat Bubble */}
                  <div className="rounded-2xl bg-[#1e293b] border border-[#334155] p-4 text-slate-100 shadow-xl space-y-3">
                    {/* Header bot */}
                    <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center font-bold text-white text-xs">
                          R
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-xs text-white">RINQ SHOP</span>
                            <span className="h-3 w-3 bg-blue-500 text-white rounded-full flex items-center justify-center text-[8px] font-black">
                              ✓
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400">bot</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">Hôm nay</span>
                    </div>

                    {/* Bot Product Message Body */}
                    <div className="space-y-2 text-xs">
                      <p className="font-bold text-white text-sm">
                        ❖ {(productName || "TÊN SẢN PHẨM").toUpperCase()}
                      </p>
                      <p className="text-emerald-400 font-semibold">
                        • <b>Đơn giá:</b> {priceDisplay} / sản phẩm
                      </p>
                      <p className="text-slate-300">
                        • <b>Tình trạng:</b> 🟢 Sẵn hàng (Giao tức thì 24/7)
                      </p>
                      <p className="text-slate-300">
                        • <b>Hình thức giao dịch:</b> Giao tài nguyên tự động 24/7
                      </p>

                      <div className="pt-2 border-t border-slate-700/60">
                        <p className="font-bold text-slate-200 mb-1.5 flex items-center gap-1">
                          <span>📝</span> <b>Thông tin & Mô tả chi tiết:</b>
                        </p>
                        {/* Live description parsed */}
                        <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                          {renderFormattedDescription(text)}
                        </div>
                      </div>

                      {warranty ? (
                        <div className="pt-2">
                          <blockquote className="border-l-2 border-violet-400 pl-2.5 py-1 text-[11px] text-violet-200 bg-violet-950/20 rounded-r">
                            🛡️ <b>CHÍNH SÁCH BẢO HÀNH:</b>
                            <br />
                            {warranty}
                          </blockquote>
                        </div>
                      ) : null}

                      <p className="text-[11px] text-slate-400 italic pt-1">
                        Kính mời Quý khách lựa chọn nút bên dưới để tiến hành thanh toán:
                      </p>
                    </div>

                    {/* Telegram Inline Keyboard simulation */}
                    <div className="space-y-1.5 pt-2">
                      <div className="grid grid-cols-1 gap-1.5">
                        <button
                          type="button"
                          className="w-full py-2 px-3 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1 border border-slate-600/40"
                        >
                          💳 Mua ngay
                        </button>
                        <button
                          type="button"
                          className="w-full py-2 px-3 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1 border border-slate-600/40"
                        >
                          🏷 Dùng mã giảm giá
                        </button>
                      </div>
                      <button
                        type="button"
                        className="w-full py-1.5 px-3 rounded-xl bg-slate-800 text-slate-400 text-[11px] font-medium flex items-center justify-center"
                      >
                        📁 Về tất cả danh mục
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* GIAO DIỆN WEB STORE */
                <div className="max-w-lg mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="border-b border-slate-800 pb-3">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                      Chi tiết sản phẩm
                    </span>
                    <h4 className="text-base font-bold text-white mt-0.5">
                      {productName || "Tên sản phẩm"}
                    </h4>
                    <p className="text-lg font-black text-emerald-400 mt-1">{priceDisplay}</p>
                  </div>

                  <div>
                    <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      Mô tả & Hướng dẫn sử dụng
                    </h5>
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                      {renderFormattedDescription(text)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
