import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COOKIE_NAME, isValidAdminSession } from "@/lib/admin-session";
import { getScoopyCatalog, scoopyRetailPrice, createScoopySupplierOrder } from "@/lib/scoopy";
import { encryptStock } from "@/lib/crypto";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

async function isAdmin(request: NextRequest) {
  return isValidAdminSession(request.cookies.get(COOKIE_NAME)?.value);
}

export async function GET(request: NextRequest) {
  if (!(await isAdmin(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { account, products } = await getScoopyCatalog();
    const imported = await prisma.product.findMany({
      where: { supplierVariantId: { startsWith: "SCOOPY:" } },
      select: { supplierVariantId: true, id: true, isActive: true, price: true },
    });
    const importedBySourceId = new Map(
      imported.map((product) => [product.supplierVariantId!.slice("SCOOPY:".length), product])
    );

    let purchasesReady = true;
    const purchases = await prisma.supplierPurchase.findMany({
      orderBy: { createdAt: "desc" }, take: 20,
      select: { id: true, supplierProductId: true, supplierProductName: true, quantity: true, maxTotalVnd: true, targetProductId: true, status: true, supplierOrderId: true, totalVnd: true, itemCount: true, createdAt: true },
    }).catch((error) => {
      if (!/SupplierPurchase|P2021|does not exist|doesn't exist/i.test(error instanceof Error ? error.message : String(error))) throw error;
      purchasesReady = false;
      return [];
    });
    return NextResponse.json({
      success: true,
      account: { tier: account.tier, balanceVnd: account.balance_vnd, currency: account.currency },
      purchases,
      purchasesReady,
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        category: product.group || "ScoopyVN",
        sourcePrice: product.retail_price_vnd,
        stock: product.stock,
        imported: Boolean(importedBySourceId.get(product.id)),
        localProductId: importedBySourceId.get(product.id)?.id || null,
        localActive: importedBySourceId.get(product.id)?.isActive || false,
        localPrice: importedBySourceId.get(product.id)?.price || null,
      })),
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể đọc danh mục ScoopyVN." }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin(request)) || request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    if (body.action === "purchase") {
      try {
        await prisma.supplierPurchase.findFirst({ select: { id: true } });
      } catch (error) {
        return NextResponse.json({ error: "Cần áp dụng bảng SupplierPurchase trong supabase-schema.sql trước khi bật nhập kho Scoopy." }, { status: 503 });
      }
      const sourceId = String(body.productId || "").trim();
      const targetProductId = Number(body.targetProductId);
      const quantity = Number(body.quantity);
      const maxTotalVnd = Number(body.maxTotalVnd);
      const idempotencyKey = String(body.idempotencyKey || "");
      if (!/^[1-9]\d{0,17}$/.test(sourceId) || !Number.isSafeInteger(targetProductId) || targetProductId < 1 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 50 || !Number.isSafeInteger(maxTotalVnd) || maxTotalVnd < 1 || maxTotalVnd > 1_000_000 || !/^[a-f0-9-]{36}$/i.test(idempotencyKey)) {
        return NextResponse.json({ error: "Sản phẩm, số lượng, hạn mức hoặc mã giao dịch không hợp lệ. Tối đa 50 sản phẩm và 1.000.000 ₫ mỗi lần." }, { status: 400 });
      }
      const requestHash = crypto.createHash("sha256").update(JSON.stringify({ sourceId, targetProductId, quantity, maxTotalVnd })).digest("hex");
      const prior = await prisma.supplierPurchase.findUnique({ where: { id: idempotencyKey } });
      if (prior && prior.requestHash !== requestHash) return NextResponse.json({ error: "Mã giao dịch đã được dùng cho yêu cầu khác." }, { status: 409 });
      if (prior?.status === "COMPLETED") return NextResponse.json({ success: true, purchaseId: prior.id, imported: prior.itemCount, totalVnd: prior.totalVnd, replayed: true });
      if (prior?.status === "REVIEW_REQUIRED") return NextResponse.json({ error: `Đơn nhà cung cấp ${prior.supplierOrderId || "đang đối soát"} cần kiểm tra thủ công. Không thể gửi mua lại.` }, { status: 409 });
      const { account, products } = await getScoopyCatalog();
      const source = products.find((product) => product.id === sourceId);
      if (!source || !Number.isSafeInteger(source.retail_price_vnd) || source.retail_price_vnd < 1) {
        return NextResponse.json({ error: "Nguồn đã hết hàng hoặc không đủ tồn. Hãy tải lại danh mục." }, { status: 409 });
      }
      const estimatedTotal = source.retail_price_vnd * quantity;
      if (!Number.isSafeInteger(estimatedTotal) || estimatedTotal > maxTotalVnd) {
        return NextResponse.json({ error: "Giá hiện tại vượt hạn mức đã xác nhận. Hãy tải lại giá và xác nhận lại." }, { status: 409 });
      }
      const target = await prisma.product.findUnique({ where: { id: targetProductId }, select: { id: true, supplierVariantId: true } });
      if (!target || target.supplierVariantId !== `SCOOPY:${sourceId}`) {
        return NextResponse.json({ error: "Sản phẩm đích không khớp nguồn Scoopy. Hãy nhập bản nháp trước." }, { status: 409 });
      }
      if (!prior && source.stock < quantity) return NextResponse.json({ error: "Nguồn không còn đủ tồn. Hãy tải lại danh mục." }, { status: 409 });
      if (!prior && account.balance_vnd < estimatedTotal) {
        return NextResponse.json({ error: `Ví Scoopy không đủ số dư. Cần khoảng ${estimatedTotal.toLocaleString("vi-VN")} ₫; hiện có ${account.balance_vnd.toLocaleString("vi-VN")} ₫.` }, { status: 409 });
      }
      if (!prior) {
        await prisma.supplierPurchase.create({ data: { id: idempotencyKey, requestHash, supplierProductId: sourceId, supplierProductName: source.name.slice(0, 250), quantity, maxTotalVnd, targetProductId, status: "PENDING" } });
      }
      try {
        const supplierOrder = await createScoopySupplierOrder(sourceId, quantity, maxTotalVnd, idempotencyKey);
        if (supplierOrder.items.length !== quantity || supplierOrder.items.some((item) => !(item.account || item.sku || "").trim())) {
          await prisma.supplierPurchase.update({ where: { id: idempotencyKey }, data: { status: "REVIEW_REQUIRED", supplierOrderId: supplierOrder.id, itemCount: supplierOrder.items.length } });
          return NextResponse.json({ error: `Nhà cung cấp đã nhận đơn ${supplierOrder.id} nhưng trả số key không khớp. Đơn được giữ lại để đối soát; không thử mua lại.` }, { status: 502 });
        }
        if (supplierOrder.totalVnd !== null && supplierOrder.totalVnd > maxTotalVnd) {
          await prisma.supplierPurchase.update({ where: { id: idempotencyKey }, data: { status: "REVIEW_REQUIRED", supplierOrderId: supplierOrder.id, totalVnd: supplierOrder.totalVnd, itemCount: supplierOrder.items.length } });
          return NextResponse.json({ error: `Nhà cung cấp báo tổng ${supplierOrder.totalVnd.toLocaleString("vi-VN")} ₫ vượt hạn mức ${maxTotalVnd.toLocaleString("vi-VN")} ₫. Đơn ${supplierOrder.id} cần đối soát; không thử mua lại.` }, { status: 502 });
        }
        await prisma.$transaction(async (tx) => {
          const current = await tx.supplierPurchase.findUnique({ where: { id: idempotencyKey } });
          if (current?.status === "COMPLETED") return;
          await tx.stockItem.createMany({ data: supplierOrder.items.map((item) => ({ productId: targetProductId, data: encryptStock((item.account || item.sku).trim()) })) });
          await tx.supplierPurchase.update({ where: { id: idempotencyKey }, data: { status: "COMPLETED", supplierOrderId: supplierOrder.id, totalVnd: supplierOrder.totalVnd ?? estimatedTotal, itemCount: supplierOrder.items.length } });
        });
        return NextResponse.json({ success: true, purchaseId: idempotencyKey, supplierOrderId: supplierOrder.id, imported: supplierOrder.items.length, totalVnd: estimatedTotal, message: `${supplierOrder.items.length} tài nguyên đã được mã hóa và nhập kho sản phẩm #${targetProductId}.` });
      } catch (error) {
        await prisma.supplierPurchase.update({ where: { id: idempotencyKey }, data: { status: "FAILED" } }).catch(() => {});
        throw error;
      }
    }
    const ids: string[] = Array.isArray(body.productIds)
      ? [...new Set<string>((body.productIds as unknown[]).map((id) => String(id).trim()).filter((id) => /^[1-9]\d{0,17}$/.test(id)))]
      : [];
    const marginById = body.marginById && typeof body.marginById === "object" ? body.marginById : {};
    const categoryById = body.categoryById && typeof body.categoryById === "object" ? body.categoryById : {};
    if (!ids.length || ids.length > 100) {
      return NextResponse.json({ error: "Chọn từ 1 đến 100 sản phẩm cần nhập." }, { status: 400 });
    }
    const { products } = await getScoopyCatalog();
    const selected = products.filter((product) => ids.includes(product.id));
    if (selected.length !== ids.length) {
      return NextResponse.json({ error: "Danh mục đã thay đổi. Tải lại danh sách trước khi nhập." }, { status: 409 });
    }
    if (selected.some((product) => product.stock < 1 || !Number.isSafeInteger(product.retail_price_vnd) || product.retail_price_vnd < 1)) {
      return NextResponse.json({ error: "Không nhập sản phẩm đang hết hàng hoặc có giá không hợp lệ." }, { status: 409 });
    }
    if (selected.some((product) => {
      const margin = Number(marginById[product.id] ?? 15);
      return !Number.isFinite(margin) || margin < 0 || margin > 2000 || scoopyRetailPrice(product.retail_price_vnd, margin) > 2_147_483_647;
    })) {
      return NextResponse.json({ error: "Giá sau khi cộng biên vượt giới hạn giá sản phẩm." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      let imported = 0;
      let existing = 0;
      for (const source of selected) {
        const sourceKey = `SCOOPY:${source.id}`;
        const found = await tx.product.findFirst({ where: { supplierVariantId: sourceKey }, select: { id: true } });
        if (found) {
          existing++;
          continue;
        }
        const margin = Math.max(0, Math.min(2000, Number(marginById[source.id] ?? 15)));
        const description = source.description?.trim().slice(0, 8000) || "Sản phẩm nhập từ danh mục ScoopyVN. Nạp kho nội bộ trước khi bật bán.";
        const customCategory = typeof categoryById[source.id] === "string" ? categoryById[source.id].trim().slice(0, 120) : "";
        const finalCategory = customCategory || source.group?.trim().slice(0, 120) || "ScoopyVN";
        await tx.product.create({
          data: {
            name: source.name.trim().slice(0, 250),
            price: scoopyRetailPrice(source.retail_price_vnd, margin),
            retailMarginPercent: Math.round(margin),
            description,
            category: finalCategory,
            supplierVariantId: sourceKey,
            fulfillmentType: "HYBRID",
            isActive: false,
            lastSupplierPrice: source.retail_price_vnd,
            autoPriceSync: true,
          },
        });
        imported++;
      }
      return { imported, existing };
    });

    return NextResponse.json({
      success: true,
      ...result,
      message: `${result.imported} sản phẩm được tạo thành bản nháp; ${result.existing} sản phẩm đã có nên được giữ nguyên.`,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể nhập sản phẩm ScoopyVN." }, { status: 502 });
  }
}
