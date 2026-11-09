"use client";

import { useMemo, useState } from "react";
import { ArrowDownToLine, Check, LoaderCircle, RefreshCw, Search, ShieldCheck, Wallet } from "lucide-react";

interface ScoopyProduct {
  id: string;
  name: string;
  description: string;
  category: string;
  sourcePrice: number;
  stock: number;
  imported: boolean;
  localProductId: number | null;
  localActive: boolean;
  localPrice: number | null;
}

interface ScoopyState {
  tier: string;
  balanceVnd: number;
  currency: string;
  products: ScoopyProduct[];
  purchases: Purchase[];
  purchasesReady?: boolean;
}

interface Purchase {
  id: string;
  supplierProductId: string;
  supplierProductName: string;
  quantity: number;
  maxTotalVnd: number;
  targetProductId: number | null;
  status: string;
  supplierOrderId: string | null;
  totalVnd: number | null;
  itemCount: number;
  createdAt: string;
}

const card = "border-2 border-black bg-white";
const button = "inline-flex min-h-10 items-center justify-center gap-2 border-2 border-black px-3 font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export default function ScoopyImportPanel({ onImported }: { onImported: () => void }) {
  const [data, setData] = useState<ScoopyState | null>(null);
  const [query, setQuery] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [margin, setMargin] = useState("15");
  const [margins, setMargins] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [purchaseDraft, setPurchaseDraft] = useState<{ source: ScoopyProduct; targetId: number; quantity: number; cap: number; key: string; locked?: boolean } | null>(null);
  const [buying, setBuying] = useState(false);

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLocaleLowerCase("vi");
    const ceiling = Number(maxPrice) || 0;
    return data.products.filter((item) =>
      (!needle || `${item.name} ${item.category} ${item.description}`.toLocaleLowerCase("vi").includes(needle)) &&
      (!ceiling || item.sourcePrice <= ceiling)
    );
  }, [data, maxPrice, query]);

  async function loadCatalog() {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/scoopy", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không tải được danh mục ScoopyVN.");
      setData(result.account ? { ...result.account, products: result.products, purchases: result.purchases || [], purchasesReady: result.purchasesReady } : null);
      setSelected([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được danh mục ScoopyVN.");
    } finally {
      setLoading(false);
    }
  }

  async function importSelected() {
    if (!selected.length) return;
    setImporting(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/scoopy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: selected, marginById: Object.fromEntries(data?.products.map((item) => [item.id, margins[item.id] ?? margin]) || []) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không nhập được sản phẩm.");
      await loadCatalog();
      setNotice(result.message);
      onImported();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không nhập được sản phẩm.");
    } finally {
      setImporting(false);
    }
  }

  async function confirmPurchase() {
    if (!purchaseDraft) return;
    setBuying(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/scoopy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "purchase", productId: purchaseDraft.source.id, targetProductId: purchaseDraft.targetId, quantity: purchaseDraft.quantity, maxTotalVnd: purchaseDraft.cap, idempotencyKey: purchaseDraft.key }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không nhập được hàng từ ScoopyVN.");
      setPurchaseDraft(null);
      setNotice(result.message || `Đã nhập ${result.imported} tài nguyên vào kho.`);
      await loadCatalog();
      onImported();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không nhập được hàng từ ScoopyVN.");
    } finally {
      setBuying(false);
    }
  }

  const selectable = filtered.filter((item) => !item.imported && item.stock > 0);

  return (
    <section className={`${card} lg:col-span-12`} aria-labelledby="scoopy-import-title">
      <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div>
          <div className="mb-3 h-2 w-16 bg-[#E63946]" />
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">Nguồn nhập hàng · 01</p>
              <h2 id="scoopy-import-title" className="mt-1 text-2xl font-black uppercase tracking-tight text-black">SCOOPYVN API</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-700">Xem danh mục, tạo bản nháp, rồi nhập key vào sản phẩm đã liên kết. Mỗi giao dịch có hạn mức chi và mã chống gửi lặp.</p>
            </div>
            <button type="button" onClick={() => void loadCatalog()} disabled={loading} className={`${button} bg-black text-white hover:bg-[#E63946]`}>
              {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {data ? "Làm mới danh mục" : "Kết nối & tải danh mục"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 border-2 border-black md:min-w-64">
          <div className="border-r-2 border-black p-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Tài khoản</div>
            <div className="mt-1 text-xl font-black uppercase">{data?.tier || "Chưa nối"}</div>
          </div>
          <div className="p-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Ví API</div>
            <div className="mt-1 text-xl font-black tabular-nums">{data ? `${data.balanceVnd.toLocaleString("vi-VN")} ₫` : "—"}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-y-2 border-black bg-[#F4F4F4] p-4 lg:flex-row lg:items-end">
        <label className="relative min-w-56 flex-1">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest">Tìm trong danh mục</span>
          <Search className="absolute bottom-3 left-3 h-4 w-4 text-black" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tên, nhóm, mô tả" className="min-h-11 w-full border-2 border-black bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#E63946]" />
        </label>
        <label className="w-full lg:w-48">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest">Giá API tối đa</span>
          <input type="number" min="0" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="Không giới hạn" className="min-h-11 w-full border-2 border-black bg-white px-3 text-sm tabular-nums outline-none focus:ring-2 focus:ring-[#E63946]" />
        </label>
        <label className="w-full lg:w-40">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest">Lãi dự kiến %</span>
          <input type="number" min="0" max="2000" value={margin} onChange={(event) => setMargin(event.target.value)} className="min-h-11 w-full border-2 border-black bg-white px-3 text-sm tabular-nums outline-none focus:ring-2 focus:ring-[#E63946]" />
        </label>
        <button type="button" disabled={!selectable.length} onClick={() => setSelected(selected.length === selectable.length ? [] : selectable.map((item) => item.id))} className={`${button} bg-white hover:bg-[#F2C94C]`}>
          {selected.length === selectable.length && selectable.length ? "Bỏ chọn" : "Chọn còn lại"}
        </button>
        <button type="button" disabled={!selected.length || importing} onClick={() => void importSelected()} className={`${button} bg-[#E63946] text-white hover:bg-black`}>
          {importing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}
          Nhập {selected.length} bản nháp
        </button>
      </div>

      {error && <p role="alert" className="border-b-2 border-black bg-[#E63946] px-4 py-3 font-bold text-white">{error}</p>}
      {notice && <p role="status" className="border-b-2 border-black bg-[#F2C94C] px-4 py-3 font-bold text-black">{notice}</p>}
      {data && data.purchasesReady === false && <p role="status" className="border-b-2 border-black bg-[#F2C94C] px-4 py-3 text-sm font-bold text-black">Cần chạy phần SupplierPurchase trong supabase-schema.sql trước khi nhập key qua API.</p>}

      {data && (
        <div className="max-h-[34rem] overflow-auto">
          <table className="w-full min-w-[740px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-black text-white">
              <tr className="text-[10px] font-bold uppercase tracking-widest">
                <th className="w-12 border-r border-white/30 px-3 py-3"><span className="sr-only">Chọn</span>+</th>
                <th className="px-3 py-3">Sản phẩm</th>
                <th className="px-3 py-3">Giá Scoopy</th>
                <th className="px-3 py-3">Biên riêng</th>
                <th className="px-3 py-3">Giá bán gợi ý</th>
                <th className="px-3 py-3">Tồn nguồn</th>
                <th className="px-3 py-3">Tình trạng</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, index) => {
                const canSelect = !item.imported && item.stock > 0;
                const itemMargin = Math.max(0, Math.min(2000, Number(margins[item.id] ?? margin) || 0));
                const suggestedPrice = Math.ceil((item.sourcePrice * (1 + itemMargin / 100)) / 1000) * 1000;
                return (
                  <tr key={item.id} className={`border-b border-black/20 ${index % 2 ? "bg-[#F4F4F4]" : "bg-white"}`}>
                    <td className="border-r border-black/20 px-3 py-3">
                      <input aria-label={`Chọn ${item.name}`} type="checkbox" disabled={!canSelect} checked={selected.includes(item.id)} onChange={() => setSelected((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} className="h-4 w-4 accent-[#E63946]" />
                    </td>
                    <td className="px-3 py-3"><div className="font-bold text-black">{item.name}</div><div className="mt-1 text-xs text-slate-600">{item.category || "Chưa phân nhóm"}</div></td>
                    <td className="px-3 py-3 tabular-nums">{item.sourcePrice.toLocaleString("vi-VN")} ₫</td>
                    <td className="px-3 py-3"><input aria-label={`Biên lợi nhuận ${item.name}`} type="number" min="0" max="2000" value={margins[item.id] ?? margin} onChange={(event) => setMargins((current) => ({ ...current, [item.id]: event.target.value }))} className="w-20 border border-black bg-white px-2 py-1 tabular-nums" />%</td>
                    <td className="px-3 py-3 font-bold tabular-nums">{suggestedPrice.toLocaleString("vi-VN")} ₫</td>
                    <td className="px-3 py-3 tabular-nums">{item.stock}</td>
                    <td className="px-3 py-3">
                      {item.imported ? <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1 bg-[#F2C94C] px-2 py-1 text-[10px] font-bold uppercase"><Check className="h-3 w-3" />Bản nháp #{item.localProductId}</span><button type="button" disabled={data?.purchasesReady === false} onClick={() => setPurchaseDraft({ source: item, targetId: item.localProductId!, quantity: 1, cap: item.sourcePrice, key: crypto.randomUUID() })} className="inline-flex min-h-8 items-center gap-1 border border-black bg-white px-2 text-[10px] font-black uppercase hover:bg-[#E63946] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"><Wallet className="h-3 w-3" />Nhập kho</button></div> : item.stock > 0 ? <span className="font-bold text-emerald-800">CÓ HÀNG</span> : <span className="font-bold text-slate-500">HẾT HÀNG</span>}
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && <tr><td colSpan={7} className="px-4 py-10 text-center font-bold uppercase text-slate-600">{loading ? "Đang tải danh mục…" : "Không có sản phẩm khớp bộ lọc."}</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {data?.purchases.length ? <div className="border-t-2 border-black p-4">
        <h3 className="text-xs font-black uppercase tracking-widest">Giao dịch nhập gần đây</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{data.purchases.slice(0, 6).map((purchase) => <div key={purchase.id} className="border border-black bg-[#F4F4F4] p-3 text-xs">
          <div className="flex items-center justify-between gap-2"><b className="truncate">{purchase.supplierProductName} × {purchase.quantity}</b><span className="font-bold uppercase">{purchase.status}</span></div>
          <p className="mt-1 text-slate-700">{purchase.itemCount} key · {purchase.totalVnd?.toLocaleString("vi-VN") || purchase.maxTotalVnd.toLocaleString("vi-VN")} ₫ · SP #{purchase.targetProductId ?? "—"}</p>
          {purchase.supplierOrderId && <p className="mt-1 font-mono text-slate-600">NCC: {purchase.supplierOrderId}</p>}
          {purchase.status === "FAILED" && purchase.targetProductId && data.products.find((item) => item.id === purchase.supplierProductId) && <button type="button" onClick={() => setPurchaseDraft({ source: data.products.find((item) => item.id === purchase.supplierProductId)!, targetId: purchase.targetProductId!, quantity: purchase.quantity, cap: purchase.maxTotalVnd, key: purchase.id, locked: true })} className="mt-2 min-h-8 border border-black bg-white px-2 font-bold uppercase hover:bg-[#F2C94C]">Tiếp tục cùng mã giao dịch</button>}
        </div>)}</div>
      </div> : null}

      <div className="flex items-start gap-2 border-t-2 border-black bg-[#F2C94C] p-4 text-xs leading-relaxed text-black">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p><b>Kiểm soát chi:</b> thao tác mua chỉ chạy sau nút xác nhận, giới hạn tối đa 50 key và 1.000.000 ₫/giao dịch. Hạn mức không đủ thì API từ chối. Key được mã hóa trước khi lưu. Không tự nạp ví hoặc bật sản phẩm.</p>
      </div>

      {purchaseDraft && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" role="presentation">
        <section role="dialog" aria-modal="true" aria-labelledby="scoopy-confirm-title" className="w-full max-w-lg border-2 border-black bg-white p-5 text-black">
          <div className="mb-3 h-2 w-16 bg-[#E63946]" />
          <h3 id="scoopy-confirm-title" className="text-xl font-black uppercase">Xác nhận mua từ ScoopyVN</h3>
          <p className="mt-2 text-sm">{purchaseDraft.source.name} → kho #{purchaseDraft.targetId}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="text-xs font-bold uppercase">Số lượng (tối đa 50)<input type="number" min="1" max="50" readOnly={purchaseDraft.locked} value={purchaseDraft.quantity} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, quantity: Number(event.target.value), key: crypto.randomUUID() })} className="mt-1 min-h-11 w-full border-2 border-black px-3 text-sm tabular-nums" /></label>
            <label className="text-xs font-bold uppercase">Hạn mức chi (₫)<input type="number" min="1" max="1000000" readOnly={purchaseDraft.locked} value={purchaseDraft.cap} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, cap: Number(event.target.value), key: crypto.randomUUID() })} className="mt-1 min-h-11 w-full border-2 border-black px-3 text-sm tabular-nums" /></label>
          </div>
          <p className="mt-3 flex items-center gap-2 border border-black bg-[#F2C94C] p-3 text-sm"><Wallet className="h-4 w-4 shrink-0" />Ví hiện có: <b>{data?.balanceVnd.toLocaleString("vi-VN")} ₫</b>. Chỉ xác nhận nếu chấp nhận trừ ví NCC.</p>
          <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={buying} onClick={() => setPurchaseDraft(null)} className={`${button} bg-white`}>Hủy</button><button type="button" disabled={buying || purchaseDraft.quantity < 1 || purchaseDraft.quantity > 50 || purchaseDraft.cap < 1 || purchaseDraft.cap > 1000000} onClick={() => void confirmPurchase()} className={`${button} bg-[#E63946] text-white`}>{buying ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}Xác nhận mua</button></div>
        </section>
      </div>}
    </section>
  );
}
