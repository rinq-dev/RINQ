"use client";

import React from "react";
import { Edit, X, Server } from "lucide-react";
import { Product } from "../types";

interface EditProductModalProps {
  editingProduct: Product | null;
  onClose: () => void;
  editName: string;
  setEditName: (val: string) => void;
  editPrice: string;
  setEditPrice: (val: string) => void;
  editDesc: string;
  setEditDesc: (val: string) => void;
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

export default function EditProductModal({
  editingProduct,
  onClose,
  editName,
  setEditName,
  editPrice,
  setEditPrice,
  editDesc,
  setEditDesc,
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
  if (!editingProduct) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-[28px] border border-slate-100 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Edit className="h-5 w-5 text-[#0e704b]" />
            <span>Chỉnh sửa sản phẩm & Giá bán</span>
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onUpdate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Tên sản phẩm *
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 font-semibold focus:outline-none focus:border-emerald-600"
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
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-[#0e704b] font-bold focus:outline-none focus:border-emerald-600"
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
                Danh mục (VD: Gemini, Netflix...)
              </label>
              <input
                type="text"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                list="edit-category-suggestions"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-600 font-medium"
              />
              <datalist id="edit-category-suggestions">
                {categoriesList.map((c) => (
                  <option key={c.name} value={c.name} />
                ))}
                <option value="Gemini" />
                <option value="Netflix" />
                <option value="ChatGPT" />
                <option value="Canva" />
                <option value="Youtube Premium" />
                <option value="Spotify" />
              </datalist>
              <div className="flex flex-wrap items-center gap-1 mt-1.5">
                {["Gemini", "Netflix", "ChatGPT", "Canva", "Youtube Premium", "Spotify"].map((preset) => (
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
            </div>
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
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
            />
            <p className="text-[11px] text-slate-600 mt-1">
              Ghi chú này sẽ được hiển thị dạng blockquote trích dẫn khi khách xem sản phẩm và trong tin broadcast bắn giá mới.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center justify-between">
              <span>Ảnh sản phẩm (URL Banner/Thumbnail)</span>
              <span className="text-[10px] text-slate-400 font-normal">Tùy chọn</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={editProductImage}
                onChange={(e) => setEditProductImage(e.target.value)}
                placeholder="https://... link ảnh banner"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 font-mono"
              />
              {editProductImage && (
                <img
                  src={editProductImage}
                  alt="Preview"
                  className="h-8 w-8 rounded-lg object-cover border border-slate-200 shrink-0 shadow-xs"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Hiển thị dạng ảnh banner phía trên chi tiết sản phẩm trên Telegram Bot.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Mô tả sản phẩm
            </label>
            <textarea
              rows={2}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
            />
          </div>

          {/* Nguồn cấp hàng tự động API NCC */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
              <Server className="h-4 w-4 text-[#0e704b]" />
              <span>Nguồn Cấp Hàng Tự Động (API LikeSub3s)</span>
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
            <p className="text-[10px] text-slate-500">
              Hệ thống tự động liên kết nguồn cấp với NCC. Khách mua nhận hàng tức thì và hoàn toàn không biết nguồn gốc hàng.
            </p>
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
              Bắn thông báo giá mới kèm lý do ngay lập tức tới <b>{subscriberCount}</b> khách hàng
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
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
              className="rounded-full bg-[#0e704b] hover:bg-[#0a5c3d] px-5 py-2 text-xs font-bold text-white transition shadow-sm disabled:opacity-50"
            >
              {isUpdating ? "Đang lưu..." : "Lưu & Áp dụng"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

