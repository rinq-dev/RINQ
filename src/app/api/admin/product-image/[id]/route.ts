import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COOKIE_NAME, isValidAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isValidAdminSession(request.cookies.get(COOKIE_NAME)?.value))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const product = await prisma.product.findUnique({ where: { id: Number(id) }, select: { imageUrl: true } });
  const match = product?.imageUrl?.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new Response(Buffer.from(match[2], "base64"), {
    headers: {
      "Content-Type": `image/${match[1].toLowerCase()}`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
