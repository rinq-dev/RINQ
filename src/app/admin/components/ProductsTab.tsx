"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Package,
  Search,
  Folder,
  ImageIcon,
  Server,
  FileText,
  Bell,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Upload,
  RotateCcw,
  RefreshCw,
  Wallet,
  MoreHorizontal,
  X,
  Grid2X2,
  List,
  Pencil,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
} from "lucide-react";
import { Product } from "../types";
import ProductImageField from "./ProductImageField";
import ScoopyImportPanel from "./ScoopyImportPanel";
import RoboticImportPanel from "./RoboticImportPanel";

interface ProductsTabProps {
  products: Product[];
  filteredProducts: Product[];
  supplierInfo: any;
  isCheckingSupplier: boolean;
  isSyncingSupplier: boolean;
  handleCheckSupplier: () => void;
  handleSyncSupplier: () => void;
  onScoopyImported: () => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  selectedProductCategory: string;
  setSelectedProductCategory: (val: string) => void;
  categoriesList: { name: string; count: number }[];
  handleRenameCategory: (oldName: string, newName: string) => Promise<boolean>;
  openEditModal: (p: Product) => void;
  handleNotifyProduct: (id: number, name: string) => void;
  handleToggleProduct: (id: number, currentStatus: boolean) => void;
  handleDeleteProduct: (id: number, name: string, reason: string, notifyUsers: boolean) => Promise<void>;
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
  newProductWarranty: string;
  setNewProductWarranty: (val: string) => void;
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
  onScoopyImported,
  searchQuery,
  setSearchQuery,
  selectedProductCategory,
  setSelectedProductCategory,
  categoriesList,
  handleRenameCategory,
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
  newProductWarranty,
  setNewProductWarranty,
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
  const [supplierPanel, setSupplierPanel] = useState<"robotic" | "scoopy">("robotic");
  const [showSupplierWorkspace, setShowSupplierWorkspace] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [isRenamingCategory, setIsRenamingCategory] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [notifyOnDelete, setNotifyOnDelete] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const categoriesRef = React.useRef<HTMLDivElement>(null);
  const [quickStockTarget, setQuickStockTarget] = useState<Product | null>(null);
  const [quickStockText, setQuickStockText] = useState("");
  const [quickNotify, setQuickNotify] = useState(true);
  const [isSubmittingQuickStock, setIsSubmittingQuickStock] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const scrollCategoryTabs = (amount: number) => {
    if (categoriesRef.current) {
      categoriesRef.current.scrollBy({ left: amount, behavior: "smooth" });
    }
  };

  const handleQuickStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickStockTarget || !quickStockText.trim()) return;
    setIsSubmittingQuickStock(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "BULK_IMPORT",
          productId: quickStockTarget.id,
          rawLines: quickStockText,
          notifyUsers: quickNotify,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setQuickStockTarget(null);
        setQuickStockText("");
        onScoopyImported();
      } else {
        alert(data.error || "Lỗi nạp kho");
      }
    } catch (err: any) {
      alert(err.message || "Lỗi kết nối");
    } finally {
      setIsSubmittingQuickStock(false);
    }
  };

  const openRenameCategory = (name: string) => {
    setEditingCategory(name);
    setCategoryDraft(name === "Chưa phân loại" ? "" : name);
  };

  const submitRenameCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingCategory || !categoryDraft.trim()) return;
    setIsRenamingCategory(true);
    const didRename = await handleRenameCategory(editingCategory, categoryDraft);
    setIsRenamingCategory(false);
    if (didRename) {
      setEditingCategory(null);
      setCategoryDraft("");
    }
  };

  const openDeleteProduct = (product: Product) => {
    setDeleteTarget(product);
    setDeleteReason("");
    setNotifyOnDelete(false);
  };

  const submitDeleteProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!deleteTarget || (notifyOnDelete && !deleteReason.trim())) return;
    setIsDeleting(true);
    await handleDeleteProduct(deleteTarget.id, deleteTarget.name, deleteReason.trim(), notifyOnDelete);
    setIsDeleting(false);
    setDeleteTarget(null);
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
      <div className="lg:col-span-12 flex flex-col gap-3 border-2 border-black bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Kho API</p><h2 className="mt-1 text-lg font-black uppercase">Nhập hàng từ nhà cung cấp</h2></div>
        <button type="button" onClick={() => setShowSupplierWorkspace((open) => !open)} className="min-h-10 border-2 border-black bg-black px-4 text-xs font-black uppercase text-white hover:bg-[#2457C5]">{showSupplierWorkspace ? "Đóng khu nhập hàng" : "Mở khu nhập hàng"}</button>
      </div>
      {showSupplierWorkspace && <div className="lg:col-span-12"><div className="mb-3 flex gap-2"><button type="button" onClick={() => setSupplierPanel("robotic")} className={`min-h-9 border-2 border-black px-3 text-xs font-black uppercase ${supplierPanel === "robotic" ? "bg-[#2457C5] text-white" : "bg-white"}`}>RoboticVN</button><button type="button" onClick={() => setSupplierPanel("scoopy")} className={`min-h-9 border-2 border-black px-3 text-xs font-black uppercase ${supplierPanel === "scoopy" ? "bg-[#E63946] text-white" : "bg-white"}`}>ScoopyVN</button></div>{supplierPanel === "robotic" ? <RoboticImportPanel onImported={onScoopyImported} categoriesList={categoriesList} /> : <ScoopyImportPanel onImported={onScoopyImported} categoriesList={categoriesList} />}</div>}

      {/* Product List Table (8 cols) */}
      <div className="lg:col-span-12 bg-white rounded-[28px] border border-slate-200 p-5 sm:p-6 shadow-sm transition-all hover:shadow-md hover:border-slate-300">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Package className="h-5 w-5 text-[#0e704b]" />
              <span>Danh sách sản phẩm trong shop</span>
            </h2>
            <p className="text-xs text-slate-600 font-medium">Hiện có {products.length} sản phẩm</p>
          </div>

          {/* Actions & Search box */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("create-product-section");
                if (el) {
                  el.scrollIntoView({ behavior: "smooth" });
                  const inp = el.querySelector("input");
                  if (inp) inp.focus();
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#0e704b] hover:bg-[#0a5c3d] text-white px-3.5 py-1.5 text-xs font-bold transition shadow-sm shrink-0 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Thêm sản phẩm</span>
            </button>
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm kiếm sản phẩm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-full text-xs bg-slate-50 border border-slate-200 focus:outline-none focus:border-emerald-600 w-full sm:w-44 text-slate-800 transition"
              />
            </div>
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5" aria-label="Kiểu hiển thị">
              <button type="button" onClick={() => setViewMode("list")} className={`rounded-md p-1.5 ${viewMode === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"}`} aria-label="Hiển thị danh sách"><List className="h-4 w-4" /></button>
              <button type="button" onClick={() => setViewMode("grid")} className={`rounded-md p-1.5 ${viewMode === "grid" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"}`} aria-label="Hiển thị lưới"><Grid2X2 className="h-4 w-4" /></button>
            </div>
          </div>
        </div>

        {/* Category Filter Tabs with Horizontal Scroll Controls */}
        <div className="relative mb-4">
          <button
            type="button"
            onClick={() => scrollCategoryTabs(-200)}
            title="Cuộn sang trái"
            className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 hidden sm:flex h-7 w-7 items-center justify-center rounded-full bg-white border border-slate-300 shadow-md text-slate-700 hover:bg-slate-100 hover:text-black transition"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div
            ref={categoriesRef}
            onWheel={(e) => {
              if (e.deltaY !== 0) {
                e.currentTarget.scrollLeft += e.deltaY;
              }
            }}
            className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent select-none px-1"
          >
            <button
              type="button"
              onClick={() => setSelectedProductCategory("ALL")}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap border shrink-0 ${
                selectedProductCategory === "ALL"
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              Tất cả ({products.length})
            </button>
            {categoriesList.map((cat) => {
              const isSelected = selectedProductCategory === cat.name;
              return (
                <div key={cat.name} className={`flex shrink-0 items-center rounded-full border transition ${isSelected ? "border-[#0e704b] bg-[#0e704b] text-white shadow-sm" : "border-emerald-100 bg-emerald-50 text-[#0e704b] hover:bg-emerald-100"}`}>
                  <button type="button" onClick={() => setSelectedProductCategory(cat.name)} className="flex items-center gap-1.5 py-1.5 pl-3 pr-1 text-xs font-bold whitespace-nowrap">
                    <Folder className="h-3.5 w-3.5 shrink-0" />
                    <span>{cat.name}</span>
                    <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${isSelected ? "bg-white/20 text-white" : "bg-emerald-200/60 text-[#0e704b]"}`}>{cat.count}</span>
                  </button>
                  <button type="button" onClick={() => openRenameCategory(cat.name)} className={`mr-1 rounded-full p-1.5 transition ${isSelected ? "text-white/80 hover:bg-white/20 hover:text-white" : "text-[#0e704b]/60 hover:bg-white hover:text-[#0e704b]"}`} aria-label={`Sửa tên danh mục ${cat.name}`} title="Sửa tên danh mục">
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => scrollCategoryTabs(200)}
            title="Cuộn sang phải"
            className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 hidden sm:flex h-7 w-7 items-center justify-center rounded-full bg-white border border-slate-300 shadow-md text-slate-700 hover:bg-slate-100 hover:text-black transition"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className={viewMode === "list" ? "overflow-x-auto" : "hidden"}>
          <table className="w-full table-fixed text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-600 uppercase text-[10px] tracking-wider font-bold">
                <th className="w-[48%] pb-3">Sản phẩm</th>
                <th className="w-[14%] pb-3">Giá bán</th>
                <th className="w-[12%] pb-3">Tồn kho</th>
                <th className="w-[8%] pb-3">Đã bán</th>
                <th className="w-[18%] pb-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredProducts.map((p) => (
                <tr key={p.id} className="group hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 pr-4 align-middle">
                    <div className="flex items-center gap-2.5">
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="h-10 w-10 rounded-xl object-cover border border-slate-200 shrink-0"
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
                        <button type="button" onClick={() => setSelectedProduct(p)} className="text-left font-bold text-slate-900 leading-5 hover:text-[#0e704b]">{p.name}</button>
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                          <button
                            type="button"
                            onClick={() => openEditModal(p)}
                            title="Bấm để đổi folder / danh mục"
                            className="inline-flex items-center gap-1 rounded bg-slate-100 hover:bg-emerald-100 hover:text-[#0e704b] px-1.5 py-0.5 font-bold text-slate-700 transition"
                          >
                            <Folder className="h-3 w-3 text-slate-400" />
                            <span>{p.category || "Chưa phân loại"}</span>
                          </button>
                          {p.supplierVariantId?.startsWith("SCOOPY:") ? (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 font-bold text-amber-800">
                              <Server className="h-2.5 w-2.5" />
                              ScoopyVN
                            </span>
                          ) : p.supplierVariantId?.startsWith("ROBOTIC:") ? (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 font-bold text-blue-700"><Server className="h-2.5 w-2.5" />RoboticVN</span>
                          ) : p.supplierVariantId ? (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 font-bold text-blue-700"><Server className="h-2.5 w-2.5" />API</span>
                          ) : (
                            <span className="rounded bg-slate-50 px-1.5 py-0.5 font-medium text-slate-500">Thủ công</span>
                          )}
                          {p.priceNote && (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 font-bold text-amber-700">
                              <FileText className="h-2.5 w-2.5 shrink-0 text-amber-600" />
                              Ghi chú giá
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 align-middle font-extrabold text-[#0e704b] whitespace-nowrap">
                    {p.price.toLocaleString("vi-VN")} đ
                  </td>
                  <td className="py-2.5 align-middle whitespace-nowrap">
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
                  <td className="py-2.5 align-middle font-bold text-slate-700 whitespace-nowrap">
                    {p.stockSold} cái
                  </td>
                  <td className="py-2.5 align-middle text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setQuickStockTarget(p);
                          setQuickStockText("");
                          setQuickNotify(true);
                        }}
                        title="Nạp thêm kho nhanh cho sản phẩm này"
                        aria-label={`Nạp kho ${p.name}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1.5 text-xs font-bold text-[#0e704b] hover:bg-[#0e704b] hover:text-white transition shadow-sm"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        <span className="hidden xl:inline">Nạp kho</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(p)}
                        title="Chỉnh sửa sản phẩm"
                        aria-label={`Sửa ${p.name}`}
                        className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-[#0e704b] transition"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleProduct(p.id, p.isActive)}
                        title={p.isActive ? "Đang hiện (bấm để ẩn)" : "Đang ẩn (bấm để hiện)"}
                        aria-label={`Ẩn/Hiện ${p.name}`}
                        className={`rounded-lg p-1.5 transition ${p.isActive ? "text-slate-500 hover:bg-slate-100 hover:text-slate-800" : "text-amber-600 bg-amber-50 hover:bg-amber-100"}`}
                      >
                        {p.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNotifyProduct(p.id, p.name)}
                        title="Gửi thông báo Telegram"
                        aria-label={`Thông báo ${p.name}`}
                        className="rounded-lg p-1.5 text-pink-600 hover:bg-pink-50 transition"
                      >
                        <Bell className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openDeleteProduct(p)}
                        title="Xóa sản phẩm"
                        aria-label={`Xóa ${p.name}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-600 hover:text-white transition shadow-sm"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="hidden xl:inline">Xóa</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={viewMode === "grid" ? "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" : "hidden"}>
          {filteredProducts.map((p) => (
            <article key={p.id} className="group relative rounded-2xl border border-slate-200 bg-slate-50/60 p-4 transition hover:border-slate-300 hover:bg-white">
              <div className="flex items-start gap-3">
                {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" /> : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-slate-400"><ImageIcon className="h-5 w-5" /></div>}
                <div className="min-w-0 flex-1"><button type="button" onClick={() => setSelectedProduct(p)} className="line-clamp-2 text-left text-sm font-extrabold leading-5 text-slate-900 hover:text-[#0e704b]">{p.name}</button><div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold"><button type="button" onClick={() => openEditModal(p)} title="Bấm để đổi folder / danh mục" className="inline-flex items-center gap-1 rounded bg-white px-1.5 py-1 text-slate-600 hover:bg-emerald-100 hover:text-[#0e704b] transition"><Folder className="h-2.5 w-2.5 text-slate-400" /><span>{p.category || "Chưa phân loại"}</span></button><span className={`rounded px-1.5 py-1 ${p.supplierVariantId ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}>{p.supplierVariantId?.startsWith("ROBOTIC:") ? "RoboticVN" : p.supplierVariantId?.startsWith("SCOOPY:") ? "ScoopyVN" : p.supplierVariantId ? "API" : "Thủ công"}</span></div></div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setQuickStockTarget(p);
                      setQuickStockText("");
                      setQuickNotify(true);
                    }}
                    title="Nạp kho nhanh"
                    className="rounded-lg bg-emerald-50 p-1.5 text-[#0e704b] hover:bg-[#0e704b] hover:text-white transition"
                  >
                    <Upload className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditModal(p)}
                    title="Chỉnh sửa sản phẩm"
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-[#0e704b] transition"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleProduct(p.id, p.isActive)}
                    title={p.isActive ? "Đang hiện (bấm để ẩn)" : "Đang ẩn (bấm để hiện)"}
                    className={`rounded-lg p-1.5 transition ${p.isActive ? "text-slate-500 hover:bg-white" : "text-amber-600 bg-amber-50"}`}
                  >
                    {p.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => openDeleteProduct(p)}
                    title="Xóa sản phẩm"
                    className="rounded-lg bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-600 hover:text-white transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-4 flex items-end justify-between border-t border-slate-200 pt-3"><div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Giá bán</p><p className="mt-0.5 text-lg font-black text-[#0e704b]">{p.price.toLocaleString("vi-VN")} đ</p></div><div className="text-right"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Tồn kho</p><p className={`mt-0.5 text-sm font-extrabold ${p.stockAvailable > 0 ? "text-emerald-700" : "text-rose-600"}`}>{p.stockAvailable > 0 ? `${p.stockAvailable} cái` : "Hết hàng"}</p></div></div>
            </article>
          ))}
        </div>
      </div>

      {mounted && typeof document !== "undefined" && editingCategory && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 overflow-y-auto" role="presentation" onMouseDown={() => !isRenamingCategory && setEditingCategory(null)}>
          <form role="dialog" aria-modal="true" aria-labelledby="rename-category-title" onSubmit={submitRenameCategory} onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl my-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Danh mục sản phẩm</p>
                <h2 id="rename-category-title" className="mt-1 text-lg font-black text-slate-900">Sửa tên danh mục</h2>
              </div>
              <button type="button" onClick={() => setEditingCategory(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Đóng">
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="mt-5 block text-xs font-bold uppercase tracking-wide text-slate-600">
              Tên mới
              <input autoFocus value={categoryDraft} onChange={(event) => setCategoryDraft(event.target.value)} maxLength={120} placeholder="Ví dụ: Tài khoản AI" className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#0e704b] focus:ring-2 focus:ring-emerald-100" />
            </label>
            <p className="mt-2 text-xs text-slate-500">Đổi tên sẽ cập nhật toàn bộ sản phẩm trong danh mục này.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={isRenamingCategory} onClick={() => setEditingCategory(null)} className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50">Hủy</button>
              <button type="submit" disabled={isRenamingCategory || !categoryDraft.trim()} className="min-h-10 rounded-xl bg-[#0e704b] px-4 text-sm font-bold text-white hover:bg-[#095c3d] disabled:cursor-not-allowed disabled:opacity-50">{isRenamingCategory ? "Đang lưu…" : "Lưu tên mới"}</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {mounted && typeof document !== "undefined" && deleteTarget && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 overflow-y-auto" role="presentation" onMouseDown={() => !isDeleting && setDeleteTarget(null)}>
          <form role="dialog" aria-modal="true" aria-labelledby="delete-product-title" onSubmit={submitDeleteProduct} onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl my-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-rose-600">Xóa sản phẩm</p>
                <h2 id="delete-product-title" className="mt-1 text-lg font-black text-slate-900">{deleteTarget.name}</h2>
              </div>
              <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Đóng">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-sm text-slate-600">
              Bạn có chắc chắn muốn xóa sản phẩm <b>{deleteTarget.name}</b>? Toàn bộ tồn kho và dữ liệu liên quan sẽ được dọn dẹp sạch sẽ.
            </p>

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <input type="checkbox" checked={notifyOnDelete} onChange={(event) => setNotifyOnDelete(event.target.checked)} className="mt-0.5 h-4 w-4 accent-rose-600" />
              <span>
                <span className="block text-sm font-bold text-slate-900">Gửi thông báo gỡ hàng cho khách qua Bot</span>
                <span className="mt-0.5 block text-xs text-slate-500">Mặc định tắt. Chỉ bật nếu muốn thông báo toàn bộ người theo dõi bot.</span>
              </span>
            </label>

            {notifyOnDelete && (
              <label className="mt-3 block text-xs font-bold uppercase tracking-wide text-slate-600">
                Lý do gỡ sản phẩm <span className="text-rose-600">*</span>
                <textarea value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} maxLength={500} rows={2} placeholder="Ví dụ: Nhà cung cấp ngừng hỗ trợ gói..." className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100" />
              </label>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={isDeleting} onClick={() => setDeleteTarget(null)} className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50">
                Hủy
              </button>
              <button type="submit" disabled={isDeleting || (notifyOnDelete && !deleteReason.trim())} className="min-h-10 rounded-xl bg-rose-600 px-5 text-sm font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50">
                {isDeleting ? "Đang xóa…" : notifyOnDelete ? "Xóa & Báo khách" : "Xóa vĩnh viễn"}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {mounted && typeof document !== "undefined" && selectedProduct && createPortal(
        <div className="fixed inset-0 z-[9999] flex justify-end bg-black/40" role="presentation" onClick={() => setSelectedProduct(null)}>
          <aside role="dialog" aria-modal="true" aria-label="Chi tiết sản phẩm" onClick={(event) => event.stopPropagation()} className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Chi tiết sản phẩm</p>
                <h2 className="mt-1 text-xl font-black text-slate-900">{selectedProduct.name}</h2>
              </div>
              <button type="button" onClick={() => setSelectedProduct(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Đóng">
                <X className="h-5 w-5" />
              </button>
            </div>
            {selectedProduct.imageUrl ? (
              <img src={selectedProduct.imageUrl} alt="" className="mt-5 h-40 w-full rounded-2xl object-cover" />
            ) : (
              <div className="mt-5 flex h-40 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <ImageIcon className="h-8 w-8" />
              </div>
            )}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-500">Giá bán</p>
                <p className="mt-1 text-lg font-black text-[#0e704b]">{selectedProduct.price.toLocaleString("vi-VN")} đ</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-500">Tồn kho</p>
                <p className="mt-1 text-lg font-black text-slate-900">{selectedProduct.stockAvailable} cái</p>
              </div>
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <div>
                <dt className="text-xs font-bold uppercase text-slate-500">Danh mục</dt>
                <dd className="mt-1 font-semibold text-slate-900">{selectedProduct.category || "Chưa phân loại"}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-slate-500">Nguồn cấp</dt>
                <dd className="mt-1 font-semibold text-slate-900">{selectedProduct.supplierVariantId?.startsWith("ROBOTIC:") ? "RoboticVN" : selectedProduct.supplierVariantId?.startsWith("SCOOPY:") ? "ScoopyVN" : selectedProduct.supplierVariantId ? "API" : "Thủ công"}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-slate-500">Mô tả</dt>
                <dd className="mt-1 whitespace-pre-wrap text-slate-700">{selectedProduct.description || "Chưa có mô tả"}</dd>
              </div>
              {selectedProduct.warranty && (
                <div>
                  <dt className="text-xs font-bold uppercase text-slate-500">Bảo hành</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-slate-700">{selectedProduct.warranty}</dd>
                </div>
              )}
            </dl>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const prod = selectedProduct;
                  setSelectedProduct(null);
                  setQuickStockTarget(prod);
                  setQuickStockText("");
                  setQuickNotify(true);
                }}
                className="rounded-xl bg-emerald-50 px-4 py-3 text-xs font-bold text-[#0e704b] hover:bg-emerald-100 transition"
              >
                Nạp kho
              </button>
              <button type="button" onClick={() => { openEditModal(selectedProduct); setSelectedProduct(null); }} className="flex-1 min-w-[120px] rounded-xl bg-[#0e704b] px-4 py-3 text-xs font-bold text-white hover:bg-[#0a5c3d] transition">Sửa sản phẩm</button>
              <button type="button" onClick={() => { handleNotifyProduct(selectedProduct.id, selectedProduct.name); setSelectedProduct(null); }} className="rounded-xl bg-pink-50 px-4 py-3 text-xs font-bold text-pink-600 hover:bg-pink-100 transition">Thông báo</button>
              <button type="button" onClick={() => { const prod = selectedProduct; setSelectedProduct(null); openDeleteProduct(prod); }} className="rounded-xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-600 hover:bg-rose-100 transition">Xóa sản phẩm</button>
            </div>
          </aside>
        </div>,
        document.body
      )}

      {/* Quick Stock-in Modal */}
      {mounted && typeof document !== "undefined" && quickStockTarget && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 overflow-y-auto" role="presentation" onMouseDown={() => !isSubmittingQuickStock && setQuickStockTarget(null)}>
          <form role="dialog" aria-modal="true" aria-labelledby="quick-stock-title" onSubmit={handleQuickStockSubmit} onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl my-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Nạp kho nhanh</p>
                <h2 id="quick-stock-title" className="mt-1 text-base font-black text-slate-900 line-clamp-1">{quickStockTarget.name}</h2>
                <p className="mt-0.5 text-xs text-slate-500 font-medium">Hiện có: <b className="text-[#0e704b]">{quickStockTarget.stockAvailable}</b> tồn kho</p>
              </div>
              <button type="button" onClick={() => setQuickStockTarget(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Đóng">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4">
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-600">
                  Dữ liệu tài khoản / Key <span className="text-rose-500">*</span>
                </label>
                <span className="text-xs font-bold text-[#0e704b]">
                  {quickStockText.split(/\r?\n/).filter((l) => l.trim()).length} dòng
                </span>
              </div>
              <textarea
                autoFocus
                rows={6}
                placeholder={`mail1@gmail.com|pass123\nmail2@gmail.com|pass456\nKEY-ABC-XYZ`}
                value={quickStockText}
                onChange={(e) => setQuickStockText(e.target.value)}
                className="w-full font-mono rounded-xl border border-slate-300 p-3 text-xs text-slate-900 outline-none focus:border-[#0e704b] focus:ring-2 focus:ring-emerald-100"
                required
              />
              <p className="mt-1 text-[11px] text-slate-500">Mỗi dòng là 1 key hoặc tài khoản. Hệ thống tự tách từng dòng thành 1 sản phẩm bán.</p>
            </div>

            <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <input
                type="checkbox"
                checked={quickNotify}
                onChange={(e) => setQuickNotify(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="text-xs font-medium text-slate-700 select-none">
                Tự động gửi thông báo hàng về kho qua Telegram Bot
              </span>
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={isSubmittingQuickStock} onClick={() => setQuickStockTarget(null)} className="min-h-10 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600 hover:bg-slate-50">
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmittingQuickStock || !quickStockText.trim()}
                className="inline-flex items-center gap-1.5 min-h-10 rounded-xl bg-[#0e704b] px-4 text-xs font-bold text-white hover:bg-[#095c3d] disabled:cursor-not-allowed disabled:opacity-50 transition active:scale-95"
              >
                {isSubmittingQuickStock ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    <span>Đang nạp…</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    <span>Nạp kho ({quickStockText.split(/\r?\n/).filter((l) => l.trim()).length})</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* Side Forms: Create Product & Bulk Import (4 cols) */}
      <div className="lg:col-span-12 grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Form Tạo Sản Phẩm */}
        <div id="create-product-section" className="lg:col-span-7 rounded-[24px] border border-slate-200 bg-white p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Sản phẩm mới</p><h3 className="mt-1 flex items-center gap-2 text-lg font-black text-slate-900"><Plus className="h-5 w-5 text-[#0e704b]" />Thêm sản phẩm</h3></div><span className="text-xs text-slate-500">Các trường * bắt buộc</span></div>

          <form onSubmit={handleCreateProduct} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Tên sản phẩm *
              </label>
              <input
                type="text"
                placeholder="Tên sản phẩm"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Giá bán (VNĐ) *
                </label>
                <input
                  type="number"
                  placeholder="Giá bán VNĐ"
                  value={newProductPrice}
                  onChange={(e) => setNewProductPrice(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-[#0e704b] focus:outline-none focus:border-emerald-600"
                  required
                />
              </div>
              <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Danh mục
                </label>
                <input
                  type="text"
                  placeholder="Chọn hoặc nhập danh mục"
                  value={newProductCategory}
                  onChange={(e) => setNewProductCategory(e.target.value)}
                  list="category-suggestions"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 font-medium"
                />
                <datalist id="category-suggestions">
                  {categoriesList.map((c) => (
                    <option key={c.name} value={c.name} />
                  ))}
                  <option value="AI & Trí tuệ nhân tạo" />
                  <option value="Giải trí & Streaming" />
                  <option value="Đồ họa & Sáng tạo" />
                  <option value="Văn phòng & Công việc" />
                  <option value="Mạng & Bảo mật" />
                  <option value="Học tập & Ngoại ngữ" />
                  <option value="Dịch vụ & Tiện ích khác" />
                </datalist>
              </div>
            </div>

            {/* Quick category preset chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[10px] text-slate-400 font-medium">Gợi ý:</span>
              {["AI & Trí tuệ nhân tạo", "Giải trí & Streaming", "Đồ họa & Sáng tạo", "Văn phòng & Công việc", "Mạng & Bảo mật", "Học tập & Ngoại ngữ"].map((preset) => (
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

            <ProductImageField id="new-product-image" value={newProductImage} onChange={setNewProductImage} />

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Mô tả sản phẩm
              </label>
              <textarea
                rows={4}
                placeholder="Thông tin chi tiết, định dạng tài khoản hiển thị cho khách..."
                value={newProductDesc}
                onChange={(e) => setNewProductDesc(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Bảo hành
              </label>
              <textarea
                rows={3}
                placeholder="Ví dụ: Bảo hành 1 giờ sau thanh toán"
                value={newProductWarranty}
                onChange={(e) => setNewProductWarranty(e.target.value)}
                className="w-full rounded-xl border border-violet-200 bg-violet-50/50 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-violet-400"
              />
            </div>

            {/* Nguồn cấp hàng tự động API */}
            <details className="rounded-2xl border border-slate-200 bg-slate-50"><summary className="cursor-pointer px-4 py-3 text-xs font-bold text-slate-800">Cấp hàng tự động qua API <span className="font-normal text-slate-500">(tuỳ chọn)</span></summary><div className="space-y-3 border-t border-slate-200 p-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Server className="h-3.5 w-3.5 text-[#0e704b]" />
                <span>Nguồn cấp hàng API</span>
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
                  <option value="HYBRID">Hybrid · ưu tiên kho nội bộ</option>
                  <option value="MANUAL">Chỉ kho nội bộ</option>
                  <option value="API">Chỉ API</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Mã gói NCC (API Variant ID)
                </label>
                <input
                  type="text"
                  placeholder="variant_..."
                  value={newSupplierVariantId}
                  onChange={(e) => setNewSupplierVariantId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 font-mono"
                />
              </div>
            </div></details>

            <button
              type="submit"
              className="w-full rounded-full bg-[#0e704b] hover:bg-[#0a5c3d] text-white py-2.5 text-xs font-bold transition shadow-sm active:scale-95"
            >
              Tạo sản phẩm
            </button>
          </form>
        </div>

        {/* Form Nạp kho hàng loạt */}
        <div className="lg:col-span-5 rounded-[24px] border border-slate-200 bg-white p-5 sm:p-6">
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

