"use client";

import React, { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
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
  Settings,
} from "lucide-react";
import { Product, Order, Stats, Coupon, Giveaway, Customer } from "./types";
import OverviewTab from "./components/OverviewTab";
import ProductsTab from "./components/ProductsTab";
import OrdersTab from "./components/OrdersTab";
import CouponsTab from "./components/CouponsTab";
import GiveawaysTab from "./components/GiveawaysTab";
import BroadcastTab from "./components/BroadcastTab";
import CustomersTab from "./components/CustomersTab";
import EditProductModal from "./components/EditProductModal";
import EditCouponModal from "./components/EditCouponModal";
import SettingsTab from "./components/SettingsTab";

export default function AdminPage() {
  const pathname = usePathname();
  const router = useRouter();
  type AdminSection = "overview" | "products" | "orders" | "customers" | "coupons" | "giveaways" | "broadcast" | "settings";
  const sectionByPath: Record<string, AdminSection> = {
    "/admin": "overview",
    "/admin/trang-chu": "overview",
    "/admin/san-pham": "products",
    "/admin/don-hang": "orders",
    "/admin/khach-hang": "customers",
    "/admin/ma-giam-gia": "coupons",
    "/admin/giveaway": "giveaways",
    "/admin/thong-bao": "broadcast",
    "/admin/cau-hinh": "settings",
  };
  const pathBySection: Record<AdminSection, string> = {
    overview: "/admin/trang-chu",
    products: "/admin/san-pham",
    orders: "/admin/don-hang",
    customers: "/admin/khach-hang",
    coupons: "/admin/ma-giam-gia",
    giveaways: "/admin/giveaway",
    broadcast: "/admin/thong-bao",
    settings: "/admin/cau-hinh",
  };

  const sectionMeta: Record<AdminSection, { title: string; description: string }> = {
    overview: { title: "Tổng quan cửa hàng", description: "Hệ thống đang phục vụ khách hàng tự động qua Bot" },
    products: { title: "Sản phẩm & Kho", description: "Quản lý danh mục, giá bán, hình ảnh và tồn kho" },
    orders: { title: "Đơn hàng", description: "Theo dõi thanh toán, cấp hàng và trạng thái đơn" },
    customers: { title: "Khách hàng", description: "Danh sách khách hàng và lịch sử mua hàng" },
    coupons: { title: "Mã giảm giá", description: "Tạo và quản lý ưu đãi dùng trong Bot" },
    giveaways: { title: "Giveaway", description: "Quản lý sự kiện và quay thưởng" },
    broadcast: { title: "Thông báo", description: "Gửi thông báo sản phẩm, tính năng và chiến dịch" },
    settings: { title: "Cấu hình", description: "Thông tin cửa hàng, thanh toán và kết nối hệ thống" },
  };

  const [activeTab, setActiveTabState] = useState<AdminSection>(() => {
    return sectionByPath[pathname || "/admin/trang-chu"] || "overview";
  });

  useEffect(() => {
    const sec = sectionByPath[pathname || "/admin/trang-chu"];
    if (sec && sec !== activeTab) {
      setActiveTabState(sec);
    }
  }, [pathname]);

  useEffect(() => {
    const onPop = () => {
      const sec = sectionByPath[window.location.pathname] || "overview";
      setActiveTabState(sec);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const setActiveTab = (section: AdminSection) => {
    setActiveTabState(section);
    const targetPath = pathBySection[section];
    if (targetPath && typeof window !== "undefined" && window.location.pathname !== targetPath) {
      window.history.pushState(null, "", targetPath);
    }
  };

  const [loading, setLoading] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [copiedBank, setCopiedBank] = useState<boolean>(false);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [giveaways, setGiveaways] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Form tạo sản phẩm mới
  const [newProductName, setNewProductName] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newProductCategory, setNewProductCategory] = useState("AI");
  const [newProductDesc, setNewProductDesc] = useState("");
  const [newProductWarranty, setNewProductWarranty] = useState("");
  const [newProductImage, setNewProductImage] = useState("");
  const [newSupplierVariantId, setNewSupplierVariantId] = useState("");
  const [newFulfillmentType, setNewFulfillmentType] = useState("HYBRID");

  // State thông tin nhà cung cấp API
  const [supplierInfo, setSupplierInfo] = useState<any>(null);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [isCheckingSupplier, setIsCheckingSupplier] = useState(false);
  const [isSyncingSupplier, setIsSyncingSupplier] = useState(false);

  // Form nạp kho hàng loạt
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [bulkText, setBulkText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [notifyOnImport, setNotifyOnImport] = useState(true);

  // Form bắn thông báo tùy chỉnh
  const [customBroadcastMsg, setCustomBroadcastMsg] = useState("");
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastImageUrl, setBroadcastImageUrl] = useState("");
  const [broadcastButtonText, setBroadcastButtonText] = useState("");
  const [broadcastButtonUrl, setBroadcastButtonUrl] = useState("");
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [notifyConfirm, setNotifyConfirm] = useState<{ productId: number; productName: string } | null>(null);
  const [isSendingRestock, setIsSendingRestock] = useState(false);

  // State chỉnh sửa sản phẩm & giá
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editWarranty, setEditWarranty] = useState("");
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
    setEditCouponIsPercent(Boolean(c.isPercent));
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
  const [orderStatusFilter, setOrderStatusFilter] = useState<"ALL" | "PAID" | "PENDING" | "FULFILLMENT">("ALL");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderProductFilter, setOrderProductFilter] = useState("ALL");
  const [orderSort, setOrderSort] = useState<"NEWEST" | "OLDEST" | "AMOUNT_DESC" | "AMOUNT_ASC">("NEWEST");
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isDeletingOrders, setIsDeletingOrders] = useState(false);
  const [manualFulfillmentOrder, setManualFulfillmentOrder] = useState<Order | null>(null);
  const [manualFulfillmentKeys, setManualFulfillmentKeys] = useState("");

  const [stats, setStats] = useState<Stats>({
    totalRevenue: 0,
    totalOrders: 0,
    paidOrders: 0,
    pendingOrders: 0,
    fulfillmentPendingOrders: 0,
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
      let res = await fetch("/api/admin");

      if (res.status === 401) {
        window.location.replace("/admin/login");
        return;
      }

      // Tự động thử lại 1 lần nếu gặp lỗi kết nối tạm thời từ Cloudflare Workers
      if (!res.ok) {
        await new Promise((r) => setTimeout(r, 600));
        res = await fetch("/api/admin");
      }

      if (res.status === 401) {
        window.location.replace("/admin/login");
        return;
      }

      if (!res.ok) {
        let msg = `Lỗi máy chủ (${res.status})`;
        try {
          const json = await res.json();
          if (json?.error) msg = json.error;
        } catch {}
        showToast(msg, true);
        return;
      }

      const data = await res.json();
      if (data.success) {
        setProducts(data.products || []);
        setOrders(data.orders || []);
        setCoupons(data.coupons || []);
        setGiveaways(data.giveaways || []);
        setCustomers(data.customers || []);
        if (data.supplier) setSupplierInfo(data.supplier);
        if (data.systemStatus) setSystemStatus(data.systemStatus);
        setStats(data.stats || {
          totalRevenue: 0,
          totalOrders: 0,
          paidOrders: 0,
          pendingOrders: 0,
          fulfillmentPendingOrders: 0,
          totalStockAvailable: 0,
          totalStockSold: 0,
          subscriberCount: 0,
        });
        setSelectedProductId((prev) => prev || (data.products?.[0]?.id ? String(data.products[0].id) : ""));
      } else {
        showToast(data.error || "Lỗi tải dữ liệu", true);
      }
    } catch (err: any) {
      showToast(err.message || "Lỗi kết nối", true);
    } finally {
      setLoading(false);
    }
  }, []);

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
          warranty: newProductWarranty.trim() || null,
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
        setNewProductWarranty("");
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
      let res = await fetch("/api/admin", {
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
      if (!res.ok && res.status >= 500) {
        await new Promise((r) => setTimeout(r, 600));
        res = await fetch("/api/admin", {
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
      }
      const data = await res.json();
      if (data.success) {
        showToast("Đã cập nhật trạng thái sản phẩm");
        fetchData();
      } else {
        showToast(data.error || "Lỗi cập nhật", true);
      }
    } catch (err: any) {
      showToast(err.message, true);
    }
  };

  const handleRenameCategory = async (oldName: string, newName: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RENAME_CATEGORY", oldName, newName }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || "Đổi tên danh mục thất bại", true);
        return false;
      }
      setSelectedProductCategory(data.newName);
      showToast(`Đã đổi tên danh mục thành "${data.newName}" (${data.count} sản phẩm)`);
      await fetchData();
      return true;
    } catch (err: any) {
      showToast(err.message || "Lỗi kết nối", true);
      return false;
    }
  };

  // Xóa sản phẩm
  const handleDeleteProduct = async (id: number, name: string, reason: string, notifyUsers: boolean, force = false): Promise<void> => {
    try {
      let res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "DELETE_PRODUCT",
          id,
          reason,
          notifyUsers,
          force,
        }),
      });
      if (!res.ok && res.status >= 500) {
        await new Promise((r) => setTimeout(r, 600));
        res = await fetch("/api/admin", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "DELETE_PRODUCT",
            id,
            reason,
            notifyUsers,
            force,
          }),
        });
      }
      const data = await res.json();
      if (res.status === 409 && data.hasPaidOrders) {
        if (window.confirm(`${data.error}\n\nNhấn OK để đồng ý xóa vĩnh viễn sản phẩm này cùng lịch sử liên quan.`)) {
          return handleDeleteProduct(id, name, reason, notifyUsers, true);
        }
        return;
      }
      if (data.success) {
        const sent = data.notifyResult?.sentCount;
        showToast(notifyUsers && typeof sent === "number" ? `Đã xóa "${name}" và gửi thông báo tới ${sent} khách` : `Đã xóa thành công sản phẩm "${name}"`);
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
    setEditWarranty(p.warranty || "");
    setEditCategory(p.category || "");
    setEditPriceReason(p.priceNote || "");
    setEditProductImage(p.imageUrl || "");
    setEditSupplierVariantId(p.supplierVariantId || "");
    setEditFulfillmentType(p.fulfillmentType || "HYBRID");
    setEditNotify(false);
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
          warranty: editWarranty.trim() || null,
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
    setNotifyConfirm({ productId, productName });
  };

  const confirmNotifyProduct = async () => {
    if (!notifyConfirm) return;
    const { productId, productName } = notifyConfirm;
    setIsSendingRestock(true);
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
    } finally {
      setIsSendingRestock(false);
      setNotifyConfirm(null);
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
          title: broadcastTitle.trim(),
          message: customBroadcastMsg.trim(),
          imageUrl: broadcastImageUrl.trim() || undefined,
          buttonText: broadcastButtonText.trim() || undefined,
          buttonUrl: broadcastButtonUrl.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Đã bắn thành công tới ${data.result?.sentCount || 0} / ${data.result?.total || 0} khách hàng!`);
        setCustomBroadcastMsg("");
        setBroadcastTitle("");
        setBroadcastImageUrl("");
        setBroadcastButtonText("");
        setBroadcastButtonUrl("");
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
          gateway: systemStatus?.bankId || "MB",
          transactionDate: new Date().toISOString(),
          accountNumber: systemStatus?.bankAccountNo || "",
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
        showToast(data.message || `Đã xử lý thanh toán thử ${orderId}. Kiểm tra trạng thái giao hàng.`);
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

  // Duyệt đơn hàng thủ công (cấp hàng và hoàn tất đơn)
  const handleApproveOrder = async (orderId: string) => {
    if (!confirm(`Xác nhận duyệt đơn hàng #${orderId} và gửi tài nguyên cho khách qua Bot?`)) return;
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE_ORDER", orderId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || "Đã duyệt đơn hàng thành công!");
        fetchData();
      } else {
        showToast(data.error || "Duyệt đơn thất bại", true);
      }
    } catch (e: any) {
      showToast(e.message || "Lỗi kết nối", true);
    }
  };

  // Cộng tiền vào ví khách hàng
  const handleCreditBalance = async (customerId: string, amount: number, reason: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CREDIT_BALANCE", customerId, amount, reason }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || `Đã cộng ${amount.toLocaleString("vi-VN")}đ cho khách hàng!`);
        fetchData();
        return true;
      } else {
        showToast(data.error || "Cộng tiền thất bại", true);
        return false;
      }
    } catch (e: any) {
      showToast(e.message || "Lỗi kết nối", true);
      return false;
    }
  };

  const handleCompleteManualFulfillment = (order: Order) => {
    setManualFulfillmentOrder(order);
    setManualFulfillmentKeys("");
  };

  const submitManualFulfillment = async () => {
    if (!manualFulfillmentOrder) return;
    const keys = manualFulfillmentKeys.split(/\r?\n/).map((key) => key.trim()).filter(Boolean);
    if (keys.length !== (manualFulfillmentOrder.quantity || 1)) {
      showToast(`Đơn cần đúng ${manualFulfillmentOrder.quantity || 1} key.`, true);
      return;
    }
    setIsDeletingOrders(true);
    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "COMPLETE_MANUAL_FULFILLMENT", orderId: manualFulfillmentOrder.id, keys }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        showToast(data.error || "Không thể hoàn tất cấp hàng", true);
        return;
      }
      showToast(data.message);
      setManualFulfillmentOrder(null);
      setManualFulfillmentKeys("");
      fetchData();
    } catch (error: any) {
      showToast(error?.message || "Lỗi kết nối", true);
    } finally {
      setIsDeletingOrders(false);
    }
  };

  // Xóa 1 đơn hàng
  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm(`Xóa đơn ${orderId}? Chỉ đơn chưa thanh toán, đã hủy hoặc hết hạn được xóa.`)) {
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
        `Xóa ${selectedOrderIds.length} đơn đã chọn nếu chúng chưa thanh toán, đã hủy hoặc hết hạn?`
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
    if (recentOrderFilter === "PAID") return o.status === "PAID" || o.status === "PAID_PENDING_FULFILLMENT";
    if (recentOrderFilter === "PENDING") return o.status === "PENDING";
    return true;
  });

  // Bộ lọc và sắp xếp toàn diện trong Tab Quản lý đơn hàng
  const filteredAndSortedOrders = orders
    .filter((o) => {
      if (orderStatusFilter === "PAID" && o.status !== "PAID") return false;
      if (orderStatusFilter === "PENDING" && o.status !== "PENDING") return false;
      if (orderStatusFilter === "FULFILLMENT" && o.status !== "PAID_PENDING_FULFILLMENT" && o.status !== "PROCESSING") return false;
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
      filteredAndSortedOrders.filter((o) => ["PENDING", "CANCELLED", "EXPIRED"].includes(o.status)).length > 0 &&
      filteredAndSortedOrders.filter((o) => ["PENDING", "CANCELLED", "EXPIRED"].includes(o.status)).every((o) => selectedOrderIds.includes(o.id));

  const toggleSelectAllOrders = () => {
    if (isAllFilteredSelected) {
      const filteredIds = new Set(filteredAndSortedOrders.filter((o) => ["PENDING", "CANCELLED", "EXPIRED"].includes(o.status)).map((o) => o.id));
      setSelectedOrderIds((prev) => prev.filter((id) => !filteredIds.has(id)));
    } else {
      const deletableIds = filteredAndSortedOrders.filter((o) => ["PENDING", "CANCELLED", "EXPIRED"].includes(o.status)).map((o) => o.id);
      const newSelected = new Set([...selectedOrderIds, ...deletableIds]);
      setSelectedOrderIds(Array.from(newSelected));
    }
  };

  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="swiss-admin min-h-screen bg-dashboard-grid text-slate-800 antialiased p-3 sm:p-5 lg:p-7 pb-24 xl:pb-7 flex flex-col font-sans selection:bg-emerald-500 selection:text-white relative overflow-x-hidden">
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

      {manualFulfillmentOrder && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="manual-fulfillment-title" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="manual-fulfillment-title" className="text-lg font-bold text-slate-900">Cấp hàng thủ công</h2>
                <p className="mt-1 text-sm text-slate-600">Đơn {manualFulfillmentOrder.id} · {manualFulfillmentOrder.product?.name || `SP #${manualFulfillmentOrder.productId}`} · {manualFulfillmentOrder.quantity || 1} key</p>
              </div>
              <button type="button" onClick={() => setManualFulfillmentOrder(null)} className="min-h-9 min-w-9 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Đóng">×</button>
            </div>
            <label htmlFor="manual-fulfillment-keys" className="mt-5 block text-sm font-semibold text-slate-800">Key bàn giao, mỗi key trên một dòng</label>
            <textarea id="manual-fulfillment-keys" rows={Math.min(8, Math.max(3, manualFulfillmentOrder.quantity || 1))} value={manualFulfillmentKeys} onChange={(event) => setManualFulfillmentKeys(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-sm text-slate-900 placeholder:text-slate-500 focus:border-[#0e704b] focus:outline-none focus:ring-2 focus:ring-emerald-700/20" placeholder="KEY-XXXX-XXXX" autoFocus />
            <p className="mt-2 text-xs text-slate-600">Đã nhập {manualFulfillmentKeys.split(/\r?\n/).filter((key) => key.trim()).length} / {manualFulfillmentOrder.quantity || 1}. Khi xác nhận, key được lưu mã hóa và gửi Telegram.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setManualFulfillmentOrder(null)} className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Hủy</button>
              <button type="button" onClick={submitManualFulfillment} disabled={isDeletingOrders} className="min-h-10 rounded-lg bg-[#0e704b] px-4 text-sm font-semibold text-white hover:bg-[#0a5c3d] disabled:opacity-50">{isDeletingOrders ? "Đang cấp…" : "Xác nhận cấp key"}</button>
            </div>
          </section>
        </div>
      )}

      {/* TOP NAVBAR (Solid white capsule bar with smooth pill transitions) */}
      <header className="bg-white rounded-3xl sm:rounded-[32px] px-4 sm:px-6 py-3 sm:py-3.5 shadow-sm border border-slate-200 flex items-center justify-between mb-4 sm:mb-5 transition-all relative z-20">
        {/* Brand / Logo */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-2xl overflow-hidden shadow-md shadow-emerald-900/10 border border-emerald-600/20 transition-transform hover:scale-105">
            <img src="/logo.jpg" alt="RINQ SHOP" className="h-full w-full object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900">
                RINQ SHOP
              </span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-[#0e704b] border border-emerald-100 flex items-center gap-1">
                RINQ ADMIN
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-600 hidden sm:block font-medium">
              Quản trị tự động Telegram & VietQR
            </p>
          </div>
        </div>

        {/* Right Action Icons & Profile */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <button
            onClick={() => fetchData()}
            disabled={loading}
            title="Làm mới dữ liệu"
            className="p-2 sm:p-2.5 rounded-full hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition border border-transparent hover:border-slate-200 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 sm:h-4.5 sm:w-4.5 ${loading ? "animate-spin text-emerald-600" : ""}`} />
          </button>

          <Link
            href="https://t.me/RINQ_bot"
            target="_blank"
            rel="noreferrer"
            title="Mở Telegram Bot"
            className="p-2 sm:p-2.5 rounded-full hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition border border-transparent hover:border-slate-200 active:scale-95"
          >
            <ExternalLink className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
          </Link>

          <button
            onClick={handleLogout}
            title="Đăng xuất"
            className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 pr-2.5 sm:pr-3 py-1 sm:py-1.5 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition active:scale-95 shadow-sm"
          >
            <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center text-xs font-bold shadow-sm">
              AD
            </div>
            <span className="text-xs font-bold text-slate-700 hidden sm:inline">Admin</span>
            <Lock className="h-3 w-3 text-slate-600 ml-0.5" />
          </button>
        </div>
      </header>

      {/* DEDICATED FULL-WIDTH NAVIGATION TABS (Chuyển xuống dưới Header - Không bị che trên máy tính) */}
      <nav className="w-full bg-white rounded-2xl sm:rounded-3xl p-1.5 sm:p-2 shadow-sm border border-slate-200/80 flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none mb-3 sm:mb-4 relative z-10">
        {[
          { id: "overview", label: "Trang chủ", icon: LayoutDashboard },
          { id: "products", label: "Sản phẩm & Kho", icon: Package },
          { id: "orders", label: "Đơn hàng", icon: ShoppingBag },
          { id: "customers", label: "Khách hàng", icon: Users },
          { id: "coupons", label: "Mã giảm giá", icon: Tag },
          { id: "giveaways", label: "Giveaway", icon: Gift },
          { id: "broadcast", label: "Thông báo", icon: Bell },
          { id: "settings", label: "Cấu hình", icon: Settings },
        ].map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id as any)}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
                active
                  ? "bg-[#0e704b] text-white shadow-md shadow-emerald-900/15"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* LIVE SYSTEM STATUS TICKER STRIP */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 text-xs scrollbar-none font-medium relative z-10">
        <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm shrink-0 transition-transform hover:scale-105">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold text-slate-800">Telegram Bot:</span>
          <span className={`font-semibold ${systemStatus?.botOnline ? "text-[#0e704b]" : "text-amber-700"}`}>{systemStatus?.botOnline ? "Đang hoạt động" : "Ngoại tuyến"}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm shrink-0 transition-transform hover:scale-105">
          <Zap className="h-3.5 w-3.5 text-amber-500" />
          <span className="font-bold text-slate-800">SePay Webhook:</span>
          <span className={`font-semibold ${systemStatus?.sepayConfigured ? "text-emerald-700" : "text-amber-700"}`}>{systemStatus?.sepayConfigured ? "Đã cấu hình" : "Chưa cấu hình"}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm shrink-0 transition-transform hover:scale-105">
          <CreditCard className="h-3.5 w-3.5 text-blue-500" />
          <span className="font-bold text-slate-800">{systemStatus?.bankId || "Ngân hàng"}:</span>
          <span className="font-mono text-slate-700 font-bold">{systemStatus?.bankAccountNo || "Chưa cấu hình"}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm shrink-0 transition-transform hover:scale-105">
          <Tag className="h-3.5 w-3.5 text-purple-500" />
          <span className="font-bold text-slate-800">Coupon:</span>
          <span className="text-purple-700 font-semibold">{coupons.filter((c) => Boolean(c.isActive)).length} mã mở</span>
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
            {sectionMeta[activeTab].title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5 font-medium">
            {activeTab === "overview" ? <><span>{sectionMeta[activeTab].description} </span><b>{stats.subscriberCount ?? 0}</b><span> khách hàng</span></> : sectionMeta[activeTab].description}
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
            type="button"
            onClick={() => setActiveTab("products")}
            className="flex items-center gap-1.5 bg-[#0e704b] hover:bg-[#0a5c3d] text-white px-4 py-2 rounded-full text-xs font-bold transition shadow-md shadow-emerald-900/15 active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>+ Nạp kho / Sản phẩm</span>
          </button>
        </div>
      </div>

      {/* MAIN BODY: SIDE DOCK + CONTENT AREA */}
      <div className="flex items-start flex-1 relative z-10">

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
                  systemStatus={systemStatus}
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
                  onScoopyImported={() => fetchData()}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  selectedProductCategory={selectedProductCategory}
                  setSelectedProductCategory={setSelectedProductCategory}
                  categoriesList={categoriesList}
                  handleRenameCategory={handleRenameCategory}
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
                  newProductWarranty={newProductWarranty}
                  setNewProductWarranty={setNewProductWarranty}
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
                  allowPaymentSimulation={Boolean(systemStatus?.allowPaymentSimulation)}
                  handleApproveOrder={handleApproveOrder}
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
                  handleCompleteManualFulfillment={handleCompleteManualFulfillment}
                  isSimulating={isSimulating}
                  isDeletingOrders={isDeletingOrders}
                  filteredAndSortedOrders={filteredAndSortedOrders}
                  copyToClipboard={copyToClipboard}
                  copiedOrderId={copiedOrderId}
                />
              )}

              {activeTab === "customers" && (
                <CustomersTab
                  customers={customers}
                  onCreditBalance={handleCreditBalance}
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
                  broadcastTitle={broadcastTitle}
                  setBroadcastTitle={setBroadcastTitle}
                  customBroadcastMsg={customBroadcastMsg}
                  setCustomBroadcastMsg={setCustomBroadcastMsg}
                  broadcastImageUrl={broadcastImageUrl}
                  setBroadcastImageUrl={setBroadcastImageUrl}
                  broadcastButtonText={broadcastButtonText}
                  setBroadcastButtonText={setBroadcastButtonText}
                  broadcastButtonUrl={broadcastButtonUrl}
                  setBroadcastButtonUrl={setBroadcastButtonUrl}
                  isBroadcasting={isBroadcasting}
                  onNotifyProduct={handleNotifyProduct}
                  onCustomBroadcast={handleCustomBroadcast}
                />
              )}
              {activeTab === "settings" && <SettingsTab />}
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      {notifyConfirm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="restock-confirm-title" className="w-full max-w-md border-2 border-black bg-white p-5 text-black">
            <div className="mb-3 h-2 w-16 bg-pink-600" />
            <h2 id="restock-confirm-title" className="text-lg font-black">GỬI THÔNG BÁO HÀNG VỀ?</h2>
            <p className="mt-2 text-sm text-slate-700">Sản phẩm <b>{notifyConfirm.productName}</b> sẽ được gửi tới toàn bộ <b>{stats.subscriberCount ?? 0}</b> khách hàng theo dõi bot.</p>
            <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={isSendingRestock} onClick={() => setNotifyConfirm(null)} className="min-h-10 border-2 border-black bg-white px-4 text-sm font-bold">Hủy</button><button type="button" disabled={isSendingRestock} onClick={() => void confirmNotifyProduct()} className="min-h-10 border-2 border-black bg-pink-600 px-4 text-sm font-bold text-white">{isSendingRestock ? "Đang gửi…" : "Gửi thông báo"}</button></div>
          </section>
        </div>
      )}
      <EditProductModal
        editingProduct={editingProduct}
        onClose={() => setEditingProduct(null)}
        editName={editName}
        setEditName={setEditName}
        editPrice={editPrice}
        setEditPrice={setEditPrice}
        editDesc={editDesc}
        setEditDesc={setEditDesc}
        editWarranty={editWarranty}
        setEditWarranty={setEditWarranty}
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

      {/* MOBILE BOTTOM NAVIGATION DOCK (Sticky on phone screen) */}
      <nav
        aria-label="Điều hướng nhanh điện thoại"
        className="xl:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_25px_rgba(0,0,0,0.08)] px-2 py-1.5 flex items-center justify-around"
      >
        {[
          { id: "overview", href: "/admin/trang-chu", label: "Tổng quan", icon: LayoutDashboard },
          { id: "products", href: "/admin/san-pham", label: "Sản phẩm", icon: Package },
          { id: "orders", href: "/admin/don-hang", label: "Đơn hàng", icon: ShoppingBag },
          { id: "customers", href: "/admin/khach-hang", label: "Khách", icon: Users },
          { id: "settings", href: "/admin/cau-hinh", label: "Cấu hình", icon: Settings },
        ].map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition active:scale-95 ${
                active
                  ? "text-[#0e704b] font-bold"
                  : "text-slate-500 hover:text-slate-800 font-medium"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : "stroke-[1.75]"}`} />
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </nav>

    </div>
  );
}
