import { ProxyAgent } from "undici";

export interface RewriteOptions {
  text: string;
  productName?: string;
  category?: string;
  tone?: "telegram" | "concise" | "sales" | "tech";
}

export interface RewriteResult {
  rewrittenText: string;
  model: string;
  keyIndexUsed: number;
  proxyUsed: string | null;
}

// Global rotating pointers (in-memory for the running node process)
let currentKeyIndex = 0;
let currentProxyIndex = 0;

function getApiKeys(): string[] {
  const envKeys = process.env.AI_API_KEYS || process.env.GEMINI_API_KEY || "";
  return envKeys
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

function getProxies(): string[] {
  const envProxies =
    process.env.AI_PROXIES ||
    process.env.ROTATING_PROXY_URL ||
    process.env.AI_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    "";
  return envProxies
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

function getNextKey(keys: string[]): { key: string; index: number } {
  if (keys.length === 0) return { key: "", index: -1 };
  const index = currentKeyIndex % keys.length;
  currentKeyIndex = (currentKeyIndex + 1) % keys.length;
  return { key: keys[index], index };
}

function getNextProxy(proxies: string[]): string | null {
  if (proxies.length === 0) return null;
  const index = currentProxyIndex % proxies.length;
  currentProxyIndex = (currentProxyIndex + 1) % proxies.length;
  return proxies[index];
}

function buildSystemInstruction(tone: string = "telegram"): string {
  const baseInstruction = `Bạn là chuyên gia biên tập nội dung số 1 cho hệ thống bán lẻ tài nguyên công nghệ "RINQ SHOP".
Nhiệm vụ: Viết lại hoặc nâng cấp mô tả sản phẩm (API key, tài khoản, dịch vụ AI, email OAuth, VPN, bản quyền...) sao cho chuyên nghiệp, rõ ràng, minh bạch và thu hút khách hàng.
Quy tắc quan trọng:
1. TUYỆT ĐỐI KHÔNG dùng bất kỳ emoji trang trí nào (không 🚀, không ✨, không 🛒, v.v.).
2. Dùng tiếng Việt chuẩn mực, có dấu chuẩn xác 100%, rõ ràng, gãy gọn.
3. Không bịa đặt thêm các tính năng mà văn bản gốc không có.
4. Trình bày nội dung theo bố cục logic:
   - Thông tin tổng quan & Điểm nổi bật
   - Bạn nhận được (Chi tiết gói / Quota / Thời hạn)
   - Lưu ý khi sử dụng (nếu có)
   - Chính sách bảo hành & Hỗ trợ`;

  switch (tone) {
    case "concise":
      return `${baseInstruction}\nPhong cách: Tối giản, cực kỳ súc tích, gạch đầu dòng ngắn gọn, vào thẳng vấn đề, loại bỏ từ ngữ rườm rà.`;
    case "sales":
      return `${baseInstruction}\nPhong cách: Bán hàng thuyết phục, nhấn mạnh tính tiện lợi, tốc độ giao tự động 24/7 và sự an tâm về bảo hành.`;
    case "tech":
      return `${baseInstruction}\nPhong cách: Chuyên sâu kỹ thuật, làm rõ thông số, API endpoint, giao thức tương thích, cơ chế token/quota và giới hạn hệ thống.`;
    case "telegram":
    default:
      return `${baseInstruction}
Phong cách Telegram Bot:
- Sử dụng các thẻ HTML được Telegram Bot hỗ trợ: <b>in đậm</b>, <i>in nghiêng</i>, <code>mã / key</code>, <blockquote>đoạn trích dẫn</blockquote>.
- Các đầu mục viết hoa và in đậm (ví dụ: <b>BẠN NHẬN ĐƯỢC:</b>, <b>LƯU Ý KHI SỬ DỤNG:</b>).
- Dùng dấu gạch ngang (-) hoặc chấm tròn (•) cho danh sách.`;
  }
}

/**
 * Smart local fallback formatter when no AI API keys are configured yet
 */
function localFormatFallback(options: RewriteOptions): string {
  const { text, productName, tone } = options;
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let title = productName ? productName.toUpperCase() : "THÔNG TIN SẢN PHẨM";
  let output = `<b>[ ${title} ]</b>\n\n`;

  for (const line of lines) {
    if (line.endsWith(":") || /^(bạn nhận được|lưu ý|bảo hành|hướng dẫn|mô tả)/i.test(line)) {
      output += `\n<b>${line.toUpperCase()}</b>\n`;
    } else if (line.startsWith("-") || line.startsWith("•") || line.startsWith("*")) {
      output += `• ${line.replace(/^[-•*]\s*/, "")}\n`;
    } else {
      output += `${line}\n`;
    }
  }

  if (tone === "telegram") {
    output += `\n<blockquote>Hệ thống giao tự động 24/7 tức thì sau khi thanh toán. Hỗ trợ kỹ thuật 1:1 qua admin.</blockquote>`;
  }

  return output.trim();
}

/**
 * Rewrite product content using Rotating AI API Keys and Rotating Proxies
 */
export async function rewriteProductContent(options: RewriteOptions): Promise<RewriteResult> {
  const keys = getApiKeys();
  const proxies = getProxies();

  if (keys.length === 0) {
    return {
      rewrittenText: localFormatFallback(options),
      model: "local-rule-formatter",
      keyIndexUsed: -1,
      proxyUsed: null,
    };
  }

  const systemInstruction = buildSystemInstruction(options.tone);
  const prompt = `Tên sản phẩm: ${options.productName || "Sản phẩm công nghệ"}\nDanh mục: ${
    options.category || "Công nghệ"
  }\nNội dung gốc cần viết lại:\n"""\n${options.text.trim()}\n"""\n\nHãy viết lại mô tả sản phẩm trên theo đúng phong cách và quy tắc đã hướng dẫn. Chỉ trả về nội dung hoàn chỉnh, không thêm lời chào, không thêm giải thích ngoài lề.`;

  let lastError: Error | null = null;
  const maxAttempts = Math.min(keys.length * 2, 6);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { key, index: keyIdx } = getNextKey(keys);
    const proxyUrl = getNextProxy(proxies);

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        key
      )}`;

      const requestBody = {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 2048,
        },
      };

      const fetchOptions: any = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      };

      if (proxyUrl) {
        fetchOptions.dispatcher = new ProxyAgent(proxyUrl);
      }

      const response = await fetch(endpoint, fetchOptions);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error [${response.status}]: ${errorText.slice(0, 300)}`);
      }

      const data = await response.json();
      const candidateText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

      if (!candidateText) {
        throw new Error("Không nhận được nội dung từ mô hình AI");
      }

      // Sanitize: enforce no decorative emojis
      const cleanedText = candidateText
        .replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
        .trim();

      return {
        rewrittenText: cleanedText,
        model: "gemini-2.5-flash",
        keyIndexUsed: keyIdx,
        proxyUsed: proxyUrl,
      };
    } catch (err: any) {
      lastError = err;
      console.warn(`[AI Rewrite] Lần thử ${attempt + 1} thất bại (Key #${keyIdx}, Proxy: ${proxyUrl || "direct"}):`, err?.message);
    }
  }

  return {
    rewrittenText: localFormatFallback(options),
    model: `fallback-error: ${lastError?.message?.slice(0, 80)}`,
    keyIndexUsed: -1,
    proxyUsed: null,
  };
}
