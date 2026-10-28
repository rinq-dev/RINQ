"use client";

import React from "react";
import {
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Package,
  Users,
  ArrowUpRight,
  Radio,
  Check,
  Copy,
  Flame,
  CreditCard,
  Sparkles,
  Activity,
  ShieldCheck,
  Bell,
  Gift,
} from "lucide-react";
import { Order, Stats } from "../types";

interface OverviewTabProps {
  stats: Stats;
  chartData: any;
  overviewChartFilter: "weekly" | "monthly";
  setOverviewChartFilter: (val: "weekly" | "monthly") => void;
  recentOrderFilter: "ALL" | "PAID" | "PENDING";
  setRecentOrderFilter: (val: "ALL" | "PAID" | "PENDING") => void;
  filteredRecentOrders: Order[];
  realCustomers: { id: string; name: string }[];
  copiedBank: boolean;
  copiedOrderId: string | null;
  copyToClipboard: (text: string, type: any, id?: string) => void;
  setActiveTab: (
    tab: "overview" | "products" | "orders" | "coupons" | "giveaways" | "broadcast"
  ) => void;
}

export default function OverviewTab({
  stats,
  chartData,
  overviewChartFilter,
  setOverviewChartFilter,
  recentOrderFilter,
  setRecentOrderFilter,
  filteredRecentOrders,
  realCustomers,
  copiedBank,
  copiedOrderId,
  copyToClipboard,
  setActiveTab,
}: OverviewTabProps) {
  return (
    <div className="space-y-5 sm:space-y-6">
      {/* 4 MINI METRICS SUMMARY STRIP */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm transition-all hover:shadow-md hover:border-emerald-300 hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-slate-600 mb-1">
            <span className="text-xs font-medium">Tổng thực thu</span>
            <div className="h-6 w-6 rounded-lg bg-emerald-50 text-[#0e704b] flex items-center justify-center">
              <DollarSign className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-slate-900">
            {stats.totalRevenue.toLocaleString("vi-VN")} đ
          </div>
          <div className="text-[10px] text-emerald-700 font-bold mt-1 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            +100% VietQR tự động
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm transition-all hover:shadow-md hover:border-emerald-300 hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-slate-600 mb-1">
            <span className="text-xs font-medium">Đơn thành công</span>
            <div className="h-6 w-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-slate-900">
            {stats.paidOrders} / {stats.totalOrders} đơn
          </div>
          <div className="text-[10px] text-blue-700 font-bold mt-1">
            Tỷ lệ duyệt: 99.8%
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm transition-all hover:shadow-md hover:border-emerald-300 hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-slate-600 mb-1">
            <span className="text-xs font-medium">Tồn kho hiện có</span>
            <div className="h-6 w-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Package className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-slate-900">
            {stats.totalStockAvailable} cái
          </div>
          <div className="text-[10px] text-purple-700 font-bold mt-1">
            Đã bán: {stats.totalStockSold} cái
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm transition-all hover:shadow-md hover:border-emerald-300 hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-slate-600 mb-1">
            <span className="text-xs font-medium">Khách theo dõi</span>
            <div className="h-6 w-6 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center">
              <Users className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-slate-900">
            {stats.subscriberCount ?? 0} khách
          </div>
          <div className="text-[10px] text-pink-700 font-bold mt-1">
            Đang kết nối bot
          </div>
        </div>
      </div>

      {/* 3 TOP BENTO CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* BENTO CARD 1: PAYMENT GOAL & GREEN BANK CARD (Cols: 4) */}
        <div className="lg:col-span-4 bg-white rounded-[28px] border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col justify-between transition-all hover:shadow-md hover:border-slate-300">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                Doanh thu cửa hàng
              </h3>
              <p className="text-xs text-slate-600 font-medium">Tài khoản nhận tiền tự động</p>
            </div>
            <button
              onClick={() => setActiveTab("orders")}
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition"
            >
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>

          {/* Styled Emerald Bank Card */}
          <div className="bg-gradient-to-br from-[#0c6b45] via-[#095737] to-[#043b24] text-white rounded-[24px] p-5 shadow-lg shadow-emerald-950/20 relative overflow-hidden my-1 group transition-transform hover:scale-[1.01]">
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full pointer-events-none blur-xl group-hover:bg-white/10 transition-all duration-500" />

            <div className="flex items-center justify-between mb-4">
              <span className="font-black tracking-widest text-sm text-emerald-200">
                TPBANK
              </span>
              <div className="flex items-center gap-1.5">
                <Radio className="h-4 w-4 text-emerald-300 animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-300">VIETQR</span>
              </div>
            </div>

            <div className="w-9 h-7 rounded-md bg-gradient-to-tr from-amber-300 via-yellow-200 to-amber-400 border border-amber-400/60 shadow-inner flex items-center justify-center mb-3">
              <div className="w-5 h-4 border border-amber-600/40 rounded-sm" />
            </div>

            <p className="text-[11px] text-emerald-200 font-medium">Tổng thực nhận</p>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-4">
              {stats.totalRevenue.toLocaleString("vi-VN")} đ
            </div>

            <div className="flex items-center justify-between text-xs text-emerald-100 font-mono pt-1">
              <button
                onClick={() => copyToClipboard("10005025333", "bank")}
                className="flex items-center gap-1.5 bg-black/20 hover:bg-black/30 px-2.5 py-1 rounded-lg transition"
                title="Sao chép số tài khoản"
              >
                <span>10005025333</span>
                {copiedBank ? <Check className="h-3 w-3 text-emerald-300" /> : <Copy className="h-3 w-3 opacity-70" />}
              </button>
              <span className="font-bold tracking-wider flex items-center gap-1.5">
                <img src="/logo.jpg" alt="Logo" className="h-4 w-4 rounded-full object-cover border border-white/30" />
                RINQ SHOP
              </span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-600 font-medium">Đơn thành công</p>
              <p className="text-base sm:text-lg font-extrabold text-slate-900">
                {stats.paidOrders} / {stats.totalOrders} đơn
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-[#0e704b] border border-emerald-100">
              <Flame className="h-3.5 w-3.5 text-amber-500" />
              Khớp 3-5 giây
            </span>
          </div>
        </div>

        {/* BENTO CARD 2: ENGAGEMENT RATE & BAR CHART (Cols: 5) */}
        <div className="lg:col-span-5 bg-white rounded-[28px] border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col justify-between transition-all hover:shadow-md hover:border-slate-300">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-slate-50 text-slate-700">
                <CreditCard className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                  Tỷ lệ đơn hàng & Hiệu suất
                </h3>
                <p className="text-xs text-slate-600 font-medium">Tỷ lệ thanh toán thành công theo ngày</p>
              </div>
            </div>

            <div className="flex items-center bg-[#F4F5F7] p-1 rounded-full border border-slate-200/60 text-[11px] font-bold">
              <button
                onClick={() => setOverviewChartFilter("weekly")}
                className={`px-2.5 py-1 rounded-full transition ${
                  overviewChartFilter === "weekly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                }`}
              >
                Tuần này
              </button>
              <button
                onClick={() => setOverviewChartFilter("monthly")}
                className={`px-2.5 py-1 rounded-full transition ${
                  overviewChartFilter === "monthly" ? "bg-[#0e704b] text-white shadow-sm" : "text-slate-600"
                }`}
              >
                Tháng này
              </button>
            </div>
          </div>

          <div className="relative pt-4 pb-2">
            <div className="flex justify-center mb-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#0e704b] px-2.5 py-0.5 text-[11px] font-bold text-white shadow-sm">
                <Sparkles className="h-3 w-3" />
                {chartData.growthBadge}
              </span>
            </div>

            <div className="h-36 sm:h-40 flex items-end justify-between gap-2 sm:gap-3 px-2 border-b border-dashed border-slate-200 pb-2">
              {chartData.bars.map((bar: any, idx: number) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <div
                    style={{ height: bar.height }}
                    className={`w-full rounded-2xl transition-all duration-500 relative group cursor-pointer ${
                      bar.active
                        ? "bg-gradient-to-t from-[#0e704b] to-[#158f60] shadow-md shadow-emerald-900/20 scale-[1.03]"
                        : bar.count > 0
                        ? "bg-emerald-300 hover:bg-emerald-400"
                        : "bg-emerald-100/60 hover:bg-emerald-200"
                    }`}
                  >
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] py-1 px-2 rounded-lg whitespace-nowrap transition-all duration-200 pointer-events-none shadow-lg z-20 font-medium">
                      {bar.count > 0 ? `${bar.count} đơn (${bar.paidCount} đã TT)` : "0 đơn"}
                    </div>
                  </div>
                  <span className={`text-[11px] font-bold ${bar.active ? "text-[#0e704b]" : "text-slate-600"}`}>
                    {bar.day}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-600 pt-2 font-medium">
            <span>
              Ghi nhận {chartData.periodLabel}: <b>{chartData.totalOrders}</b> đơn ({chartData.paidOrders} thành công)
            </span>
            <span className="text-[#0e704b] font-bold">
              {chartData.conversionRate}% hoàn tất
            </span>
          </div>
        </div>

        {/* BENTO CARD 3: TỒN KHO & ACTION (Cols: 3) */}
        <div className="lg:col-span-3 bg-white rounded-[28px] border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col justify-between transition-all hover:shadow-md hover:border-slate-300">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                Kho hàng sẵn
              </h3>
              <p className="text-xs text-slate-600 font-medium">Tài nguyên hiện có trong kho</p>
            </div>
            <button
              onClick={() => setActiveTab("products")}
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition"
            >
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>

          <div className="my-1">
            <p className="text-[11px] font-medium text-slate-600">Tổng tài nguyên sẵn sàng</p>
            <div className="text-3xl font-extrabold tracking-tight text-slate-900">
              {stats.totalStockAvailable} <span className="text-sm font-semibold text-slate-600">cái</span>
            </div>

            <div className="h-14 w-full my-1">
              <svg viewBox="0 0 100 30" className="w-full h-full text-emerald-500 fill-emerald-50 stroke-emerald-600" preserveAspectRatio="none">
                <path
                  d="M0,20 Q15,5 30,18 T60,10 T90,22 T100,15 L100,30 L0,30 Z"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => setActiveTab("products")}
              className="w-full py-2.5 rounded-full bg-[#0e704b] hover:bg-[#0a5c3d] text-white text-xs font-bold transition shadow-sm active:scale-95"
            >
              + Nạp kho
            </button>
            <button
              onClick={() => setActiveTab("orders")}
              className="w-full py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition active:scale-95"
            >
              Đơn hàng ↓
            </button>
          </div>
        </div>
      </div>

      {/* 2 BOTTOM BENTO CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* BENTO CARD 4: RECENT PAYMENTS TABLE (Cols: 8) */}
        <div className="lg:col-span-8 bg-white rounded-[28px] border border-slate-200 p-5 sm:p-6 shadow-sm transition-all hover:shadow-md hover:border-slate-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                Lịch sử đơn hàng gần nhất
              </h3>
              <p className="text-xs text-slate-600 font-medium">Đơn hàng mới tạo & đã thanh toán qua Bot</p>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-full border border-slate-200/60 text-xs font-semibold">
              <button
                onClick={() => setRecentOrderFilter("ALL")}
                className={`px-3 py-1 rounded-full transition ${
                  recentOrderFilter === "ALL" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                }`}
              >
                Tất cả
              </button>
              <button
                onClick={() => setRecentOrderFilter("PAID")}
                className={`px-3 py-1 rounded-full transition ${
                  recentOrderFilter === "PAID" ? "bg-emerald-700 text-white shadow-sm" : "text-slate-600"
                }`}
              >
                Đã nhận hàng
              </button>
              <button
                onClick={() => setRecentOrderFilter("PENDING")}
                className={`px-3 py-1 rounded-full transition ${
                  recentOrderFilter === "PENDING" ? "bg-amber-500 text-white shadow-sm" : "text-slate-600"
                }`}
              >
                Chờ TT
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-600 uppercase text-[10px] tracking-wider font-bold">
                  <th className="pb-3 font-semibold">Khách hàng</th>
                  <th className="pb-3 font-semibold">Sản phẩm</th>
                  <th className="pb-3 font-semibold">Thời gian</th>
                  <th className="pb-3 font-semibold">Trạng thái</th>
                  <th className="pb-3 font-semibold text-right">Số tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredRecentOrders.slice(0, 6).map((o, idx) => (
                  <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${
                            idx % 3 === 0
                              ? "bg-pink-500"
                              : idx % 3 === 1
                              ? "bg-blue-500"
                              : "bg-amber-500"
                          }`}
                        >
                          {o.username ? o.username.slice(0, 2).toUpperCase() : "TG"}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">
                            {o.username ? `@${o.username}` : `ID: ${o.telegramId}`}
                          </div>
                          <button
                            onClick={() => copyToClipboard(o.id, "order", o.id)}
                            className="text-[10px] text-slate-600 font-mono hover:text-[#0e704b] flex items-center gap-1"
                          >
                            <span>{o.id}</span>
                            {copiedOrderId === o.id ? (
                              <Check className="h-2.5 w-2.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-2.5 w-2.5 opacity-40 hover:opacity-100" />
                            )}
                          </button>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 text-slate-700">
                      <span className="font-semibold text-slate-900">
                        {o.product?.name || `SP #${o.productId}`}
                      </span>
                      {o.quantity && o.quantity > 1 ? (
                        <span className="ml-1.5 rounded-full bg-emerald-50 text-[#0e704b] border border-emerald-100 px-1.5 py-0.2 text-[10px] font-bold">
                          x{o.quantity}
                        </span>
                      ) : null}
                    </td>

                    <td className="py-3 text-slate-600 whitespace-nowrap text-xs">
                      {new Date(o.createdAt).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </td>

                    <td className="py-3 whitespace-nowrap">
                      {o.status === "PAID" ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0e704b]">
                          <span className="h-2 w-2 rounded-full bg-[#0e704b] animate-pulse" />
                          Thành công
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600">
                          <span className="h-2 w-2 rounded-full bg-amber-500" />
                          Chờ TT
                        </span>
                      )}
                    </td>

                    <td className="py-3 text-right font-extrabold text-slate-900 whitespace-nowrap">
                      {o.totalAmount.toLocaleString("vi-VN")} đ
                    </td>
                  </tr>
                ))}

                {filteredRecentOrders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-600 text-xs">
                      Không tìm thấy đơn hàng nào phù hợp bộ lọc.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* BENTO CARD 5: SUBSCRIBERS & COMMUNITY (Cols: 4) */}
        <div className="lg:col-span-4 bg-white rounded-[28px] border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col justify-between transition-all hover:shadow-md hover:border-slate-300">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-xl bg-slate-50 text-slate-700">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                  Khách hàng & Nhận tin
                </h3>
                <p className="text-xs text-slate-600 font-medium">Người dùng kết nối qua Bot</p>
              </div>
            </div>

            <div className="my-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">
                  {stats.subscriberCount ?? 0}
                </span>
                <span className="text-xs font-semibold text-slate-600">người theo dõi</span>
                <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-[#0e704b] border border-emerald-100">
                  {(stats.subscriberCount ?? 0) > 0 ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                      Sẵn sàng nhận tin
                    </>
                  ) : (
                    "Chưa có kết nối"
                  )}
                </span>
              </div>

              <div className="flex items-center mt-3">
                {realCustomers.slice(0, 4).map((c, i) => (
                  <div
                    key={c.id}
                    title={c.name}
                    className={`h-9 w-9 rounded-full border-2 border-white flex items-center justify-center text-white text-[11px] font-bold shadow-sm -ml-2 first:ml-0 transition-transform hover:scale-110 hover:z-10 ${
                      i === 0
                        ? "bg-[#0e704b]"
                        : i === 1
                        ? "bg-indigo-600"
                        : i === 2
                        ? "bg-amber-500"
                        : "bg-rose-500"
                    }`}
                  >
                    {c.name.replace("@", "").slice(0, 2).toUpperCase()}
                  </div>
                ))}
                {realCustomers.length > 4 ? (
                  <div className="h-9 w-9 rounded-full border-2 border-white bg-[#0e704b] text-white text-xs font-bold flex items-center justify-center shadow-sm -ml-2">
                    +{realCustomers.length - 4}
                  </div>
                ) : realCustomers.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">
                    Chưa có khách hàng phát sinh đơn
                  </span>
                ) : null}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 my-2 space-y-1.5 text-xs">
              <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                <Activity className="h-3 w-3 text-emerald-600" />
                <span>Hệ thống tự động bắn tin khi nạp kho</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                <ShieldCheck className="h-3 w-3 text-blue-600" />
                <span>Khách mua nhận tài nguyên sau 3 giây</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-2">
            <button
              onClick={() => setActiveTab("broadcast")}
              className="w-full py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
            >
              <Bell className="h-3.5 w-3.5 text-emerald-400" />
              <span>Bắn thông báo toàn bộ khách</span>
            </button>
            <button
              onClick={() => setActiveTab("giveaways")}
              className="w-full py-2 rounded-full bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-100 text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95"
            >
              <Gift className="h-3.5 w-3.5" />
              <span>Mở sự kiện Giveaway tặng quà</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
