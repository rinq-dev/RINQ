"use client";

import React, { useState, useEffect } from "react";
import {
  AlertTriangle,
  Wallet,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
} from "lucide-react";

interface SupplierAlertBannerProps {
  onSyncPriceRequested?: () => void;
}

export default function SupplierAlertBanner({ onSyncPriceRequested }: SupplierAlertBannerProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/supplier-alerts");
      const json = await res.json();
      if (res.ok) {
        setData(json);
      }
    } catch (err) {
      console.error("Lỗi tải cảnh báo nhà cung cấp:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    // Tự động kiểm tra lại sau mỗi 5 phút
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!data || !data.summary?.hasAlert) {
    return null;
  }

  const { balances, priceAlerts, summary } = data;
  const hasLowBalance = summary.lowBalanceSuppliers.length > 0;
  const hasPriceChanges = summary.priceChangesCount > 0;

  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 shadow-sm transition-all text-slate-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-extrabold text-sm text-slate-900 uppercase tracking-wide">
                Cảnh báo nhà cung cấp & Biến động giá vốn
              </h4>
              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                Cần chú ý
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700">
              {hasLowBalance && (
                <span className="font-semibold text-rose-700 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600 inline" />
                  Số dư sắp cạn: {summary.lowBalanceSuppliers.join(", ")}
                </span>
              )}
              {hasPriceChanges && (
                <span className="font-semibold text-amber-900 flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5 text-amber-700 inline" />
                  {summary.priceChangesCount} sản phẩm có biến động giá nhập gốc
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="inline-flex items-center gap-1 rounded-xl bg-white border border-amber-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-amber-100/50 transition active:scale-95"
          >
            <span>{showDetails ? "Thu gọn" : "Xem chi tiết"}</span>
            {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={fetchAlerts}
            disabled={loading}
            title="Làm mới cảnh báo"
            className="rounded-xl bg-white border border-amber-300 p-2 text-slate-700 hover:bg-amber-100/50 transition active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-amber-700" : ""}`} />
          </button>
        </div>
      </div>

      {/* Chi tiết cảnh báo khi mở rộng */}
      {showDetails && (
        <div className="mt-4 pt-4 border-t border-amber-200/80 space-y-4">
          
          {/* 1. Chi tiết số dư ví các NCC */}
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5" />
              <span>Tình trạng số dư ví nhà cung cấp</span>
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* RoboticVN */}
              <div
                className={`p-3 rounded-xl border ${
                  balances.robotic.isLow
                    ? "bg-rose-50 border-rose-200 text-rose-900"
                    : "bg-white border-slate-200 text-slate-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">RoboticVN API</span>
                  {balances.robotic.isLow && (
                    <span className="rounded-full bg-rose-200/80 px-2 py-0.5 text-[10px] font-extrabold text-rose-800">
                      Sắp hết số dư
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-sm sm:text-base font-extrabold">
                    {balances.robotic.balanceVnd.toLocaleString("vi-VN")} đ
                  </span>
                  <a
                    href="https://roboticvn.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-bold text-blue-700 hover:underline inline-flex items-center gap-0.5"
                  >
                    <span>Nạp tiền</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              {/* ScoopyVN */}
              <div
                className={`p-3 rounded-xl border ${
                  balances.scoopy.isLow
                    ? "bg-rose-50 border-rose-200 text-rose-900"
                    : "bg-white border-slate-200 text-slate-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">ScoopyVN API</span>
                  {balances.scoopy.isLow && (
                    <span className="rounded-full bg-rose-200/80 px-2 py-0.5 text-[10px] font-extrabold text-rose-800">
                      Sắp hết số dư
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-sm sm:text-base font-extrabold">
                    {balances.scoopy.balanceVnd.toLocaleString("vi-VN")} đ
                  </span>
                  <a
                    href="https://scoopyvn.shop"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-bold text-blue-700 hover:underline inline-flex items-center gap-0.5"
                  >
                    <span>Nạp tiền</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Chi tiết biến động giá vốn sản phẩm */}
          {hasPriceChanges && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>Sản phẩm thay đổi giá vốn nhập từ NCC</span>
                </h5>
                {onSyncPriceRequested && (
                  <button
                    type="button"
                    onClick={onSyncPriceRequested}
                    className="text-xs font-bold text-[#0e704b] hover:underline"
                  >
                    Đồng bộ tự động tất cả
                  </button>
                )}
              </div>

              <div className="overflow-x-auto rounded-xl border border-amber-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-amber-100/50 text-slate-600 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="p-2.5">Sản phẩm</th>
                      <th className="p-2.5">NCC</th>
                      <th className="p-2.5">Giá vốn cũ</th>
                      <th className="p-2.5">Giá vốn mới</th>
                      <th className="p-2.5">Giá bán hiện tại</th>
                      <th className="p-2.5">Giá gợi ý</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {priceAlerts.map((item: any) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-900">{item.name}</td>
                        <td className="p-2.5 font-medium text-slate-600">{item.supplier}</td>
                        <td className="p-2.5 text-slate-500 whitespace-nowrap">
                          {item.oldCost ? `${item.oldCost.toLocaleString("vi-VN")} đ` : "Chưa có"}
                        </td>
                        <td className="p-2.5 font-bold whitespace-nowrap">
                          <span className={item.isIncrease ? "text-rose-600" : "text-emerald-600"}>
                            {item.newCost.toLocaleString("vi-VN")} đ{" "}
                            {item.diffPercent !== 0 && (
                              <span className="text-[10px]">
                                ({item.diffPercent > 0 ? "+" : ""}{item.diffPercent}%)
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="p-2.5 font-semibold text-slate-700 whitespace-nowrap">
                          {item.currentRetail.toLocaleString("vi-VN")} đ
                        </td>
                        <td className="p-2.5 font-extrabold text-[#0e704b] whitespace-nowrap">
                          {item.suggestedRetail.toLocaleString("vi-VN")} đ
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
