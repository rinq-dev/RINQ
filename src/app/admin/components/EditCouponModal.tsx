"use client";

import React from "react";
import { Tag, X, RotateCcw } from "lucide-react";
import { Coupon } from "../types";

interface EditCouponModalProps {
  editingCoupon: Coupon | null;
  onClose: () => void;
  editCouponCode: string;
  setEditCouponCode: (val: string) => void;
  editCouponDiscount: string;
  setEditCouponDiscount: (val: string) => void;
  editCouponIsPercent: boolean;
  setEditCouponIsPercent: (val: boolean) => void;
  editCouponMaxUsage: string;
  setEditCouponMaxUsage: (val: string) => void;
  editCouponUsedCount: string;
  setEditCouponUsedCount: (val: string) => void;
  onUpdate: (e: React.FormEvent) => void;
}

export default function EditCouponModal({
  editingCoupon,
  onClose,
  editCouponCode,
  setEditCouponCode,
  editCouponDiscount,
  setEditCouponDiscount,
  editCouponIsPercent,
  setEditCouponIsPercent,
  editCouponMaxUsage,
  setEditCouponMaxUsage,
  editCouponUsedCount,
  setEditCouponUsedCount,
  onUpdate,
}: EditCouponModalProps) {
  if (!editingCoupon) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-[28px] border border-slate-100 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Tag className="h-5 w-5 text-[#0e704b]" />
            <span>Chỉnh sửa mã giảm giá</span>
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
              Mã Code (viết hoa không dấu)
            </label>
            <input
              type="text"
              value={editCouponCode}
              onChange={(e) => setEditCouponCode(e.target.value.toUpperCase())}
              className="w-full font-mono uppercase rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Mức giảm
              </label>
              <input
                type="number"
                value={editCouponDiscount}
                onChange={(e) => setEditCouponDiscount(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-[#0e704b] focus:outline-none focus:border-emerald-600"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Loại giảm
              </label>
              <select
                value={editCouponIsPercent ? "percent" : "fixed"}
                onChange={(e) => setEditCouponIsPercent(e.target.value === "percent")}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
              >
                <option value="fixed">Tiền cố định (VNĐ)</option>
                <option value="percent">Phần trăm (%)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Lượt dùng tối đa
              </label>
              <input
                type="number"
                value={editCouponMaxUsage}
                onChange={(e) => setEditCouponMaxUsage(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-600"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Lượt đã dùng
              </label>
              <input
                type="number"
                value={editCouponUsedCount}
                onChange={(e) => setEditCouponUsedCount(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-600"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-emerald-50/70 p-3 border border-emerald-100">
            <span className="text-xs text-slate-700 font-medium">
              Đã sử dụng: <b>{editCouponUsedCount}</b> / {editCouponMaxUsage} lượt
            </span>
            <button
              type="button"
              onClick={() => setEditCouponUsedCount("0")}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0e704b] text-white text-[11px] font-bold shadow-sm hover:bg-[#0a5c3d] transition active:scale-95"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Đặt lại về 0</span>
            </button>
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
              className="rounded-full bg-[#0e704b] hover:bg-[#0a5c3d] px-5 py-2 text-xs font-bold text-white transition shadow-sm"
            >
              Lưu thay đổi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

