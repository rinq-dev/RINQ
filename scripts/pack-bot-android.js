const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// The PC bot is the source of truth. Mirror bot runtime source and schema before packaging.
const androidRoot = path.resolve("rinq-bot-android");
const botRuntimeLibraries = [
  "admin-session.ts",
  "affiliate.ts",
  "api5s.ts",
  "app-settings.ts",
  "bot-status.ts",
  "categories.ts",
  "crypto.ts",
  "customer-auth.ts",
  "flash-sale.ts",
  "notifier.ts",
  "order-policy.ts",
  "price-sync.ts",
  "promo.ts",
  "restock.ts",
  "robotic.ts",
  "scoopy.ts",
  "supplier.ts",
  "supplier-fulfillment.ts",
  "telegram-auth.ts",
  "warranty.ts",
  "web-auth.ts",
];
for (const name of botRuntimeLibraries) {
  fs.copyFileSync(path.resolve("src/lib", name), path.join(androidRoot, "src/lib", name));
}
fs.copyFileSync(path.resolve("src/bot/index.ts"), path.join(androidRoot, "src/bot/index.ts"));
if (fs.existsSync(path.resolve("public/qr-frame.jpg"))) {
  fs.mkdirSync(path.join(androidRoot, "public"), { recursive: true });
  fs.copyFileSync(path.resolve("public/qr-frame.jpg"), path.join(androidRoot, "public/qr-frame.jpg"));
}
const canonicalSchema = fs.readFileSync(path.resolve("prisma/schema.prisma"), "utf8");
const androidGenerator = 'generator client {\n  provider      = "prisma-client-js"\n  engineType    = "client"\n}';
const androidSchema = canonicalSchema.replace(
  /generator client\s*\{[\s\S]*?\}/,
  androidGenerator,
);
fs.writeFileSync(path.join(androidRoot, "prisma/schema.prisma"), androidSchema);

const filesToZip = [
  ".env.example",
  "HUONG-DAN-TERMUX.txt",
  "package.json",
  "package-lock.json",
  "README.md",
  "start.sh",
  "tsconfig.json",
  "prisma/schema.prisma",
];

function getFiles(dir) {
  let res = [];
  fs.readdirSync(dir).forEach((f) => {
    const fp = path.join(dir, f);
    if (fs.statSync(fp).isDirectory()) {
      res = res.concat(getFiles(fp));
    } else {
      res.push(fp.replace(/\\/g, "/"));
    }
  });
  return res;
}

getFiles("rinq-bot-android/src").forEach((f) => {
  filesToZip.push(f.replace("rinq-bot-android/", ""));
});

if (fs.existsSync(path.join(androidRoot, "public"))) {
  getFiles("rinq-bot-android/public").forEach((f) => {
    filesToZip.push(f.replace("rinq-bot-android/", ""));
  });
}

console.log("Total files to zip:", filesToZip.length);

const targetZip = path.resolve("RINQ_BOT_ANDROID.zip");
if (fs.existsSync(targetZip)) {
  fs.unlinkSync(targetZip);
}

execSync(`tar -a -cf "${targetZip}" ${filesToZip.join(" ")}`, {
  cwd: androidRoot,
  stdio: "inherit",
});

console.log("Archive created successfully at:", targetZip);
const stat = fs.statSync(targetZip);
console.log("Size:", stat.size, "bytes");

