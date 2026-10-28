"use client";

import { FormEvent, useEffect, useState } from "react";
import { LockKeyhole } from "lucide-react";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    localStorage.removeItem("admin_password");
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thể đăng nhập.");
      window.location.replace("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể đăng nhập.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 px-4 text-white">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
          <LockKeyhole className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold">Đăng nhập quản trị</h1>
        <p className="mt-2 text-sm text-slate-400">Phiên đăng nhập sẽ tự hết hạn sau 8 giờ.</p>
        <label htmlFor="password" className="mt-6 block text-sm font-medium text-slate-200">Mật khẩu</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-xl border border-white/15 bg-slate-900 px-4 py-3 outline-none focus:border-emerald-400"
        />
        {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
        <button disabled={busy} className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold hover:bg-emerald-500 disabled:opacity-60">
          {busy ? "Đang xác thực…" : "Đăng nhập"}
        </button>
      </form>
    </main>
  );
}
