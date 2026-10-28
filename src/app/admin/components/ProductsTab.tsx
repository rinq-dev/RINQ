"use client";

import React from "react";
import {
  Package,
  Search,
  Folder,
  ImageIcon,
  Server,
  FileText,
  Edit,
  Bell,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Upload,
  RotateCcw,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { Product } from "../types";

interface ProductsTabProps {
  products: Product[];
  filteredProducts: Product[];
  supplierInfo: any;
  isCheckingSupplier: boolean;
  isSyncingSupplier: boolean;
  handleCheckSupplier: () => void;
  handleSyncSupplier: () => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  selectedProductCategory: string;
  setSelectedProductCategory: (val: string) => void;
  categoriesList: { name: string; count: number }[];
  openEditModal: (p: Product) => void;
  handleNotifyProduct: (id: number, name: string) => void;
  handleToggleProduct: (id: number, currentStatus: boolean) => void;
  handleDeleteProduct: (id: number, name: string) => void;
  // Form Create
  newProductName: string;
  setNewProductName: (val: string) => void;
  newProductPrice: string;
  setNewProductPrice: (val: string) => void;
  newProductCategory: string;
  setNewProductCategory: (val: string) => void;
  newProductImage: string;
  setNewProductImage: (val: string) => void;
  newProductDesc: string;
  setNewProductDesc: (val: string) => void;
  newFulfillmentType: string;
  setNewFulfillmentType: (val: string) => void;
  newSupplierVariantId: string;
  setNewSupplierVariantId: (val: string) => void;
  handleCreateProduct: (e: React.FormEvent) => void;
  // Form Bulk Import
  selectedProductId: string;
  setSelectedProductId: (val: string) => void;
  bulkText: string;
  setBulkText: (val: string) => void;
  notifyOnImport: boolean;
  setNotifyOnImport: (val: boolean) => void;
  isImporting: boolean;
  handleBulkImport: (e: React.FormEvent) => void;
}

export default function ProductsTab({
  products,
  filteredProducts,
  supplierInfo,
  isCheckingSupplier,
  isSyncingSupplier,
  handleCheckSupplier,
  handleSyncSupplier,
  searchQuery,
  setSearchQuery,
  selectedProductCategory,
  setSelectedProductCategory,
  categoriesList,
  openEditModal,
  handleNotifyProduct,
  handleToggleProduct,
  handleDeleteProduct,
  newProductName,
  setNewProductName,
  newProductPrice,
  setNewProductPrice,
  newProductCategory,
  setNewProductCategory,
  newProductImage,
  setNewProductImage,
  newProductDesc,
  setNewProductDesc,
  newFulfillmentType,
  setNewFulfillmentType,
  newSupplierVariantId,
  setNewSupplierVariantId,
  handleCreateProduct,
  selectedProductId,
  setSelectedProductId,
  bulkText,
  setBulkText,
  notifyOnImport,
  setNotifyOnImport,
  isImporting,
  handleBulkImport,
}: ProductsTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
      {/* CỔNG KẾT NỐI NHÀ CUNG CẤP API (LIKESUB3S) */}
      <div className="lg:col-span-12 bg-white rounded-[24px] border border-slate-200 p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-emerald-50 text-[#0e704b] flex items-center justify-center shrink-0 border border-emerald-100">
            <Server className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                Cổng Cấp Hàng Tự Động (API LikeSub3s)
              </h3>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-[#0e704b] border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                {supplierInfo?.connected
                  ? `Đã kết nối (${supplierInfo.vipLevel || "BRONZE"})`
                  : "Đang kết nối..."}
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                Tài khoản NCC: <b>@{supplierInfo?.username || "zophim"}</b>
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Tự động mua gói và gửi tài nguyên cho khách khi kho thủ công hết. Khách hoàn toàn không biết nguồn hàng.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap sm:flex-nowrap">
          <div className="px-3.5 py-1.5 rounded-2xl bg-slate-50 border border-slate-100 text-right">
            <div className="text-[10px] uppercase font-bold text-slate-500">Số dư ví NCC</div>
            <div
              className={`text-base font-extrabold ${
                Number(supplierInfo?.balanceVnd || 0) > 0
                  ? "text-[#0e704b]"
                  : "text-amber-600"
              }`}
            >
              {Number(supplierInfo?.balanceVnd || 0).toLocaleString("vi-VN")} đ
            </div>
          </div>
          <button
            type="button"
            onClick={handleCheckSupplier}
            disabled={isCheckingSupplier}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
            title="Kiểm tra lại số dư"
          >
            <RotateCcw
              className={`h-3.5 w-3.5 ${isCheckingSupplier ? "animate-spin" : ""}`}
            />
            <span>Làm mới</span>
          </button>
          <button
            type="button"
            onClick={handleSyncSupplier}
            disabled={isSyncingSupplier}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
            title="Tự động lấy sản phẩm từ API NCC và chỉ giữ hàng dưới 40.000đ"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isSyncingSupplier ? "animate-spin" : ""}`}
            />
            <span>{isSyncingSupplier ? "Đang đồng bộ..." : "Đồng bộ <40k từ API"}</span>
          </button>
          <a
            href="https://likesub3s.com"
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 rounded-xl bg-[#0e704b] hover:bg-[#0b5c3d] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <Wallet className="h-3.5 w-3.5" />
            <span>Nạp tiền NCC</span>
          </a>
        </div>
      </div>

      {/* Product List Table (8 cols) */}
      <div className="lg:col-span-8 bg-white rounded-[28px] border border-slate-200 p-5 sm:p-6 shadow-sm transition-all hover:shadow-md hover:border-slate-300">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Package className="h-5 w-5 text-[#0e704b]" />
              <span>Danh sách sản phẩm trong shop</span>
            </h2>
            <p className="text-xs text-slate-600 font-medium">Hiện có {products.length} sản phẩm</p>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm sản phẩm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-full text-xs bg-slate-50 border border-slate-200 focus:outline-none focus:border-emerald-600 w-full sm:w-48 text-slate-800 transition"
            />
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedProductCategory("ALL")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap border ${
              selectedProductCategory === "ALL"
                ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
          >
            Tất cả ({products.length})
          </button>
          {categoriesList.map((cat) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => setSelectedProductCategory(cat.name)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap border flex items-center gap-1.5 ${
                selectedProductCategory === cat.name
                  ? "bg-[#0e704b] text-white border-[#0e704b] shadow-sm"
                  : "bg-emerald-50 text-[#0e704b] border-emerald-100 hover:bg-emerald-100"
              }`}
            >
              <Folder className="h-3.5 w-3.5 shrink-0" />
              <span>{cat.name}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  selectedProductCategory === cat.name
                    ? "bg-white/20 text-white"
                    : "bg-emerald-200/60 text-[#0e704b]"
                }`}
              >
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-600 uppercase text-[10px] tracking-wider font-bold">
                <th className="pb-3">Sản phẩm</th>
                <th className="pb-3">Giá bán</th>
                <th className="pb-3">Tồn kho</th>
                <th className="pb-3">Đã bán</th>
                <th className="pb-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredProducts.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3">
                    <div className="flex items-center gap-2.5">
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="h-9 w-9 rounded-xl object-cover border border-slate-200 shrink-0 shadow-xs"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-400 shrink-0">
                          <ImageIcon className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="text-xs text-slate-600 flex items-center gap-1 mt-0.5 flex-wrap">
                          {p.category && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-700">
                              {p.category}
                            </span>
                          )}
                          {p.supplierVariantId ? (
                            <span
                              className="inline-flex items-center gap-1 rounded bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.2 text-[10px] font-bold"
                              title={`Nguồn cấp ${p.fulfillmentType || "HYBRID"}: ${p.supplierVariantId}`}
                            >
                              <Server className="h-2.5 w-2.5 shrink-0 text-blue-600" />
                              <span>
                                {p.fulfillmentType === "API" ? "Chỉ API" : "Hybrid"}: {p.supplierVariantId}
                              </span>
                            </span>
                          ) : (
                            <span className="rounded bg-slate-50 text-slate-500 border border-slate-200 px-1.5 py-0.2 text-[10px] font-medium">
                              Thủ công
                            </span>
                          )}
                          {p.priceNote && (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 text-[10px] font-bold">
                              <FileText className="h-2.5 w-2.5 shrink-0 text-amber-600" />
                              <span>{p.priceNote}</span>
                            </span>
                          )}
                          <span className="truncate max-w-xs">{p.description || "Không có mô tả"}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 font-extrabold text-[#0e704b] whitespace-nowrap">
                    {p.price.toLocaleString("vi-VN")} đ
                  </td>
                  <td className="py-3 whitespace-nowrap">
                    {p.stockAvailable > 0 ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-[#0e704b] border border-emerald-100">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                        Còn {p.stockAvailable}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-600 border border-rose-100">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                        Hết
                      </span>
                    )}
                  </td>
                  <td className="py-3 font-bold text-slate-700 whitespace-nowrap">
                    {p.stockSold} cái
                  </td>
                  <td className="py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openEditModal(p)}
                        title="Sửa giá, tên & ghi chú"
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-[#0e704b] hover:text-white text-slate-600 transition"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleNotifyProduct(p.id, p.name)}
                        title="Bắn thông báo Telegram hàng về"
                        className="p-1.5 rounded-lg bg-pink-50 hover:bg-pink-600 hover:text-white text-pink-600 transition"
                      >
                        <Bell className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleToggleProduct(p.id, p.isActive)}
                        title={p.isActive ? "Đang hiện (Bấm để ẩn)" : "Đang ẩn (Bấm để hiện)"}
                        className={`p-1.5 rounded-lg transition ${
                          p.isActive
                            ? "bg-emerald-50 text-[#0e704b] hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {p.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(p.id, p.name)}
                        title="Xóa sản phẩm"
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side Forms: Create Product & Bulk Import (4 cols) */}
      <div className="lg:col-span-4 space-y-6">
        {/* Form Tạo Sản Phẩm */}
        <div className="bg-white rounded-[28px] border border-slate-200 p-5 sm:p-6 shadow-sm transition-all hover:shadow-md hover:border-slate-300">
          <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-2 mb-3">
            <Plus className="h-4 w-4 text-[#0e704b]" />
            <span>Thêm sản phẩm mới</span>
          </h3>

          <form onSubmit={handleCreateProduct} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Tên sản phẩm *
              </label>
              <input
                type="text"
                placeholder="VD: ChatGPT Plus 1 Tháng"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Giá bán (VNĐ) *
                </label>
                <input
                  type="number"
                  placeholder="VD: 99000"
                  value={newProductPrice}
                  onChange={(e) => setNewProductPrice(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-[#0e704b] focus:outline-none focus:border-emerald-600"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Danh mục (VD: Gemini, Netflix...)
                </label>
                <input
                  type="text"
                  placeholder="Nhập hoặc chọn danh mục (VD: Gemini)"
                  value={newProductCategory}
                  onChange={(e) => setNewProductCategory(e.target.value)}
                  list="category-suggestions"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 font-medium"
                />
                <datalist id="category-suggestions">
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
              </div>
            </div>

            {/* Quick category preset chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[10px] text-slate-400 font-medium">Gợi ý danh mục:</span>
              {["Gemini", "Netflix", "ChatGPT", "Canva", "Youtube Premium", "Spotify"].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setNewProductCategory(preset)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition border ${
                    newProductCategory.toLowerCase() === preset.toLowerCase()
                      ? "bg-[#0e704b] text-white border-[#0e704b]"
                      : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-[#0e704b]"
                  }`}
                >
                  +{preset}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center justify-between">
                <span>Ảnh sản phẩm (URL Banner/Thumbnail)</span>
                <span className="text-[10px] text-slate-400 font-normal">Tùy chọn</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  placeholder="https://... link ảnh banner"
                  value={newProductImage}
                  onChange={(e) => setNewProductImage(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 font-mono"
                />
                {newProductImage && (
                  <img
                    src={newProductImage}
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
                Mô tả ngắn
              </label>
              <textarea
                rows={2}
                placeholder="Bảo hành 30 ngày, tự động gửi key sau khi chuyển khoản..."
                value={newProductDesc}
                onChange={(e) => setNewProductDesc(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            {/* Nguồn cấp hàng tự động API */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Server className="h-3.5 w-3.5 text-[#0e704b]" />
                <span>Nguồn Cấp Hàng Tự Động (API LikeSub3s)</span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Chế độ cấp hàng
                </label>
                <select
                  value={newFulfillmentType}
                  onChange={(e) => setNewFulfillmentType(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-600 font-medium"
                >
                  <option value="HYBRID">Hybrid (Kho ưu tiên, hết tự mua API)</option>
                  <option value="MANUAL">Chỉ bán kho thủ công (Manual)</option>
                  <option value="API">Chỉ mua tự động qua API (API Only)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Mã gói NCC (API Variant ID)
                </label>
                <input
                  type="text"
                  placeholder="VD: Mã variant bên LikeSub3s (tùy chọn)"
                  value={newSupplierVariantId}
                  onChange={(e) => setNewSupplierVariantId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Tự động đặt hàng NCC khi khách thanh toán mà khách không hề biết. Để trống nếu chỉ bán thủ công.
                </p>
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded-full bg-[#0e704b] hover:bg-[#0a5c3d] text-white py-2.5 text-xs font-bold transition shadow-sm active:scale-95"
            >
              + Tạo sản phẩm ngay
            </button>
          </form>
        </div>

        {/* Form Nạp kho hàng loạt */}
        <div className="bg-white rounded-[28px] border border-slate-200 p-5 sm:p-6 shadow-sm transition-all hover:shadow-md hover:border-slate-300">
          <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-2 mb-3">
            <Upload className="h-4 w-4 text-[#0e704b]" />
            <span>Nạp kho hàng loạt (Bulk Import)</span>
          </h3>

          <form onSubmit={handleBulkImport} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Chọn sản phẩm nạp *
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-600"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.category ? `[${p.category}] ` : ""}{p.name} (Tồn: {p.stockAvailable})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-slate-600">
                  Dữ liệu (Mỗi dòng 1 key/tài khoản) *
                </label>
                <span className="text-[11px] font-bold text-[#0e704b]">
                  {bulkText.split(/\r?\n/).filter((l) => l.trim()).length} cái
                </span>
              </div>
              <textarea
                rows={4}
                placeholder={`user1|pass1\nuser2|pass2\nKEY-ABC-123`}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                className="w-full font-mono rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="notifyStock"
                checked={notifyOnImport}
                onChange={(e) => setNotifyOnImport(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <label htmlFor="notifyStock" className="text-xs text-slate-600 cursor-pointer font-medium select-none">
                Tự động bắn thông báo Telegram khi nạp xong
              </label>
            </div>

            <button
              type="submit"
              disabled={isImporting}
              className="w-full rounded-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 text-xs font-bold transition shadow-sm disabled:opacity-50 active:scale-95"
            >
              {isImporting ? "Đang nạp..." : "Nạp vào kho ngay"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

