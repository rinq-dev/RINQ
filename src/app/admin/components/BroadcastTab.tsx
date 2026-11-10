"use client";

import React from "react";
import { Package, Send, Bell, Image as ImageIcon, Link2 } from "lucide-react";
import { Product, Stats } from "../types";

interface BroadcastTabProps {
  products: Product[];
  stats: Stats;
  broadcastTitle: string;
  setBroadcastTitle: (value: string) => void;
  customBroadcastMsg: string;
  setCustomBroadcastMsg: (value: string) => void;
  broadcastImageUrl: string;
  setBroadcastImageUrl: (value: string) => void;
  broadcastButtonText: string;
  setBroadcastButtonText: (value: string) => void;
  broadcastButtonUrl: string;
  setBroadcastButtonUrl: (value: string) => void;
  isBroadcasting: boolean;
  onNotifyProduct: (id: number, name: string) => void;
  onCustomBroadcast: (event: React.FormEvent) => void;
}

export default function BroadcastTab(props: BroadcastTabProps) {
  const { products, stats, broadcastTitle, setBroadcastTitle, customBroadcastMsg, setCustomBroadcastMsg, broadcastImageUrl, setBroadcastImageUrl, broadcastButtonText, setBroadcastButtonText, broadcastButtonUrl, setBroadcastButtonUrl, isBroadcasting, onNotifyProduct, onCustomBroadcast } = props;
  return <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6">
    <div className="xl:col-span-5 bg-white rounded-[28px] border border-slate-200 p-5 sm:p-6 shadow-sm">
      <div className="mb-4"><h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-2"><Package className="h-5 w-5 text-[#0e704b]" /> Giới thiệu sản phẩm tới khách</h3><p className="text-xs text-slate-600 font-medium mt-1">Gửi bài giới thiệu sản phẩm có ảnh, mô tả và nút mua trực tiếp tới <b>{stats.subscriberCount ?? 0}</b> người theo dõi bot.</p></div>
      <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">{products.map((product) => <div key={product.id} className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-100 bg-slate-50/60"><div className="min-w-0"><div className="font-bold text-xs sm:text-sm text-slate-900 truncate">{product.name}</div><div className="text-[11px] text-slate-600 font-medium mt-0.5">Tồn kho: <b className="text-[#0e704b]">{product.stockAvailable}</b> · Giá: {product.price.toLocaleString("vi-VN")} đ</div></div><button onClick={() => onNotifyProduct(product.id, product.name)} className="shrink-0 flex items-center gap-1.5 rounded-full bg-pink-600 hover:bg-pink-700 text-white px-3.5 py-1.5 text-xs font-bold transition"><Send className="h-3 w-3" /> Gửi giới thiệu</button></div>)}</div>
    </div>
    <div className="xl:col-span-7 bg-white rounded-[28px] border border-slate-200 p-5 sm:p-6 shadow-sm">
      <div className="mb-4"><h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-2"><Bell className="h-5 w-5 text-pink-600" /> Chiến dịch thông báo / quảng cáo</h3><p className="text-xs text-slate-600 font-medium mt-1">Dùng cho giới thiệu tính năng, khuyến mãi, bảo trì hoặc tin chăm sóc khách hàng.</p></div>
      <form onSubmit={onCustomBroadcast} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3"><div><label className="block text-xs font-semibold text-slate-600 mb-1">Tiêu đề</label><input value={broadcastTitle} onChange={(event) => setBroadcastTitle(event.target.value)} maxLength={120} placeholder="Ví dụ: Tính năng mới đã có mặt" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-pink-600" /></div><div><label className="block text-xs font-semibold text-slate-600 mb-1">Nội dung * · hỗ trợ HTML Telegram</label><textarea rows={8} value={customBroadcastMsg} onChange={(event) => setCustomBroadcastMsg(event.target.value)} placeholder={`🔥 Ưu đãi mới từ RINQ SHOP\n\nXin chào quý khách...`} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-900 focus:outline-none focus:border-pink-600" required /></div></div>
        <div className="space-y-3"><div><label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1"><ImageIcon className="h-3.5 w-3.5" /> Ảnh minh họa (URL HTTPS)</label><input type="url" value={broadcastImageUrl} onChange={(event) => setBroadcastImageUrl(event.target.value)} placeholder="https://.../banner.jpg" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-pink-600" /></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><label className="block text-xs font-semibold text-slate-600 mb-1">Nhãn nút CTA</label><input value={broadcastButtonText} onChange={(event) => setBroadcastButtonText(event.target.value)} maxLength={64} placeholder="Xem chi tiết" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-pink-600" /></div><div><label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1"><Link2 className="h-3.5 w-3.5" /> Link CTA</label><input type="url" value={broadcastButtonUrl} onChange={(event) => setBroadcastButtonUrl(event.target.value)} placeholder="https://..." className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-pink-600" /></div></div><div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-600"><div className="font-bold text-slate-800 mb-2">Xem nhanh</div><div className="whitespace-pre-wrap">{broadcastTitle || "📢 RINQ SHOP"}{"\n\n"}{customBroadcastMsg || "Nội dung quảng cáo sẽ hiển thị ở đây."}</div>{broadcastButtonText && <div className="mt-3 inline-flex rounded-lg bg-pink-600 px-3 py-1.5 font-bold text-white">{broadcastButtonText}</div>}</div><button type="submit" disabled={isBroadcasting} className="w-full rounded-full bg-pink-600 hover:bg-pink-700 text-white py-3 text-xs font-bold transition disabled:opacity-50">{isBroadcasting ? "Đang gửi chiến dịch…" : `Gửi tới ${stats.subscriberCount ?? 0} khách hàng`}</button></div>
      </form>
    </div>
  </div>;
}
