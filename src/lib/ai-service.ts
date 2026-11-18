import { ProxyAgent } from "undici";
import { prisma } from "@/lib/prisma";

export interface RewriteOptions {
  text: string;
  productName?: string;
  category?: string;
  type?: "description" | "warranty";
  tone?: "telegram" | "concise" | "sales" | "tech";
}

export interface RewriteResult {
  rewrittenText: string;
  model: string;
  keyIndexUsed: number;
  totalKeys: number;
  keyMasked: string;
  proxyUsed: string | null;
}

// Global rotating pointers (in-memory for the running node process)
let currentKeyIndex = 0;
let currentProxyIndex = 0;

async function getApiKeys(): Promise<string[]> {
  try {
    const dbSetting = await prisma.appSetting.findUnique({
      where: { key: "AI_API_KEYS" },
    });
    const rawKeys = dbSetting?.value?.trim() || process.env.AI_API_KEYS || process.env.GEMINI_API_KEY || "";
    return rawKeys
      .split(/[\r\n,]+/)
      .map((k) => k.trim())
      .filter(Boolean);
  } catch {
    const envKeys = process.env.AI_API_KEYS || process.env.GEMINI_API_KEY || "";
    return envKeys
      .split(/[\r\n,]+/)
      .map((k) => k.trim())
      .filter(Boolean);
  }
}

async function getProxies(): Promise<string[]> {
  try {
    const dbSetting = await prisma.appSetting.findUnique({
      where: { key: "AI_PROXIES" },
    });
    const rawProxies =
      dbSetting?.value?.trim() ||
      process.env.AI_PROXIES ||
      process.env.ROTATING_PROXY_URL ||
      process.env.AI_PROXY ||
      process.env.HTTPS_PROXY ||
      process.env.HTTP_PROXY ||
      "";
    return rawProxies
      .split(/[\r\n,]+/)
      .map((p) => p.trim())
      .filter(Boolean);
  } catch {
    const envProxies =
      process.env.AI_PROXIES ||
      process.env.ROTATING_PROXY_URL ||
      process.env.AI_PROXY ||
      process.env.HTTPS_PROXY ||
      process.env.HTTP_PROXY ||
      "";
    return envProxies
      .split(/[\r\n,]+/)
      .map((p) => p.trim())
      .filter(Boolean);
  }
}

async function getNextKey(keys: string[], attemptOffset = 0): Promise<{ key: string; index: number }> {
  if (keys.length === 0) return { key: "", index: -1 };
  if (keys.length === 1) return { key: keys[0], index: 0 };

  try {
    const record = await prisma.appSetting.findUnique({
      where: { key: "AI_KEY_ROTATING_COUNTER" },
    });
    const currentVal = record ? parseInt(record.value, 10) || 0 : 0;
    const assignedIndex = (currentVal + attemptOffset) % keys.length;

    // Tăng bộ đếm cho request tiếp theo để phân tán tải đều (Round-Robin per Request)
    if (attemptOffset === 0) {
      const nextVal = (currentVal + 1) % keys.length;
      await prisma.appSetting
        .upsert({
          where: { key: "AI_KEY_ROTATING_COUNTER" },
          update: { value: String(nextVal) },
          create: { key: "AI_KEY_ROTATING_COUNTER", value: String(nextVal) },
        })
        .catch(() => {});
    }

    return { key: keys[assignedIndex], index: assignedIndex };
  } catch {
    const idx = (currentKeyIndex + attemptOffset) % keys.length;
    if (attemptOffset === 0) {
      currentKeyIndex = (currentKeyIndex + 1) % keys.length;
    }
    return { key: keys[idx], index: idx };
  }
}

function getNextProxy(proxies: string[]): string | null {
  if (proxies.length === 0) return null;
  const index = currentProxyIndex % proxies.length;
  currentProxyIndex = (currentProxyIndex + 1) % proxies.length;
  return proxies[index];
}

function buildSystemInstruction(tone: string = "telegram", type: "description" | "warranty" = "description"): string {
  if (type === "warranty") {
    return `Bạn là chuyên gia soạn thảo chính sách bảo hành và cam kết dịch vụ cho hệ thống RINQ SHOP.
Nhiệm vụ: Viết chính sách bảo hành ngắn gọn, rõ ràng, minh bạch cho sản phẩm tài nguyên số (API key, tài khoản, hotmail OAuth, phần mềm...).
Quy tắc quan trọng:
1. TUYỆT ĐỐI KHÔNG dùng emoji trang trí (không 🚀, không ✨, không 🛒, v.v.).
2. Dùng tiếng Việt chuẩn mực, có dấu chuẩn xác 100%, gãy gọn.
3. Nội dung bao gồm 2 đến 4 ý cốt lõi:
   - Phạm vi bảo hành (lỗi kết nối, key không hoạt động, lỗi server nguồn).
   - Thời hạn bảo hành (VD: trong 1 giờ đầu, 24 giờ, 3 ngày, hoặc suốt hạn sử dụng của gói).
   - Điều kiện từ chối (tự ý thay đổi thông tin/mật khẩu, dùng sai mục đích).
4. Chỉ trả về nội dung chính sách bảo hành dạng các gạch đầu dòng (-) hoặc đoạn ngắn, KHÔNG thêm lời chào hay giải thích ngoài lề.`;
  }

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
   - Chính sách bảo hành & Hỗ trợ
5. Nếu trong văn bản có thông tin hoặc đường dẫn hướng dẫn sử dụng (VD: link /guides/... hoặc link web), hãy giữ lại gọn gàng ở mục ghi chú hoặc mục <b>Hướng dẫn sử dụng:</b> để khách hàng dễ truy cập.`;

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
  if (options.type === "warranty") {
    return `• Bảo hành 1 đổi 1 nếu lỗi từ nhà cung cấp hoặc server nguồn trong thời hạn sử dụng.\n• Hỗ trợ kỹ thuật 24/7 trực tiếp qua admin.\n• Không bảo hành trường hợp tự ý thay đổi thông tin/mật khẩu hoặc vi phạm quy định dịch vụ.`;
  }

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
  const keys = await getApiKeys();
  const proxies = await getProxies();

  if (keys.length === 0) {
    return {
      rewrittenText: localFormatFallback(options),
      model: "local-rule-formatter",
      keyIndexUsed: 0,
      totalKeys: 0,
      keyMasked: "Nội bộ",
      proxyUsed: null,
    };
  }

  const systemInstruction = buildSystemInstruction(options.tone, options.type);
  const prompt =
    options.type === "warranty"
      ? `Tên sản phẩm: ${options.productName || "Tài nguyên công nghệ"}\nDanh mục: ${
          options.category || "Công nghệ"
        }\nThông tin bảo hành hiện tại hoặc ghi chú:\n"""\n${options.text.trim()}\n"""\n\nHãy soạn thảo một chính sách bảo hành ngắn gọn (2-4 gạch đầu dòng), rõ ràng, minh bạch cho sản phẩm này.`
      : `Tên sản phẩm: ${options.productName || "Sản phẩm công nghệ"}\nDanh mục: ${
          options.category || "Công nghệ"
        }\nNội dung gốc cần viết lại:\n"""\n${options.text.trim()}\n"""\n\nHãy viết lại mô tả sản phẩm trên theo đúng phong cách và quy tắc đã hướng dẫn. Chỉ trả về nội dung hoàn chỉnh, không thêm lời chào, không thêm giải thích ngoài lề.`;

  const CANDIDATE_MODELS = [
    "gemini-flash-latest",
    "gemini-3.8-flash",
    "gemini-3.1-flash-lite",
  ];

  let lastError: Error | null = null;
  const maxAttempts = Math.min(keys.length * 2, 6);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { key, index: keyIdx } = await getNextKey(keys, attempt);
    const proxyUrl = getNextProxy(proxies);

    for (const model of CANDIDATE_MODELS) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
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
            "x-goog-api-key": key,
          },
          body: JSON.stringify(requestBody),
        };

        if (proxyUrl) {
          fetchOptions.dispatcher = new ProxyAgent(proxyUrl);
        }

        const response = await fetch(endpoint, fetchOptions);

        if (!response.ok) {
          const errorText = await response.text();
          if (response.status === 404 || response.status === 503) {
            console.warn(`[AI Rewrite] Model ${model} (Key #${keyIdx + 1}) trả về [${response.status}], thử model tiếp...`);
            continue;
          }
          throw new Error(`Gemini API error [${response.status}]: ${errorText.slice(0, 300)}`);
        }

        const data = await response.json();
        const candidateText =
          data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

        if (!candidateText) {
          throw new Error("Không nhận được nội dung từ mô hình AI");
        }

        // Sanitize: enforce no decorative emojis
        let cleanedText = candidateText
          .replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
          .replace(/\n{3,}/g, "\n\n")
          .trim();

        return {
          rewrittenText: cleanedText,
          model,
          keyIndexUsed: keyIdx + 1,
          totalKeys: keys.length,
          keyMasked: key.length > 8 ? `...${key.slice(-6)}` : `Key #${keyIdx + 1}`,
          proxyUsed: proxyUrl,
        };
      } catch (err: any) {
        lastError = err;
        console.warn(`[AI Rewrite] Lần thử ${attempt + 1} thất bại (Key #${keyIdx + 1}, Model: ${model}, Proxy: ${proxyUrl || "direct"}):`, err?.message);
      }
    }
  }

  // Nếu đã cấu hình key mà tất cả đều lỗi, báo lỗi thật thay vì giả mạo thành công
  throw new Error(`Không thể kết nối AI (${lastError?.message || "Lỗi kết nối hoặc API Key"})`);
}
