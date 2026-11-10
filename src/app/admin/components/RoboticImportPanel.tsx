"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  Check,
  Folder,
  FolderPlus,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { categorizeProductName, STANDARD_CATEGORIES } from "@/lib/categories";

interface RoboticProduct {
  id: string;
  variantId: string;
  name: string;
  description: string;
  category: string;
  sourcePrice: number;
  stock: number;
  imported: boolean;
  localProductId: number | null;
  localActive: boolean;
  localPrice: number | null;
  marginPercent: number;
}

interface RoboticData {
  username: string;
  balanceVnd: number;
  balanceUsd: number;
  products: RoboticProduct[];
}

const button =
  "inline-flex min-h-10 items-center justify-center gap-2 border-2 border-black px-3 font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export default function RoboticImportPanel({
  onImported,
  categoriesList = [],
}: {
  onImported: () => void;
  categoriesList?: { name: string; count: number }[];
}) {
  const [data, setData] = useState<RoboticData | null>(null);
  const [query, setQuery] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [selectedFolder, setSelectedFolder] = useState("ALL");
  const [selected, setSelected] = useState<string[]>([]);
  const [margins, setMargins] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [bulkFolderInput, setBulkFolderInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncingPrices, setSyncingPrices] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [purchase, setPurchase] = useState<{
    source: RoboticProduct;
    targetId: number;
    quantity: number;
    cap: number;
    key: string;
  } | null>(null);
  const [buying, setBuying] = useState(false);

  const defaultCategoryFor = (item: RoboticProduct) => {
    return categorizeProductName(item.name, item.category);
  };

  const categoryFor = (item: RoboticProduct) => {
    const key = `${item.id}:${item.variantId}`;
    return categories[key] ?? defaultCategoryFor(item);
  };

  const allKnownFolders = useMemo(() => {
    const set = new Set<string>();
    categoriesList.forEach((c) => {
      if (c.name && c.name.trim() && c.name !== "Chưa phân loại") set.add(c.name.trim());
    });
    STANDARD_CATEGORIES.forEach((s) => set.add(s.name));
    if (data?.products) {
      data.products.forEach((p) => {
        const autoCat = categorizeProductName(p.name, p.category);
        if (autoCat) set.add(autoCat);
        if (p.category?.trim()) set.add(p.category.trim());
      });
    }
    Object.values(categories).forEach((cat) => {
      if (cat?.trim()) set.add(cat.trim());
    });
    return Array.from(set).filter(Boolean);
  }, [categoriesList, data, categories]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLocaleLowerCase("vi");
    const ceiling = Number(maxPrice) || 0;
    return data.products.filter((item) => {
      const currentCat = categoryFor(item);
      const matchesFolder =
        selectedFolder === "ALL" ||
        currentCat === selectedFolder ||
        item.category === selectedFolder;
      const matchesSearch =
        !needle ||
        `${item.name} ${item.category} ${item.description} ${currentCat}`
          .toLocaleLowerCase("vi")
          .includes(needle);
      const matchesPrice = !ceiling || item.sourcePrice <= ceiling;
      return matchesFolder && matchesSearch && matchesPrice;
    });
  }, [data, maxPrice, query, selectedFolder, categories]);

  const marginFor = (item: RoboticProduct) => {
    const raw = margins[`${item.id}:${item.variantId}`];
    return Math.max(0, Math.min(2000, Number(raw ?? item.marginPercent ?? 15)));
  };

  async function load() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/robotic?offset=0&limit=35", { cache: "no-store" });
      const rawText = await response.text();
      let result: any;
      try {
        result = JSON.parse(rawText);
      } catch {
        throw new Error(`Máy chủ phản hồi lỗi (${response.status}). Vui lòng bấm Thử lại.`);
      }
      if (!response.ok) throw new Error(result.error || "Không tải được danh mục RoboticVN.");
      setData(result.account ? { ...result.account, products: result.products || [] } : null);
      setSelected([]);

      if (result.hasMore) {
        try {
          await new Promise((res) => setTimeout(res, 600));
          const nextRes = await fetch("/api/admin/robotic?offset=35&limit=40", { cache: "no-store" });
          const nextRaw = await nextRes.text();
          const nextResult = JSON.parse(nextRaw);
          if (nextRes.ok && Array.isArray(nextResult.products)) {
            setData((prev) => {
              if (!prev) return null;
              const existingKeys = new Set(prev.products.map((p) => `${p.id}:${p.variantId}`));
              const additional = nextResult.products.filter(
                (p: any) => !existingKeys.has(`${p.id}:${p.variantId}`)
              );
              return {
                ...prev,
                products: [...prev.products, ...additional],
              };
            });
          }
        } catch (err) {
          console.warn("Lỗi tải phần còn lại của danh mục RoboticVN:", err);
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được danh mục RoboticVN.");
    } finally {
      setLoading(false);
    }
  }

  async function syncPrices() {
    setSyncingPrices(true);
    setError("");
    try {
      const response = await fetch("/api/admin/robotic/sync-prices", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không đồng bộ được giá.");
      setNotice(
        `Đã quét ${result.totalChecked} sản phẩm · Tự động chốt lại giá cho ${result.updatedCount} mặt hàng.`
      );
      await load();
      onImported();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Lỗi đồng bộ giá.");
    } finally {
      setSyncingPrices(false);
    }
  }

  async function importSelected() {
    if (!selected.length) return;
    setImporting(true);
    setError("");
    try {
      const categoryById: Record<string, string> = {};
      selected.forEach((key) => {
        const item = data?.products.find((p) => `${p.id}:${p.variantId}` === key);
        categoryById[key] = categories[key] ?? (item ? defaultCategoryFor(item) : "");
      });

      const response = await fetch("/api/admin/robotic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productIds: selected,
          marginById: margins,
          categoryById,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không tạo được bản nháp RoboticVN.");
      setNotice(result.message);
      await load();
      onImported();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tạo được bản nháp.");
    } finally {
      setImporting(false);
    }
  }

  async function confirmPurchase() {
    if (!purchase) return;
    setBuying(true);
    setError("");
    try {
      const response = await fetch("/api/admin/robotic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "purchase",
          productId: `${purchase.source.id}:${purchase.source.variantId}`,
          targetProductId: purchase.targetId,
          quantity: purchase.quantity,
          maxTotalVnd: purchase.cap,
          idempotencyKey: purchase.key,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không nhập được hàng RoboticVN.");
      setPurchase(null);
      setNotice(result.message || "Đã nhập kho RoboticVN.");
      await load();
      onImported();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không nhập được hàng.");
    } finally {
      setBuying(false);
    }
  }

  const selectable = filtered.filter((item) => !item.imported && item.stock > 0);

  return (
    <section className="lg:col-span-12 border-2 border-black bg-white" aria-labelledby="robotic-import-title">
      <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div>
          <div className="mb-3 h-2 w-16 bg-[#2457C5]" />
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">
            Nguồn nhập hàng · 03
          </p>
          <h2 id="robotic-import-title" className="mt-1 text-2xl font-black uppercase tracking-tight text-black">
            ROBOTICVN API
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-700">
            Danh mục 2 tầng sản phẩm/biến thể. Cho phép lọc theo folder, chọn folder sẵn có hoặc tạo tên mới cho từng sản phẩm trước khi nhập bản nháp.
          </p>
        </div>
        <div className="grid grid-cols-2 border-2 border-black md:min-w-64">
          <div className="border-r-2 border-black p-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Tài khoản</div>
            <div className="mt-1 text-sm font-black uppercase">{data?.username || "Chưa nối"}</div>
          </div>
          <div className="p-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Ví API</div>
            <div className="mt-1 text-xl font-black tabular-nums">
              {data ? `${data.balanceVnd.toLocaleString("vi-VN")} ₫` : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-col gap-3 border-y-2 border-black bg-[#F4F4F4] p-4 lg:flex-row lg:items-end">
        <label className="relative min-w-48 flex-1">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest">Tìm trong danh mục</span>
          <Search className="absolute bottom-3 left-3 h-4 w-4 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tên, nhóm, mô tả, folder..."
            className="min-h-11 w-full border-2 border-black bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#2457C5]"
          />
        </label>

        {/* Folder filter */}
        <label className="w-full lg:w-56">
          <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest">
            <Folder className="h-3 w-3 text-[#2457C5]" />
            Lọc Folder / Danh mục
          </span>
          <select
            value={selectedFolder}
            onChange={(e) => setSelectedFolder(e.target.value)}
            className="min-h-11 w-full border-2 border-black bg-white px-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-[#2457C5]"
          >
            <option value="ALL">Tất cả Folder ({data?.products.length || 0})</option>
            {allKnownFolders.map((cat) => (
              <option key={cat} value={cat}>
                📁 {cat}
              </option>
            ))}
          </select>
        </label>

        <label className="w-full lg:w-40">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest">Giá API tối đa</span>
          <input
            type="number"
            min="0"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="Không giới hạn"
            className="min-h-11 w-full border-2 border-black bg-white px-3 text-sm tabular-nums outline-none focus:ring-2 focus:ring-[#2457C5]"
          />
        </label>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className={`${button} bg-black text-white hover:bg-[#2457C5]`}
        >
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{" "}
          {data ? "Làm mới" : "Kết nối"}
        </button>

        <button
          type="button"
          onClick={() => void syncPrices()}
          disabled={syncingPrices}
          title="Tự động đồng bộ và chốt giá mới từ nhà cung cấp RoboticVN"
          className={`${button} bg-[#2457C5] text-white hover:bg-black`}
        >
          {syncingPrices ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{" "}
          Đồng bộ & Chốt giá
        </button>

        <button
          type="button"
          disabled={!selectable.length}
          onClick={() =>
            setSelected(
              selected.length === selectable.length ? [] : selectable.map((item) => `${item.id}:${item.variantId}`)
            )
          }
          className={`${button} bg-white hover:bg-[#F2C94C]`}
        >
          {selected.length === selectable.length && selectable.length ? "Bỏ chọn" : "Chọn còn lại"}
        </button>

        <button
          type="button"
          disabled={!selected.length || importing}
          onClick={() => void importSelected()}
          className={`${button} bg-[#2457C5] text-white hover:bg-black`}
        >
          {importing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}{" "}
          Nhập {selected.length} bản nháp
        </button>
      </div>

      {/* Bulk Folder Assignment Bar */}
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black bg-[#EBF3FF] px-4 py-3 text-xs text-black">
          <div className="flex items-center gap-2">
            <span className="font-black uppercase text-[#2457C5]">Đã chọn {selected.length} mục</span>
            <span className="text-slate-400">|</span>
            <span className="font-semibold text-slate-700">Gán nhanh folder cho các mục đã chọn:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <input
                type="text"
                list="robotic-bulk-folder-datalist"
                value={bulkFolderInput}
                onChange={(e) => setBulkFolderInput(e.target.value)}
                placeholder="Chọn hoặc nhập tên folder..."
                className="min-h-9 w-60 border-2 border-black bg-white px-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#2457C5]"
              />
              <datalist id="robotic-bulk-folder-datalist">
                {allKnownFolders.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </div>
            <button
              type="button"
              disabled={!bulkFolderInput.trim()}
              onClick={() => {
                const target = bulkFolderInput.trim();
                if (!target) return;
                setCategories((prev) => {
                  const next = { ...prev };
                  selected.forEach((k) => {
                    next[k] = target;
                  });
                  return next;
                });
                setNotice(`Đã gán folder "${target}" cho ${selected.length} sản phẩm đã chọn.`);
              }}
              className="inline-flex min-h-9 items-center gap-1 border-2 border-black bg-[#2457C5] px-3 font-bold uppercase text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              Áp dụng folder
            </button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="border-b-2 border-black bg-[#E63946] px-4 py-3 font-bold text-white">{error}</p>}
      {notice && <p role="status" className="border-b-2 border-black bg-[#F2C94C] px-4 py-3 font-bold text-black">{notice}</p>}

      {data && (
        <div className="max-h-[34rem] overflow-auto">
          <datalist id="robotic-folder-list">
            {allKnownFolders.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>

          <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-black text-white">
              <tr className="text-[10px] font-bold uppercase tracking-widest">
                <th className="w-12 px-3 py-3">+</th>
                <th className="px-3 py-3 min-w-[220px]">Sản phẩm / Biến thể</th>
                <th className="px-3 py-3 min-w-[200px]">Folder / Danh mục</th>
                <th className="px-3 py-3">Giá gốc</th>
                <th className="px-3 py-3">Lãi từng mặt hàng</th>
                <th className="px-3 py-3">Giá bán</th>
                <th className="px-3 py-3">Tồn nguồn</th>
                <th className="px-3 py-3">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, index) => {
                const key = `${item.id}:${item.variantId}`;
                const margin = marginFor(item);
                const retail = Math.ceil((item.sourcePrice * (1 + margin / 100)) / 1000) * 1000;
                const currentCat = categoryFor(item);
                const isCustom = Boolean(categories[key]);

                return (
                  <tr key={key} className={`border-b border-black/20 ${index % 2 ? "bg-[#F4F4F4]" : "bg-white"}`}>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        disabled={item.imported || item.stock < 1}
                        checked={selected.includes(key)}
                        onChange={() =>
                          setSelected((current) =>
                            current.includes(key) ? current.filter((id) => id !== key) : [...current, key]
                          )
                        }
                        className="h-4 w-4 accent-[#2457C5]"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-bold text-black">{item.name}</div>
                      <div className="mt-1 text-xs text-slate-600">
                        {item.category} · <span className="font-mono">{item.variantId}</span>
                      </div>
                    </td>
                    {/* Folder / Danh mục column */}
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1">
                        <input
                          type="text"
                          list="robotic-folder-list"
                          value={currentCat}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCategories((current) => ({ ...current, [key]: val }));
                          }}
                          placeholder="Chọn hoặc nhập folder..."
                          className="w-full min-w-[180px] border border-black bg-white px-2 py-1 text-xs font-semibold text-slate-900 outline-none focus:border-[#2457C5] focus:ring-1 focus:ring-[#2457C5]"
                        />
                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                          <Folder className="h-2.5 w-2.5 text-[#2457C5]" />
                          <span className="truncate max-w-[160px]">
                            {isCustom ? "Tùy chỉnh folder" : "Tự động phân loại"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{item.sourcePrice.toLocaleString("vi-VN")} ₫</td>
                    <td className="px-3 py-3">
                      <input
                        type="number"
                        min="0"
                        max="2000"
                        value={margins[key] ?? String(item.marginPercent ?? 15)}
                        onChange={(e) => setMargins((current) => ({ ...current, [key]: e.target.value }))}
                        className="w-20 border border-black bg-white px-2 py-1 tabular-nums"
                      />
                      %
                    </td>
                    <td className="px-3 py-3 font-bold tabular-nums">{retail.toLocaleString("vi-VN")} ₫</td>
                    <td className="px-3 py-3 tabular-nums">{item.stock}</td>
                    <td className="px-3 py-3">
                      {item.imported ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 bg-[#F2C94C] px-2 py-1 text-[10px] font-bold uppercase">
                            <Check className="h-3 w-3" />
                            Bản nháp #{item.localProductId}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setPurchase({
                                source: item,
                                targetId: item.localProductId!,
                                quantity: 1,
                                cap: item.sourcePrice,
                                key: crypto.randomUUID(),
                              })
                            }
                            className="inline-flex min-h-8 items-center gap-1 border border-black bg-white px-2 text-[10px] font-black uppercase hover:bg-[#2457C5] hover:text-white"
                          >
                            <Wallet className="h-3 w-3" />
                            Nhập kho
                          </button>
                        </div>
                      ) : item.stock > 0 ? (
                        <span className="font-bold text-emerald-800">CÓ HÀNG</span>
                      ) : (
                        <span className="font-bold text-slate-500">HẾT HÀNG</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center font-bold uppercase text-slate-600">
                    {loading ? "Đang tải danh mục…" : "Không có sản phẩm khớp bộ lọc."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-start gap-2 border-t-2 border-black bg-[#F2C94C] p-4 text-xs leading-relaxed text-black">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <b>Kiểm soát chi:</b> chỉ mua sau xác nhận. Giới hạn 50 key và 2.000.000 ₫/lần. API key chỉ nằm trên máy chủ.
        </p>
      </div>

      {purchase && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
          <section role="dialog" aria-modal="true" className="w-full max-w-lg border-2 border-black bg-white p-5 text-black">
            <div className="mb-3 h-2 w-16 bg-[#2457C5]" />
            <h3 className="text-xl font-black uppercase">Xác nhận mua từ RoboticVN</h3>
            <p className="mt-2 text-sm">
              {purchase.source.name} → kho #{purchase.targetId}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-xs font-bold uppercase">
                Số lượng
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={purchase.quantity}
                  onChange={(e) =>
                    setPurchase({ ...purchase, quantity: Number(e.target.value), key: crypto.randomUUID() })
                  }
                  className="mt-1 min-h-11 w-full border-2 border-black px-3 text-sm"
                />
              </label>
              <label className="text-xs font-bold uppercase">
                Hạn mức chi
                <input
                  type="number"
                  min="1"
                  max="2000000"
                  value={purchase.cap}
                  onChange={(e) =>
                    setPurchase({ ...purchase, cap: Number(e.target.value), key: crypto.randomUUID() })
                  }
                  className="mt-1 min-h-11 w-full border-2 border-black px-3 text-sm"
                />
              </label>
            </div>
            <p className="mt-3 flex items-center gap-2 border border-black bg-[#F2C94C] p-3 text-sm">
              <Wallet className="h-4 w-4" />
              Ví hiện có: <b>{data?.balanceVnd.toLocaleString("vi-VN")} ₫</b>
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={buying} onClick={() => setPurchase(null)} className={`${button} bg-white`}>
                Hủy
              </button>
              <button
                type="button"
                disabled={buying || purchase.quantity < 1 || purchase.quantity > 50 || purchase.cap < 1 || purchase.cap > 2000000}
                onClick={() => void confirmPurchase()}
                className={`${button} bg-[#2457C5] text-white`}
              >
                {buying ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                Xác nhận mua
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}