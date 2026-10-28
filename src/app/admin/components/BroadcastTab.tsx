"use client";

import React from "react";
import { Package, Send, Bell } from "lucide-react";
import { Product, Stats } from "../types";

interface BroadcastTabProps {
  products: Product[];
  stats: Stats;
  customBroadcastMsg: string;
  setCustomBroadcastMsg: (val: string) => void;
  isBroadcasting: boolean;
  onNotifyProduct: (id: number, name: string) => void;
  onCustomBroadcast: (e: React.FormEvent) => void;
}

export default function BroadcastTab({
  products,
  stats,
  customBroadcastMsg,
  setCustomBroadcastMsg,
  isBroadcasting,
  onNotifyProduct,
  onCustomBroadcast,
}: BroadcastTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
      {/* Box 1: Bắn thông báo hàng về theo sản phẩm (7 cols) */}
      <div className="lg:col-span-7 bg-white rounded-[28px] border border-slate-200 p-5 sm:p-6 shadow-sm transition-all hover:shadow-md hover:border-slate-300">
        <div className="mb-4">
          <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-2">
            <Package className="h-5 w-5 text-[#0e704b]" />
            <span>Bắn thông báo hàng về (Restock Alert)</span>
          </h3>
          <p className="text-xs text-slate-600 font-medium mt-1">
            Bấm nút bắn thông báo bên cạnh sản phẩm để gửi tin kèm nút "Mua ngay" cho toàn bộ <b>{stats.subscriberCount ?? 0}</b> khách hàng
          </p>
        </div>

        <div className="space-y-3">
          {products.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition"
            >
              <div>
                <div className="font-bold text-xs sm:text-sm text-slate-900">{p.name}</div>
                <div className="text-[11px] text-slate-600 font-medium mt-0.5">
                  Tồn kho: <b className="text-[#0e704b]">{p.stockAvailable}</b> · Giá: {p.price.toLocaleString("vi-VN")} đ
                </div>
              </div>

              <button
                onClick={() => onNotifyProduct(p.id, p.name)}
                className="flex items-center gap-1.5 rounded-full bg-pink-600 hover:bg-pink-700 text-white px-3.5 py-1.5 text-xs font-bold transition shadow-sm active:scale-95"
              >
                <Send className="h-3 w-3" />
                <span>Bắn thông báo</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Box 2: Bắn tin nhắn tùy chỉnh (5 cols) */}
      <div className="lg:col-span-5 bg-white rounded-[28px] border border-slate-200 p-5 sm:p-6 shadow-sm transition-all hover:shadow-md hover:border-slate-300">
        <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-2 mb-2">
          <Bell className="h-5 w-5 text-pink-600" />
          <span>Bắn tin nhắn tùy chỉnh</span>
        </h3>
        <p className="text-xs text-slate-600 font-medium mb-3">
          Gửi thông báo bảo trì, tri ân, khuyến mãi bất kỳ vào Telegram của từng khách.
        </p>

        <form onSubmit={onCustomBroadcast} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Nội dung thông báo * (Hỗ trợ HTML: &lt;b&gt;, &lt;i&gt;, &lt;code&gt;)
            </label>
            <textarea
              rows={5}
              placeholder={`🔥 SHOP BẢO TRÌ NÂNG CẤP HỆ THỐNG...\n\nXin chào quý khách, shop sẽ tạm bảo trì trong 15 phút.`}
              value={customBroadcastMsg}
              onChange={(e) => setCustomBroadcastMsg(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-900 focus:outline-none focus:border-pink-600"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isBroadcasting}
            className="w-full rounded-full bg-pink-600 hover:bg-pink-700 text-white py-2.5 text-xs font-bold transition shadow-md shadow-pink-600/20 disabled:opacity-50 active:scale-95"
          >
            {isBroadcasting ? "Đang gửi..." : `Bắn tới ${stats.subscriberCount ?? 0} khách hàng ngay`}
          </button>
        </form>
      </div>
    </div>
  );
}

