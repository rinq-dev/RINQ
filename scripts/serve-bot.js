const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

// 1. Tự động đóng gói bản zip bot mới nhất
console.log("📦 Đang đóng gói bản zip bot mới nhất...");
try {
  execSync("npm run pack:bot", { stdio: "inherit" });
} catch (e) {
  console.error("Lỗi đóng gói zip:", e.message);
}

// 2. Tìm IP mạng nội bộ Wi-Fi của máy tính
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal && !net.address.startsWith("169.254")) {
        if (net.address.startsWith("192.168.") || net.address.startsWith("10.")) {
          return net.address;
        }
      }
    }
  }
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "localhost";
}

const PORT = 8080;
const IP = getLocalIP();
const zipPath = path.join(__dirname, "..", "RINQ_BOT_ANDROID.zip");

if (!fs.existsSync(zipPath)) {
  console.error("❌ Không tìm thấy file RINQ_BOT_ANDROID.zip!");
  process.exit(1);
}

const server = http.createServer((req, res) => {
  if (req.url === "/" || req.url === "/RINQ_BOT_ANDROID.zip" || req.url?.startsWith("/bot")) {
    const stat = fs.statSync(zipPath);
    res.writeHead(200, {
      "Content-Type": "application/zip",
      "Content-Length": stat.size,
      "Content-Disposition": "attachment; filename=RINQ_BOT_ANDROID.zip",
    });
    const readStream = fs.createReadStream(zipPath);
    readStream.pipe(res);
    console.log(`\n📲 Đã gửi RINQ_BOT_ANDROID.zip sang điện thoại thành công! (${(stat.size / 1024).toFixed(1)} KB)`);
    return;
  }
  res.writeHead(404);
  res.end("Not Found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("\n=======================================================");
  console.log("🚀 MÁY CHỦ CHUYỂN FILE ĐANG CHẠY (CÙNG WI-FI)");
  console.log("=======================================================");
  console.log(`👉 Trên Termux điện thoại, dán lệnh này:\n`);
  console.log(`curl -O http://${IP}:${PORT}/RINQ_BOT_ANDROID.zip && unzip -o RINQ_BOT_ANDROID.zip\n`);
  console.log("=======================================================");
  console.log("(Nhấn Ctrl + C trên máy tính khi tải xong để tắt)");
});

