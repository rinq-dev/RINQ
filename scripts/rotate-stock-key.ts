import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { decryptStock, encryptStock } from "../src/lib/crypto";

async function main() {
  if (!process.env.STOCK_ENCRYPTION_KEY_PREVIOUS) {
    throw new Error("Set STOCK_ENCRYPTION_KEY_PREVIOUS to the old key before rotating stored stock.");
  }

  let cursor = 0;
  let migrated = 0;
  while (true) {
    const batch = await prisma.stockItem.findMany({
      where: { id: { gt: cursor } },
      orderBy: { id: "asc" },
      take: 500,
      select: { id: true, data: true },
    });
    if (batch.length === 0) break;
    cursor = batch[batch.length - 1].id;

    const updates = batch
      .filter((item) => item.data.startsWith("enc:v1:"))
      .map((item) => ({ id: item.id, data: encryptStock(decryptStock(item.data)) }));

    if (updates.length) {
      await prisma.$transaction(
        updates.map(({ id, data }) => prisma.stockItem.update({ where: { id }, data: { data } }))
      );
      migrated += updates.length;
    }
  }

  console.log(`Re-encrypted ${migrated} stock item(s) with STOCK_ENCRYPTION_KEY.`);
}

main()
  .catch((error) => {
    console.error("Stock key rotation failed. Keep both keys configured until the data is migrated.", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
