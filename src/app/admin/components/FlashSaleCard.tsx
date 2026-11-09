"use client";

import React, { useState, useEffect } from "react";
import { Flame, Clock, Send, StopCircle, Sparkles, Check, AlertCircle } from "lucide-react";
import { FlashSaleConfig } from "../types";

interface FlashSaleCardProps {
  initialFlashSale?: FlashSaleConfig | null;
  onRefreshData?: () => void;
}

export default function FlashSaleCard({
  initialFlashSale,
  onRefreshData,
}: FlashSaleCardProps) {
  const [flashSale, setFlashSale] = useState<FlashSaleConfig | null>(initialFlashSale || null);
  const [loading, setLoading] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(20);
  const [durationHours, setDurationHours] = useState(2);
  const [title, setTitle] = useState("⚡ GIỜ VÀNG FLASH SALE");
  const [note, setNote] = useState("");
  const [broadcastToBot, setBroadcastToBot] = useState(true);
  const [remainingText, setRemainingText] = useState("");
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (initialFlashSale !== undefined) {
      setFlashSale(initialFlashSale);
    }
  }, [initialFlashSale]);

  // Bộ đếm thời gian còn lại
  useEffect(() => {
    if (!flashSale?.active) {
      setRemainingText("");
      return;
    }

    const updateTimer = () => {
      const diffMs = new Date(flashSale.expiresAt).getTime() - Date.now();
      if (diffMs <= 0) {
        setRemainingText("Đã hết hạn");
        setFlashSale(null);
        return;
      }
      const hours = Math.floor(diffMs / (3600 * 1000));
      const mins = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
      const secs = Math.floor((diffMs % (60 * 1000)) / 1000);
      setRemainingText(`${hours > 0 ? `${hours}h ` : ""}${mins}p ${secs}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [flashSale]);

  const handleStartFlashSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg(null);

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "startFlashSale",
          discountPercent,
          durationHours,
          title: title.trim() || "⚡ GIỜ VÀNG FLASH SALE",
          note: note.trim() || null,
          broadcastToBot,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Lỗi bật Flash Sale");
      }

      setFlashSale(data.flashSale);
      setStatusMsg({ type: "success", text: "Đã kích hoạt Flash Sale và cập nhật toàn bộ giá trên Bot!" });
      onRefreshData?.();
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Lỗi không xác định" });
    } finally {
      setLoading(false);
    }
  };

  const handleStopFlashSale = async () => {
    if (!confirm("Bạn có chắc chắn muốn dừng Flash Sale sớm? Giá bán sẽ trở về mức bình thường.")) return;
    setLoading(true);
    setStatusMsg(null);

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stopFlashSale" }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Lỗi dừng Flash Sale");
      }

      setFlashSale(null);
      setStatusMsg({ type: "success", text: "Đã tắt Flash Sale. Giá bán lẻ đã trở lại bình thường." });
      onRefreshData?.();
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Lỗi không xác định" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/70 via-white to-orange-50/60 p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-100 pb-3.5 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-sm shadow-amber-500/20">
            <Flame className={`h-5 w-5 ${flashSale?.active ? "animate-bounce" : ""}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                Chiến Dịch Flash Sale · Giờ Vàng Giảm Giá
              </h3>
              {flashSale?.active ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-black text-red-700 animate-pulse">
                  🔥 ĐANG BẬT (-{flashSale.discountPercent}%)
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                  Đang tắt
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tự động giảm giá toàn bộ sản phẩm trên Bot & bắn thông báo tới tất cả khách hàng
            </p>
          </div>
        </div>

        {flashSale?.active && (
          <div className="flex items-center gap-2 sm:self-center">
            <div className="flex items-center gap-1.5 rounded-xl bg-amber-100/80 px-3 py-1.5 text-xs font-bold text-amber-900 border border-amber-200">
              <Clock className="h-3.5 w-3.5 text-amber-700" />
              <span>Còn: {remainingText}</span>
            </div>
            <button
              onClick={handleStopFlashSale}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50"
            >
              <StopCircle className="h-3.5 w-3.5" />
              <span>Dừng sớm</span>
            </button>
          </div>
        )}
      </div>

      {statusMsg && (
        <div
          className={`mb-4 flex items-center gap-2 rounded-xl p-3 text-xs font-semibold ${
            statusMsg.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {statusMsg.type === "success" ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {flashSale?.active ? (
        <div className="rounded-xl border border-amber-200 bg-white/90 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Tên sự kiện:</span>
            <span className="font-bold text-slate-900">{flashSale.title}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Mức giảm:</span>
            <span className="font-extrabold text-red-600">Giảm {flashSale.discountPercent}% cho toàn bộ sản phẩm</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Thời gian kết thúc:</span>
            <span className="font-semibold text-slate-700">
              {new Date(flashSale.expiresAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
            </span>
          </div>
          {flashSale.note && (
            <div className="pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-500 font-medium">Nội dung thông điệp gửi khách:</span>
              <p className="mt-1 text-xs italic text-slate-800 bg-amber-50/60 p-2.5 rounded-lg border border-amber-100">
                "{flashSale.note}"
              </p>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleStartFlashSale} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mức giảm giá (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(parseInt(e.target.value, 10) || 1)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                  required
                />
                <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">%</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Thời lượng (giờ)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="72"
                  value={durationHours}
                  onChange={(e) => setDurationHours(parseFloat(e.target.value) || 1)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                  required
                />
                <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">giờ</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tên sự kiện / Tiêu đề
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="⚡ GIỜ VÀNG FLASH SALE"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Ghi chú thêm / Thông điệp gửi khách <span className="text-slate-400 font-normal">(không bắt buộc)</span>
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Tri ân khách hàng cuối tuần, số lượng tài nguyên có hạn! Chúc Quý khách mua sắm vui vẻ."
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white placeholder:text-slate-400"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 select-none">
              <input
                type="checkbox"
                checked={broadcastToBot}
                onChange={(e) => setBroadcastToBot(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span>Tự động bắn thông báo (Broadcast) tới toàn bộ khách hàng trên Bot</span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-xs font-extrabold text-white shadow-md shadow-orange-500/20 hover:from-amber-600 hover:to-orange-600 active:scale-95 transition-all disabled:opacity-50"
            >
              <Flame className="h-4 w-4" />
              <span>{loading ? "Đang kích hoạt..." : "Kích hoạt Flash Sale"}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
