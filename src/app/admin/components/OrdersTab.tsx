"use client";

import React from "react";
import {
  ShoppingBag,
  Search,
  X,
  Trash2,
  CheckCircle2,
  Clock,
  Zap,
  Check,
  Copy,
} from "lucide-react";
import { Order, Product, Stats } from "../types";

interface OrdersTabProps {
  orders: Order[];
  products: Product[];
  stats: Stats;
  orderStatusFilter: "ALL" | "PAID" | "PENDING";
  setOrderStatusFilter: (val: "ALL" | "PAID" | "PENDING") => void;
  orderSearch: string;
  setOrderSearch: (val: string) => void;
  orderProductFilter: string;
  setOrderProductFilter: (val: string) => void;
  orderSort: any;
  setOrderSort: (val: any) => void;
  selectedOrderIds: string[];
  isAllFilteredSelected: boolean;
  toggleSelectAllOrders: () => void;
  toggleSelectOrder: (id: string) => void;
  handleDeleteSelectedOrders: () => void;
  handleClearPendingOrders: () => void;
  handleDeleteOrder: (id: string) => void;
  handleSimulatePayment: (orderId: string, amount: number) => void;
  isSimulating: boolean;
  isDeletingOrders: boolean;
  filteredAndSortedOrders: Order[];
  copyToClipboard: (text: string, type: any, id?: string) => void;
  copiedOrderId: string | null;
}

export default function OrdersTab({
  orders,
  products,
  stats,
  orderStatusFilter,
  setOrderStatusFilter,
  orderSearch,
  setOrderSearch,
  orderProductFilter,
  setOrderProductFilter,
  orderSort,
  setOrderSort,
  selectedOrderIds,
  isAllFilteredSelected,
  toggleSelectAllOrders,
  toggleSelectOrder,
  handleDeleteSelectedOrders,
  handleClearPendingOrders,
  handleDeleteOrder,
  handleSimulatePayment,
  isSimulating,
  isDeletingOrders,
  filteredAndSortedOrders,
  copyToClipboard,
  copiedOrderId,
}: OrdersTabProps) {
  return (
    <div className="bg-white rounded-[28px] border border-slate-200 p-5 sm:p-6 shadow-sm transition-all hover:shadow-md hover:border-slate-300">
      {/* Header & Clickable Status Filter Badges */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-[#0e704b]" />
            <span>Lịch sử tất cả đơn hàng</span>
          </h2>
          <p className="text-xs text-slate-600 font-medium mt-0.5">
            Tổng <b>{orders.length}</b> đơn hàng (Chuyển khoản VietQR tự động khớp)
          </p>
        </div>

        {/* Status Filter Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setOrderStatusFilter("ALL")}
            className={`px-3 py-1.5 rounded-full font-bold transition-all border ${orderStatusFilter === "ALL"
                ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
          >
            Tất cả ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setOrderStatusFilter("PAID")}
            className={`px-3 py-1.5 rounded-full font-bold transition-all border ${orderStatusFilter === "PAID"
                ? "bg-[#0e704b] text-white border-[#0e704b] shadow-sm"
                : "bg-emerald-50 text-[#0e704b] border-emerald-100 hover:bg-emerald-100/70"
              }`}
          >
            {stats.paidOrders} Đã thanh toán
          </button>
          <button
            type="button"
            onClick={() => setOrderStatusFilter("PENDING")}
            className={`px-3 py-1.5 rounded-full font-bold transition-all border ${orderStatusFilter === "PENDING"
                ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                : "bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100/70"
              }`}
          >
            {stats.pendingOrders} Chờ thanh toán
          </button>
        </div>
      </div>

      {/* Filter & Action Toolbar */}
      <div className="bg-slate-50/90 rounded-2xl p-3 sm:p-3.5 mb-5 border border-slate-200/70 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              placeholder="Tìm theo mã đơn (DH...), @khách hàng, sản phẩm..."
              className="w-full bg-white pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-[#0e704b] transition font-medium"
            />
            {orderSearch && (
              <button
                type="button"
                onClick={() => setOrderSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter Product */}
          <select
            value={orderProductFilter}
            onChange={(e) => setOrderProductFilter(e.target.value)}
            className="bg-white px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-[#0e704b] font-medium"
          >
            <option value="ALL">Tất cả sản phẩm ({products.length})</option>
            {products.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Sort Dropdown */}
          <select
            value={orderSort}
            onChange={(e) => setOrderSort(e.target.value)}
            className="bg-white px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-[#0e704b] font-medium"
          >
            <option value="NEWEST">Mới nhất trước</option>
            <option value="OLDEST">Cũ nhất trước</option>
            <option value="AMOUNT_DESC">Số tiền cao nhất</option>
            <option value="AMOUNT_ASC">Số tiền thấp nhất</option>
          </select>
        </div>

        {/* Action buttons (Delete Selected or Clean All Pending) */}
        <div className="flex items-center gap-2 flex-wrap">
          {selectedOrderIds.length > 0 && (
            <button
              type="button"
              onClick={handleDeleteSelectedOrders}
              disabled={isDeletingOrders}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm active:scale-95 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Xóa {selectedOrderIds.length} đơn đã chọn</span>
            </button>
          )}

          {stats.pendingOrders > 0 && (
            <button
              type="button"
              onClick={handleClearPendingOrders}
              disabled={isDeletingOrders}
              title="Xóa toàn bộ các đơn thử nghiệm / đơn chờ thanh toán"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-rose-50 border border-amber-200 hover:border-rose-200 text-amber-800 hover:text-rose-600 text-xs font-bold transition active:scale-95 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Dọn sạch {stats.pendingOrders} đơn chờ</span>
            </button>
          )}

          {(orderSearch || orderStatusFilter !== "ALL" || orderProductFilter !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setOrderSearch("");
                setOrderStatusFilter("ALL");
                setOrderProductFilter("ALL");
              }}
              className="px-2.5 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
            >
              Đặt lại lọc
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-slate-600 uppercase text-[10px] tracking-wider font-bold">
              <th className="pb-3 w-8 text-center">
                <input
                  type="checkbox"
                  checked={isAllFilteredSelected}
                  onChange={toggleSelectAllOrders}
                  title="Chọn tất cả đơn đang hiển thị"
                  className="h-3.5 w-3.5 rounded border-slate-300 text-[#0e704b] focus:ring-emerald-500 cursor-pointer"
                />
              </th>
              <th className="pb-3">Mã đơn</th>
              <th className="pb-3">Khách hàng</th>
              <th className="pb-3">Sản phẩm</th>
              <th className="pb-3">Số tiền</th>
              <th className="pb-3">Trạng thái</th>
              <th className="pb-3">Thời gian</th>
              <th className="pb-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredAndSortedOrders.map((o) => {
              const isSelected = selectedOrderIds.includes(o.id);
              return (
                <tr
                  key={o.id}
                  className={`transition-colors ${isSelected ? "bg-emerald-50/50" : "hover:bg-slate-50/80"
                    }`}
                >
                  <td className="py-3 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectOrder(o.id)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-[#0e704b] focus:ring-emerald-500 cursor-pointer"
                    />
                  </td>
                  <td className="py-3 font-mono font-bold text-[#0e704b] whitespace-nowrap">
                    <button
                      onClick={() => copyToClipboard(o.id, "order", o.id)}
                      className="flex items-center gap-1 hover:underline"
                    >
                      <span>{o.id}</span>
                      {copiedOrderId === o.id ? (
                        <Check className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <Copy className="h-3 w-3 opacity-50" />
                      )}
                    </button>
                  </td>
                  <td className="py-3 whitespace-nowrap">
                    <div className="font-bold text-slate-900">
                      {o.username ? `@${o.username}` : `ID: ${o.telegramId}`}
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="font-semibold text-slate-900">
                      {o.product?.name || `SP #${o.productId}`}
                      {o.quantity && o.quantity > 1 ? (
                        <span className="ml-1.5 rounded-full bg-emerald-50 text-[#0e704b] border border-emerald-100 px-2 py-0.5 text-[10px] font-bold">
                          x{o.quantity}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-3 font-extrabold text-slate-900 whitespace-nowrap">
                    {o.totalAmount.toLocaleString("vi-VN")} đ
                  </td>
                  <td className="py-3 whitespace-nowrap">
                    {o.status === "PAID" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-[#0e704b] border border-emerald-100">
                        <CheckCircle2 className="h-3 w-3" />
                        Đã trả hàng
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 border border-amber-100">
                        <Clock className="h-3 w-3" />
                        Chờ thanh toán
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-slate-600 whitespace-nowrap text-xs">
                    {new Date(o.createdAt).toLocaleString("vi-VN", {
                      timeZone: "Asia/Ho_Chi_Minh",
                    })}
                  </td>
                  <td className="py-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5 justify-end">
                      {o.status === "PENDING" ? (
                        <button
                          onClick={() => handleSimulatePayment(o.id, o.totalAmount)}
                          disabled={isSimulating}
                          className="inline-flex items-center gap-1 rounded-full bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 text-xs font-bold transition shadow-sm disabled:opacity-50 active:scale-95"
                        >
                          <Zap className="h-3 w-3" />
                          <span>Giả lập TT</span>
                        </button>
                      ) : (
                        <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">
                          {o.stocks && o.stocks[0] ? o.stocks[0].data.substring(0, 16) + "..." : "Đã nhận"}
                        </span>
                      )}

                      {/* Delete Single Order Button */}
                      <button
                        type="button"
                        onClick={() => handleDeleteOrder(o.id)}
                        disabled={isDeletingOrders}
                        title="Xóa đơn hàng này"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition active:scale-90 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {filteredAndSortedOrders.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-600 text-xs">
                  <ShoppingBag className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                  <div className="font-semibold text-slate-700">Không tìm thấy đơn hàng nào</div>
                  <p className="text-slate-400 mt-1">
                    Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm để xem các đơn hàng khác.
                  </p>
                  {(orderSearch || orderStatusFilter !== "ALL" || orderProductFilter !== "ALL") && (
                    <button
                      type="button"
                      onClick={() => {
                        setOrderSearch("");
                        setOrderStatusFilter("ALL");
                        setOrderProductFilter("ALL");
                      }}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#0e704b] hover:underline"
                    >
                      Đặt lại tất cả bộ lọc
                    </button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary bar */}
      {filteredAndSortedOrders.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 pt-4 mt-2 border-t border-slate-100 gap-2">
          <div>
            Hiển thị <b>{filteredAndSortedOrders.length}</b> / <b>{orders.length}</b> đơn hàng
            {selectedOrderIds.length > 0 && (
              <span className="ml-2 font-bold text-rose-600">
                (Đã chọn {selectedOrderIds.length} đơn)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {orderStatusFilter !== "ALL" && (
              <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-semibold">
                Trạng thái: {orderStatusFilter === "PAID" ? "Đã thanh toán" : "Chờ thanh toán"}
              </span>
            )}
            {orderProductFilter !== "ALL" && (
              <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-semibold">
                SP: {products.find((p) => String(p.id) === orderProductFilter)?.name || orderProductFilter}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
