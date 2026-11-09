import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { COOKIE_NAME, isValidAdminSession } from "@/lib/admin-session";
import { encryptStock } from "@/lib/crypto";
import { getRoboticCatalog, createRoboticOrder, roboticRetailPrice } from "@/lib/robotic";
import { categorizeProductName } from "@/lib/categories";

export const dynamic = "force-dynamic";
async function isAdmin(request: NextRequest) { return isValidAdminSession(request.cookies.get(COOKIE_NAME)?.value); }

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

export async function GET(request: NextRequest) {
  if (!(await isAdmin(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get("refresh") === "1";
    const maxPrice = Number(url.searchParams.get("maxPrice") || 2_147_483_647);
    const offset = Number(url.searchParams.get("offset") || 0);
    const limit = Number(url.searchParams.get("limit") || 35);

    const catalog = await getRoboticCatalog({
      maxPrice,
      offset,
      limit,
      forceRefresh,
    });

    const imported = await withTimeout(
      prisma.product.findMany({
        where: { supplierVariantId: { startsWith: "ROBOTIC:" } },
        select: { supplierVariantId: true, id: true, isActive: true, price: true, retailMarginPercent: true },
      }),
      2500,
      []
    ).catch(() => []);

    const importedBySource = new Map(imported.map((item) => [item.supplierVariantId!.slice("ROBOTIC:".length), item]));

    const purchases = offset === 0
      ? await withTimeout(
          prisma.supplierPurchase.findMany({
            where: { supplierProductId: { startsWith: "ROBOTIC:" } },
            orderBy: { createdAt: "desc" },
            take: 20,
            select: { id: true, supplierProductId: true, supplierProductName: true, quantity: true, maxTotalVnd: true, targetProductId: true, status: true, supplierOrderId: true, totalVnd: true, itemCount: true, createdAt: true },
          }),
          2500,
          []
        ).catch(() => [])
      : [];
    return NextResponse.json({
      success: true,
      account: catalog.account,
      purchases,
      hasMore: catalog.hasMore,
      totalSummaries: catalog.totalSummaries,
      products: catalog.products.map((item) => {
        const local = importedBySource.get(`${item.id}:${item.variantId}`);
        return {
          ...item,
          imported: Boolean(local),
          localProductId: local?.id || null,
          localActive: local?.isActive || false,
          localPrice: local?.price || null,
          marginPercent: local?.retailMarginPercent ?? 15,
        };
      }),
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể đọc danh mục RoboticVN." }, { status: 502 }); }
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin(request)) || request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    if (body.action === "purchase") {
      const sourceKey = String(body.productId || "").trim();
      const targetProductId = Number(body.targetProductId);
      const quantity = Number(body.quantity);
      const maxTotalVnd = Number(body.maxTotalVnd);
      const idempotencyKey = String(body.idempotencyKey || "");
      if (!sourceKey || !Number.isSafeInteger(targetProductId) || targetProductId < 1 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 50 || !Number.isSafeInteger(maxTotalVnd) || maxTotalVnd < 1 || maxTotalVnd > 2_000_000 || !/^[a-f0-9-]{36}$/i.test(idempotencyKey)) return NextResponse.json({ error: "Sản phẩm, số lượng, hạn mức hoặc mã giao dịch không hợp lệ." }, { status: 400 });
      const [productId, variantId] = sourceKey.split(":");
      const catalog = await getRoboticCatalog();
      const source = catalog.products.find((item) => item.id === productId && item.variantId === variantId);
      if (!source || source.stock < quantity) return NextResponse.json({ error: "Nguồn đã hết hàng hoặc không đủ tồn. Hãy tải lại danh mục." }, { status: 409 });
      const estimatedTotal = source.sourcePrice * quantity;
      if (estimatedTotal > maxTotalVnd || catalog.account.balanceVnd < estimatedTotal) return NextResponse.json({ error: "Giá hoặc số dư ví RoboticVN không đủ theo hạn mức đã xác nhận." }, { status: 409 });
      const target = await prisma.product.findUnique({ where: { id: targetProductId }, select: { id: true, supplierVariantId: true } });
      if (!target || target.supplierVariantId !== `ROBOTIC:${sourceKey}`) return NextResponse.json({ error: "Sản phẩm đích không khớp nguồn RoboticVN." }, { status: 409 });
      const requestHash = crypto.createHash("sha256").update(JSON.stringify({ sourceKey, targetProductId, quantity, maxTotalVnd })).digest("hex");
      const prior = await prisma.supplierPurchase.findUnique({ where: { id: idempotencyKey } });
      if (prior?.status === "COMPLETED") return NextResponse.json({ success: true, replayed: true, imported: prior.itemCount, purchaseId: prior.id });
      if (prior && prior.requestHash !== requestHash) return NextResponse.json({ error: "Mã giao dịch đã dùng cho yêu cầu khác." }, { status: 409 });
      if (!prior) await prisma.supplierPurchase.create({ data: { id: idempotencyKey, requestHash, supplierProductId: `ROBOTIC:${sourceKey}`, supplierProductName: source.name.slice(0, 250), quantity, maxTotalVnd, targetProductId, status: "PENDING" } });
      try {
        const order = await createRoboticOrder(variantId, quantity, idempotencyKey);
        if (order.items.length !== quantity || order.items.some((item) => !item.rawText.trim())) { await prisma.supplierPurchase.update({ where: { id: idempotencyKey }, data: { status: "REVIEW_REQUIRED", supplierOrderId: order.orderId, itemCount: order.items.length } }); return NextResponse.json({ error: `RoboticVN đã nhận đơn ${order.orderId} nhưng trả số key không khớp; cần đối soát.` }, { status: 502 }); }
        await prisma.$transaction(async (tx) => { await tx.stockItem.createMany({ data: order.items.map((item) => ({ productId: targetProductId, data: encryptStock(item.rawText.trim()) })) }); await tx.supplierPurchase.update({ where: { id: idempotencyKey }, data: { status: "COMPLETED", supplierOrderId: order.orderId, totalVnd: estimatedTotal, itemCount: order.items.length } }); });
        return NextResponse.json({ success: true, imported: order.items.length, totalVnd: estimatedTotal, supplierOrderId: order.orderId, message: `${order.items.length} tài nguyên đã nhập kho.` });
      } catch (error) { await prisma.supplierPurchase.update({ where: { id: idempotencyKey }, data: { status: "FAILED" } }).catch(() => {}); throw error; }
    }
    const ids = Array.isArray(body.productIds) ? [...new Set(body.productIds.map((id: unknown) => String(id).trim()))] : [];
    const marginById = body.marginById && typeof body.marginById === "object" ? body.marginById : {};
    if (!ids.length || ids.length > 100) return NextResponse.json({ error: "Chọn từ 1 đến 100 mặt hàng." }, { status: 400 });
    const catalog = await getRoboticCatalog();
    const selected = catalog.products.filter((item) => ids.includes(`${item.id}:${item.variantId}`));
    if (selected.length !== ids.length) return NextResponse.json({ error: "Danh mục đã thay đổi. Tải lại danh sách trước khi nhập." }, { status: 409 });
    let imported = 0; let existing = 0;
    for (const source of selected) {
      const sourceKey = `ROBOTIC:${source.id}:${source.variantId}`;
      const margin = Math.max(0, Math.min(2000, Number(marginById[`${source.id}:${source.variantId}`] ?? 15)));
      const existingProduct = await prisma.product.findFirst({ where: { supplierVariantId: sourceKey }, select: { id: true } });
      if (existingProduct) { existing++; continue; }
      await prisma.product.create({
        data: {
          name: source.name.slice(0, 250),
          price: roboticRetailPrice(source.sourcePrice, margin),
          retailMarginPercent: Math.round(margin),
          description: source.description.slice(0, 8000) || null,
          category: categorizeProductName(source.name, source.category),
          supplierVariantId: sourceKey,
          fulfillmentType: "API",
          isActive: false,
          lastSupplierPrice: source.sourcePrice,
          autoPriceSync: true,
        },
      });
      imported++;
    }
    return NextResponse.json({ success: true, imported, existing, message: `${imported} bản nháp RoboticVN đã tạo; biên lợi nhuận lưu riêng từng mặt hàng.` });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể xử lý RoboticVN." }, { status: 502 }); }
}
