import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL chưa được cấu hình cho ứng dụng web");
}

const pool = new Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 1000,
  allowExitOnIdle: true,
});

pool.on("error", (err) => {
  console.warn("Lỗi socket DB:", err?.message || err);
});

const adapter = new PrismaPg(pool);

// Tự động serialize BigInt sang Number khi JSON.stringify
if (typeof BigInt !== "undefined" && !(BigInt.prototype as any).toJSON) {
  (BigInt.prototype as any).toJSON = function () {
    const num = Number(this);
    return Number.isSafeInteger(num) ? num : this.toString();
  };
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;
