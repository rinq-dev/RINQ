"use client";

import { useEffect, useState } from "react";
import { Check, CreditCard, Globe, KeyRound, LoaderCircle, Save, ShieldCheck, Store, UserRound } from "lucide-react";

type Settings = {
  SHOP_NAME: string;
  BOT_USERNAME: string;
  SUPPORT_USERNAME: string;
  BANK_ID: string;
  BANK_ACCOUNT_NO: string;
  BANK_ACCOUNT_NAME: string;
  statuses?: { telegram: boolean; sepay: boolean; robotic: boolean; scoopy: boolean };
};

const input = "mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#0e704b] focus:ring-2 focus:ring-emerald-100";

export default function SettingsTab() {
  const [settings, setSettings] = useState<Settings>({ SHOP_NAME: "RINQ SHOP", BOT_USERNAME: "", SUPPORT_USERNAME: "", BANK_ID: "", BANK_ACCOUNT_NO: "", BANK_ACCOUNT_NAME: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/settings", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không tải được cấu hình.");
      setSettings(result.settings);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được cấu hình."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function save() {
    setSaving(true); setNotice(""); setError("");
    try {
      const response = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: { SHOP_NAME: settings.SHOP_NAME, BOT_USERNAME: settings.BOT_USERNAME, SUPPORT_USERNAME: settings.SUPPORT_USERNAME, BANK_ID: settings.BANK_ID, BANK_ACCOUNT_NO: settings.BANK_ACCOUNT_NO, BANK_ACCOUNT_NAME: settings.BANK_ACCOUNT_NAME } }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không lưu được cấu hình.");
      setSettings((current) => ({ ...current, ...result.settings }));
      setNotice("Đã lưu cấu hình. Bot sẽ dùng thông tin thanh toán mới ở đơn tiếp theo.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không lưu được cấu hình."); }
    finally { setSaving(false); }
  }

  const update = (key: keyof Settings, value: string) => setSettings((current) => ({ ...current, [key]: value }));
  return <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-6 flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Control center</p><h2 className="mt-1 text-2xl font-black text-slate-900">Cấu hình hệ thống</h2><p className="mt-1 text-sm text-slate-600">Thông tin hiển thị và thanh toán dùng chung cho web quản trị và bot.</p></div><Store className="h-7 w-7 text-[#0e704b]" /></div>
      {loading ? <div className="flex items-center gap-2 py-12 text-sm font-semibold text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Đang tải cấu hình…</div> : <>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-bold uppercase tracking-wide text-slate-600 sm:col-span-2">Tên cửa hàng<input value={settings.SHOP_NAME} onChange={(e) => update("SHOP_NAME", e.target.value)} className={input} maxLength={80} /></label>
          <label className="text-xs font-bold uppercase tracking-wide text-slate-600">Username bot<input value={settings.BOT_USERNAME} onChange={(e) => update("BOT_USERNAME", e.target.value)} className={input} placeholder="RINQ_bot" maxLength={64} /></label>
          <label className="text-xs font-bold uppercase tracking-wide text-slate-600">Username hỗ trợ<input value={settings.SUPPORT_USERNAME} onChange={(e) => update("SUPPORT_USERNAME", e.target.value)} className={input} placeholder="rinq_hotro" maxLength={64} /></label>
        </div>
        <div className="my-7 border-t border-slate-100" />
        <div className="mb-4 flex items-center gap-2"><CreditCard className="h-4 w-4 text-emerald-700" /><h3 className="text-sm font-black uppercase tracking-wide text-slate-900">Thanh toán VietQR</h3></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold uppercase tracking-wide text-slate-600">Ngân hàng / mã ngân hàng<input value={settings.BANK_ID} onChange={(e) => update("BANK_ID", e.target.value)} className={input} placeholder="TPBank" maxLength={40} /></label><label className="text-xs font-bold uppercase tracking-wide text-slate-600">Số tài khoản<input value={settings.BANK_ACCOUNT_NO} onChange={(e) => update("BANK_ACCOUNT_NO", e.target.value)} className={input} inputMode="numeric" maxLength={32} /></label><label className="text-xs font-bold uppercase tracking-wide text-slate-600 sm:col-span-2">Tên chủ tài khoản<input value={settings.BANK_ACCOUNT_NAME} onChange={(e) => update("BANK_ACCOUNT_NAME", e.target.value)} className={input} maxLength={120} /></label></div>
        {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p>}{notice && <p role="status" className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700"><Check className="h-4 w-4" />{notice}</p>}
        <button type="button" onClick={() => void save()} disabled={saving} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0e704b] px-5 text-sm font-bold text-white transition hover:bg-[#095c3d] disabled:opacity-60">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Lưu cấu hình</button>
      </>}
    </div>
    <aside className="space-y-4"><div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600" /><h3 className="font-black text-slate-900">Kết nối bảo mật</h3></div><p className="mt-2 text-xs leading-5 text-slate-600">API key, mật khẩu admin và database chỉ nằm trong Cloudflare Secrets. Trang này không hiển thị hoặc ghi đè các giá trị đó.</p><div className="mt-4 space-y-2 text-xs font-semibold"><Status label="Telegram Bot" active={settings.statuses?.telegram} /><Status label="SePay Webhook" active={settings.statuses?.sepay} /><Status label="RoboticVN API" active={settings.statuses?.robotic} /><Status label="ScoopyVN API" active={settings.statuses?.scoopy} /></div></div><div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5"><div className="flex items-center gap-2 text-slate-800"><KeyRound className="h-4 w-4" /><span className="text-sm font-black">Phạm vi cấu hình</span></div><p className="mt-2 text-xs leading-5 text-slate-600">Thay đổi ngân hàng áp dụng cho đơn mới. Đơn đã tạo giữ nguyên mã QR và nội dung chuyển khoản cũ.</p></div></aside>
  </section>;
}

function Status({ label, active }: { label: string; active?: boolean }) { return <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"><span>{label}</span><span className={active ? "text-emerald-700" : "text-amber-700"}>{active ? "Đã nối" : "Chưa nối"}</span></div>; }
