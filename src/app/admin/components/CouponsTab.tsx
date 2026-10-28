"use client";

import React from "react";
import { Tag, Edit, Eye, EyeOff, Trash2, Plus } from "lucide-react";
import { Coupon } from "../types";

interface CouponsTabProps {
  coupons: Coupon[];
  onOpenEditModal: (c: Coupon) => void;
  onToggleCoupon: (id: number, currentStatus: number) => void;
  onDeleteCoupon: (id: number) => void;
  newCouponCode: string;
  setNewCouponCode: (val: string) => void;
  newCouponDiscount: string;
  setNewCouponDiscount: (val: string) => void;
  newCouponIsPercent: boolean;
  setNewCouponIsPercent: (val: boolean) => void;
  newCouponMaxUsage: string;
  setNewCouponMaxUsage: (val: string) => void;
  onCreateCoupon: (e: React.FormEvent) => void;
}

export default function CouponsTab({
  coupons,
  onOpenEditModal,
  onToggleCoupon,
  onDeleteCoupon,
  newCouponCode,
  setNewCouponCode,
  newCouponDiscount,
  setNewCouponDiscount,
  newCouponIsPercent,
  setNewCouponIsPercent,
  newCouponMaxUsage,
  setNewCouponMaxUsage,
  onCreateCoupon,
}: CouponsTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
      {/* Danh sách Coupons (8 cols) */}
      <div className="lg:col-span-8 bg-white rounded-[28px] border border-slate-200 p-5 sm:p-6 shadow-sm transition-all hover:shadow-md hover:border-slate-300">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Tag className="h-5 w-5 text-[#0e704b]" />
              <span>Mã giảm giá (Coupons)</span>
            </h2>
            <p className="text-xs text-slate-600 font-medium">Áp dụng tự động trong bot</p>
          </div>
          <span className="text-xs font-bold rounded-full bg-emerald-50 text-[#0e704b] border border-emerald-100 px-3 py-1">
            {coupons.filter((c) => c.isActive === 1).length} đang kích hoạt
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {coupons.map((c) => (
            <div
              key={c.id}
              className={`p-4 rounded-2xl border transition-all ${
                c.isActive === 1
                  ? "bg-white border-slate-200/80 shadow-sm hover:shadow-md hover:-translate-y-0.5"
                  : "bg-slate-50 border-slate-200 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono font-black text-base text-[#0e704b] bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-100">
                  {c.code}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onOpenEditModal(c)}
                    className="p-1 text-slate-600 hover:text-[#0e704b]"
                    title="Chỉnh sửa mã & reset lượt dùng"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onToggleCoupon(c.id, c.isActive)}
                    className="p-1 text-slate-600 hover:text-slate-900"
                    title="Bật/Tắt"
                  >
                    {c.isActive === 1 ? <Eye className="h-4 w-4 text-[#0e704b]" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => onDeleteCoupon(c.id)}
                    className="p-1 text-rose-500 hover:text-rose-700"
                    title="Xóa"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="text-lg font-extrabold text-slate-900 my-1">
                Giảm {c.isPercent === 1 ? `${c.discount}%` : `${c.discount.toLocaleString("vi-VN")} đ`}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600 pt-2 border-t border-slate-100 mt-2 font-medium">
                <span>Đã dùng: <b>{c.usedCount}</b> / {c.maxUsage}</span>
                <span className="inline-flex items-center gap-1.5 font-bold">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      c.isActive === 1 ? "bg-emerald-500" : "bg-rose-500"
                    }`}
                  />
                  <span className={c.isActive === 1 ? "text-emerald-700" : "text-rose-600"}>
                    {c.isActive === 1 ? "Đang mở" : "Đang tắt"}
                  </span>
                </span>
              </div>
            </div>
          ))}

          {coupons.length === 0 && (
            <div className="col-span-2 py-8 text-center text-slate-600 text-xs">
              Chưa có mã giảm giá nào. Hãy tạo mã đầu tiên ở cột bên phải!
            </div>
          )}
        </div>
      </div>

      {/* Form Tạo Mã Giảm Giá (4 cols) */}
      <div className="lg:col-span-4 bg-white rounded-[28px] border border-slate-200 p-5 sm:p-6 shadow-sm transition-all hover:shadow-md hover:border-slate-300">
        <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-2 mb-3">
          <Plus className="h-4 w-4 text-[#0e704b]" />
          <span>Tạo mã giảm giá mới</span>
        </h3>

        <form onSubmit={onCreateCoupon} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Mã Code (viết liền không dấu) *
            </label>
            <input
              type="text"
              placeholder="VD: RINQ10, TRIAN50..."
              value={newCouponCode}
              onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
              className="w-full font-mono uppercase rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Mức giảm *
              </label>
              <input
                type="number"
                placeholder="10 hoặc 20000"
                value={newCouponDiscount}
                onChange={(e) => setNewCouponDiscount(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-[#0e704b] focus:outline-none focus:border-emerald-600"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Loại giảm
              </label>
              <select
                value={newCouponIsPercent ? "percent" : "fixed"}
                onChange={(e) => setNewCouponIsPercent(e.target.value === "percent")}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-600"
              >
                <option value="percent">Phần trăm (%)</option>
                <option value="fixed">Số tiền (VNĐ)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Số lượt dùng tối đa
            </label>
            <input
              type="number"
              placeholder="100"
              value={newCouponMaxUsage}
              onChange={(e) => setNewCouponMaxUsage(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-full bg-[#0e704b] hover:bg-[#0a5c3d] text-white py-2.5 text-xs font-bold transition shadow-sm active:scale-95"
          >
            + Tạo mã giảm giá ngay
          </button>
        </form>
      </div>
    </div>
  );
}

