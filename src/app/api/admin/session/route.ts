import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminCookieOptions, createAdminSession, COOKIE_NAME } from "@/lib/admin-session";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
type AttemptState = { count: number; resetAt: number };
const globalForAdminAttempts = globalThis as typeof globalThis & {
  adminLoginAttempts?: Map<string, AttemptState>;
};
const attempts = globalForAdminAttempts.adminLoginAttempts ?? new Map<string, AttemptState>();
globalForAdminAttempts.adminLoginAttempts = attempts;

function safeEqual(a: string, b: string) {
  const aHash = createHmac("sha256", "admin-password-check").update(a).digest();
  const bHash = createHmac("sha256", "admin-password-check").update(b).digest();
  return timingSafeEqual(aHash, bHash);
}

function isSameOrigin(req: NextRequest) {
  const originHeader = req.headers.get("origin");
  if (!originHeader || originHeader === "null") return false;

  try {
    const origin = new URL(originHeader);
    const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim().toLowerCase();
    const protocolMatches = forwardedProto
      ? origin.protocol === `${forwardedProto}:`
      : process.env.NODE_ENV === "production"
        ? origin.protocol === "https:"
        : origin.protocol === req.nextUrl.protocol || origin.protocol === "https:";

    if (!protocolMatches) return false;

    // A reverse proxy can terminate HTTPS and forward the request to Next.js over HTTP.
    // Compare the browser Origin to the external host headers before falling back to Next's URL.
    const hostCandidates = [
      req.headers.get("x-forwarded-host"),
      req.headers.get("host"),
      req.nextUrl.host,
    ].flatMap((value) => value?.split(",").map((host) => host.trim()).filter(Boolean) ?? []);

    return hostCandidates.some((host) => {
      try {
        return new URL(`${origin.protocol}//${host}`).host.toLowerCase() === origin.host.toLowerCase();
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 403 });

  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",").map((part) => part.trim()).filter(Boolean);
  const ip = req.headers.get("x-real-ip") || (forwardedFor?.length ? forwardedFor[forwardedFor.length - 1] : "unknown");
  const now = Date.now();
  const current = attempts.get(ip);
  if (current && current.resetAt > now && current.count >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: "Bạn thử quá nhiều lần. Hãy chờ 15 phút rồi thử lại." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const supplied = typeof body.password === "string" ? body.password : "";
  const configured = process.env.ADMIN_PASSWORD || "";
  const secret = process.env.ADMIN_SESSION_SECRET || "";
  const isDev = process.env.NODE_ENV !== "production";
  const configIsSafe = isDev
    ? configured.length > 0 && secret.length >= 32
    : configured.length >= 8 && configured.toLowerCase() !== "admin" && secret.length >= 32;

  if (!configIsSafe || !safeEqual(supplied, configured)) {
    const next = current && current.resetAt > now ? current : { count: 0, resetAt: now + WINDOW_MS };
    next.count += 1;
    attempts.set(ip, next);
    return NextResponse.json(
      { error: configIsSafe ? "Mật khẩu không đúng" : "Thiết lập ADMIN_PASSWORD và ADMIN_SESSION_SECRET an toàn trước khi đăng nhập." },
      { status: configIsSafe ? 401 : 503 }
    );
  }

  attempts.delete(ip);
  const response = NextResponse.json({ success: true });
  response.cookies.set({ ...adminCookieOptions(), value: await createAdminSession() });
  return response;
}

export async function DELETE(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 403 });
  const response = NextResponse.json({ success: true });
  response.cookies.set({ ...adminCookieOptions(), value: "", maxAge: 0 });
  response.cookies.delete(COOKIE_NAME);
  return response;
}
