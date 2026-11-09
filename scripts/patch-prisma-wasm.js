const fs = require("fs");
const path = require("path");

const classFilePath = path.join(__dirname, "../src/generated/prisma/internal/class.ts");

if (fs.existsSync(classFilePath)) {
  let content = fs.readFileSync(classFilePath, "utf8");

  const target = `config.compilerWasm = {
  getRuntime: async () => await import("./query_compiler_bg.js"),

  getQueryCompilerWasmModule: async () => {
    const { default: module } = await import("./query_compiler_bg.wasm?module")
    return module
  }
}`;

  const replacement = `config.compilerWasm = {
  getRuntime: async () => await import("./query_compiler_bg.js"),

  getQueryCompilerWasmModule: async () => {
    try {
      const res = await import("./query_compiler_bg.wasm?module");
      if (res?.default) return res.default;
    } catch {}
    try {
      if (typeof process !== "undefined" && process.versions?.node) {
        const fs = await import("fs");
        const path = await import("path");
        const wasmPath = path.resolve(__dirname, "./query_compiler_bg.wasm");
        const wasmBuffer = fs.readFileSync(wasmPath);
        return new WebAssembly.Module(wasmBuffer);
      }
    } catch (e) {
      console.error("Lỗi load wasm trong Node.js:", e);
    }
    return undefined;
  }
}`;

  if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(classFilePath, content, "utf8");
    console.log("✅ Đã vá Prisma WASM loader cho Node.js!");
  } else if (content.includes("new WebAssembly.Module(wasmBuffer)")) {
    console.log("ℹ️ Prisma WASM loader đã được vá từ trước.");
  } else {
    console.warn("⚠️ Không tìm thấy vị trí khớp chính xác để vá WASM loader.");
  }
} else {
  console.warn("⚠️ File class.ts không tồn tại, bỏ qua vá WASM.");
}

