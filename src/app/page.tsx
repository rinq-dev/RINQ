"use client";

import React, { useState, useEffect, useMemo } from "react";
import confetti from "canvas-confetti";
import {
  ShieldCheck,
  Zap,
  ShoppingBag,
  Search,
  Copy,
  Check,
  RefreshCw,
  Clock,
  QrCode,
  Sparkles,
  Bot,
  Download,
  CheckCircle2,
  X,
  CreditCard,
  ChevronRight,
  PackageCheck,
  User,
  AlertCircle,
  FileText,
  LogIn,
  LogOut,
  ExternalLink,
} from "lucide-react";

interface Product {
  id: number;
  name: string;
  price: number;
  description: string | null;
  category: string;
  priceNote?: string | null;
  imageUrl?: string | null;
  stockAvailable: number;
  isAutoApi?: boolean;
}

interface BankInfo {
  bankId: string;
  bankAccountNo: string;
  bankAccountName: string;
}

interface ActiveOrderPayment {
  orderId: string;
  productName: string;
  quantity: number;
  totalAmount: number;
  qrUrl: string;
  bankId: string;
  bankAccountNo: string;
  bankAccountName: string;
}

interface TelegramTMAUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

interface UserOrderRecord {
  id: string;
  productId: number;
  productName: string;
  imageUrl?: string | null;
  category?: string;
  quantity: number;
  totalAmount: number;
  status: string;
  createdAt: string;
  paidAt?: string | null;
  keys: string[];
}

export default function StorefrontPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [bankInfo, setBankInfo] = useState<BankInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Trạng thái hoạt động của Telegram Bot (Bot phải mở thì Web mới cho phép hoạt động)
  const [isBotActive, setIsBotActive] = useState<boolean | null>(null);

  // Telegram Mini App Context & Web Login
  const [tgUser, setTgUser] = useState<TelegramTMAUser | null>(null);
  const [isTMA, setIsTMA] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authSession, setAuthSession] = useState<{ token: string; botUrl: string; qrUrl: string } | null>(null);
  const [pendingBuyProduct, setPendingBuyProduct] = useState<Product | null>(null);

  // Modal mua hàng
  const [buyingProduct, setBuyingProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [telegramUser, setTelegramUser] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState<{ discount: number; isPercent: boolean } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Màn hình thanh toán QR & Realtime Polling
  const [activePayment, setActivePayment] = useState<ActiveOrderPayment | null>(null);
  const [paymentSecondsLeft, setPaymentSecondsLeft] = useState(600); // 10 phút
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [deliveredKeys, setDeliveredKeys] = useState<string[] | null>(null);

  // Modal lịch sử đơn hàng của người dùng Telegram
  const [myOrdersOpen, setMyOrdersOpen] = useState(false);
  const [myOrders, setMyOrders] = useState<UserOrderRecord[]>([]);
  const [isLoadingMyOrders, setIsLoadingMyOrders] = useState(false);

  // Modal tra cứu đơn hàng vãng lai (không đăng nhập)
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupOrderId, setLookupOrderId] = useState("");
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState("");

  // Copy toast state
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // FOMO live notification popup
  const [fomoNotice, setFomoNotice] = useState<string | null>(null);

  // Haptic Feedback rung phản hồi Telegram
  const triggerHaptic = (type: "light" | "medium" | "heavy" | "success" | "error" = "medium") => {
    if (typeof window !== "undefined" && (window as any).Telegram?.WebApp?.HapticFeedback) {
      const haptic = (window as any).Telegram.WebApp.HapticFeedback;
      if (type === "success" || type === "error") {
        haptic.notificationOccurred(type);
      } else {
        haptic.impactOccurred(type);
      }
    }
  };

  // Tải danh sách đơn hàng đã mua của Telegram User
  const fetchMyOrders = async (overrideToken?: string) => {
    setIsLoadingMyOrders(true);
    try {
      const initData = typeof window !== "undefined" ? (window as any).Telegram?.WebApp?.initData || "" : "";
      const token =
        overrideToken ??
        authToken ??
        (typeof window !== "undefined" ? localStorage.getItem("rinq_web_auth_token") : null) ??
        "";
      const headers: Record<string, string> = {};
      if (initData) headers["x-telegram-init-data"] = initData;
      if (token) headers["x-web-auth-token"] = token;

      const res = await fetch("/api/store/user-orders", { headers });
      const data = await res.json();
      if (data.success) {
        setMyOrders(data.orders || []);
      }
    } catch (err) {
      console.error("Lỗi fetch đơn hàng Telegram:", err);
    } finally {
      setIsLoadingMyOrders(false);
    }
  };

  // Khởi tạo Telegram Mini App SDK & Khôi phục phiên Web Login
  useEffect(() => {
    if (typeof window !== "undefined") {
      // 1. Kiểm tra môi trường Telegram Mini App
      if ((window as any).Telegram?.WebApp) {
        const tg = (window as any).Telegram.WebApp;
        try {
          tg.ready();
          tg.expand();
          setIsTMA(true);

          const user = tg.initDataUnsafe?.user;
          if (user && user.id) {
            setTgUser(user);
            if (user.username) {
              setTelegramUser(`@${user.username}`);
            } else if (user.first_name) {
              setTelegramUser(user.first_name);
            }
            fetchMyOrders();
            return;
          }
        } catch (err) {
          console.warn("Lỗi khởi tạo Telegram WebApp:", err);
        }
      }

      // 2. Nếu ở ngoài web browser thông thường, khôi phục từ localStorage
      try {
        const savedUser = localStorage.getItem("rinq_web_telegram_user");
        const savedToken = localStorage.getItem("rinq_web_auth_token");
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          if (parsed && parsed.id) {
            setTgUser(parsed);
            if (parsed.username) {
              setTelegramUser(`@${parsed.username}`);
            } else if (parsed.first_name) {
              setTelegramUser(parsed.first_name);
            }
            if (savedToken) {
              setAuthToken(savedToken);
            }
            fetchMyOrders(savedToken || undefined);
          }
        }
      } catch (e) {
        console.warn("Lỗi đọc session lưu trữ:", e);
      }
    }
  }, []);

  // Bắt đầu quá trình Đăng nhập Telegram trên Web
  const startTelegramLogin = async () => {
    triggerHaptic("medium");
    setAuthModalOpen(true);
    setAuthSession(null);
    try {
      const res = await fetch("/api/store/auth/session", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setAuthSession({
          token: data.token,
          botUrl: data.botUrl,
          qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(data.botUrl)}`,
        });
      }
    } catch (err) {
      console.error("Lỗi tạo phiên đăng nhập Telegram:", err);
    }
  };

  // Realtime Polling kiểm tra trạng thái xác nhận từ Bot
  useEffect(() => {
    if (!authModalOpen || !authSession?.token) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/store/auth/session?token=${encodeURIComponent(authSession.token)}`);
        const data = await res.json();
        if (data.success && data.verified && data.user) {
          clearInterval(interval);
          triggerHaptic("success");
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
          });

          setTgUser(data.user);
          setAuthToken(authSession.token);
          if (data.user.username) {
            setTelegramUser(`@${data.user.username}`);
          } else if (data.user.first_name) {
            setTelegramUser(data.user.first_name);
          }

          localStorage.setItem("rinq_web_telegram_user", JSON.stringify(data.user));
          localStorage.setItem("rinq_web_auth_token", authSession.token);
          setAuthModalOpen(false);

          fetchMyOrders(authSession.token);

          // Nếu trước đó đang chọn mua một sản phẩm thì mở lại ngay
          if (pendingBuyProduct) {
            setBuyingProduct(pendingBuyProduct);
            setQuantity(1);
            setCouponCode("");
            setCouponDiscount(null);
            setCouponError("");
            setPendingBuyProduct(null);
          }
        }
      } catch (e) {
        console.warn("Lỗi kiểm tra phiên xác thực:", e);
      }
    }, 1800);

    return () => clearInterval(interval);
  }, [authModalOpen, authSession, pendingBuyProduct]);

  // Đăng xuất khỏi Web
  const handleLogout = () => {
    triggerHaptic("light");
    localStorage.removeItem("rinq_web_telegram_user");
    localStorage.removeItem("rinq_web_auth_token");
    setTgUser(null);
    setAuthToken(null);
    setTelegramUser("");
    setMyOrders([]);
  };

  // Định kỳ kiểm tra trạng thái hoạt động của Telegram Bot
  useEffect(() => {
    let isMounted = true;
    const checkBot = async () => {
      try {
        const res = await fetch("/api/store/bot-status");
        const data = await res.json();
        if (isMounted) {
          setIsBotActive(Boolean(data.online));
        }
      } catch {
        if (isMounted) setIsBotActive(false);
      }
    };

    checkBot();
    const interval = setInterval(checkBot, 3500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Fetch dữ liệu store
  const fetchStoreData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/store");
      const data = await res.json();
      if (data.success) {
        setProducts(data.products || []);
        setCategories(data.categories || []);
        if (data.bankInfo) setBankInfo(data.bankInfo);
      }
    } catch (e) {
      console.error("Lỗi fetch store data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStoreData();
  }, []);

  // Timer đếm ngược đơn hàng thanh toán
  useEffect(() => {
    if (!activePayment || deliveredKeys) return;
    const interval = setInterval(() => {
      setPaymentSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activePayment, deliveredKeys]);

  // Realtime Polling kiểm tra trạng thái thanh toán đơn hàng
  useEffect(() => {
    if (!activePayment || deliveredKeys || paymentSecondsLeft <= 0) return;

    const pollPayment = async () => {
      setIsCheckingPayment(true);
      try {
        const res = await fetch(`/api/store/order?orderId=${encodeURIComponent(activePayment.orderId)}`);
        const data = await res.json();
        if (data.success && data.status === "PAID") {
          setDeliveredKeys(data.keys || []);
          triggerHaptic("success");
          confetti({
            particleCount: 120,
            spread: 80,
            origin: { y: 0.6 },
          });
          // Làm mới đơn hàng cá nhân
          if (tgUser?.id) {
            fetchMyOrders();
          }
        }
      } catch (err) {
        console.error("Lỗi kiểm tra thanh toán:", err);
      } finally {
        setIsCheckingPayment(false);
      }
    };

    pollPayment();
    const pollInterval = setInterval(pollPayment, 2500);
    return () => clearInterval(pollInterval);
  }, [activePayment, deliveredKeys, paymentSecondsLeft, tgUser]);

  // FOMO live notifications
  useEffect(() => {
    if (products.length === 0) return;
    const interval = setInterval(() => {
      const randProd = products[Math.floor(Math.random() * products.length)];
      if (!randProd) return;
      const minsAgo = Math.floor(Math.random() * 8) + 1;
      setFomoNotice(`Khách hàng vừa mua 1x ${randProd.name} (${minsAgo} phút trước)`);
      setTimeout(() => setFomoNotice(null), 4500);
    }, 18000);
    return () => clearInterval(interval);
  }, [products]);

  // Filter sản phẩm
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === "ALL" || p.category === selectedCategory;
      const matchSearch =
        searchQuery.trim() === "" ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Helper copy text
  const copyToClipboard = (text: string, fieldName: string) => {
    triggerHaptic("light");
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Mở modal mua hàng (Bắt buộc đăng nhập Telegram)
  const handleOpenBuy = (product: Product) => {
    triggerHaptic("medium");
    if (!tgUser) {
      setPendingBuyProduct(product);
      startTelegramLogin();
      return;
    }
    setBuyingProduct(product);
    setQuantity(1);
    setCouponCode("");
    setCouponDiscount(null);
    setCouponError("");
  };

  // Áp dụng coupon
  const handleApplyCoupon = async () => {
    if (!couponCode.trim() || !buyingProduct) return;
    setCouponError("");
    try {
      const baseAmount = buyingProduct.price * quantity;
      const res = await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode.trim(), amount: baseAmount }),
      });
      const data = await res.json();
      if (data.valid) {
        triggerHaptic("success");
        setCouponDiscount({ discount: data.discountAmount, isPercent: false });
      } else {
        triggerHaptic("error");
        setCouponDiscount(null);
        setCouponError(data.error || "Mã giảm giá không hợp lệ");
      }
    } catch {
      setCouponError("Lỗi kiểm tra mã giảm giá");
    }
  };

  // Tính tổng tiền sau giảm
  const currentTotal = useMemo(() => {
    if (!buyingProduct) return 0;
    const base = buyingProduct.price * quantity;
    if (!couponDiscount) return base;
    return Math.max(0, base - couponDiscount.discount);
  }, [buyingProduct, quantity, couponDiscount]);

  // Tạo đơn hàng thanh toán
  const handleCreateOrder = async () => {
    if (!buyingProduct) return;
    if (!tgUser) {
      startTelegramLogin();
      return;
    }
    triggerHaptic("medium");
    setIsSubmittingOrder(true);
    try {
      const res = await fetch("/api/store/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: buyingProduct.id,
          quantity,
          telegramId: String(tgUser.id),
          telegramUser: tgUser.username ? `@${tgUser.username}` : tgUser.first_name || String(tgUser.id),
          firstName: tgUser.first_name || undefined,
          couponCode: couponDiscount ? couponCode : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        triggerHaptic("success");
        setActivePayment({
          orderId: data.order.id,
          productName: data.order.productName,
          quantity: data.order.quantity,
          totalAmount: data.order.totalAmount,
          qrUrl: data.payment.qrUrl,
          bankId: data.payment.bankId,
          bankAccountNo: data.payment.bankAccountNo,
          bankAccountName: data.payment.bankAccountName,
        });
        setPaymentSecondsLeft(600);
        setDeliveredKeys(null);
        setBuyingProduct(null);
        if (tgUser?.id) {
          fetchMyOrders();
        }
      } else {
        triggerHaptic("error");
        alert(data.error || "Không thể tạo đơn hàng");
      }
    } catch (e: any) {
      triggerHaptic("error");
      alert("Lỗi kết nối tạo đơn: " + e.message);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Mở lại mã QR thanh toán cho đơn hàng Pending từ My Orders
  const handleResumePendingPayment = (order: UserOrderRecord) => {
    if (!bankInfo) return;
    triggerHaptic("light");
    const qrUrl = `https://api.vietqr.io/image/${bankInfo.bankId}-${bankInfo.bankAccountNo}-compact2.jpg?amount=${order.totalAmount}&addInfo=${order.id}&accountName=${encodeURIComponent(bankInfo.bankAccountName)}`;
    setActivePayment({
      orderId: order.id,
      productName: order.productName,
      quantity: order.quantity,
      totalAmount: order.totalAmount,
      qrUrl,
      bankId: bankInfo.bankId,
      bankAccountNo: bankInfo.bankAccountNo,
      bankAccountName: bankInfo.bankAccountName,
    });
    setPaymentSecondsLeft(600);
    setDeliveredKeys(null);
    setMyOrdersOpen(false);
  };

  // Tra cứu đơn hàng vãng lai
  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupOrderId.trim()) return;
    setIsLookingUp(true);
    setLookupError("");
    setLookupResult(null);
    try {
      const res = await fetch(`/api/store/order?orderId=${encodeURIComponent(lookupOrderId.trim().toUpperCase())}`);
      const data = await res.json();
      if (data.success) {
        triggerHaptic("success");
        setLookupResult(data);
      } else {
        triggerHaptic("error");
        setLookupError(data.error || "Không tìm thấy thông tin đơn hàng này.");
      }
    } catch {
      triggerHaptic("error");
      setLookupError("Lỗi kết nối tra cứu");
    } finally {
      setIsLookingUp(false);
    }
  };

  // Tải file text chứa key đã mua
  const handleDownloadKeys = (orderId: string, prodName: string, keys: string[]) => {
    triggerHaptic("light");
    const content =
      `RINQ SHOP - BÀN GIAO ĐƠN HÀNG #${orderId}\n` +
      `Sản phẩm: ${prodName}\n` +
      `Thời gian: ${new Date().toLocaleString("vi-VN")}\n\n` +
      `TÀI KHOẢN / KEY CỦA QUÝ KHÁCH:\n` +
      keys.join("\n\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `RINQ_${orderId}_keys.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-dashboard-grid text-slate-800 relative selection:bg-emerald-600 selection:text-white pb-20">
      {/* Màn hình khóa khi Telegram Bot chưa khởi động */}
      {isBotActive === false && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md text-white text-center">
          <div className="h-20 w-20 rounded-3xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mb-5 shadow-2xl animate-pulse">
            <Bot className="h-10 w-10" />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs font-bold border border-rose-500/30 mb-3">
            <AlertCircle className="h-4 w-4" /> BOT TELEGRAM ĐANG TẮT
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Hệ Thống Đang Chờ Khởi Động Telegram Bot
          </h2>
          <p className="mt-2 text-slate-300 text-sm max-w-md leading-relaxed">
            Website chỉ hoạt động khi Telegram Bot đang mở trên máy chủ.
            Vui lòng nhấp đúp vào file <code className="bg-slate-800 px-2 py-0.5 rounded text-amber-300 font-mono text-xs">run-bot.bat</code> để kích hoạt Bot.
          </p>
          <div className="mt-6 flex items-center gap-2.5 text-xs text-slate-400 bg-slate-900/90 px-4 py-2.5 rounded-2xl border border-slate-800 shadow-inner">
            <RefreshCw className="h-4 w-4 text-emerald-400 animate-spin" />
            <span>Đang dò tìm tín hiệu... Trang web sẽ tự động mở ngay khi Bot hoạt động.</span>
          </div>
        </div>
      )}

      {/* Ambient Aura Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="ambient-orb-1 absolute -top-32 left-1/4 w-[500px] h-[500px] rounded-full bg-emerald-500/15 blur-[120px] pointer-events-none" />
        <div className="ambient-orb-2 absolute top-1/3 -right-20 w-[450px] h-[450px] rounded-full bg-teal-400/10 blur-[130px] pointer-events-none" />
        <div className="ambient-orb-3 absolute -bottom-20 -left-20 w-[480px] h-[480px] rounded-full bg-emerald-600/10 blur-[140px] pointer-events-none" />
      </div>

      {/* Header Sticky */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/85 border-b border-slate-200/80 shadow-sm transition">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 overflow-hidden rounded-xl border border-emerald-500/30 shadow-md">
              <img src="/logo.jpg" alt="RINQ Logo" className="h-full w-full object-cover" />
            </div>
            <div>
              <span className="font-extrabold text-lg text-slate-900 tracking-tight flex items-center gap-1.5">
                RINQ SHOP
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  24/7 AUTO
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Telegram User Connected Profile */}
            {tgUser ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    triggerHaptic("light");
                    setMyOrdersOpen(true);
                    if (tgUser?.id) fetchMyOrders();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-50 text-[#0e704b] hover:bg-emerald-100 border border-emerald-200/90 transition shadow-sm"
                >
                  <PackageCheck className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Đơn của tôi</span>
                  {myOrders.length > 0 && (
                    <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-600 text-white font-black">
                      {myOrders.length}
                    </span>
                  )}
                </button>

                <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200/80">
                  {tgUser.photo_url ? (
                    <img
                      src={tgUser.photo_url}
                      alt={tgUser.first_name}
                      className="h-6 w-6 rounded-full object-cover border border-emerald-400"
                    />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">
                      {tgUser.first_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="text-left hidden md:block">
                    <p className="text-[11px] font-bold text-slate-800 leading-none">
                      {tgUser.first_name}
                    </p>
                    <p className="text-[9px] text-slate-400 font-mono">
                      {tgUser.username ? `@${tgUser.username}` : `ID: ${tgUser.id}`}
                    </p>
                  </div>
                </div>

                {!isTMA && (
                  <button
                    onClick={handleLogout}
                    title="Đăng xuất Telegram"
                    className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={startTelegramLogin}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-[#229ED9] hover:bg-[#1e8bc0] text-white shadow-sm transition"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Đăng nhập Telegram</span>
                  <span className="sm:hidden">Đăng nhập</span>
                </button>

                <button
                  onClick={() => {
                    triggerHaptic("light");
                    setLookupOpen(true);
                    setLookupResult(null);
                    setLookupError("");
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Tra cứu đơn</span>
                </button>
              </div>
            )}

            {!isTMA && (
              <a
                href="https://t.me/rinq_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-sky-500 hover:bg-sky-600 text-white transition shadow-sm"
              >
                <Bot className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Telegram Bot</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 relative z-10 space-y-8">
        {/* Telegram Connected Alert Banner if in TMA or Web Auth */}
        {tgUser ? (
          <div className="rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-sky-500/10 p-3.5 border border-emerald-500/20 backdrop-blur-sm flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <p className="text-xs text-slate-700">
                Đã kết nối Telegram: <b className="text-slate-900">{tgUser.first_name}</b>{" "}
                {tgUser.username && <span className="text-emerald-700 font-mono">(@{tgUser.username})</span>}.
                Key và hóa đơn sẽ tự động gửi thẳng vào chat Telegram của bạn!
              </p>
            </div>
            <button
              onClick={() => {
                triggerHaptic("light");
                setMyOrdersOpen(true);
                fetchMyOrders();
              }}
              className="shrink-0 text-xs font-bold text-emerald-800 hover:underline flex items-center gap-1 ml-2"
            >
              Xem đơn đã mua <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10 p-3.5 border border-amber-500/25 backdrop-blur-sm flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
              </span>
              <p className="text-xs text-slate-700">
                Bạn đang xem sản phẩm với tư cách Khách. <b className="text-slate-900">Yêu cầu đăng nhập Telegram để đặt mua hàng</b> và nhận key tự động 24/7.
              </p>
            </div>
            <button
              onClick={startTelegramLogin}
              className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 ml-2 shadow-sm transition"
            >
              <LogIn className="h-3.5 w-3.5 text-amber-300" /> Đăng nhập ngay
            </button>
          </div>
        )}

        {/* Bento Hero Section */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-[#0e704b] via-[#0a5c3d] to-slate-900 text-white shadow-xl relative overflow-hidden flex flex-col justify-between">
            <div className="absolute -right-12 -bottom-12 w-60 h-60 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold tracking-wide text-emerald-200 border border-white/20 mb-4">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                HỆ THỐNG TRẢ HÀNG TỰ ĐỘNG VIETQR SEPAY
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
                Tài Nguyên Số Tự Động <br />
                Nhận Key Tức Thì Sau 3s
              </h1>
              <p className="mt-2 text-emerald-100/90 text-sm max-w-lg leading-relaxed">
                Tài khoản ChatGPT Plus, API Keys, Tool & Phần mềm bản quyền. Quét mã QR thanh toán ngân hàng chuyển khoản tự động, hệ thống lập tức bàn giao.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 pt-4 border-t border-white/15 text-xs font-medium text-emerald-200">
              <span className="flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-amber-300" /> Phát hàng 3-5s
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-300" /> Bảo hành 1:1
              </span>
              <span className="flex items-center gap-1.5">
                <QrCode className="h-4 w-4 text-sky-300" /> Quét VietQR Mọi Ngân Hàng
              </span>
            </div>
          </div>

          {/* Bento Sub Card */}
          <div className="rounded-3xl p-6 bento-card flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Trạng Thái Hệ Thống</span>
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-800 mt-2">Máy Chủ Hoạt Động Bình Thường</h3>
              <p className="text-xs text-slate-500 mt-1">
                Cổng VietQR và Bot Telegram kết nối liên tục 24/7 không gián đoạn.
              </p>
            </div>

            <div className="space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
              <div className="flex justify-between items-center">
                <span>Ngân hàng thụ hưởng:</span>
                <span className="font-bold text-slate-800">{bankInfo?.bankId || "TPBank"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Chủ tài khoản:</span>
                <span className="font-bold text-slate-800">{bankInfo?.bankAccountName || "RINQ SHOP"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Hỗ trợ kỹ thuật:</span>
                <a href="https://t.me/zophim" target="_blank" rel="noreferrer" className="text-emerald-700 font-bold hover:underline">
                  @zophim
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Filter and Search Bar */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            {/* Danh mục */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                onClick={() => {
                  triggerHaptic("light");
                  setSelectedCategory("ALL");
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  selectedCategory === "ALL"
                    ? "bg-[#0e704b] text-white shadow-md shadow-emerald-900/10"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                Tất cả ({products.length})
              </button>
              {categories.map((cat) => {
                const count = products.filter((p) => p.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => {
                      triggerHaptic("light");
                      setSelectedCategory(cat);
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                      selectedCategory === cat
                        ? "bg-[#0e704b] text-white shadow-md shadow-emerald-900/10"
                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>

            {/* Ô tìm kiếm */}
            <div className="relative min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm kiếm sản phẩm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm"
              />
            </div>
          </div>

          {/* Danh Sách Sản Phẩm */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-64 rounded-3xl bg-slate-100 animate-pulse border border-slate-200/60" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-300">
              <ShoppingBag className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-3 font-bold text-slate-700">Không tìm thấy sản phẩm nào</h3>
              <p className="text-xs text-slate-400 mt-1">Thử thay đổi từ khóa tìm kiếm hoặc danh mục.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredProducts.map((p) => {
                const isOutOfStock = !p.isAutoApi && p.stockAvailable <= 0;
                return (
                  <div
                    key={p.id}
                    className="bento-card rounded-3xl p-5 flex flex-col justify-between group transition-all duration-300 hover:-translate-y-1"
                  >
                    <div>
                      {/* Ảnh sản phẩm nếu có */}
                      {p.imageUrl ? (
                        <div className="h-40 w-full mb-4 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/60 relative">
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase bg-slate-900/80 backdrop-blur-md text-white">
                            {p.category}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between mb-3">
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                            {p.category}
                          </span>
                          <span
                            className={`text-[11px] font-bold ${
                              p.isAutoApi
                                ? "text-sky-600"
                                : p.stockAvailable > 0
                                ? "text-emerald-600"
                                : "text-rose-500"
                            }`}
                          >
                            {p.isAutoApi
                              ? "⚡ Tự động API"
                              : p.stockAvailable > 0
                              ? `Còn ${p.stockAvailable} tài khoản`
                              : "Hết hàng"}
                          </span>
                        </div>
                      )}

                      <h3 className="font-extrabold text-base text-slate-900 group-hover:text-[#0e704b] transition line-clamp-1">
                        {p.name}
                      </h3>

                      <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed min-h-[32px]">
                        {p.description || "Tài khoản bảo hành uy tín, phân phối tự động tức thì."}
                      </p>
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Giá bán</span>
                        <div className="text-lg font-black text-slate-900">
                          {p.price.toLocaleString("vi-VN")} <span className="text-xs font-bold text-emerald-700">đ</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleOpenBuy(p)}
                        disabled={isOutOfStock}
                        className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-sm ${
                          isOutOfStock
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                            : "bg-[#0e704b] hover:bg-[#0a5c3d] text-white shadow-emerald-900/10"
                        }`}
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        {isOutOfStock ? "Tạm hết" : "Mua ngay"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Modal Đăng Nhập Telegram */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-pop-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 relative text-center">
            <button
              onClick={() => {
                triggerHaptic("light");
                setAuthModalOpen(false);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mx-auto h-14 w-14 rounded-2xl bg-sky-50 text-[#229ED9] flex items-center justify-center mb-3 shadow-inner">
              <Bot className="h-7 w-7" />
            </div>

            <h3 className="font-extrabold text-slate-900 text-lg">Đăng Nhập Telegram</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
              Vui lòng kết nối Telegram để hệ thống tự động giao key và kích hoạt bảo hành đơn hàng cho bạn.
            </p>

            {authSession ? (
              <div className="mt-5 space-y-4">
                {/* Nút 1 chạm mở Telegram Bot */}
                <a
                  href={authSession.botUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => triggerHaptic("medium")}
                  className="w-full py-3.5 px-4 rounded-2xl bg-[#229ED9] hover:bg-[#1e8bc0] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 active:scale-95 transition"
                >
                  <Bot className="h-4 w-4" />
                  Mở Telegram để Xác Nhận
                  <ExternalLink className="h-3.5 w-3.5 opacity-80" />
                </a>

                {/* Hoặc quét mã QR trên PC */}
                <div className="pt-3 pb-1 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2.5">
                    Hoặc quét mã QR bằng camera điện thoại
                  </span>
                  <div className="mx-auto w-44 h-44 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-center">
                    <img
                      src={authSession.qrUrl}
                      alt="QR Đăng nhập Telegram"
                      className="w-full h-full object-contain rounded-xl"
                    />
                  </div>
                </div>

                {/* Trạng thái chờ */}
                <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-500 pt-1">
                  <RefreshCw className="h-3.5 w-3.5 text-[#229ED9] animate-spin" />
                  <span>Đang chờ bạn bấm <b>Bắt đầu (Start)</b> trên Bot...</span>
                </div>
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs">
                <RefreshCw className="h-6 w-6 animate-spin text-[#229ED9] mb-2" />
                Đang tạo phiên đăng nhập an toàn...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Mua Hàng */}
      {buyingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-pop-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative">
            <button
              onClick={() => {
                triggerHaptic("light");
                setBuyingProduct(null);
              }}
              className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-xl bg-emerald-50 text-[#0e704b]">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Xác Nhận Đơn Hàng</h3>
                <p className="text-xs text-slate-500">Hoàn tất để quét mã VietQR tự động</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Sản phẩm:</span>
                <span className="font-bold text-slate-800 text-right">{buyingProduct.name}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Đơn giá:</span>
                <span className="font-bold text-slate-800">{buyingProduct.price.toLocaleString("vi-VN")} đ</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Tồn kho hiện có:</span>
                <span className="font-bold text-emerald-700">
                  {buyingProduct.isAutoApi ? "Sẵn sàng (API)" : `${buyingProduct.stockAvailable} sản phẩm`}
                </span>
              </div>
            </div>

            {/* Telegram User Linked Callout */}
            {tgUser && (
              <div className="mt-3 p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <p className="text-[11px] text-emerald-800">
                  Tài khoản nhận hàng: <b>{tgUser.first_name}</b> {tgUser.username && `(@${tgUser.username})`}. Key sẽ gửi vào Bot chat của bạn.
                </p>
              </div>
            )}

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Số lượng mua:</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      triggerHaptic("light");
                      setQuantity(Math.max(1, quantity - 1));
                    }}
                    className="h-9 w-9 rounded-xl border border-slate-200 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100"
                  >
                    -
                  </button>
                  <span className="font-black text-sm text-slate-900 w-8 text-center">{quantity}</span>
                  <button
                    onClick={() => {
                      if (buyingProduct.isAutoApi || quantity < buyingProduct.stockAvailable) {
                        triggerHaptic("light");
                        setQuantity(quantity + 1);
                      }
                    }}
                    className="h-9 w-9 rounded-xl border border-slate-200 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100"
                  >
                    +
                  </button>
                </div>
              </div>

              {!tgUser && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Telegram Username hoặc Email nhận thông báo:
                  </label>
                  <input
                    type="text"
                    placeholder="@username hoặc Số điện thoại"
                    value={telegramUser}
                    onChange={(e) => setTelegramUser(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mã giảm giá (Nếu có):</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nhập mã coupon"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    onClick={handleApplyCoupon}
                    className="px-3 py-2 text-xs font-bold rounded-xl bg-slate-800 text-white hover:bg-slate-900 transition"
                  >
                    Áp dụng
                  </button>
                </div>
                {couponDiscount && (
                  <p className="text-[11px] text-emerald-700 font-bold mt-1">
                    Đã giảm {couponDiscount.discount.toLocaleString("vi-VN")} đ!
                  </p>
                )}
                {couponError && (
                  <p className="text-[11px] text-rose-600 font-medium mt-1">{couponError}</p>
                )}
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Tổng thanh toán</span>
                <div className="text-xl font-black text-[#0e704b]">
                  {currentTotal.toLocaleString("vi-VN")} đ
                </div>
              </div>

              <button
                onClick={handleCreateOrder}
                disabled={isSubmittingOrder}
                className="px-6 py-3 rounded-xl bg-[#0e704b] hover:bg-[#0a5c3d] text-white font-bold text-xs flex items-center gap-2 transition active:scale-95 disabled:opacity-50"
              >
                {isSubmittingOrder ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Đang tạo đơn...
                  </>
                ) : (
                  <>
                    <QrCode className="h-4 w-4" />
                    Tạo mã VietQR
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Thanh toán VietQR & Realtime Bàn Giao */}
      {activePayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-pop-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => {
                triggerHaptic("light");
                setActivePayment(null);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            {!deliveredKeys ? (
              // Trạng thái chờ thanh toán
              <div className="space-y-4">
                <div className="text-center">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200 mb-2">
                    <Clock className="h-3.5 w-3.5 animate-spin" />
                    CHỜ THANH TOÁN: {Math.floor(paymentSecondsLeft / 60)}:
                    {(paymentSecondsLeft % 60).toString().padStart(2, "0")}
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-xl">Quét Mã VietQR SePay</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Mở ứng dụng Ngân hàng và quét mã để hệ thống tự động trả hàng
                  </p>
                </div>

                {/* Khung ảnh QR */}
                <div className="mx-auto max-w-[260px] p-3 rounded-2xl bg-white border-2 border-emerald-500/40 shadow-lg flex items-center justify-center">
                  <img
                    src={activePayment.qrUrl}
                    alt="VietQR Payment"
                    className="w-full h-auto rounded-xl"
                  />
                </div>

                {/* Thông tin chuyển khoản sao chép */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Ngân hàng:</span>
                    <span className="font-bold text-slate-800">{activePayment.bankId}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Số tài khoản:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-slate-900">{activePayment.bankAccountNo}</span>
                      <button
                        onClick={() => copyToClipboard(activePayment.bankAccountNo, "accNo")}
                        className="p-1 rounded text-slate-400 hover:text-emerald-700"
                        title="Sao chép"
                      >
                        {copiedField === "accNo" ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Số tiền chính xác:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-emerald-700 text-sm">
                        {activePayment.totalAmount.toLocaleString("vi-VN")} đ
                      </span>
                      <button
                        onClick={() => copyToClipboard(String(activePayment.totalAmount), "amount")}
                        className="p-1 rounded text-slate-400 hover:text-emerald-700"
                        title="Sao chép"
                      >
                        {copiedField === "amount" ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-emerald-50/80 p-2 rounded-xl border border-emerald-200/60">
                    <span className="text-emerald-900 font-semibold">Nội dung CK (Bắt buộc):</span>
                    <div className="flex items-center gap-1.5">
                      <code className="font-mono font-black text-rose-600 text-sm">
                        {activePayment.orderId}
                      </code>
                      <button
                        onClick={() => copyToClipboard(activePayment.orderId, "memo")}
                        className="p-1 rounded bg-white text-slate-500 hover:text-emerald-700 shadow-sm"
                        title="Sao chép mã đơn"
                      >
                        {copiedField === "memo" ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Trạng thái kiểm tra realtime */}
                <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                  Đang kiểm tra giao dịch tự động...
                </div>

                <div className="text-center">
                  <p className="text-[11px] text-slate-400">
                    Lưu ý: Chuyển khoản đúng số tiền và nội dung. Hệ thống sẽ phát hàng ngay khi tiền vào tài khoản.
                  </p>
                </div>
              </div>
            ) : (
              // Trạng thái đã thanh toán thành công
              <div className="space-y-5 text-center">
                <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
                  <CheckCircle2 className="h-10 w-10" />
                </div>

                <div>
                  <h3 className="font-extrabold text-2xl text-slate-900">Thanh Toán Thành Công!</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Cảm ơn Quý khách! Đơn hàng #{activePayment.orderId} đã được duyệt tự động.
                  </p>
                </div>

                {/* Khung hiển thị Keys / Accounts */}
                <div className="text-left space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Tài nguyên đã bàn giao:</span>
                    <button
                      onClick={() => handleDownloadKeys(activePayment.orderId, activePayment.productName, deliveredKeys)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline"
                    >
                      <Download className="h-3.5 w-3.5" /> Tải file .txt
                    </button>
                  </div>

                  <div className="bg-slate-900 text-emerald-400 font-mono text-xs p-4 rounded-2xl max-h-48 overflow-y-auto space-y-2 select-all border border-slate-800">
                    {deliveredKeys.map((k, idx) => (
                      <div key={idx} className="pb-1 border-b border-slate-800 last:border-none">
                        <span className="text-slate-500 select-none">#{idx + 1}: </span>
                        {k}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => copyToClipboard(deliveredKeys.join("\n"), "allKeys")}
                    className="w-full py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition"
                  >
                    {copiedField === "allKeys" ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-600" /> Đã sao chép tất cả!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" /> Sao chép tất cả
                      </>
                    )}
                  </button>
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/60 text-[11px] text-amber-800 text-left">
                  Quý khách vui lòng lưu lại mã đơn hàng <b>{activePayment.orderId}</b> để tra cứu bảo hành hoặc hỗ trợ khi cần.
                </div>

                <button
                  onClick={() => {
                    triggerHaptic("light");
                    setActivePayment(null);
                  }}
                  className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition"
                >
                  Hoàn tất & Tiếp tục mua sắm
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Lịch Sử Đơn Hàng Của Khách (TMA My Orders) */}
      {myOrdersOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-pop-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative max-h-[90vh] flex flex-col">
            <button
              onClick={() => {
                triggerHaptic("light");
                setMyOrdersOpen(false);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 mb-4 shrink-0">
              <div className="p-2 rounded-xl bg-emerald-50 text-[#0e704b]">
                <PackageCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Đơn Hàng Của Tôi</h3>
                <p className="text-xs text-slate-500">
                  Tài khoản: {tgUser?.first_name} {tgUser?.username ? `(@${tgUser.username})` : ""}
                </p>
              </div>
            </div>

            <div className="overflow-y-auto space-y-3.5 pr-1 flex-1">
              {isLoadingMyOrders ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />
                  <span className="text-xs">Đang tải lịch sử đơn hàng...</span>
                </div>
              ) : myOrders.length === 0 ? (
                <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <ShoppingBag className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="text-xs font-bold text-slate-600 mt-2">Chưa có đơn hàng nào</p>
                  <p className="text-[11px] text-slate-400 mt-1">Các đơn hàng bạn mua sẽ xuất hiện tại đây.</p>
                </div>
              ) : (
                myOrders.map((order) => {
                  const isPaid = order.status === "PAID";
                  return (
                    <div
                      key={order.id}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 transition hover:border-slate-300"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-xs text-slate-800">#{order.id}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isPaid
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  : "bg-amber-100 text-amber-800 border border-amber-200"
                              }`}
                            >
                              {isPaid ? "ĐÃ THANH TOÁN" : "CHỜ THANH TOÁN"}
                            </span>
                          </div>
                          <h4 className="font-extrabold text-sm text-slate-900 mt-1">{order.productName}</h4>
                          <p className="text-[11px] text-slate-400">
                            {new Date(order.createdAt).toLocaleString("vi-VN")} • SL: {order.quantity}
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="font-black text-sm text-emerald-800">
                            {order.totalAmount.toLocaleString("vi-VN")} đ
                          </span>
                        </div>
                      </div>

                      {/* Hiển thị key nếu đã thanh toán */}
                      {isPaid && order.keys && order.keys.length > 0 && (
                        <div className="pt-2 border-t border-slate-200/70 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-700">Tài nguyên bàn giao:</span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => copyToClipboard(order.keys.join("\n"), `keys_${order.id}`)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline"
                              >
                                {copiedField === `keys_${order.id}` ? (
                                  <>
                                    <Check className="h-3 w-3 text-emerald-600" /> Đã chép
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3 w-3" /> Sao chép
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleDownloadKeys(order.id, order.productName, order.keys)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:underline"
                              >
                                <Download className="h-3 w-3" /> Tải về
                              </button>
                            </div>
                          </div>

                          <div className="bg-slate-900 text-emerald-400 font-mono text-xs p-3 rounded-xl max-h-32 overflow-y-auto space-y-1 select-all border border-slate-800">
                            {order.keys.map((k, i) => (
                              <div key={i} className="pb-0.5 border-b border-slate-800/80 last:border-none">
                                <span className="text-slate-500 select-none">#{i + 1}: </span>
                                {k}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Nút tiếp tục thanh toán nếu đang PENDING */}
                      {!isPaid && (
                        <div className="pt-2 border-t border-slate-200/70 flex justify-end">
                          <button
                            onClick={() => handleResumePendingPayment(order)}
                            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
                          >
                            <QrCode className="h-3.5 w-3.5" /> Thanh toán ngay
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 shrink-0 text-center">
              <button
                onClick={() => {
                  triggerHaptic("light");
                  if (tgUser?.id) fetchMyOrders();
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                <RefreshCw className="h-3 w-3" /> Làm mới danh sách
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tra Cứu Đơn Hàng Vãng Lai */}
      {lookupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-pop-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative">
            <button
              onClick={() => {
                triggerHaptic("light");
                setLookupOpen(false);
              }}
              className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                <Search className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Tra Cứu Đơn Hàng</h3>
                <p className="text-xs text-slate-500">Xem lại key/tài khoản đã mua trước đó</p>
              </div>
            </div>

            <form onSubmit={handleLookup} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mã đơn hàng (DH + 32 ký tự):</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nhập mã đơn hàng"
                    value={lookupOrderId}
                    onChange={(e) => setLookupOrderId(e.target.value.toUpperCase())}
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 uppercase font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={isLookingUp}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-[#0e704b] text-white hover:bg-[#0a5c3d] transition disabled:opacity-50"
                  >
                    {isLookingUp ? "Đang tìm..." : "Tra cứu"}
                  </button>
                </div>
              </div>
            </form>

            {lookupError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-medium border border-rose-200">
                {lookupError}
              </div>
            )}

            {lookupResult && (
              <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Mã đơn:</span>
                  <span className="font-mono font-bold text-slate-900">{lookupResult.orderId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Sản phẩm:</span>
                  <span className="font-bold text-slate-900">{lookupResult.productName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Trạng thái:</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                      lookupResult.status === "PAID"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {lookupResult.status === "PAID" ? "ĐÃ THANH TOÁN" : lookupResult.status}
                  </span>
                </div>

                {lookupResult.keys && lookupResult.keys.length > 0 && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="font-bold text-slate-700 block mb-1">Tài nguyên bàn giao:</span>
                    <div className="bg-slate-900 text-emerald-400 font-mono text-[11px] p-3 rounded-xl max-h-36 overflow-y-auto space-y-1">
                      {lookupResult.keys.map((k: string, i: number) => (
                        <div key={i}>{k}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* FOMO Live Toast */}
      {fomoNotice && (
        <div className="fixed bottom-5 left-5 z-40 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-3 shadow-xl flex items-center gap-2.5 text-xs text-slate-800 animate-pop-in">
          <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <ShoppingBag className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold">{fomoNotice}</p>
          </div>
        </div>
      )}
    </div>
  );
}
