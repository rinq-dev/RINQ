"use client";

import React, { useMemo, useState } from "react";
import { Search, Users, ShoppingBag, Wallet, ExternalLink, Plus, Coins, X, CheckCircle2 } from "lucide-react";
import { Customer } from "../types";

interface CustomersTabProps {
  customers: Customer[];
  onCreditBalance?: (customerId: string, amount: number, reason: string) => Promise<boolean> | void;
}

export default function CustomersTab({ customers, onCreditBalance }: CustomersTabProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"ALL" | "BUYERS" | "FOLLOWERS">("ALL");

  // State modal cộng tiền
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [creditAmount, setCreditAmount] = useState<string>("");
  const [creditReason, setCreditReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const filtered = useMemo(() => {
    return customers.filter((customer) => {
      const haystack = `${customer.id} ${customer.username || ""} ${customer.firstName || ""}`.toLowerCase();
      const matchesQuery = !query.trim() || haystack.includes(query.trim().toLowerCase().replace(/^@/, ""));
      const matchesFilter =
        filter === "ALL" || (filter === "BUYERS" ? customer.orderCount > 0 : customer.orderCount === 0);
      return matchesQuery && matchesFilter;
    });
  }, [customers, filter, query]);

  const buyers = customers.filter((customer) => customer.orderCount > 0).length;
  const totalSpent = customers.reduce((sum, customer) => sum + customer.totalSpent, 0);
  const totalBalance = customers.reduce((sum, customer) => sum + (customer.balance || 0), 0);

  const handleOpenCredit = (c: Customer) => {
    setSelectedCustomer(c);
    setCreditAmount("20000");
    setCreditReason("Hoàn tiền đơn hàng lỗi");
  };

  const handleSubmitCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const amt = parseInt(creditAmount.replace(/\D/g, ""), 10);
    if (!amt || amt <= 0) {
      alert("Vui lòng nhập số tiền hợp lệ (> 0đ)");
      return;
    }

    if (onCreditBalance) {
      setIsSubmitting(true);
      try {
        await onCreditBalance(selectedCustomer.id, amt, creditReason.trim());
        setSelectedCustomer(null);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <section className="space-y-5">
      {/* 4 Thống kê khách hàng */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Users className="h-4 w-4 text-emerald-600" /> Tổng khách
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-extrabold text-slate-900">{customers.length}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <ShoppingBag className="h-4 w-4 text-teal-600" /> Đã từng mua
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-extrabold text-slate-900">{buyers}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Wallet className="h-4 w-4 text-blue-600" /> Tổng chi tiêu
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-extrabold text-slate-900">
            {totalSpent.toLocaleString("vi-VN")} đ
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Coins className="h-4 w-4 text-amber-500" /> Tổng số dư ví khách
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-extrabold text-[#0e704b]">
            {totalBalance.toLocaleString("vi-VN")} đ
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[28px] p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="h-5 w-5 text-[#0e704b]" />
              <span>Khách hàng Telegram & Ví số dư</span>
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Quản lý số dư, cộng tiền hoàn trả hoặc đền bù đơn hàng cho khách.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm username, tên hoặc Telegram ID"
                className="w-full sm:w-64 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-[#0e704b]"
              />
            </div>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as typeof filter)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
            >
              <option value="ALL">Tất cả khách ({customers.length})</option>
              <option value="BUYERS">Đã mua hàng ({buyers})</option>
              <option value="FOLLOWERS">Chưa mua ({customers.length - buyers})</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500 font-bold">
              <tr>
                <th className="px-3 py-3">Khách hàng</th>
                <th className="px-3 py-3">Telegram ID</th>
                <th className="px-3 py-3">Số dư ví</th>
                <th className="px-3 py-3">Đơn hàng</th>
                <th className="px-3 py-3">Chi tiêu</th>
                <th className="px-3 py-3">Gần nhất</th>
                <th className="px-3 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((customer) => (
                <tr key={customer.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-3 py-3">
                    <div className="font-bold text-slate-900">
                      {customer.firstName || (customer.username ? `@${customer.username}` : "Khách Telegram")}
                    </div>
                    <div className="text-slate-500 text-xs">
                      {customer.username ? `@${customer.username}` : "Chưa có username"}
                    </div>
                  </td>
                  <td className="px-3 py-3 font-mono font-medium text-slate-600">{customer.id}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className="font-extrabold text-[#0e704b] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      {(customer.balance || 0).toLocaleString("vi-VN")} đ
                    </span>
                  </td>
                  <td className="px-3 py-3 font-semibold text-slate-800 whitespace-nowrap">
                    {customer.orderCount}{" "}
                    <span className="text-emerald-700 font-bold">({customer.paidOrderCount} đơn trả)</span>
                  </td>
                  <td className="px-3 py-3 font-bold text-slate-900 whitespace-nowrap">
                    {customer.totalSpent.toLocaleString("vi-VN")} đ
                  </td>
                  <td className="px-3 py-3 text-slate-600 text-xs whitespace-nowrap">
                    {customer.lastOrderAt
                      ? new Date(customer.lastOrderAt).toLocaleDateString("vi-VN")
                      : new Date(customer.createdAt).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => handleOpenCredit(customer)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition active:scale-95"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Cộng tiền</span>
                      </button>

                      {customer.username && (
                        <a
                          href={`https://t.me/${customer.username}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded-lg text-slate-400 hover:text-[#0e704b] hover:bg-slate-100 transition"
                          title="Nhắn tin trên Telegram"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-500 font-medium">
              Không tìm thấy khách hàng phù hợp.
            </div>
          )}
        </div>
      </div>

      {/* MODAL CỘNG TIỀN CHO KHÁCH */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setSelectedCustomer(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-2xl bg-emerald-100 text-[#0e704b]">
                <Coins className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Cộng tiền vào ví khách hàng</h3>
                <p className="text-xs text-slate-500">
                  {selectedCustomer.firstName || "Khách hàng"} (
                  {selectedCustomer.username ? `@${selectedCustomer.username}` : `ID ${selectedCustomer.id}`})
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 mb-4 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Số dư hiện tại:</span>
                <span className="font-extrabold text-[#0e704b]">
                  {(selectedCustomer.balance || 0).toLocaleString("vi-VN")} đ
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Telegram ID:</span>
                <span className="font-mono text-slate-700">{selectedCustomer.id}</span>
              </div>
            </div>

            <form onSubmit={handleSubmitCredit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Số tiền muốn cộng (VNĐ):
                </label>
                <input
                  type="number"
                  step="1000"
                  min="1000"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  placeholder="Ví dụ: 20000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-[#0e704b]"
                  required
                />
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {[10000, 20000, 50000, 100000, 200000].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setCreditAmount(String(chip))}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-[#0e704b] text-[11px] font-bold text-slate-600 transition"
                    >
                      +{chip.toLocaleString("vi-VN")}đ
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Lý do cộng tiền (gửi kèm thông báo Telegram):
                </label>
                <input
                  type="text"
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  placeholder="Ví dụ: Hoàn tiền đơn lỗi, đền bù, khuyến mại..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-[#0e704b]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm active:scale-95 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{isSubmitting ? "Đang xử lý..." : "Xác nhận cộng tiền"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
