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
    content: `- Dinh dang: email | link_lay_otp
- Dang nhap bang OTP (khong can mat khau), nhap email roi lay ma OTP tai link
[Buoc 1]: Mo ung dung/trang chu va nhap email duoc he thong cap, sau do bam Tiep tuc
[Buoc 2]: Mo mot tab trinh duyet moi, dan link lay OTP de nhan ma xac thuc 6 so
[Buoc 3]: Nhap ma OTP vao trang dich vu de hoan tat dang nhap
Luu y: Bao hanh dang nhap thanh cong trong 1 gio tu khi mua. Vui long kiem tra tai khoan ngay sau khi nhan hang.`,
  },
  {
    title: "Acc Mail : Pass : 2FA",
    content: `- Dinh dang: email | mat_khau | ma_2fa_secret
[Buoc 1]: Dang nhap bang Email va Mat khau duoc cap
[Buoc 2]: Tai man hinh yeu cau ma 2FA, truy cap trang https://2fa.live (hoac app Google Authenticator)
[Buoc 3]: Dan ma 2FA Secret vao de lay ma 6 chu so dang chay
[Buoc 4]: Nhap ma 6 so de dang nhap thanh cong
Luu y: Khong tu y thay doi email/mat khau de duoc bao hanh toan thoi gian.`,
  },
  {
    title: "Key Ban Quyen",
    content: `- Dinh dang: Ma ban quyen License Key (XXXXX-XXXXX-XXXXX-XXXXX)
[Buoc 1]: Tai bo cai dat phan mem chinh hang tu trang chu nha phat hanh
[Buoc 2]: Cai dat va mo ung dung, tim muc "Cai dat" -> "Kich hoat ban quyen" (Activate License)
[Buoc 3]: Dan ma ban quyen da mua va bam Xac nhan
Luu y: Moi key su dung cho 1 thiet bi/tai khoan theo goi da chon. Cam ket bao hanh 1 doi 1 suot thoi han goi.`,
  },
  {
    title: "Nang Cap Chinh Chu",
    content: `- Hinh thuc: Nang cap truc tiep tren tai khoan email chinh chu cua Quy khach
[Buoc 1]: Sau khi thanh toan, gui email tai khoan cua Quy khach cho Admin/Bot
[Buoc 2]: Kiem tra hom thu den (hoac hom thu Spam/Rac) de nhan email loi moi
[Buoc 3]: Bam vao duong link trong email de chap nhan tham gia goi dich vu
Luu y: RINQ SHOP tuyet doi khong yeu cau mat khau tai khoan cua Quy khach. Dam bao an toan 100%.`,
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
        "Mo ta hien tai da co noi dung. Ban co muon thay the toan bo bang mau nay khong?\n(Bam OK de thay the, bam Cancel de noi tiep vao cuoi)"
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
  const priceDisplay = numPrice.toLocaleString("vi-VN") + " d";

  const parseInlineTags = (str: string) => {
    const parts = [];
    let remaining = str;
    let keyIdx = 0;
    const regex = /(?:<a\s+(?:[^>]*?\s+)?href=["']([^"']+)["'][^>]*>(.*?)<\/a>|<b>(.*?)<\/b>|<code>(.*?)<\/code>|<i>(.*?)<\/i>|\*\*(.*?)\*\*|`([^`]+)`|(https?:\/\/[^\s<>)"]+))/i;

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
      if (fullMatch.startsWith("<a") || fullMatch.startsWith("<A")) {
        const href = match[1] || "#";
        const label = match[2] || href;
        parts.push(
          <a
            key={keyIdx++}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-sky-400 font-mono text-[11px] underline break-all select-all inline hover:text-sky-300"
          >
            {label}
          </a>
        );
      } else if (fullMatch.startsWith("http://") || fullMatch.startsWith("https://")) {
        parts.push(
          <a
            key={keyIdx++}
            href={fullMatch}
            target="_blank"
            rel="noreferrer"
            className="text-sky-400 font-mono text-[11px] underline break-all select-all inline hover:text-sky-300"
          >
            {fullMatch}
          </a>
        );
      } else if (fullMatch.startsWith("<b>") || fullMatch.startsWith("**")) {
        const inner = match[3] || match[6] || "";
        parts.push(
          <strong key={keyIdx++} className="font-bold text-white">
            {inner}
          </strong>
        );
      } else if (fullMatch.startsWith("<code>") || fullMatch.startsWith("`")) {
        const inner = match[4] || match[7] || "";
        parts.push(
          <code
            key={keyIdx++}
            className="bg-black/50 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono text-xs mx-0.5"
          >
            {inner}
          </code>
        );
      } else if (fullMatch.startsWith("<i>")) {
        const inner = match[5] || "";
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
          Chua co noi dung mo ta. Ban hay chuyen sang tab Soan thao de nhap noi dung.
        </div>
      );
    }

    const lines = raw.split("\n");
    return (
      <div className="space-y-1.5 leading-relaxed text-xs sm:text-sm text-slate-100 break-words">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return <div key={idx} className="h-1.5" />;
          }

          const isStep = /^(\[Buoc|\d+\.|Buoc)/i.test(trimmed);
          const isBullet = trimmed.startsWith("- ") || trimmed.startsWith("• ");
          const isWarning = /^(Luu y|\*)/i.test(trimmed);

          if (isStep) {
            const stepMatch = trimmed.match(/^(\[Buoc\s*\d*\]|\d+\.|Buoc\s*\d*)\s*[:.-]?\s*(.*)$/i);
            const stepPrefix = stepMatch ? stepMatch[1] : "[>]";
            const stepBody = stepMatch ? stepMatch[2] : trimmed;
            return (
              <div key={idx} className="flex items-start gap-1.5 bg-emerald-950/40 border border-emerald-500/25 rounded-xl px-2.5 py-1 text-emerald-200">
                <span className="font-semibold text-emerald-400 shrink-0">{stepPrefix}</span>
                <div className="flex-1 text-slate-100 text-xs break-words">{parseInlineTags(stepBody)}</div>
              </div>
            );
          }

          if (isWarning) {
            let cleanWarn = trimmed;
            if (cleanWarn.startsWith("* ")) cleanWarn = cleanWarn.substring(2);
            return (
              <div key={idx} className="flex items-start gap-1.5 bg-amber-950/40 border border-amber-500/25 rounded-xl px-2.5 py-1 text-amber-200 text-xs">
                <span className="text-amber-400 font-bold shrink-0">[!]</span>
                <div className="flex-1 break-words">{parseInlineTags(cleanWarn)}</div>
              </div>
            );
          }

          if (isBullet) {
            let cleanBullet = trimmed;
            if (cleanBullet.startsWith("- ")) cleanBullet = cleanBullet.substring(2);
            else if (cleanBullet.startsWith("• ")) cleanBullet = cleanBullet.substring(2);
            return (
              <div key={idx} className="flex items-start gap-1.5 pl-1 text-slate-200 text-xs">
                <span className="text-emerald-400 font-bold shrink-0">•</span>
                <div className="flex-1 break-words">{parseInlineTags(cleanBullet)}</div>
              </div>
            );
          }

          return (
            <p key={idx} className="text-xs text-slate-200 break-words">
              {parseInlineTags(trimmed)}
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
                <span>Chinh sua san pham &amp; Gia ban</span>
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
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* COT 1 (BEN TRAI - 6 PHAN): THONG TIN CO BAN & GIA */}
              <div className="lg:col-span-6 space-y-3.5 border-b lg:border-b-0 lg:border-r border-slate-200/90 lg:pr-6 pb-6 lg:pb-0">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  <span>Cau hinh thong tin &amp; Gia ban</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Ten san pham *
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
                      Gia ban moi (VND) *
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
                        Gia cu: <s className="text-rose-500">{editingProduct.price.toLocaleString("vi-VN")} d</s>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Danh muc
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
                    Ly do thay doi gia / Ghi chu tren Bot
                  </label>
                  <input
                    type="text"
                    value={editPriceReason}
                    onChange={(e) => setEditPriceReason(e.target.value)}
                    placeholder="VD: Dot hang moi, Tri an khach hang, Nang cap goi..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white"
                  />
                  <p className="text-[11px] text-slate-600 mt-1">
                    Ghi chu nay se duoc hien thi dang trích dan khi khach xem san pham tren Bot.
                  </p>
                </div>

                <ProductImageField id="edit-product-image" value={editProductImage} onChange={setEditProductImage} />

                {/* Nguon cap hang tu dong API NCC */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <Server className="h-4 w-4 text-[#0e704b]" />
                    <span>Nguon Cap Hang Tu Dong (RoboticVN API)</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                        Che do cap hang
                      </label>
                      <select
                        value={editFulfillmentType}
                        onChange={(e) => setEditFulfillmentType(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-600 font-medium"
                      >
                        <option value="HYBRID">Hybrid (Kho uu tien, het tu mua API)</option>
                        <option value="MANUAL">Chi ban kho thu cong (Manual)</option>
                        <option value="API">Chi mua tu dong qua API (API Only)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                        Ma goi NCC (API Variant ID)
                      </label>
                      <input
                        type="text"
                        placeholder="Ma variant ben NCC"
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
                    Ban thong bao dieu chinh gia toi <b>{subscriberCount}</b> khach hang qua Bot
                  </label>
                </div>
              </div>

              {/* COT 2 (BEN PHAI - 6 PHAN): MO TA CHI TIET & PREVIEW BOT */}
              <div className="lg:col-span-6 flex flex-col space-y-3">
                {/* Header Cot Phai: Switcher Tab Soan Thao vs Xem Truoc */}
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
                      <span>Soan thao mo ta</span>
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
                      <span>Xem truoc Bot Telegram</span>
                    </button>
                  </div>

                  <span className="text-[11px] font-semibold text-slate-600 hidden sm:inline">
                    {editDesc.length} ky tu
                  </span>
                </div>

                {rightTab === "edit" ? (
                  /* GIAO DIEN SOAN THAO */
                  <div className="space-y-3">
                    {/* Quick template chips */}
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                          <FileText className="h-3 w-3 text-[#0e704b]" />
                          <span>Mau mo ta co san:</span>
                        </span>
                        <span className="text-[10px] text-slate-600">Bam de chen nhanh</span>
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
                        title="In dam"
                      >
                        <Bold className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting("<i>", "</i>")}
                        className="p-1 hover:bg-white rounded-lg transition"
                        title="In nghieng"
                      >
                        <Italic className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting("<code>", "</code>")}
                        className="p-1 hover:bg-white rounded-lg transition text-xs font-mono font-bold"
                        title="Ma / Key"
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
                        <span>Gach dau dong</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting("[Buoc ]: ")}
                        className="px-2 py-0.5 hover:bg-white rounded-lg transition text-xs font-bold text-[#0e704b]"
                      >
                        Buoc
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting("Luu y: ")}
                        className="px-2 py-0.5 hover:bg-white rounded-lg transition text-xs font-bold text-amber-700"
                      >
                        Luu y
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting("<blockquote>", "</blockquote>")}
                        className="p-1 hover:bg-white rounded-lg transition"
                        title="Trich dan"
                      >
                        <Quote className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Textarea to rong rai */}
                    <div>
                      <textarea
                        ref={textareaRef}
                        rows={10}
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Nhap thong tin chi tiet, dinh dang tai khoan, huong dan su dung va luu y tai day..."
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs sm:text-sm font-mono leading-relaxed text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white custom-scrollbar shadow-inner"
                      />
                    </div>

                    {/* Chinh sach bao hanh */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                        <span>Chinh sach bao hanh</span>
                        <span className="text-[10px] text-slate-600 font-normal">Gui kem trong tin nhan sau thanh toan</span>
                      </label>
                      <textarea
                        rows={3}
                        value={editWarranty}
                        onChange={(e) => setEditWarranty(e.target.value)}
                        placeholder="BAO HANH 1 GIO TU THANH TOAN THANH CONG. Han gui ho tro: trong 1 gio ke tu luc don duoc xac nhan."
                        className="w-full rounded-xl border border-violet-200 bg-violet-50/50 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-violet-400 focus:bg-white"
                      />
                    </div>
                  </div>
                ) : (
                  /* GIAO DIEN XEM TRUOC TELEGRAM BOT */
                  <div className="rounded-2xl bg-[#1e293b] border border-[#334155] p-4 text-slate-100 shadow-xl space-y-3">
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
                              v
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400">bot tu dong</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-mono">Xem truoc</span>
                    </div>

                    {/* Body message */}
                    <div className="space-y-2 text-xs">
                      <p className="font-bold text-white text-sm break-words">
                        [RINQ] {(editName || "TEN SAN PHAM").toUpperCase()}
                      </p>
                      <p className="text-emerald-400 font-semibold">
                        - <b>Don gia:</b> {priceDisplay} / san pham
                      </p>
                      <p className="text-slate-300">
                        - <b>Tinh trang:</b> San hang (Giao tu dong 24/7)
                      </p>

                      {editPriceReason ? (
                        <blockquote className="border-l-2 border-emerald-500 pl-2 text-slate-300 italic text-[11px] bg-slate-900/40 py-0.5 rounded-r break-words">
                          <b>Ghi chu:</b> {editPriceReason}
                        </blockquote>
                      ) : null}

                      <div className="pt-2 border-t border-slate-700/60">
                        <p className="font-bold text-slate-200 mb-1 flex items-center gap-1">
                          <b>Thong tin &amp; Mo ta chi tiet:</b>
                        </p>
                        <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-800">
                          {renderTelegramDescription(editDesc)}
                        </div>
                      </div>

                      {editWarranty ? (
                        <div className="pt-1.5">
                          <blockquote className="border-l-2 border-violet-400 pl-2.5 py-1 text-[11px] text-violet-200 bg-violet-950/30 rounded-r break-words">
                            <b>CHINH SACH BAO HANH:</b>
                            <br />
                            {editWarranty}
                          </blockquote>
                        </div>
                      ) : null}

                      <p className="text-[11px] text-slate-400 italic pt-1">
                        Kinh moi Quy khach lua chon nut ben duoi de tien hanh thanh toan:
                      </p>
                    </div>

                    {/* Buttons simulation */}
                    <div className="space-y-1.5 pt-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="py-2.5 px-3 rounded-xl bg-slate-700/90 text-slate-100 text-xs font-bold text-center border border-slate-600/50 shadow-sm">
                          Mua ngay
                        </div>
                        <div className="py-2.5 px-3 rounded-xl bg-slate-700/90 text-slate-100 text-xs font-bold text-center border border-slate-600/50 shadow-sm">
                          Dung ma giam gia
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
              Giao dien 2 cot Split-View giup soan thao va xem truoc mo ta truc quan
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Huy
              </button>
              <button
                type="submit"
                disabled={isUpdating}
                className="rounded-full bg-[#0e704b] hover:bg-[#0a5c3d] px-6 py-2 text-xs font-bold text-white transition shadow-sm disabled:opacity-50 active:scale-95 flex items-center gap-1.5"
              >
                {isUpdating ? "Dang luu..." : "Luu & Ap dung"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
