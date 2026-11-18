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
  X,
  Grid2X2,
  List,
  Pencil,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  BookOpen,
  Sparkles,
  Wand2,
  ExternalLink,
  Check,
  ShieldCheck,
} from "lucide-react";
import { Product } from "../types";
import ProductImageField from "./ProductImageField";
import ScoopyImportPanel from "./ScoopyImportPanel";
import RoboticImportPanel from "./RoboticImportPanel";
import SupplierAlertBanner from "./SupplierAlertBanner";
import { GUIDES_CATALOG, predictGuideUrl } from "@/lib/guides-catalog";

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
  newProductFakeStock: string;
  setNewProductFakeStock: (val: string) => void;
  newProductCategory: string;
  setNewProductCategory: (val: string) => void;
  newProductImage: string;
  setNewProductImage: (val: string) => void;
  newProductDesc: string;
  setNewProductDesc: (val: string) => void;
  newProductWarranty: string;
  setNewProductWarranty: (val: string) => void;
  newProductGuideUrl: string;
  setNewProductGuideUrl: (val: string) => void;
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
  newProductFakeStock,
  setNewProductFakeStock,
  newProductCategory,
  setNewProductCategory,
  newProductImage,
  setNewProductImage,
  newProductDesc,
  setNewProductDesc,
  newProductWarranty,
  setNewProductWarranty,
  newProductGuideUrl,
  setNewProductGuideUrl,
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
  const [isCreateAiRewriting, setIsCreateAiRewriting] = useState(false);
  const [isCreateAiWarrantyLoading, setIsCreateAiWarrantyLoading] = useState(false);
  const [createAiTone, setCreateAiTone] = useState<"telegram" | "concise" | "sales" | "tech">("telegram");
  const [createAiNotice, setCreateAiNotice] = useState<{ message: string; isError?: boolean } | null>(null);
  const [createWarrantyNotice, setCreateWarrantyNotice] = useState<{ message: string; isError?: boolean } | null>(null);

  const createPredictedGuide = predictGuideUrl({
    name: newProductName,
    description: newProductDesc,
    category: newProductCategory,
    supplierVariantId: newSupplierVariantId,
  });

  const handleCreateAiRewrite = async () => {
    if (!newProductDesc.trim()) {
      setCreateAiNotice({ message: "Vui lòng nhập một vài ý mô tả trước khi bấm AI viết lại", isError: true });
      return;
    }
    setIsCreateAiRewriting(true);
    setCreateAiNotice(null);
    try {
      const res = await fetch("/api/ai/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: newProductDesc,
          productName: newProductName,
          category: newProductCategory,
          tone: createAiTone,
        }),
      });
      const data = await res.json();
      if (data.success && data.rewrittenText) {
        setNewProductDesc(data.rewrittenText);
        const keyInfo = data.totalKeys > 1 ? `Đã đổi sang Key #${data.keyIndexUsed}/${data.totalKeys} (${data.keyMasked})` : `Key #${data.keyIndexUsed || 1}`;
        setCreateAiNotice({ message: `Đã viết lại thành công [${keyInfo}]${data.proxyUsed ? " qua Proxy" : ""}` });
      } else {
        setCreateAiNotice({ message: data.error || "Không thể viết lại", isError: true });
      }
    } catch (err: any) {
      setCreateAiNotice({ message: err?.message || "Lỗi AI", isError: true });
    } finally {
      setIsCreateAiRewriting(false);
    }
  };

  const handleCreateAiWarranty = async () => {
    setIsCreateAiWarrantyLoading(true);
    setCreateWarrantyNotice(null);
    try {
      const res = await fetch("/api/ai/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: newProductWarranty.trim() || newProductDesc.trim() || newProductName,
          productName: newProductName,
          category: newProductCategory,
          type: "warranty",
          tone: createAiTone,
        }),
      });
      const data = await res.json();
      if (data.success && data.rewrittenText) {
        setNewProductWarranty(data.rewrittenText);
        const keyInfo =
          data.totalKeys > 1
            ? `Đã đổi sang Key #${data.keyIndexUsed}/${data.totalKeys} (${data.keyMasked})`
            : `Key #${data.keyIndexUsed || 1}`;
        setCreateWarrantyNotice({
          message: `Đã soạn bảo hành thành công [${keyInfo}]${data.proxyUsed ? " qua Proxy" : ""}`,
        });
      } else {
        setCreateWarrantyNotice({ message: data.error || "Không thể soạn chính sách bảo hành", isError: true });
      }
    } catch (err: any) {
      setCreateWarrantyNotice({ message: err?.message || "Lỗi AI", isError: true });
    } finally {
      setIsCreateAiWarrantyLoading(false);
    }
  };

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
      {/* Supplier & Price Change Alerts Banner */}
      <div className="lg:col-span-12">
        <SupplierAlertBanner onSyncPriceRequested={handleSyncSupplier} />
      </div>

      {/* Top Supplier Workspace Panel */}
      <div className="lg:col-span-12 flex flex-col gap-3 border-2 border-black bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Kho API</p>
          <h2 className="mt-1 text-lg font-black uppercase">Nhập hàng từ nhà cung cấp</h2>
        </div>
        <button
          type="button"
          onClick={() => setShowSupplierWorkspace((open) => !open)}
          className="min-h-10 border-2 border-black bg-black px-4 text-xs font-black uppercase text-white hover:bg-[#2457C5] transition active:scale-95"
        >
          {showSupplierWorkspace ? "Đóng khu nhập hàng" : "Mở khu nhập hàng"}
        </button>
      </div>

      {showSupplierWorkspace && (
        <div className="lg:col-span-12">
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => setSupplierPanel("robotic")}
              className={`min-h-9 border-2 border-black px-3 text-xs font-black uppercase transition ${
                supplierPanel === "robotic" ? "bg-[#2457C5] text-white" : "bg-white"
              }`}
            >
              RoboticVN
            </button>
            <button
              type="button"
              onClick={() => setSupplierPanel("scoopy")}
              className={`min-h-9 border-2 border-black px-3 text-xs font-black uppercase transition ${
                supplierPanel === "scoopy" ? "bg-[#E63946] text-white" : "bg-white"
              }`}
            >
              ScoopyVN
            </button>
          </div>
          {supplierPanel === "robotic" ? (
            <RoboticImportPanel onImported={onScoopyImported} categoriesList={categoriesList} />
          ) : (
            <ScoopyImportPanel onImported={onScoopyImported} categoriesList={categoriesList} />
          )}
        </div>
      )}

      {/* Product List Section */}
      <div className="lg:col-span-12 bg-white rounded-[24px] sm:rounded-[28px] border border-slate-200 p-4 sm:p-6 shadow-sm transition-all hover:shadow-md hover:border-slate-300">
        
        {/* Header: Title + Action Buttons */}
        <div className="flex flex-col gap-3.5 mb-4 sm:mb-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Package className="h-5 w-5 text-[#0e704b] shrink-0" />
                <span>Danh sách sản phẩm trong shop</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Hiện có <span className="font-bold text-[#0e704b]">{products.length}</span> sản phẩm
              </p>
            </div>

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
          </div>

          {/* Search Bar + List/Grid Switcher */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Tìm kiếm sản phẩm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-2 sm:py-1.5 rounded-full text-xs bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#0e704b] focus:bg-white w-full text-slate-800 transition"
              />
            </div>
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 shrink-0" aria-label="Kiểu hiển thị">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`rounded-md p-1.5 transition ${
                  viewMode === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-700"
                }`}
                aria-label="Hiển thị danh sách"
                title="Hiển thị danh sách"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`rounded-md p-1.5 transition ${
                  viewMode === "grid" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-700"
                }`}
                aria-label="Hiển thị lưới"
                title="Hiển thị lưới"
              >
                <Grid2X2 className="h-4 w-4" />
              </button>
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
            className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none select-none px-0.5 -mx-1"
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
                <div
                  key={cat.name}
                  className={`flex shrink-0 items-center rounded-full border transition ${
                    isSelected
                      ? "border-[#0e704b] bg-[#0e704b] text-white shadow-sm"
                      : "border-emerald-100 bg-emerald-50/80 text-[#0e704b] hover:bg-emerald-100"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedProductCategory(cat.name)}
                    className="flex items-center gap-1.5 py-1.5 pl-3 pr-1 text-xs font-bold whitespace-nowrap"
                  >
                    <Folder className="h-3.5 w-3.5 shrink-0" />
                    <span>{cat.name}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                        isSelected ? "bg-white/20 text-white" : "bg-emerald-200/60 text-[#0e704b]"
                      }`}
                    >
                      {cat.count}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openRenameCategory(cat.name)}
                    className={`mr-1 rounded-full p-1.5 transition ${
                      isSelected
                        ? "text-white/80 hover:bg-white/20 hover:text-white"
                        : "text-[#0e704b]/60 hover:bg-white hover:text-[#0e704b]"
                    }`}
                    aria-label={`Sửa tên danh mục ${cat.name}`}
                    title="Sửa tên danh mục"
                  >
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

        {/* View Mode: LIST */}
        <div className={viewMode === "list" ? "block" : "hidden"}>
          
          {/* 1. MOBILE INTERFACE: Modern Card-based List Layout (< 768px) */}
          <div className="md:hidden space-y-3">
            {filteredProducts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-slate-500 text-xs">
                Không tìm thấy sản phẩm nào phù hợp.
              </div>
            ) : (
              filteredProducts.map((p) => (
                <div
                  key={p.id}
                  className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs transition hover:border-[#0e704b]/40 hover:shadow-sm"
                >
                  {/* Top: Thumbnail Image + Product Title + Category Tags */}
                  <div className="flex items-start gap-3">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="h-12 w-12 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-50"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-400 shrink-0">
                        <ImageIcon className="h-5 w-5" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => setSelectedProduct(p)}
                        className="text-left font-bold text-slate-900 text-sm leading-snug line-clamp-2 hover:text-[#0e704b] transition-colors"
                      >
                        {p.name}
                      </button>

                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                        <button
                          type="button"
                          onClick={() => openEditModal(p)}
                          title="Bấm để đổi folder / danh mục"
                          className="inline-flex items-center gap-1 rounded bg-slate-100 hover:bg-emerald-50 hover:text-[#0e704b] px-1.5 py-0.5 font-bold text-slate-600 transition"
                        >
                          <Folder className="h-2.5 w-2.5 text-slate-400" />
                          <span>{p.category || "Chưa phân loại"}</span>
                        </button>

                        {p.supplierVariantId?.startsWith("SCOOPY:") ? (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 font-bold text-amber-800">
                            <Server className="h-2.5 w-2.5" />
                            ScoopyVN
                          </span>
                        ) : p.supplierVariantId?.startsWith("ROBOTIC:") ? (
                          <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 font-bold text-blue-700">
                            <Server className="h-2.5 w-2.5" />
                            RoboticVN
                          </span>
                        ) : p.supplierVariantId ? (
                          <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 font-bold text-blue-700">
                            <Server className="h-2.5 w-2.5" />
                            API
                          </span>
                        ) : (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-500">
                            Thủ công
                          </span>
                        )}

                        {!p.isActive && (
                          <span className="rounded bg-amber-100/80 px-1.5 py-0.5 font-bold text-amber-800">
                            Đang ẩn
                          </span>
                        )}

                        {p.priceNote && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 font-bold text-amber-700">
                            <FileText className="h-2.5 w-2.5 shrink-0 text-amber-600" />
                            Ghi chú giá
                          </span>
                        )}

                        {p.guideUrl && (
                          <a
                            href={
                              p.guideUrl.startsWith("http://") || p.guideUrl.startsWith("https://")
                                ? p.guideUrl
                                : `https://rinqshop.vercel.app${p.guideUrl.startsWith("/") ? "" : "/"}${p.guideUrl}`
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 font-bold text-[#0e704b] hover:underline"
                            title="Mở hướng dẫn sản phẩm"
                          >
                            <BookOpen className="h-2.5 w-2.5 text-[#0e704b]" />
                            Hướng dẫn
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Middle: Clean Metrics Strip (Giá bán - Tồn kho - Đã bán) */}
                  <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50/90 p-2.5 border border-slate-100 text-center">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Giá bán</p>
                      <p className="mt-0.5 text-xs sm:text-sm font-extrabold text-[#0e704b]">
                        {p.price.toLocaleString("vi-VN")} đ
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tồn kho</p>
                      <div className="mt-0.5 flex flex-col items-center gap-0.5">
                        {p.stockAvailable > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/80 px-2 py-0.5 text-[11px] font-bold text-[#0e704b]">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                            Còn {p.stockAvailable}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100/80 px-2 py-0.5 text-[11px] font-bold text-rose-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                            Hết hàng
                          </span>
                        )}
                        {(p.fakeStock || 0) > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/90 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                            Tồn ảo: {p.fakeStock}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Đã bán</p>
                      <p className="mt-0.5 text-xs sm:text-sm font-bold text-slate-700">
                        {p.stockSold} cái
                      </p>
                    </div>
                  </div>

                  {/* Bottom: Touch-friendly Action Bar */}
                  <div className="mt-3 flex items-center gap-1.5 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setQuickStockTarget(p);
                        setQuickStockText("");
                        setQuickNotify(true);
                      }}
                      className="flex-1 min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-[#0e704b] border border-emerald-200/80 hover:bg-[#0e704b] hover:text-white transition active:scale-95 shadow-2xs"
                    >
                      <Upload className="h-4 w-4" />
                      <span>Nạp kho</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditModal(p)}
                      title="Chỉnh sửa sản phẩm"
                      className="inline-flex items-center justify-center gap-1 min-h-[38px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition active:scale-95"
                    >
                      <Pencil className="h-4 w-4" />
                      <span>Sửa</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleProduct(p.id, p.isActive)}
                      title={p.isActive ? "Đang hiện (bấm để ẩn)" : "Đang ẩn (bấm để hiện)"}
                      className={`min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl border transition active:scale-95 ${
                        p.isActive
                          ? "border-slate-200 text-slate-500 hover:bg-slate-100"
                          : "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100"
                      }`}
                    >
                      {p.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleNotifyProduct(p.id, p.name)}
                      title="Gửi thông báo Telegram"
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-pink-50 border border-pink-100 text-pink-600 hover:bg-pink-100 transition active:scale-95"
                    >
                      <Bell className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => openDeleteProduct(p)}
                      title="Xóa sản phẩm"
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white transition active:scale-95"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 2. DESKTOP INTERFACE: Professional Wide Table (>= 768px) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                  <th className="py-3 pr-4 w-[42%]">Sản phẩm</th>
                  <th className="py-3 px-3 w-[15%]">Giá bán</th>
                  <th className="py-3 px-3 w-[13%]">Tồn kho</th>
                  <th className="py-3 px-3 w-[10%]">Đã bán</th>
                  <th className="py-3 pl-3 text-right w-[20%]">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="group hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 pr-4 align-middle">
                      <div className="flex items-center gap-3">
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="h-10 w-10 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-50"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-400 shrink-0">
                            <ImageIcon className="h-4 w-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => setSelectedProduct(p)}
                            className="text-left font-bold text-slate-900 leading-snug hover:text-[#0e704b] transition-colors"
                          >
                            {p.name}
                          </button>
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
                              <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 font-bold text-blue-700">
                                <Server className="h-2.5 w-2.5" />
                                RoboticVN
                              </span>
                            ) : p.supplierVariantId ? (
                              <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 font-bold text-blue-700">
                                <Server className="h-2.5 w-2.5" />
                                API
                              </span>
                            ) : (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-500">
                                Thủ công
                              </span>
                            )}
                            {p.priceNote && (
                              <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 font-bold text-amber-700">
                                <FileText className="h-2.5 w-2.5 shrink-0 text-amber-600" />
                                Ghi chú giá
                              </span>
                            )}
                            {p.guideUrl && (
                              <a
                                href={
                                  p.guideUrl.startsWith("http://") || p.guideUrl.startsWith("https://")
                                    ? p.guideUrl
                                    : `https://rinqshop.vercel.app${p.guideUrl.startsWith("/") ? "" : "/"}${p.guideUrl}`
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 font-bold text-[#0e704b] hover:underline"
                                title="Mở hướng dẫn sản phẩm"
                              >
                                <BookOpen className="h-2.5 w-2.5 text-[#0e704b]" />
                                Hướng dẫn
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 align-middle font-extrabold text-[#0e704b] whitespace-nowrap">
                      {p.price.toLocaleString("vi-VN")} đ
                    </td>
                    <td className="py-3 px-3 align-middle whitespace-nowrap">
                      <div className="flex flex-col items-start gap-1">
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
                        {(p.fakeStock || 0) > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                            Tồn ảo: {p.fakeStock}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 align-middle font-bold text-slate-700 whitespace-nowrap">
                      {p.stockSold} cái
                    </td>
                    <td className="py-3 pl-3 align-middle text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setQuickStockTarget(p);
                            setQuickStockText("");
                            setQuickNotify(true);
                          }}
                          title="Nạp thêm kho nhanh cho sản phẩm này"
                          aria-label={`Nạp kho ${p.name}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-[#0e704b] hover:bg-[#0e704b] hover:text-white transition shadow-sm"
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
                          className={`rounded-lg p-1.5 transition ${
                            p.isActive
                              ? "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                              : "text-amber-600 bg-amber-50 hover:bg-amber-100"
                          }`}
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
        </div>

        {/* View Mode: GRID */}
        <div className={viewMode === "grid" ? "grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3" : "hidden"}>
          {filteredProducts.map((p) => (
            <article
              key={p.id}
              className="group relative rounded-2xl border border-slate-200 bg-slate-50/60 p-4 transition hover:border-[#0e704b]/40 hover:bg-white hover:shadow-sm"
            >
              <div className="flex items-start gap-3">
                {p.imageUrl ? (
                  <img
                    src={p.imageUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-xl object-cover border border-slate-200 bg-white"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(p)}
                    className="line-clamp-2 text-left text-sm font-extrabold leading-5 text-slate-900 hover:text-[#0e704b]"
                  >
                    {p.name}
                  </button>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => openEditModal(p)}
                      title="Bấm để đổi folder / danh mục"
                      className="inline-flex items-center gap-1 rounded bg-white px-1.5 py-1 text-slate-600 hover:bg-emerald-100 hover:text-[#0e704b] transition shadow-2xs"
                    >
                      <Folder className="h-2.5 w-2.5 text-slate-400" />
                      <span>{p.category || "Chưa phân loại"}</span>
                    </button>
                    <span
                      className={`rounded px-1.5 py-1 ${
                        p.supplierVariantId ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {p.supplierVariantId?.startsWith("ROBOTIC:")
                        ? "RoboticVN"
                        : p.supplierVariantId?.startsWith("SCOOPY:")
                        ? "ScoopyVN"
                        : p.supplierVariantId
                        ? "API"
                        : "Thủ công"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Grid Metrics Strip */}
              <div className="mt-3.5 grid grid-cols-2 gap-2 rounded-xl bg-white p-2.5 border border-slate-100">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Giá bán</p>
                  <p className="mt-0.5 text-sm font-black text-[#0e704b]">{p.price.toLocaleString("vi-VN")} đ</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Tồn kho</p>
                  <p className={`mt-0.5 text-xs font-extrabold ${p.stockAvailable > 0 ? "text-emerald-700" : (p.fakeStock || 0) > 0 ? "text-amber-700" : "text-rose-600"}`}>
                    {p.stockAvailable > 0 ? `Còn ${p.stockAvailable} cái` : (p.fakeStock || 0) > 0 ? `Tồn ảo: ${p.fakeStock}` : "Hết hàng"}
                  </p>
                </div>
              </div>

              {/* Action Buttons in Grid */}
              <div className="mt-3 flex items-center justify-between gap-1.5 pt-2 border-t border-slate-200/80">
                <button
                  type="button"
                  onClick={() => {
                    setQuickStockTarget(p);
                    setQuickStockText("");
                    setQuickNotify(true);
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-50 px-2 py-1.5 text-xs font-bold text-[#0e704b] hover:bg-[#0e704b] hover:text-white transition shadow-2xs"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Nạp kho</span>
                </button>
                <button
                  type="button"
                  onClick={() => openEditModal(p)}
                  title="Chỉnh sửa sản phẩm"
                  className="rounded-xl bg-white border border-slate-200 p-2 text-slate-600 hover:text-[#0e704b] transition shadow-2xs"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleProduct(p.id, p.isActive)}
                  title={p.isActive ? "Đang hiện (bấm để ẩn)" : "Đang ẩn (bấm để hiện)"}
                  className={`rounded-xl border p-2 transition shadow-2xs ${
                    p.isActive ? "border-slate-200 bg-white text-slate-600" : "border-amber-200 bg-amber-50 text-amber-600"
                  }`}
                >
                  {p.isActive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => openDeleteProduct(p)}
                  title="Xóa sản phẩm"
                  className="rounded-xl bg-rose-50 border border-rose-100 p-2 text-rose-600 hover:bg-rose-600 hover:text-white transition shadow-2xs"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Category Rename Modal */}
      {mounted && typeof document !== "undefined" && editingCategory && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 overflow-y-auto"
          role="presentation"
          onMouseDown={() => !isRenamingCategory && setEditingCategory(null)}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-category-title"
            onSubmit={submitRenameCategory}
            onMouseDown={(event) => event.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl my-auto"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Danh mục sản phẩm</p>
                <h2 id="rename-category-title" className="mt-1 text-lg font-black text-slate-900">
                  Sửa tên danh mục
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="mt-5 block text-xs font-bold uppercase tracking-wide text-slate-600">
              Tên mới
              <input
                autoFocus
                value={categoryDraft}
                onChange={(event) => setCategoryDraft(event.target.value)}
                maxLength={120}
                placeholder="Ví dụ: Tài khoản AI"
                className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#0e704b] focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <p className="mt-2 text-xs text-slate-500">Đổi tên sẽ cập nhật toàn bộ sản phẩm trong danh mục này.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={isRenamingCategory}
                onClick={() => setEditingCategory(null)}
                className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isRenamingCategory || !categoryDraft.trim()}
                className="min-h-10 rounded-xl bg-[#0e704b] px-4 text-sm font-bold text-white hover:bg-[#095c3d] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRenamingCategory ? "Đang lưu…" : "Lưu tên mới"}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* Delete Product Modal */}
      {mounted && typeof document !== "undefined" && deleteTarget && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 overflow-y-auto"
          role="presentation"
          onMouseDown={() => !isDeleting && setDeleteTarget(null)}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-product-title"
            onSubmit={submitDeleteProduct}
            onMouseDown={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl my-auto"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-rose-600">Xóa sản phẩm</p>
                <h2 id="delete-product-title" className="mt-1 text-lg font-black text-slate-900">
                  {deleteTarget.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-sm text-slate-600">
              Bạn có chắc chắn muốn xóa sản phẩm <b>{deleteTarget.name}</b>? Toàn bộ tồn kho và dữ liệu liên quan sẽ được dọn dẹp sạch sẽ.
            </p>

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <input
                type="checkbox"
                checked={notifyOnDelete}
                onChange={(event) => setNotifyOnDelete(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-rose-600"
              />
              <span>
                <span className="block text-sm font-bold text-slate-900">Gửi thông báo gỡ hàng cho khách qua Bot</span>
                <span className="mt-0.5 block text-xs text-slate-500">Mặc định tắt. Chỉ bật nếu muốn thông báo toàn bộ người theo dõi bot.</span>
              </span>
            </label>

            {notifyOnDelete && (
              <label className="mt-3 block text-xs font-bold uppercase tracking-wide text-slate-600">
                Lý do gỡ sản phẩm <span className="text-rose-600">*</span>
                <textarea
                  value={deleteReason}
                  onChange={(event) => setDeleteReason(event.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="Ví dụ: Nhà cung cấp ngừng hỗ trợ gói..."
                  className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                />
              </label>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isDeleting || (notifyOnDelete && !deleteReason.trim())}
                className="min-h-10 rounded-xl bg-rose-600 px-5 text-sm font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting ? "Đang xóa…" : notifyOnDelete ? "Xóa & Báo khách" : "Xóa vĩnh viễn"}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* Product Detail Drawer */}
      {mounted && typeof document !== "undefined" && selectedProduct && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex justify-end bg-black/40"
          role="presentation"
          onClick={() => setSelectedProduct(null)}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Chi tiết sản phẩm"
            onClick={(event) => event.stopPropagation()}
            className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Chi tiết sản phẩm</p>
                <h2 className="mt-1 text-xl font-black text-slate-900">{selectedProduct.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Đóng"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {selectedProduct.imageUrl ? (
              <img
                src={selectedProduct.imageUrl}
                alt=""
                className="mt-5 h-40 w-full rounded-2xl object-cover border border-slate-200"
              />
            ) : (
              <div className="mt-5 flex h-40 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 border border-slate-200">
                <ImageIcon className="h-8 w-8" />
              </div>
            )}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                <p className="text-[10px] font-bold uppercase text-slate-500">Giá bán</p>
                <p className="mt-1 text-lg font-black text-[#0e704b]">
                  {selectedProduct.price.toLocaleString("vi-VN")} đ
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                <p className="text-[10px] font-bold uppercase text-slate-500">Tồn kho</p>
                <p className="mt-1 text-lg font-black text-slate-900">
                  {selectedProduct.stockAvailable} cái
                  {(selectedProduct.fakeStock || 0) > 0 && (
                    <span className="ml-2 text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      Tồn ảo: {selectedProduct.fakeStock}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <div>
                <dt className="text-xs font-bold uppercase text-slate-500">Danh mục</dt>
                <dd className="mt-1 font-semibold text-slate-900">{selectedProduct.category || "Chưa phân loại"}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-slate-500">Nguồn cấp</dt>
                <dd className="mt-1 font-semibold text-slate-900">
                  {selectedProduct.supplierVariantId?.startsWith("ROBOTIC:")
                    ? "RoboticVN"
                    : selectedProduct.supplierVariantId?.startsWith("SCOOPY:")
                    ? "ScoopyVN"
                    : selectedProduct.supplierVariantId
                    ? "API"
                    : "Thủ công"}
                </dd>
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
                className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs font-bold text-[#0e704b] hover:bg-emerald-100 transition shadow-2xs"
              >
                Nạp kho
              </button>
              <button
                type="button"
                onClick={() => {
                  openEditModal(selectedProduct);
                  setSelectedProduct(null);
                }}
                className="flex-1 min-w-[120px] rounded-xl bg-[#0e704b] px-4 py-3 text-xs font-bold text-white hover:bg-[#0a5c3d] transition shadow-2xs"
              >
                Sửa sản phẩm
              </button>
              <button
                type="button"
                onClick={() => {
                  handleNotifyProduct(selectedProduct.id, selectedProduct.name);
                  setSelectedProduct(null);
                }}
                className="rounded-xl bg-pink-50 border border-pink-100 px-4 py-3 text-xs font-bold text-pink-600 hover:bg-pink-100 transition shadow-2xs"
              >
                Thông báo
              </button>
              <button
                type="button"
                onClick={() => {
                  const prod = selectedProduct;
                  setSelectedProduct(null);
                  openDeleteProduct(prod);
                }}
                className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-xs font-bold text-rose-600 hover:bg-rose-100 transition shadow-2xs"
              >
                Xóa sản phẩm
              </button>
            </div>
          </aside>
        </div>,
        document.body
      )}

      {/* Quick Stock-in Modal */}
      {mounted && typeof document !== "undefined" && quickStockTarget && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 overflow-y-auto"
          role="presentation"
          onMouseDown={() => !isSubmittingQuickStock && setQuickStockTarget(null)}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-stock-title"
            onSubmit={handleQuickStockSubmit}
            onMouseDown={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl my-auto"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Nạp kho nhanh</p>
                <h2 id="quick-stock-title" className="mt-1 text-base font-black text-slate-900 line-clamp-1">
                  {quickStockTarget.name}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 font-medium">
                  Hiện có: <b className="text-[#0e704b]">{quickStockTarget.stockAvailable}</b> tồn kho
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickStockTarget(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Đóng"
              >
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
              <button
                type="button"
                disabled={isSubmittingQuickStock}
                onClick={() => setQuickStockTarget(null)}
                className="min-h-10 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
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

      {/* Side Forms: Create Product & Bulk Import (12 cols) */}
      <div className="lg:col-span-12 grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Form Tạo Sản Phẩm */}
        <div id="create-product-section" className="lg:col-span-7 rounded-[24px] border border-slate-200 bg-white p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Sản phẩm mới</p>
              <h3 className="mt-1 flex items-center gap-2 text-lg font-black text-slate-900">
                <Plus className="h-5 w-5 text-[#0e704b]" />
                <span>Thêm sản phẩm</span>
              </h3>
            </div>
            <span className="text-xs text-slate-500">Các trường * bắt buộc</span>
          </div>

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
                </datalist>
              </div>
            </div>

            {/* Custom Image Upload Field */}
            <div>
              <ProductImageField
                id="create-product-image"
                value={newProductImage}
                onChange={setNewProductImage}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  Mô tả sản phẩm
                </label>
                <div className="flex items-center gap-1.5">
                  <select
                    value={createAiTone}
                    onChange={(e) => setCreateAiTone(e.target.value as any)}
                    className="text-[10px] font-bold rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-slate-700"
                  >
                    <option value="telegram">Telegram HTML</option>
                    <option value="concise">Rút gọn</option>
                    <option value="sales">Bán hàng</option>
                    <option value="tech">Kỹ thuật</option>
                  </select>
                  <button
                    type="button"
                    disabled={isCreateAiRewriting || !newProductDesc.trim()}
                    onClick={handleCreateAiRewrite}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#0e704b] hover:bg-[#0a5c3d] disabled:opacity-50 text-white px-2.5 py-0.5 text-[11px] font-bold transition shadow-2xs"
                  >
                    {isCreateAiRewriting ? (
                      <>
                        <LoaderCircle className="h-3 w-3 animate-spin" />
                        <span>Đang viết...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3" />
                        <span>AI Viết lại</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {createAiNotice && (
                <div
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-lg flex items-center gap-1 ${
                    createAiNotice.isError ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-800"
                  }`}
                >
                  <span>{createAiNotice.message}</span>
                </div>
              )}

              <textarea
                rows={3}
                placeholder="Mô tả chi tiết sản phẩm, tính năng, hướng dẫn..."
                value={newProductDesc}
                onChange={(e) => setNewProductDesc(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div className="space-y-1.5 p-2.5 rounded-xl bg-violet-50/40 border border-violet-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-violet-600" />
                  <span>Chính sách bảo hành</span>
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={isCreateAiWarrantyLoading}
                    onClick={handleCreateAiWarranty}
                    className="inline-flex items-center gap-1 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-2 py-0.5 text-[10px] font-bold transition shadow-2xs cursor-pointer active:scale-95"
                  >
                    {isCreateAiWarrantyLoading ? (
                      <>
                        <LoaderCircle className="h-3 w-3 animate-spin" />
                        <span>Đang viết...</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-3 w-3" />
                        <span>AI Viết bảo hành</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Mau nhanh */}
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[10px] text-slate-400">Mẫu:</span>
                <button
                  type="button"
                  onClick={() => setNewProductWarranty("• Bảo hành 1 đổi 1 trong 1 giờ đầu nếu không kích hoạt hoặc lỗi sản phẩm.\n• Hỗ trợ kỹ thuật nhanh qua Admin.")}
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white text-slate-600 border border-slate-200 hover:bg-violet-50 hover:text-violet-700 cursor-pointer"
                >
                  1 đổi 1 (1h)
                </button>
                <button
                  type="button"
                  onClick={() => setNewProductWarranty("• Bảo hành toàn bộ thời gian sử dụng đối với lỗi do key hoặc server nguồn.\n• Đổi mới hoặc hoàn tiền tương ứng.")}
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white text-slate-600 border border-slate-200 hover:bg-violet-50 hover:text-violet-700 cursor-pointer"
                >
                  Lỗi server
                </button>
                <button
                  type="button"
                  onClick={() => setNewProductWarranty("• Bảo hành trọn gói suốt thời hạn đăng ký dịch vụ.\n• Không bảo hành nếu tự ý thay đổi thông tin/mật khẩu.")}
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white text-slate-600 border border-slate-200 hover:bg-violet-50 hover:text-violet-700 cursor-pointer"
                >
                  Theo gói
                </button>
              </div>

              {createWarrantyNotice && (
                <div
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-lg flex items-center gap-1 ${
                    createWarrantyNotice.isError ? "bg-rose-50 text-rose-700" : "bg-violet-100 text-violet-900"
                  }`}
                >
                  <span>{createWarrantyNotice.message}</span>
                </div>
              )}

              <textarea
                rows={2}
                placeholder="VD: Bảo hành 1 đổi 1 trong 30 ngày..."
                value={newProductWarranty}
                onChange={(e) => setNewProductWarranty(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-violet-500"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-[#0e704b]" />
                  <span>Đường link hướng dẫn sử dụng riêng (URL / Guide)</span>
                </label>
                <div className="flex items-center gap-1.5">
                  {newProductGuideUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        const fullUrl =
                          newProductGuideUrl.startsWith("http://") || newProductGuideUrl.startsWith("https://")
                            ? newProductGuideUrl
                            : `https://rinqshop.vercel.app${newProductGuideUrl.startsWith("/") ? "" : "/"}${newProductGuideUrl}`;
                        const insertStr = `\n\n<b>Hướng dẫn sử dụng:</b>\n${fullUrl}`;
                        setNewProductDesc(newProductDesc ? `${newProductDesc.trim()}${insertStr}` : insertStr.trim());
                      }}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-[#0e704b] bg-emerald-100/70 hover:bg-emerald-200/80 px-2 py-0.5 rounded-lg border border-emerald-300 transition cursor-pointer"
                      title="Chèn kèm đường link hướng dẫn này vào ô ghi chú mô tả"
                    >
                      <span>+ Chèn vào ghi chú</span>
                    </button>
                  )}
                  {newProductGuideUrl && (
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                      Đã chọn link
                    </span>
                  )}
                </div>
              </div>

              {/* AI Prediction for new product */}
              {createPredictedGuide.match && newProductGuideUrl !== createPredictedGuide.match.url && (
                <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-emerald-300 shadow-2xs text-xs">
                  <div className="flex items-center gap-1.5 min-w-0 pr-2">
                    <Sparkles className="h-3.5 w-3.5 text-[#0e704b] shrink-0" />
                    <div className="truncate text-[11px]">
                      <span className="font-extrabold text-[#0e704b]">AI dự đoán:</span>{" "}
                      <span className="font-semibold text-slate-800">{createPredictedGuide.match.shortTitle}</span>
                      <span className="text-[10px] text-slate-500 ml-1">({createPredictedGuide.reason})</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewProductGuideUrl(createPredictedGuide.match!.url)}
                    className="px-2.5 py-1 rounded-lg bg-[#0e704b] hover:bg-[#0a5c3d] text-white text-[10px] font-bold shrink-0 transition active:scale-95 shadow-2xs cursor-pointer"
                    title="Bấm để áp dụng link này"
                  >
                    Áp dụng link
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5">
                <div className="sm:col-span-7">
                  <input
                    type="text"
                    placeholder="VD: /guides/doi-tac-2-claude hoặc https://..."
                    value={newProductGuideUrl}
                    onChange={(e) => setNewProductGuideUrl(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-600 focus:bg-white"
                  />
                </div>
                <div className="sm:col-span-5">
                  <select
                    value={newProductGuideUrl}
                    onChange={(e) => {
                      if (e.target.value) setNewProductGuideUrl(e.target.value);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-[11px] text-slate-700 font-medium focus:outline-none focus:border-emerald-600"
                  >
                    <option value="">-- Chọn bài có sẵn ({GUIDES_CATALOG.length} bài) --</option>
                    {GUIDES_CATALOG.map((g) => (
                      <option key={g.slug} value={g.url}>
                        [{g.category}] {g.shortTitle}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-[10px] text-slate-500">
                Đường link này sẽ hiển thị thành nút bấm riêng <b>"📚 Xem hướng dẫn sử dụng"</b> trên Bot Telegram và Web, thay thế việc nhét link vào text mô tả.
              </p>
            </div>

            <details className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-slate-600 select-none">
                Cài đặt nâng cao (Nhà cung cấp / API)
              </summary>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Cơ chế cấp hàng
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

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-amber-800 mb-1">
                    Tồn kho ảo hiển thị (Display Stock)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0 = Dùng tồn thực / NCC"
                    value={newProductFakeStock}
                    onChange={(e) => setNewProductFakeStock(e.target.value)}
                    className="w-full rounded-xl border border-amber-200 bg-amber-50/40 px-2.5 py-1.5 text-xs text-amber-900 font-bold focus:outline-none focus:border-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Khi &gt; 0, Bot luôn cho phép khách mua số lượng này. Sau khi mua hệ thống sẽ tự trừ dần và báo Admin để nạp thêm.
                  </p>
                </div>
              </div>
            </details>

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
