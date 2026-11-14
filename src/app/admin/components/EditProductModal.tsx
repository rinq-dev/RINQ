"use client";

import React, { useState, useRef } from "react";
import {
  Edit,
  X,
  Server,
  Smartphone,
  Edit3,
  Bold,
  Italic,
  Code,
  List,
  Quote,
  FileText,
  RotateCcw,
} from "lucide-react";
import { Product } from "../types";
import ProductImageField from "./ProductImageField";

interface EditProductModalProps {
  editingProduct: Product | null;
  onClose: () => void;
  editName: string;
  setEditName: (val: string) => void;
  editPrice: string;
  setEditPrice: (val: string) => void;
  editDesc: string;
  setEditDesc: (val: string) => void;
  editWarranty: string;
  setEditWarranty: (val: string) => void;
  editCategory: string;
  setEditCategory: (val: string) => void;
  editPriceReason: string;
  setEditPriceReason: (val: string) => void;
  editProductImage: string;
  setEditProductImage: (val: string) => void;
  editSupplierVariantId: string;
  setEditSupplierVariantId: (val: string) => void;
  editFulfillmentType: string;
  setEditFulfillmentType: (val: string) => void;
  editNotify: boolean;
  setEditNotify: (val: boolean) => void;
  isUpdating: boolean;
  categoriesList: { name: string; count: number }[];
  subscriberCount: number;
  onUpdate: (e: React.FormEvent) => void;
}

const TEMPLATES = [
  {
    title: "Acc Mail | OTP",
    content: `- Định dạng: email | link_lay_otp
- Đăng nhập bằng OTP (không cần mật khẩu), nhập email rồi lấy mã OTP tại link
👉 Bước 1: Mở ứng dụng/trang chủ và nhập email được hệ thống cấp, sau đó bấm Tiếp tục
👉 Bước 2: Mở một tab trình duyệt mới, dán link lấy OTP để nhận mã xác thực 6 số
👉 Bước 3: Nhập mã OTP vào trang dịch vụ để hoàn tất đăng nhập
⚠️ Lưu ý: Bảo hành đăng nhập thành công trong vòng 1 giờ từ khi mua. Vui lòng kiểm tra tài khoản ngay sau khi nhận hàng.`,
  },
  {
    title: "Acc Mail : Pass : 2FA",
    content: `- Định dạng: email | mat_khau | ma_2fa_secret
👉 Bước 1: Đăng nhập bằng Email và Mật khẩu được cấp
👉 Bước 2: Tại màn hình yêu cầu mã 2FA, truy cập trang https://2fa.live (hoặc app Google Authenticator)
👉 Bước 3: Dán mã 2FA Secret vào để lấy mã 6 chữ số đang chạy
👉 Bước 4: Nhập mã 6 số để đăng nhập thành công
⚠️ Lưu ý: Không tự ý thay đổi email/mật khẩu để được bảo hành toàn thời gian.`,
  },
  {
    title: "Key Bản Quyền",
    content: `- Định dạng: Mã bản quyền License Key (XXXXX-XXXXX-XXXXX-XXXXX)
👉 Bước 1: Tải bộ cài đặt phần mềm chính hãng từ trang chủ nhà phát hành
👉 Bước 2: Cài đặt và mở ứng dụng, tìm mục "Cài đặt" -> "Kích hoạt bản quyền" (Activate License)
👉 Bước 3: Dán mã bản quyền đã mua và bấm Xác nhận
⚠️ Lưu ý: Mỗi key sử dụng cho 1 thiết bị/tài khoản theo gói đã chọn. Cam kết bảo hành 1 đổi 1 suốt thời hạn gói.`,
  },
  {
    title: "Nâng Cấp Chính Chủ",
    content: `- Hình thức: Nâng cấp trực tiếp trên tài khoản email chính chủ của Quý khách
👉 Bước 1: Sau khi thanh toán, gửi email tài khoản của Quý khách cho Admin/Bot
👉 Bước 2: Kiểm tra hòm thư đến (hoặc hòm thư Spam/Rác) để nhận email lời mời
👉 Bước 3: Bấm vào đường link trong email để chấp nhận tham gia gói dịch vụ
⚠️ Lưu ý: RINQ SHOP tuyệt đối không yêu cầu mật khẩu tài khoản của Quý khách. Đảm bảo an toàn 100%.`,
  },
];

export default function EditProductModal({
  editingProduct,
  onClose,
  editName,
  setEditName,
  editPrice,
  setEditPrice,
  editDesc,
  setEditDesc,
  editWarranty,
  setEditWarranty,
  editCategory,
  setEditCategory,
  editPriceReason,
  setEditPriceReason,
  editProductImage,
  setEditProductImage,
  editSupplierVariantId,
  setEditSupplierVariantId,
  editFulfillmentType,
  setEditFulfillmentType,
  editNotify,
  setEditNotify,
  isUpdating,
  categoriesList,
  subscriberCount,
  onUpdate,
}: EditProductModalProps) {
  const [rightTab, setRightTab] = useState<"edit" | "preview">("edit");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!editingProduct) return null;

  const insertFormatting = (tagStart: string, tagEnd: string = "") => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = editDesc.substring(start, end);
    const replacement = selected ? `${tagStart}${selected}${tagEnd}` : `${tagStart}${tagEnd}`;
    const next = editDesc.substring(0, start) + replacement + editDesc.substring(end);
    setEditDesc(next);
    setTimeout(() => {
      el.focus();
      const newCursor = selected ? start + replacement.length : start + tagStart.length;
      el.setSelectionRange(newCursor, newCursor);
    }, 0);
  };

  const applyTemplate = (content: string) => {
    if (editDesc.trim() && editDesc.trim() !== content.trim()) {
      const confirmReplace = window.confirm(
        "Mô tả hiện tại đã có nội dung. Bạn có muốn THAY THẾ toàn bộ bằng mẫu này không?\n(Bấm 'OK' để thay thế, bấm 'Cancel' để nối tiếp vào cuối)"
      );
      if (confirmReplace) {
        setEditDesc(content);
      } else {
        setEditDesc(`${editDesc.trim()}\n\n${content}`);
      }
    } else {
      setEditDesc(content);
    }
  };

  const numPrice = parseInt(String(editPrice).replace(/\D/g, ""), 10) || 0;
  const priceDisplay = numPrice.toLocaleString("vi-VN") + " đ";

  // Parse inline Telegram tags: <b>, <code>, <i>
  const parseInlineTags = (str: string) => {
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

  const renderTelegramDescription = (raw: string) => {
    if (!raw.trim()) {
      return (
        <div className="py-6 text-center text-slate-500 italic text-xs">
          Chưa có nội dung mô tả... Bạn hãy chuyển sang tab Soạn thảo để nhập nội dung.
        </div>
      );
    }

    const lines = raw.split("\n");
    return (
      <div className="space-y-1.5 leading-relaxed text-xs sm:text-sm text-slate-100">
        {lines.map((line, idx) => {
          if (!line.trim()) {
            return <div key={idx} className="h-1.5" />;
          }

          const isStep = line.trim().startsWith("👉") || /^\d+\./.test(line.trim());
          const isBullet = line.trim().startsWith("- ") || line.trim().startsWith("• ");
          const isWarning = line.trim().startsWith("⚠️") || line.trim().startsWith("*");

          const formattedParts = parseInlineTags(line);

          if (isStep) {
            return (
              <div key={idx} className="flex items-start gap-1.5 bg-emerald-950/40 border border-emerald-500/25 rounded-xl px-2.5 py-1 text-emerald-200">
                <span className="font-semibold text-emerald-400">👉</span>
                <div className="flex-1 text-slate-100 text-xs">{formattedParts}</div>
              </div>
            );
          }

          if (isWarning) {
            return (
              <div key={idx} className="flex items-start gap-1.5 bg-amber-950/40 border border-amber-500/25 rounded-xl px-2.5 py-1 text-amber-200 text-xs">
                <span className="text-amber-400 font-bold">⚠️</span>
                <div className="flex-1">{formattedParts}</div>
              </div>
            );
          }

          if (isBullet) {
            return (
              <div key={idx} className="flex items-start gap-1.5 pl-1.5 text-slate-200 text-xs">
                <span className="text-emerald-400 font-bold">•</span>
                <div className="flex-1">{formattedParts}</div>
              </div>
            );
          }

          return (
            <p key={idx} className="text-xs text-slate-200">
              {formattedParts}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-5xl rounded-[28px] border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col overflow-hidden">
        {/* STICKY MODAL HEADER */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 sm:px-6 py-3.5 bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-emerald-50 text-[#0e704b] flex items-center justify-center border border-emerald-100 shadow-sm">
              <Edit className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span>Chỉnh sửa sản phẩm & Giá bán</span>
                <span className="text-xs font-mono font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                  ID: #{editingProduct.id}
                </span>
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-600 hover:bg-slate-200/80 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 2-COLUMN SPLIT VIEW FORM */}
        <form onSubmit={onUpdate} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* CỘT 1 (BÊN TRÁI - 6 PHẦN): THÔNG TIN CƠ BẢN & GIÁ */}
              <div className="lg:col-span-6 space-y-3.5 border-b lg:border-b-0 lg:border-r border-slate-200/90 lg:pr-6 pb-6 lg:pb-0">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  <span>⚙️ Cấu hình thông tin & Giá</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Tên sản phẩm *
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs sm:text-sm text-slate-900 font-semibold focus:outline-none focus:border-emerald-600 focus:bg-white"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Giá bán mới (VNĐ) *
                    </label>
                    <input
                      type="number"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs sm:text-sm text-[#0e704b] font-bold focus:outline-none focus:border-emerald-600 focus:bg-white"
                      required
                    />
                    {editingProduct.price !== parseInt(editPrice || "0", 10) && (
                      <div className="text-[11px] text-slate-600 mt-1 font-medium">
                        Giá cũ: <s className="text-rose-500">{editingProduct.price.toLocaleString("vi-VN")} đ</s>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Danh mục
                    </label>
                    <input
                      type="text"
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      list="edit-category-suggestions"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white font-medium"
                    />
                    <datalist id="edit-category-suggestions">
                      {categoriesList.map((c) => (
                        <option key={c.name} value={c.name} />
                      ))}
                      <option value="AI & Trí tuệ nhân tạo" />
                      <option value="Giải trí & Streaming" />
                      <option value="Đồ họa & Sáng tạo" />
                      <option value="Văn phòng & Công việc" />
                      <option value="Mạng & Bảo mật" />
                      <option value="Học tập & Ngoại ngữ" />
                      <option value="Dịch vụ & Tiện ích khác" />
                    </datalist>
                  </div>
                </div>

                {/* Quick categories chips */}
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  {["AI & Trí tuệ nhân tạo", "Giải trí & Streaming", "Đồ họa & Sáng tạo", "Văn phòng & Công việc", "Mạng & Bảo mật", "Học tập & Ngoại ngữ"].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setEditCategory(preset)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition border ${
                        editCategory.toLowerCase() === preset.toLowerCase()
                          ? "bg-[#0e704b] text-white border-[#0e704b]"
                          : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-[#0e704b]"
                      }`}
                    >
                      +{preset}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Lý do thay đổi giá / Ghi chú (Hiển thị dạng trích dẫn ghi chú trên Bot)
                  </label>
                  <input
                    type="text"
                    value={editPriceReason}
                    onChange={(e) => setEditPriceReason(e.target.value)}
                    placeholder="VD: Đợt hàng mới, Khuyến mãi tri ân, Nâng cấp gói..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white"
                  />
                  <p className="text-[11px] text-slate-600 mt-1">
                    Ghi chú này hiển thị dạng blockquote khi khách xem sản phẩm và trong tin broadcast bắn giá mới.
                  </p>
                </div>

                <ProductImageField id="edit-product-image" value={editProductImage} onChange={setEditProductImage} />

                {/* Nguồn cấp hàng tự động API NCC */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <Server className="h-4 w-4 text-[#0e704b]" />
                    <span>Nguồn Cấp Hàng Tự Động (RoboticVN API)</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                        Chế độ cấp hàng
                      </label>
                      <select
                        value={editFulfillmentType}
                        onChange={(e) => setEditFulfillmentType(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-600 font-medium"
                      >
                        <option value="HYBRID">Hybrid (Kho ưu tiên, hết tự mua API)</option>
                        <option value="MANUAL">Chỉ bán kho thủ công (Manual)</option>
                        <option value="API">Chỉ mua tự động qua API (API Only)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                        Mã gói NCC (API Variant ID)
                      </label>
                      <input
                        type="text"
                        placeholder="Mã variant bên NCC"
                        value={editSupplierVariantId}
                        onChange={(e) => setEditSupplierVariantId(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-2xl border border-pink-100 bg-pink-50/60 p-3">
                  <input
                    type="checkbox"
                    id="editNotify"
                    checked={editNotify}
                    onChange={(e) => setEditNotify(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-pink-600 focus:ring-pink-500 cursor-pointer"
                  />
                  <label
                    htmlFor="editNotify"
                    className="text-xs text-slate-700 cursor-pointer font-medium select-none"
                  >
                    Bắn thông báo điều chỉnh giá tới <b>{subscriberCount}</b> khách hàng qua Bot
                  </label>
                </div>
              </div>

              {/* CỘT 2 (BÊN PHẢI - 6 PHẦN): MÔ TẢ CHI TIẾT & LIVE PREVIEW BOT */}
              <div className="lg:col-span-6 flex flex-col space-y-3">
                {/* Header Cột Phải: Switcher Tab Soạn Thảo vs Xem Trước */}
                <div className="flex items-center justify-between pb-1">
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setRightTab("edit")}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition ${
                        rightTab === "edit"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <Edit3 className="h-3.5 w-3.5 text-[#0e704b]" />
                      <span>Soạn thảo mô tả</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRightTab("preview")}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition ${
                        rightTab === "preview"
                          ? "bg-[#1e293b] text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <Smartphone className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Xem trước Bot Telegram</span>
                    </button>
                  </div>

                  <span className="text-[11px] font-semibold text-slate-600 hidden sm:inline">
                    {editDesc.length} ký tự
                  </span>
                </div>

                {rightTab === "edit" ? (
                  /* GIAO DIỆN SOẠN THẢO */
                  <div className="space-y-3">
                    {/* Quick template chips */}
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                          <FileText className="h-3 w-3 text-[#0e704b]" />
                          <span>Mẫu mô tả có sẵn (1-chạm):</span>
                        </span>
                        <span className="text-[10px] text-slate-600">Bấm để chèn nhanh</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {TEMPLATES.map((tpl) => (
                          <button
                            key={tpl.title}
                            type="button"
                            onClick={() => applyTemplate(tpl.content)}
                            className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-white hover:bg-emerald-50 hover:text-[#0e704b] hover:border-emerald-300 border border-slate-200 text-slate-700 transition shadow-2xs"
                          >
                            + {tpl.title}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Toolbar nhanh */}
                    <div className="flex flex-wrap items-center gap-1 p-1.5 bg-slate-100 rounded-xl border border-slate-200 text-slate-700">
                      <button
                        type="button"
                        onClick={() => insertFormatting("<b>", "</b>")}
                        className="p-1 hover:bg-white rounded-lg transition font-bold text-xs"
                        title="In đậm (Bold)"
                      >
                        <Bold className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting("<i>", "</i>")}
                        className="p-1 hover:bg-white rounded-lg transition"
                        title="In nghiêng (Italic)"
                      >
                        <Italic className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting("<code>", "</code>")}
                        className="p-1 hover:bg-white rounded-lg transition text-xs font-mono font-bold"
                        title="Mã hoặc Key (Code)"
                      >
                        <Code className="h-3.5 w-3.5" />
                      </button>
                      <div className="h-3.5 w-px bg-slate-300 mx-1" />
                      <button
                        type="button"
                        onClick={() => insertFormatting("- ")}
                        className="px-2 py-0.5 hover:bg-white rounded-lg transition text-xs font-medium flex items-center gap-1"
                      >
                        <List className="h-3 w-3" />
                        <span>• Gạch đầu dòng</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting("👉 Bước : ")}
                        className="px-2 py-0.5 hover:bg-white rounded-lg transition text-xs font-bold text-[#0e704b]"
                      >
                        👉 Bước
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting("⚠️ Lưu ý: ")}
                        className="px-2 py-0.5 hover:bg-white rounded-lg transition text-xs font-bold text-amber-600"
                      >
                        ⚠️ Lưu ý
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting("<blockquote>", "</blockquote>")}
                        className="p-1 hover:bg-white rounded-lg transition"
                        title="Trích dẫn (Quote)"
                      >
                        <Quote className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Textarea to rộng rãi */}
                    <div>
                      <textarea
                        ref={textareaRef}
                        rows={10}
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Nhập thông tin chi tiết, định dạng tài khoản, hướng dẫn sử dụng và lưu ý tại đây..."
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs sm:text-sm font-mono leading-relaxed text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white custom-scrollbar shadow-inner"
                      />
                    </div>

                    {/* Chính sách bảo hành */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                        <span>Chính sách bảo hành</span>
                        <span className="text-[10px] text-slate-600 font-normal">Gửi kèm trong tin nhắn sau thanh toán</span>
                      </label>
                      <textarea
                        rows={3}
                        value={editWarranty}
                        onChange={(e) => setEditWarranty(e.target.value)}
                        placeholder={'⏱ BẢO HÀNH 1 GIỜ TỪ THANH TOÁN THÀNH CÔNG\n⏱ Hạn gửi hỗ trợ: trong 1 giờ kể từ lúc đơn được xác nhận.'}
                        className="w-full rounded-xl border border-violet-200 bg-violet-50/50 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-violet-400 focus:bg-white"
                      />
                    </div>
                  </div>
                ) : (
                  /* GIAO DIỆN XEM TRƯỚC TELEGRAM BOT (LIVE PREVIEW) */
                  <div className="rounded-2xl bg-[#1e293b] border border-[#334155] p-4 text-slate-100 shadow-xl space-y-2.5 max-h-[500px] overflow-y-auto custom-scrollbar">
                    {/* Header bot */}
                    <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center font-bold text-white text-xs shadow">
                          R
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-xs text-white">RINQ SHOP</span>
                            <span className="h-3 w-3 bg-blue-500 text-white rounded-full flex items-center justify-center text-[8px] font-black">
                              ✓
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400">bot tự động</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-mono">Xem trước thực tế</span>
                    </div>

                    {/* Body message */}
                    <div className="space-y-1.5 text-xs">
                      <p className="font-bold text-white text-sm">
                        ❖ {(editName || "TÊN SẢN PHẨM").toUpperCase()}
                      </p>
                      <p className="text-emerald-400 font-semibold">
                        • <b>Đơn giá:</b> {priceDisplay} / sản phẩm
                      </p>
                      <p className="text-slate-300">
                        • <b>Tình trạng:</b> 🟢 Sẵn hàng (Giao tức thì 24/7)
                      </p>

                      {editPriceReason ? (
                        <blockquote className="border-l-2 border-emerald-500 pl-2 text-slate-300 italic text-[11px] bg-slate-900/40 py-0.5 rounded-r">
                          📝 <b>Ghi chú:</b> {editPriceReason}
                        </blockquote>
                      ) : null}

                      <div className="pt-2 border-t border-slate-700/60">
                        <p className="font-bold text-slate-200 mb-1 flex items-center gap-1">
                          <span>📝</span> <b>Thông tin & Mô tả chi tiết:</b>
                        </p>
                        <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-800">
                          {renderTelegramDescription(editDesc)}
                        </div>
                      </div>

                      {editWarranty ? (
                        <div className="pt-1.5">
                          <blockquote className="border-l-2 border-violet-400 pl-2.5 py-1 text-[11px] text-violet-200 bg-violet-950/30 rounded-r">
                            🛡️ <b>CHÍNH SÁCH BẢO HÀNH:</b>
                            <br />
                            {editWarranty}
                          </blockquote>
                        </div>
                      ) : null}

                      <p className="text-[11px] text-slate-400 italic pt-1">
                        Kính mời Quý khách lựa chọn nút bên dưới để tiến hành thanh toán:
                      </p>
                    </div>

                    {/* Buttons simulation */}
                    <div className="space-y-1 pt-1.5">
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="py-1.5 px-2 rounded-xl bg-slate-700/80 text-slate-200 text-[11px] font-semibold text-center border border-slate-600/40">
                          💳 Mua ngay
                        </div>
                        <div className="py-1.5 px-2 rounded-xl bg-slate-700/80 text-slate-200 text-[11px] font-semibold text-center border border-slate-600/40">
                          🏷 Dùng mã giảm giá
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* STICKY BOTTOM ACTIONS FOOTER */}
          <div className="border-t border-slate-100 px-5 sm:px-6 py-3 bg-slate-50/80 flex items-center justify-between">
            <span className="text-[11px] text-slate-600 font-medium hidden sm:inline">
              ✨ Giao diện 2 cột Split-View giúp bạn vừa soạn thảo vừa xem trước mô tả dễ dàng
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isUpdating}
                className="rounded-full bg-[#0e704b] hover:bg-[#0a5c3d] px-6 py-2 text-xs font-bold text-white transition shadow-sm disabled:opacity-50 active:scale-95 flex items-center gap-1.5"
              >
                {isUpdating ? "Đang lưu..." : "Lưu & Áp dụng"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
