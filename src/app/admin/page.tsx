"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Package,
  Layers,
  ShoppingBag,
  DollarSign,
  CheckCircle2,
  Clock,
  Zap,
  Plus,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff,
  Upload,
  Lock,
  KeyRound,
  ExternalLink,
  Bot,
  AlertCircle,
  Copy,
  Bell,
  Send,
  Users,
  Edit,
  X,
  Gift,
  Tag,
  Trophy,
  Percent,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  CreditCard,
  LayoutDashboard,
  Search,
  Filter,
  Check,
  Radio,
  SlidersHorizontal,
  ChevronRight,
  Activity,
  ShieldCheck,
  Flame,
  MessageCircle,
  RotateCcw,
  Folder,
  FileText,
  Wallet,
  Server,
  Globe,
  Image as ImageIcon,
} from "lucide-react";
import { Product, Order, Stats, Coupon, Giveaway } from "./types";
import OverviewTab from "./components/OverviewTab";
import ProductsTab from "./components/ProductsTab";
import OrdersTab from "./components/OrdersTab";
import CouponsTab from "./components/CouponsTab";
import GiveawaysTab from "./components/GiveawaysTab";
import BroadcastTab from "./components/BroadcastTab";
import EditProductModal from "./components/EditProductModal";
import EditCouponModal from "./components/EditCouponModal";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<
    "overview" | "products" | "orders" | "coupons" | "giveaways" | "broadcast"
  >("overview");

  const [loading, setLoading] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [copiedBank, setCopiedBank] = useState<boolean>(false);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [giveaways, setGiveaways] = useState<any[]>([]);

  // Form tạo sản phẩm mới
  const [newProductName, setNewProductName] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newProductCategory, setNewProductCategory] = useState("AI");
  const [newProductDesc, setNewProductDesc] = useState("");
  const [newProductImage, setNewProductImage] = useState("");
  const [newSupplierVariantId, setNewSupplierVariantId] = useState("");
  const [newFulfillmentType, setNewFulfillmentType] = useState("HYBRID");

  // State thông tin nhà cung cấp API
  const [supplierInfo, setSupplierInfo] = useState<any>(null);
  const [isCheckingSupplier, setIsCheckingSupplier] = useState(false);
  const [isSyncingSupplier, setIsSyncingSupplier] = useState(false);

  // Form nạp kho hàng loạt
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [bulkText, setBulkText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [notifyOnImport, setNotifyOnImport] = useState(true);

  // Form bắn thông báo tùy chỉnh
  const [customBroadcastMsg, setCustomBroadcastMsg] = useState("");
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // State chỉnh sửa sản phẩm & giá
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editPriceReason, setEditPriceReason] = useState("");
  const [editProductImage, setEditProductImage] = useState("");
  const [editSupplierVariantId, setEditSupplierVariantId] = useState("");
  const [editFulfillmentType, setEditFulfillmentType] = useState("HYBRID");
  const [editNotify, setEditNotify] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // Form tạo mã giảm giá
  const [newCouponCode, setNewCouponCode] = useState("");
  const [newCouponDiscount, setNewCouponDiscount] = useState("");
  const [newCouponIsPercent, setNewCouponIsPercent] = useState(false);
  const [newCouponMaxUsage, setNewCouponMaxUsage] = useState("100");

  // State chỉnh sửa mã giảm giá
  const [editingCoupon, setEditingCoupon] = useState<any | null>(null);
  const [editCouponCode, setEditCouponCode] = useState("");
  const [editCouponDiscount, setEditCouponDiscount] = useState("");
  const [editCouponIsPercent, setEditCouponIsPercent] = useState(false);
  const [editCouponMaxUsage, setEditCouponMaxUsage] = useState("100");
  const [editCouponUsedCount, setEditCouponUsedCount] = useState("0");

  const openEditCouponModal = (c: any) => {
    setEditingCoupon(c);
    setEditCouponCode(c.code);
    setEditCouponDiscount(String(c.discount));
    setEditCouponIsPercent(c.isPercent === 1);
    setEditCouponMaxUsage(String(c.maxUsage));
    setEditCouponUsedCount(String(c.usedCount));
  };

  // Form tạo Giveaway
  const [newGaTitle, setNewGaTitle] = useState("");
  const [newGaReward, setNewGaReward] = useState("");
  const [newGaDesc, setNewGaDesc] = useState("");
  const [newGaWinners, setNewGaWinners] = useState("1");

  // Password Modal & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [overviewChartFilter, setOverviewChartFilter] = useState<"weekly" | "monthly">("weekly");
  const [recentOrderFilter, setRecentOrderFilter] = useState<"ALL" | "PAID" | "PENDING">("ALL");
  const [isSimulating, setIsSimulating] = useState(false);
  const [selectedProductCategory, setSelectedProductCategory] = useState<string>("ALL");

  // Bộ lọc & Xóa đơn hàng trong Tab Quản lý đơn
  const [orderStatusFilter, setOrderStatusFilter] = useState<"ALL" | "PAID" | "PENDING">("ALL");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderProductFilter, setOrderProductFilter] = useState("ALL");
  const [orderSort, setOrderSort] = useState<"NEWEST" | "OLDEST" | "AMOUNT_DESC" | "AMOUNT_ASC">("NEWEST");
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isDeletingOrders, setIsDeletingOrders] = useState(false);

  const [stats, setStats] = useState<Stats>({
    totalRevenue: 0,
    totalOrders: 0,
    paidOrders: 0,
    pendingOrders: 0,
    totalStockAvailable: 0,
    totalStockSold: 0,
    subscriberCount: 0,
  });

  const showToast = (text: string, isError = false) => {
    setToastMsg({ text, isError });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const copyToClipboard = (text: string, type: "bank" | "order", id?: string) => {
    navigator.clipboard.writeText(text);
    if (type === "bank") {
      setCopiedBank(true);
      setTimeout(() => setCopiedBank(false), 2000);
    } else if (type === "order" && id) {
      setCopiedOrderId(id);
      setTimeout(() => setCopiedOrderId(null), 2000);
    }
    showToast("Đã sao chép vào bộ nhớ tạm!");
  };

  // Tính toán số liệu biểu đồ THỰC TẾ từ database (không fake số liệu)
  const chartData = React.useMemo(() => {
    const now = new Date();
    const vnNow = new Date(now.getTime() + 7 * 3600 * 1000);
    const vnYear = vnNow.getUTCFullYear();
    const vnMonth = vnNow.getUTCMonth();
    const vnDate = vnNow.getUTCDate();
    const vnDay = vnNow.getUTCDay(); // 0 = CN, 1 = T2, ..., 6 = T7

    if (overviewChartFilter === "weekly") {
      const daysSinceMon = (vnDay + 6) % 7;
      const mondayZeroUtc = Date.UTC(vnYear, vnMonth, vnDate - daysSinceMon, 0, 0, 0) - 7 * 3600 * 1000;
      const lastMondayZeroUtc = mondayZeroUtc - 7 * 86400 * 1000;

      const dayConfigs = [
        { label: "T2", dayOfWeek: 1 },
        { label: "T3", dayOfWeek: 2 },
        { label: "T4", dayOfWeek: 3 },
        { label: "T5", dayOfWeek: 4 },
        { label: "T6", dayOfWeek: 5 },
        { label: "T7", dayOfWeek: 6 },
        { label: "CN", dayOfWeek: 0 },
      ];

      const rawBars = dayConfigs.map((cfg, idx) => {
        const startMs = mondayZeroUtc + idx * 86400 * 1000;
        const endMs = startMs + 86400 * 1000;

        const dayOrders = orders.filter((o) => {
          const t = new Date(o.createdAt).getTime();
          return t >= startMs && t < endMs;
        });

        const paid = dayOrders.filter((o) => o.status === "PAID").length;

        return {
          day: cfg.label,
          count: dayOrders.length,
          paidCount: paid,
          active: cfg.dayOfWeek === vnDay,
        };
      });

      const maxCount = Math.max(...rawBars.map((b) => b.count), 0);
      const totalThisWeek = rawBars.reduce((s, b) => s + b.count, 0);
      const paidThisWeek = rawBars.reduce((s, b) => s + b.paidCount, 0);

      const lastWeekOrders = orders.filter((o) => {
        const t = new Date(o.createdAt).getTime();
        return t >= lastMondayZeroUtc && t < mondayZeroUtc;
      });
      const totalLastWeek = lastWeekOrders.length;

      let growthBadge = "";
      if (totalLastWeek === 0) {
        growthBadge = totalThisWeek > 0 ? `+${totalThisWeek} đơn tuần này` : "0% tăng trưởng";
      } else {
        const rate = Math.round(((totalThisWeek - totalLastWeek) / totalLastWeek) * 100);
        growthBadge = `${rate >= 0 ? "+" : ""}${rate}% so với tuần trước`;
      }

      return {
        bars: rawBars.map((b) => ({
          ...b,
          height:
            maxCount === 0
              ? "10%"
              : b.count === 0
              ? "10%"
              : `${Math.max(18, Math.round((b.count / maxCount) * 95))}%`,
        })),
        totalOrders: totalThisWeek,
        paidOrders: paidThisWeek,
        growthBadge,
        periodLabel: "tuần này",
        conversionRate: totalThisWeek > 0 ? Math.round((paidThisWeek / totalThisWeek) * 100) : 0,
      };
    } else {
      const lastDayOfMonth = new Date(vnYear, vnMonth + 1, 0).getDate();
      const prevMonthStartUtc = Date.UTC(vnYear, vnMonth - 1, 1, 0, 0, 0) - 7 * 3600 * 1000;
      const prevLastDay = new Date(vnYear, vnMonth, 0).getDate();
      const prevMonthEndUtc = Date.UTC(vnYear, vnMonth - 1, prevLastDay, 23, 59, 59, 999) - 7 * 3600 * 1000;

      const weekBuckets = [
        { label: "Tuần 1", startDay: 1, endDay: 7 },
        { label: "Tuần 2", startDay: 8, endDay: 14 },
        { label: "Tuần 3", startDay: 15, endDay: 21 },
        { label: "Tuần 4", startDay: 22, endDay: lastDayOfMonth },
      ];

      const currentWeekIndex =
        vnDate <= 7 ? 0 : vnDate <= 14 ? 1 : vnDate <= 21 ? 2 : 3;

      const rawBars = weekBuckets.map((wb, idx) => {
        const startMs = Date.UTC(vnYear, vnMonth, wb.startDay, 0, 0, 0) - 7 * 3600 * 1000;
        const endMs = Date.UTC(vnYear, vnMonth, wb.endDay, 23, 59, 59, 999) - 7 * 3600 * 1000;

        const weekOrders = orders.filter((o) => {
          const t = new Date(o.createdAt).getTime();
          return t >= startMs && t <= endMs;
        });

        const paid = weekOrders.filter((o) => o.status === "PAID").length;

        return {
          day: wb.label,
          count: weekOrders.length,
          paidCount: paid,
          active: idx === currentWeekIndex,
        };
      });

      const maxCount = Math.max(...rawBars.map((b) => b.count), 0);
      const totalThisMonth = rawBars.reduce((s, b) => s + b.count, 0);
      const paidThisMonth = rawBars.reduce((s, b) => s + b.paidCount, 0);

      const prevMonthOrders = orders.filter((o) => {
        const t = new Date(o.createdAt).getTime();
        return t >= prevMonthStartUtc && t <= prevMonthEndUtc;
      });
      const totalPrevMonth = prevMonthOrders.length;

      let growthBadge = "";
      if (totalPrevMonth === 0) {
        growthBadge = totalThisMonth > 0 ? `+${totalThisMonth} đơn tháng này` : "0% tăng trưởng";
      } else {
        const rate = Math.round(((totalThisMonth - totalPrevMonth) / totalPrevMonth) * 100);
        growthBadge = `${rate >= 0 ? "+" : ""}${rate}% so với tháng trước`;
      }

      return {
        bars: rawBars.map((b) => ({
          ...b,
          height:
            maxCount === 0
              ? "10%"
              : b.count === 0
              ? "10%"
              : `${Math.max(18, Math.round((b.count / maxCount) * 95))}%`,
        })),
        totalOrders: totalThisMonth,
        paidOrders: paidThisMonth,
        growthBadge,
        periodLabel: "tháng này",
        conversionRate: totalThisMonth > 0 ? Math.round((paidThisMonth / totalThisMonth) * 100) : 0,
      };
    }
  }, [orders, overviewChartFilter]);

  // Danh sách khách hàng thực tế từ orders
  const realCustomers = React.useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach((o) => {
      if (o.telegramId) {
        const name = o.username ? `@${o.username}` : `ID ${o.telegramId.slice(-4)}`;
        map.set(o.telegramId, name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [orders]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin");

      if (res.status === 401) {
        window.location.replace("/admin/login");
        return;
      }

      const data = await res.json();
      if (data.success) {
        setProducts(data.products || []);
        setOrders(data.orders || []);
        setCoupons(data.coupons || []);
        setGiveaways(data.giveaways || []);
        if (data.supplier) setSupplierInfo(data.supplier);
        setStats(data.stats || {
          totalRevenue: 0,
          totalOrders: 0,
          paidOrders: 0,
          pendingOrders: 0,
          totalStockAvailable: 0,
          totalStockSold: 0,
          subscriberCount: 0,
        });
        if (!selectedProductId && data.products?.length > 0) {
          setSelectedProductId(String(data.products[0].id));
        }
      } else {
        showToast(data.error || "Lỗi tải dữ liệu", true);
      }
    } catch (err: any) {
      showToast(err.message || "Lỗi kết nối", true);
    } finally {
      // Giữ loading nhẹ để hiệu ứng skeleton mượt mà
      setTimeout(() => setLoading(false), 300);
    }
  }, [selectedProductId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogout = async () => {
    await fetch("/api/admin/session", { method: "DELETE" });
    window.location.replace("/admin/login");
  };

  // Tạo sản phẩm mới
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim() || !newProductPrice) {
      showToast("Vui lòng điền đủ tên và giá sản phẩm", true);
      return;
    }

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "CREATE_PRODUCT",
          name: newProductName.trim(),
          price: parseInt(newProductPrice, 10),
          category: newProductCategory.trim(),
          description: newProductDesc.trim(),
          imageUrl: newProductImage.trim() || null,
          supplierVariantId: newSupplierVariantId.trim() || null,
          fulfillmentType: newFulfillmentType,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast("Thêm sản phẩm thành công!");
        setNewProductName("");
        setNewProductPrice("");
        setNewProductDesc("");
        setNewProductImage("");
        setNewSupplierVariantId("");
        setNewFulfillmentType("HYBRID");
        fetchData();
      } else {
        showToast(data.error || "Thêm sản phẩm thất bại", true);
      }
    } catch (err: any) {
      showToast(err.message || "Lỗi kết nối", true);
    }
  };

  // Toggle ẩn/hiện sản phẩm
  const handleToggleProduct = async (id: number, currentStatus: boolean) => {
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "TOGGLE_PRODUCT",
          id,
          isActive: !currentStatus,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Đã cập nhật trạng thái sản phẩm");
        fetchData();
      }
    } catch (err: any) {
      showToast(err.message, true);
    }
  };

  // Xóa sản phẩm
  const handleDeleteProduct = async (id: number, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa sản phẩm "${name}" cùng toàn bộ kho hàng của nó?`)) {
      return;
    }
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "DELETE_PRODUCT",
          id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Đã xóa sản phẩm "${name}"`);
        fetchData();
      } else {
        showToast(data.error || "Lỗi xóa sản phẩm", true);
      }
    } catch (err: any) {
      showToast(err.message, true);
    }
  };

  // Mở modal sửa sản phẩm
  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setEditName(p.name);
    setEditPrice(String(p.price));
    setEditDesc(p.description || "");
    setEditCategory(p.category || "");
    setEditPriceReason(p.priceNote || "");
    setEditProductImage(p.imageUrl || "");
    setEditSupplierVariantId(p.supplierVariantId || "");
    setEditFulfillmentType(p.fulfillmentType || "HYBRID");
    setEditNotify(true);
  };

  // Cập nhật sản phẩm & Giá bán
  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (!editName.trim() || !editPrice) {
      showToast("Vui lòng điền đủ tên và giá bán", true);
      return;
    }

    setIsUpdating(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "UPDATE_PRODUCT",
          id: editingProduct.id,
          name: editName.trim(),
          price: parseInt(editPrice, 10),
          category: editCategory.trim(),
          description: editDesc.trim(),
          priceReason: editPriceReason.trim(),
          imageUrl: editProductImage.trim() || null,
          supplierVariantId: editSupplierVariantId.trim() || null,
          fulfillmentType: editFulfillmentType,
          notifyUsers: editNotify,
        }),
      });

      const data = await res.json();
      if (data.success) {
        let msg = `Cập nhật sản phẩm "${editName}" thành công!`;
        if (data.notifyResult?.sentCount > 0) {
          msg += ` (Đã gửi thông báo tới ${data.notifyResult.sentCount} khách hàng)`;
        }
        showToast(msg);
        setEditingProduct(null);
        fetchData();
      } else {
        showToast(data.error || "Cập nhật thất bại", true);
      }
    } catch (err: any) {
      showToast(err.message || "Lỗi kết nối", true);
    } finally {
      setIsUpdating(false);
    }
  };

  // Tra cứu & kiểm tra kết nối NCC
  const handleCheckSupplier = async () => {
    setIsCheckingSupplier(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "TEST_SUPPLIER" }),
      });
      const data = await res.json();
      if (data.success && data.supplier) {
        setSupplierInfo(data.supplier);
        showToast("Đã làm mới số dư và trạng thái NCC!");
      } else {
        showToast(data.error || "Không thể kết nối API NCC", true);
      }
    } catch (e: any) {
      showToast(e.message || "Lỗi kết nối", true);
    } finally {
      setIsCheckingSupplier(false);
    }
  };

  // Đồng bộ sản phẩm từ NCC (<40k)
  const handleSyncSupplier = async () => {
    if (!confirm("Bắt đầu lấy các mặt hàng từ NCC và chỉ giữ các mặt hàng có giá dưới 40.000đ?")) return;
    setIsSyncingSupplier(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "SYNC_SUPPLIER_PRODUCTS", maxPrice: 40000 }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showToast(data.message || "Đã đồng bộ xong các mặt hàng dưới 40.000đ!");
        fetchData();
      } else {
        showToast(data.error || `Lỗi đồng bộ (${res.status})`, true);
      }
    } catch (e: any) {
      showToast(e.message || "Lỗi đồng bộ", true);
    } finally {
      setIsSyncingSupplier(false);
    }
  };

  // Nạp kho hàng loạt
  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !bulkText.trim()) {
      showToast("Vui lòng chọn sản phẩm và nhập danh sách tài nguyên", true);
      return;
    }

    setIsImporting(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "BULK_IMPORT",
          productId: selectedProductId,
          rawLines: bulkText,
          notifyUsers: notifyOnImport,
        }),
      });

      const data = await res.json();
      if (data.success) {
        let msg = `Đã nạp thành công ${data.count} tài nguyên vào kho!`;
        if (data.notifyResult?.sentCount > 0) {
          msg += ` (Đã bắn thông báo tới ${data.notifyResult.sentCount} khách hàng)`;
        }
        showToast(msg);
        setBulkText("");
        fetchData();
      } else {
        showToast(data.error || "Nạp kho thất bại", true);
      }
    } catch (err: any) {
      showToast(err.message || "Lỗi kết nối", true);
    } finally {
      setIsImporting(false);
    }
  };

  // Bắn thông báo hàng về theo sản phẩm
  const handleNotifyProduct = async (productId: number, productName: string) => {
    if (!confirm(`Bạn có muốn bắn tin nhắn thông báo hàng về cho "${productName}" tới tất cả khách hàng không?`)) {
      return;
    }
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "NOTIFY_RESTOCK",
          productId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Đã gửi thông báo hàng về tới ${data.notifyResult?.sentCount || 0} khách hàng!`);
      } else {
        showToast(data.error || "Lỗi bắn thông báo", true);
      }
    } catch (err: any) {
      showToast(err.message, true);
    }
  };

  // Bắn thông báo tùy chỉnh
  const handleCustomBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customBroadcastMsg.trim()) {
      showToast("Vui lòng nhập nội dung thông báo", true);
      return;
    }

    if (!confirm(`Xác nhận gửi tin nhắn này tới toàn bộ ${stats.subscriberCount ?? 0} khách hàng trên Bot?`)) {
      return;
    }

    setIsBroadcasting(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "BROADCAST_CUSTOM",
          message: customBroadcastMsg.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Đã bắn thành công tới ${data.result?.sentCount || 0} / ${data.result?.total || 0} khách hàng!`);
        setCustomBroadcastMsg("");
      } else {
        showToast(data.error || "Lỗi gửi thông báo", true);
      }
    } catch (err: any) {
      showToast(err.message || "Lỗi kết nối", true);
    } finally {
      setIsBroadcasting(false);
    }
  };

  // Giả lập webhook thanh toán
  const handleSimulatePayment = async (orderId: string, amount: number) => {
    setIsSimulating(true);
    try {
      const res = await fetch("/api/webhook/sepay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: Date.now(),
          gateway: "TPBank",
          transactionDate: new Date().toISOString(),
          accountNumber: "10005025333",
          transferType: "in",
          transferAmount: amount,
          accumulated: 1000000,
          code: null,
          content: `${orderId}`,
          referenceCode: `SIM_${Date.now()}`,
          description: `Chuyen khoan don hang ${orderId}`,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Thanh toán đơn ${orderId} thành công! Bot đã phát hàng tự động.`);
        fetchData();
      } else {
        showToast(data.error || "Giả lập thất bại", true);
      }
    } catch (err: any) {
      showToast(err.message || "Lỗi kết nối", true);
    } finally {
      setIsSimulating(false);
    }
  };

  // Xóa 1 đơn hàng
  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa đơn hàng ${orderId}? Thao tác này không thể hoàn tác.`)) {
      return;
    }
    setIsDeletingOrders(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "DELETE_ORDER",
          id: orderId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || `Đã xóa đơn ${orderId}`);
        setSelectedOrderIds((prev) => prev.filter((id) => id !== orderId));
        fetchData();
      } else {
        showToast(data.error || "Xóa đơn hàng thất bại", true);
      }
    } catch (err: any) {
      showToast(err.message || "Lỗi xóa đơn hàng", true);
    } finally {
      setIsDeletingOrders(false);
    }
  };

  // Xóa các đơn hàng đã chọn
  const handleDeleteSelectedOrders = async () => {
    if (selectedOrderIds.length === 0) return;
    if (
      !confirm(
        `Bạn có chắc chắn muốn xóa ${selectedOrderIds.length} đơn hàng đã chọn? Thao tác này không thể hoàn tác.`
      )
    ) {
      return;
    }
    setIsDeletingOrders(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "DELETE_ORDERS",
          ids: selectedOrderIds,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || `Đã xóa ${selectedOrderIds.length} đơn hàng`);
        setSelectedOrderIds([]);
        fetchData();
      } else {
        showToast(data.error || "Xóa thất bại", true);
      }
    } catch (err: any) {
      showToast(err.message || "Lỗi thao tác", true);
    } finally {
      setIsDeletingOrders(false);
    }
  };

  // Xóa toàn bộ đơn chờ thanh toán
  const handleClearPendingOrders = async () => {
    if (stats.pendingOrders === 0) {
      showToast("Không có đơn chờ thanh toán nào để xóa", true);
      return;
    }
    if (
      !confirm(
        `Xác nhận xóa TOÀN BỘ ${stats.pendingOrders} đơn hàng đang ở trạng thái 'Chờ thanh toán'?`
      )
    ) {
      return;
    }
    setIsDeletingOrders(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "DELETE_ORDERS",
          onlyPending: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Đã dọn dẹp sạch toàn bộ đơn chờ thanh toán!");
        setSelectedOrderIds([]);
        fetchData();
      } else {
        showToast(data.error || "Xóa thất bại", true);
      }
    } catch (err: any) {
      showToast(err.message || "Lỗi thao tác", true);
    } finally {
      setIsDeletingOrders(false);
    }
  };

  // Tạo Coupon
  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCouponCode.trim() || !newCouponDiscount) {
      showToast("Vui lòng điền đủ mã và mức giảm", true);
      return;
    }

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "CREATE_COUPON",
          code: newCouponCode.trim().toUpperCase(),
          discount: parseInt(newCouponDiscount, 10),
          isPercent: newCouponIsPercent,
          maxUsage: parseInt(newCouponMaxUsage || "100", 10),
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Đã tạo mã giảm giá "${newCouponCode.toUpperCase()}"!`);
        setNewCouponCode("");
        setNewCouponDiscount("");
        fetchData();
      } else {
        showToast(data.error || "Tạo mã thất bại", true);
      }
    } catch (err: any) {
      showToast(err.message, true);
    }
  };

  // Cập nhật mã giảm giá
  const handleUpdateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCoupon) return;
    if (!editCouponCode.trim() || !editCouponDiscount) {
      showToast("Vui lòng điền đủ mã và mức giảm", true);
      return;
    }

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "UPDATE_COUPON",
          id: editingCoupon.id,
          code: editCouponCode.trim().toUpperCase(),
          discount: parseInt(editCouponDiscount, 10),
          isPercent: editCouponIsPercent,
          maxUsage: parseInt(editCouponMaxUsage || "100", 10),
          usedCount: parseInt(editCouponUsedCount || "0", 10),
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Đã cập nhật mã "${editCouponCode.toUpperCase()}"!`);
        setEditingCoupon(null);
        fetchData();
      } else {
        showToast(data.error || "Cập nhật mã thất bại", true);
      }
    } catch (err: any) {
      showToast(err.message, true);
    }
  };

  // Toggle trạng thái mã giảm giá
  const handleToggleCoupon = async (id: number, currentStatus: number | boolean) => {
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "TOGGLE_COUPON",
          id,
          isActive: Boolean(currentStatus) ? false : true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Đã đổi trạng thái mã giảm giá");
        fetchData();
      }
    } catch (err: any) {
      showToast(err.message, true);
    }
  };

  // Xóa mã giảm giá
  const handleDeleteCoupon = async (id: number) => {
    if (!confirm("Xác nhận xóa mã giảm giá này?")) return;
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "DELETE_COUPON",
          id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Đã xóa mã giảm giá");
        fetchData();
      }
    } catch (err: any) {
      showToast(err.message, true);
    }
  };

  // Tạo Giveaway
  const handleCreateGiveaway = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGaTitle.trim() || !newGaReward.trim()) {
      showToast("Vui lòng điền tiêu đề và phần thưởng Giveaway", true);
      return;
    }

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "CREATE_GIVEAWAY",
          title: newGaTitle.trim(),
          reward: newGaReward.trim(),
          description: newGaDesc.trim(),
          winnerCount: parseInt(newGaWinners || "1", 10),
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Đã tạo Giveaway "${newGaTitle}"!`);
        setNewGaTitle("");
        setNewGaReward("");
        setNewGaDesc("");
        fetchData();
      } else {
        showToast(data.error || "Tạo Giveaway thất bại", true);
      }
    } catch (err: any) {
      showToast(err.message, true);
    }
  };

  // Quay thưởng Giveaway
  const handleDrawGiveaway = async (id: number, title: string) => {
    if (!confirm(`Xác nhận quay thưởng ngẫu nhiên sự kiện "${title}"?`)) return;

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "DRAW_GIVEAWAY",
          giveawayId: id,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const winnerNames = data.winners.map((w: any) => `@${w.username || w.telegramId}`).join(", ");
        showToast(`🎉 Đã quay xong! Người trúng giải: ${winnerNames}`);
        fetchData();
      } else {
        showToast(data.error || "Quay thưởng thất bại", true);
      }
    } catch (err: any) {
      showToast(err.message, true);
    }
  };

  // Xóa Giveaway
  const handleDeleteGiveaway = async (id: number) => {
    if (!confirm("Xác nhận xóa sự kiện Giveaway này?")) return;
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "DELETE_GIVEAWAY",
          giveawayId: id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Đã xóa sự kiện Giveaway");
        fetchData();
      }
    } catch (err: any) {
      showToast(err.message, true);
    }
  };

  // Danh sách các danh mục sản phẩm duy nhất
  const categoriesList = React.useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => {
      const c = (p.category && p.category.trim()) || "Chưa phân loại";
      map.set(c, (map.get(c) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [products]);

  // Lọc sản phẩm theo danh mục và tìm kiếm
  const filteredProducts = products.filter((p) => {
    if (selectedProductCategory !== "ALL") {
      const cat = (p.category && p.category.trim()) || "Chưa phân loại";
      if (cat !== selectedProductCategory) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = p.name.toLowerCase().includes(q);
      const matchCat = (p.category || "").toLowerCase().includes(q);
      const matchDesc = (p.description || "").toLowerCase().includes(q);
      if (!matchName && !matchCat && !matchDesc) return false;
    }
    return true;
  });

  // Lọc đơn hàng gần đây trong Overview
  const filteredRecentOrders = orders.filter((o) => {
    if (recentOrderFilter === "PAID") return o.status === "PAID";
    if (recentOrderFilter === "PENDING") return o.status === "PENDING";
    return true;
  });

  // Bộ lọc và sắp xếp toàn diện trong Tab Quản lý đơn hàng
  const filteredAndSortedOrders = orders
    .filter((o) => {
      if (orderStatusFilter === "PAID" && o.status !== "PAID") return false;
      if (orderStatusFilter === "PENDING" && o.status !== "PENDING") return false;
      if (orderProductFilter !== "ALL" && String(o.productId) !== orderProductFilter) return false;
      if (orderSearch.trim()) {
        const q = orderSearch.toLowerCase().trim();
        const matchId = o.id.toLowerCase().includes(q);
        const matchUser =
          (o.username || "").toLowerCase().includes(q) || (o.telegramId || "").includes(q);
        const matchProduct = (o.product?.name || "").toLowerCase().includes(q);
        if (!matchId && !matchUser && !matchProduct) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (orderSort === "NEWEST") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (orderSort === "OLDEST") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (orderSort === "AMOUNT_DESC") {
        return b.totalAmount - a.totalAmount;
      }
      if (orderSort === "AMOUNT_ASC") {
        return a.totalAmount - b.totalAmount;
      }
      return 0;
    });

  const isAllFilteredSelected =
    filteredAndSortedOrders.length > 0 &&
    filteredAndSortedOrders.every((o) => selectedOrderIds.includes(o.id));

  const toggleSelectAllOrders = () => {
    if (isAllFilteredSelected) {
      const filteredIds = new Set(filteredAndSortedOrders.map((o) => o.id));
      setSelectedOrderIds((prev) => prev.filter((id) => !filteredIds.has(id)));
    } else {
      const newSelected = new Set([...selectedOrderIds, ...filteredAndSortedOrders.map((o) => o.id)]);
      setSelectedOrderIds(Array.from(newSelected));
    }
  };

  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-dashboard-grid text-slate-800 antialiased p-3 sm:p-5 lg:p-7 flex flex-col font-sans selection:bg-emerald-500 selection:text-white relative overflow-x-hidden">
      {/* Top glowing progress bar during fetch */}
      {loading && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-[#0e704b] z-[100] animate-pulse shadow-md" />
      )}

      {/* Toast Alert */}
      {toastMsg && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2 rounded-2xl px-5 py-3 text-xs sm:text-sm font-semibold shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
            toastMsg.isError
              ? "bg-rose-600 text-white shadow-rose-600/30"
              : "bg-emerald-700 text-white shadow-emerald-700/30"
          }`}
        >
          {toastMsg.isError ? <AlertCircle className="h-4 w-4 shrink-0" /> : <Check className="h-4 w-4 shrink-0" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* TOP NAVBAR (Solid white capsule bar with smooth pill transitions) */}
      <header className="bg-white rounded-3xl sm:rounded-[32px] px-4 sm:px-6 py-3 sm:py-3.5 shadow-sm border border-slate-200 flex items-center justify-between mb-4 sm:mb-5 transition-all relative z-20">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-2xl overflow-hidden shadow-md shadow-emerald-900/10 border border-emerald-600/20 transition-transform hover:scale-105">
            <img src="/logo.jpg" alt="RINQ SHOP" className="h-full w-full object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900">
                RINQ SHOP
              </span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-[#0e704b] border border-emerald-100 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                PRO
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-600 hidden sm:block font-medium">
              Quản trị tự động Telegram & VietQR
            </p>
          </div>
        </div>

        {/* Center Pill Navigation (Desktop) with smooth sliding appearance */}
        <nav className="hidden lg:flex items-center gap-1 bg-[#F4F5F7] p-1.5 rounded-full border border-slate-200/60 shadow-inner">
          {[
            { id: "overview", label: "Dashboard", icon: LayoutDashboard },
            { id: "products", label: "Sản phẩm & Kho", icon: Package },
            { id: "orders", label: "Đơn hàng", icon: ShoppingBag },
            { id: "coupons", label: "Mã giảm giá", icon: Tag },
            { id: "giveaways", label: "Giveaway", icon: Gift },
            { id: "broadcast", label: "Thông báo", icon: Bell },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300 ${
                  active
                    ? "bg-[#0e704b] text-white shadow-md shadow-emerald-900/20 scale-[1.02]"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/70"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Action Icons & Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => fetchData()}
            disabled={loading}
            title="Làm mới dữ liệu"
            className="p-2 sm:p-2.5 rounded-full hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition border border-transparent hover:border-slate-200 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 sm:h-4.5 sm:w-4.5 ${loading ? "animate-spin text-emerald-600" : ""}`} />
          </button>

          <a
            href="https://t.me/RINQ_bot"
            target="_blank"
            rel="noreferrer"
            title="Mở Telegram Bot"
            className="p-2 sm:p-2.5 rounded-full hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition border border-transparent hover:border-slate-200 active:scale-95"
          >
            <ExternalLink className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
          </a>

          <button
            onClick={handleLogout}
            title="Đăng xuất"
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition active:scale-95 shadow-sm"
          >
            <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center text-xs font-bold shadow-sm">
              AD
            </div>
            <span className="text-xs font-bold text-slate-700 hidden sm:inline">Admin</span>
            <Lock className="h-3 w-3 text-slate-600 ml-0.5" />
          </button>
        </div>
      </header>

      {/* MOBILE SCROLLABLE TAB NAV */}
      <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto pb-2.5 mb-3 scrollbar-none">
        {[
          { id: "overview", label: "Dashboard", icon: LayoutDashboard },
          { id: "products", label: "Sản phẩm & Kho", icon: Package },
          { id: "orders", label: "Đơn hàng", icon: ShoppingBag },
          { id: "coupons", label: "Mã giảm giá", icon: Tag },
          { id: "giveaways", label: "Giveaway", icon: Gift },
          { id: "broadcast", label: "Thông báo", icon: Bell },
        ].map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2 rounded-full text-xs font-semibold transition shrink-0 ${
                active
                  ? "bg-[#0e704b] text-white shadow-sm scale-[1.02]"
                  : "bg-white text-slate-600 border border-slate-200/80"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* LIVE SYSTEM STATUS TICKER STRIP */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 text-xs scrollbar-none font-medium relative z-10">
        <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm shrink-0 transition-transform hover:scale-105">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold text-slate-800">Telegram Bot:</span>
          <span className="text-[#0e704b] font-semibold">Online 24/7</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm shrink-0 transition-transform hover:scale-105">
          <Zap className="h-3.5 w-3.5 text-amber-500" />
          <span className="font-bold text-slate-800">SePay Webhook:</span>
          <span className="text-emerald-700 font-semibold">Sẵn sàng (200 OK)</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm shrink-0 transition-transform hover:scale-105">
          <CreditCard className="h-3.5 w-3.5 text-blue-500" />
          <span className="font-bold text-slate-800">TPBank:</span>
          <span className="font-mono text-slate-700 font-bold">10005025333</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm shrink-0 transition-transform hover:scale-105">
          <Tag className="h-3.5 w-3.5 text-purple-500" />
          <span className="font-bold text-slate-800">Coupon:</span>
          <span className="text-purple-700 font-semibold">{coupons.filter(c => c.isActive === 1).length} mã mở</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm shrink-0 transition-transform hover:scale-105">
          <Gift className="h-3.5 w-3.5 text-pink-500" />
          <span className="font-bold text-slate-800">Giveaway:</span>
          <span className="text-pink-700 font-semibold">{giveaways.filter(g => g.status === "ACTIVE").length} sự kiện</span>
        </div>
      </div>

      {/* SUBHEADER: Welcome & Quick action buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 sm:mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Welcome Back, Admin
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5 font-medium">
            Hệ thống đang phục vụ <b>{stats.subscriberCount ?? 0}</b> khách hàng tự động qua Bot
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Date range pill */}
          <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-full text-xs font-semibold text-slate-600 border border-slate-200/80 shadow-sm">
            <Clock className="h-3.5 w-3.5 text-[#0e704b]" />
            <span>
              {new Date().toLocaleDateString("vi-VN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>

          {/* Quick Action Button */}
          <button
            onClick={() => setActiveTab("products")}
            className="flex items-center gap-1.5 bg-[#0e704b] hover:bg-[#0a5c3d] text-white px-4 py-2 rounded-full text-xs font-bold transition shadow-md shadow-emerald-900/15 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>+ Nạp kho / Sản phẩm</span>
          </button>
        </div>
      </div>

      {/* MAIN BODY: SIDE DOCK + CONTENT AREA */}
      <div className="flex gap-5 sm:gap-6 items-start flex-1 relative z-10">
        {/* Left Floating Sidebar Dock (Desktop only) */}
        <aside className="hidden lg:flex flex-col items-center gap-3 bg-white p-2.5 rounded-[28px] border border-slate-200 shadow-sm shrink-0">
          {[
            { id: "overview", icon: LayoutDashboard, label: "Tổng quan" },
            { id: "products", icon: Package, label: "Sản phẩm" },
            { id: "orders", icon: ShoppingBag, label: "Đơn hàng" },
            { id: "coupons", icon: Tag, label: "Mã giảm giá" },
            { id: "giveaways", icon: Gift, label: "Giveaway" },
            { id: "broadcast", icon: Bell, label: "Bắn thông báo" },
          ].map((btn) => {
            const Icon = btn.icon;
            const active = activeTab === btn.id;
            return (
              <button
                key={btn.id}
                onClick={() => setActiveTab(btn.id as any)}
                title={btn.label}
                className={`p-3 rounded-2xl transition-all duration-300 ${
                  active
                    ? "bg-[#0e704b] text-white shadow-md shadow-emerald-900/20 scale-105"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <Icon className="h-5 w-5" />
              </button>
            );
          })}

          <div className="w-6 h-px bg-slate-200 my-1" />

          <button
            onClick={handleLogout}
            title="Đăng xuất"
            className="p-3 rounded-2xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition active:scale-95"
          >
            <Lock className="h-5 w-5" />
          </button>

          <a
            href="https://t.me/zophim"
            target="_blank"
            rel="noreferrer"
            title="Hỗ trợ Admin @zophim"
            className="p-3 rounded-2xl text-slate-600 hover:text-emerald-700 hover:bg-slate-50 transition active:scale-95"
          >
            <MessageCircle className="h-5 w-5" />
          </a>
        </aside>

        {/* MAIN DYNAMIC CONTENT WITH SLIDE TRANSITIONS */}
        <main className="flex-1 min-w-0">
          {/* =========================================================================
              LOADING SKELETON (Khi đang tải hoặc chuyển dữ liệu)
             ========================================================================= */}
          {loading && products.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 sm:gap-6 animate-pulse">
              <div className="lg:col-span-4 bg-white rounded-[28px] p-6 h-80 skeleton-shimmer" />
              <div className="lg:col-span-5 bg-white rounded-[28px] p-6 h-80 skeleton-shimmer" />
              <div className="lg:col-span-3 bg-white rounded-[28px] p-6 h-80 skeleton-shimmer" />
              <div className="lg:col-span-8 bg-white rounded-[28px] p-6 h-96 skeleton-shimmer" />
              <div className="lg:col-span-4 bg-white rounded-[28px] p-6 h-96 skeleton-shimmer" />
            </div>
          ) : (
            <div key={activeTab} className="tab-slide-enter">
                            {activeTab === "overview" && (
                <OverviewTab
                  stats={stats}
                  chartData={chartData}
                  overviewChartFilter={overviewChartFilter}
                  setOverviewChartFilter={setOverviewChartFilter}
                  recentOrderFilter={recentOrderFilter}
                  setRecentOrderFilter={setRecentOrderFilter}
                  filteredRecentOrders={filteredRecentOrders}
                  realCustomers={realCustomers}
                  copiedBank={copiedBank}
                  copiedOrderId={copiedOrderId}
                  copyToClipboard={copyToClipboard}
                  setActiveTab={setActiveTab}
                />
              )}

              {activeTab === "products" && (
                <ProductsTab
                  products={products}
                  filteredProducts={filteredProducts}
                  supplierInfo={supplierInfo}
                  isCheckingSupplier={isCheckingSupplier}
                  isSyncingSupplier={isSyncingSupplier}
                  handleCheckSupplier={handleCheckSupplier}
                  handleSyncSupplier={handleSyncSupplier}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  selectedProductCategory={selectedProductCategory}
                  setSelectedProductCategory={setSelectedProductCategory}
                  categoriesList={categoriesList}
                  openEditModal={openEditModal}
                  handleNotifyProduct={handleNotifyProduct}
                  handleToggleProduct={handleToggleProduct}
                  handleDeleteProduct={handleDeleteProduct}
                  newProductName={newProductName}
                  setNewProductName={setNewProductName}
                  newProductPrice={newProductPrice}
                  setNewProductPrice={setNewProductPrice}
                  newProductCategory={newProductCategory}
                  setNewProductCategory={setNewProductCategory}
                  newProductImage={newProductImage}
                  setNewProductImage={setNewProductImage}
                  newProductDesc={newProductDesc}
                  setNewProductDesc={setNewProductDesc}
                  newFulfillmentType={newFulfillmentType}
                  setNewFulfillmentType={setNewFulfillmentType}
                  newSupplierVariantId={newSupplierVariantId}
                  setNewSupplierVariantId={setNewSupplierVariantId}
                  handleCreateProduct={handleCreateProduct}
                  selectedProductId={selectedProductId}
                  setSelectedProductId={setSelectedProductId}
                  bulkText={bulkText}
                  setBulkText={setBulkText}
                  notifyOnImport={notifyOnImport}
                  setNotifyOnImport={setNotifyOnImport}
                  isImporting={isImporting}
                  handleBulkImport={handleBulkImport}
                />
              )}

              {activeTab === "orders" && (
                <OrdersTab
                  orders={orders}
                  products={products}
                  stats={stats}
                  orderStatusFilter={orderStatusFilter}
                  setOrderStatusFilter={setOrderStatusFilter}
                  orderSearch={orderSearch}
                  setOrderSearch={setOrderSearch}
                  orderProductFilter={orderProductFilter}
                  setOrderProductFilter={setOrderProductFilter}
                  orderSort={orderSort}
                  setOrderSort={setOrderSort}
                  selectedOrderIds={selectedOrderIds}
                  isAllFilteredSelected={isAllFilteredSelected}
                  toggleSelectAllOrders={toggleSelectAllOrders}
                  toggleSelectOrder={toggleSelectOrder}
                  handleDeleteSelectedOrders={handleDeleteSelectedOrders}
                  handleClearPendingOrders={handleClearPendingOrders}
                  handleDeleteOrder={handleDeleteOrder}
                  handleSimulatePayment={handleSimulatePayment}
                  isSimulating={isSimulating}
                  isDeletingOrders={isDeletingOrders}
                  filteredAndSortedOrders={filteredAndSortedOrders}
                  copyToClipboard={copyToClipboard}
                  copiedOrderId={copiedOrderId}
                />
              )}

              {activeTab === "coupons" && (
                <CouponsTab
                  coupons={coupons}
                  onOpenEditModal={openEditCouponModal}
                  onToggleCoupon={handleToggleCoupon}
                  onDeleteCoupon={handleDeleteCoupon}
                  newCouponCode={newCouponCode}
                  setNewCouponCode={setNewCouponCode}
                  newCouponDiscount={newCouponDiscount}
                  setNewCouponDiscount={setNewCouponDiscount}
                  newCouponIsPercent={newCouponIsPercent}
                  setNewCouponIsPercent={setNewCouponIsPercent}
                  newCouponMaxUsage={newCouponMaxUsage}
                  setNewCouponMaxUsage={setNewCouponMaxUsage}
                  onCreateCoupon={handleCreateCoupon}
                />
              )}

              {activeTab === "giveaways" && (
                <GiveawaysTab
                  giveaways={giveaways}
                  newGaTitle={newGaTitle}
                  setNewGaTitle={setNewGaTitle}
                  newGaReward={newGaReward}
                  setNewGaReward={setNewGaReward}
                  newGaWinners={newGaWinners}
                  setNewGaWinners={setNewGaWinners}
                  newGaDesc={newGaDesc}
                  setNewGaDesc={setNewGaDesc}
                  onDrawGiveaway={handleDrawGiveaway}
                  onDeleteGiveaway={handleDeleteGiveaway}
                  onCreateGiveaway={handleCreateGiveaway}
                />
              )}

              {activeTab === "broadcast" && (
                <BroadcastTab
                  products={products}
                  stats={stats}
                  customBroadcastMsg={customBroadcastMsg}
                  setCustomBroadcastMsg={setCustomBroadcastMsg}
                  isBroadcasting={isBroadcasting}
                  onNotifyProduct={handleNotifyProduct}
                  onCustomBroadcast={handleCustomBroadcast}
                />
              )}
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <EditProductModal
        editingProduct={editingProduct}
        onClose={() => setEditingProduct(null)}
        editName={editName}
        setEditName={setEditName}
        editPrice={editPrice}
        setEditPrice={setEditPrice}
        editDesc={editDesc}
        setEditDesc={setEditDesc}
        editCategory={editCategory}
        setEditCategory={setEditCategory}
        editPriceReason={editPriceReason}
        setEditPriceReason={setEditPriceReason}
        editProductImage={editProductImage}
        setEditProductImage={setEditProductImage}
        editSupplierVariantId={editSupplierVariantId}
        setEditSupplierVariantId={setEditSupplierVariantId}
        editFulfillmentType={editFulfillmentType}
        setEditFulfillmentType={setEditFulfillmentType}
        editNotify={editNotify}
        setEditNotify={setEditNotify}
        isUpdating={isUpdating}
        categoriesList={categoriesList}
        subscriberCount={stats.subscriberCount ?? 0}
        onUpdate={handleUpdateProduct}
      />

      <EditCouponModal
        editingCoupon={editingCoupon}
        onClose={() => setEditingCoupon(null)}
        editCouponCode={editCouponCode}
        setEditCouponCode={setEditCouponCode}
        editCouponDiscount={editCouponDiscount}
        setEditCouponDiscount={setEditCouponDiscount}
        editCouponIsPercent={editCouponIsPercent}
        setEditCouponIsPercent={setEditCouponIsPercent}
        editCouponMaxUsage={editCouponMaxUsage}
        setEditCouponMaxUsage={setEditCouponMaxUsage}
        editCouponUsedCount={editCouponUsedCount}
        setEditCouponUsedCount={setEditCouponUsedCount}
        onUpdate={handleUpdateCoupon}
      />

    </div>
  );
}
