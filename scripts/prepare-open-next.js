const fs = require("node:fs");
const path = require("node:path");

// Next 16 writes proxy output to `.next/server/middleware.js`, while its
// standalone trace omits the file. OpenNext expects it in the standalone
// server tree when collecting traced middleware files.
const source = path.join(process.cwd(), ".next", "server", "middleware.js");
const target = path.join(
  process.cwd(),
  ".next",
  "standalone",
  ".next",
  "server",
  "middleware.js",
);

if (fs.existsSync(source) && !fs.existsSync(target)) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  console.log("Prepared Next 16 proxy bundle for OpenNext.");
}
