export interface GuideItem {
  slug: string;
  url: string;
  fullUrl: string;
  title: string;
  shortTitle: string;
  category: "Đối tác 1" | "Đối tác 2" | "Nexus & Mirai" | "Mail" | "AI API";
  partner: string;
  modelFamily: string;
  keywords: string[];
  summary: string;
}

export const GUIDES_CATALOG: GuideItem[] = [
  {
    slug: "doi-tac-1-claude",
    url: "/guides/doi-tac-1-claude",
    fullUrl: "https://rinqshop.vercel.app/guides/doi-tac-1-claude",
    title: "Hướng dẫn cấu hình Claude · Đối tác 1 (api.nghimmo.com)",
    shortTitle: "Claude · Đối tác 1 (Nghimmo)",
    category: "Đối tác 1",
    partner: "Đối tác 1 (Nghimmo)",
    modelFamily: "Claude",
    keywords: [
      "claude",
      "sonnet",
      "opus",
      "haiku",
      "fable",
      "anthropic",
      "nghimmo",
      "đối tác 1",
      "partner1",
      "partner1-claude",
      "claude code",
      "cline",
      "continue",
    ],
    summary:
      "Kết nối Claude Code CLI, Cline, Continue với Base URL https://api.nghimmo.com, model nghi/claude-sonnet-5.5.",
  },
  {
    slug: "doi-tac-1-codex",
    url: "/guides/doi-tac-1-codex",
    fullUrl: "https://rinqshop.vercel.app/guides/doi-tac-1-codex",
    title: "Hướng dẫn cấu hình Codex & GPT · Đối tác 1 (api.nghimmo.com)",
    shortTitle: "Codex & GPT · Đối tác 1 (Nghimmo)",
    category: "Đối tác 1",
    partner: "Đối tác 1 (Nghimmo)",
    modelFamily: "Codex & GPT",
    keywords: [
      "codex",
      "gpt",
      "gpt-5",
      "gpt-5.6",
      "gpt-5.5",
      "sol",
      "terra",
      "luna",
      "openai responses",
      "wire_api",
      "responses",
      "nghimmo",
      "đối tác 1",
      "partner1",
      "partner1-codex",
    ],
    summary:
      "Kết nối Codex CLI (wire_api = responses), Cline với Base URL https://api.nghimmo.com/v1 và model GPT-5.6 Sol / Terra.",
  },
  {
    slug: "doi-tac-2-claude",
    url: "/guides/doi-tac-2-claude",
    fullUrl: "https://rinqshop.vercel.app/guides/doi-tac-2-claude",
    title: "Hướng dẫn cấu hình Claude · Đối tác 2 (Workesim)",
    shortTitle: "Claude · Đối tác 2 (Workesim)",
    category: "Đối tác 2",
    partner: "Đối tác 2 (Workesim)",
    modelFamily: "Claude",
    keywords: [
      "claude",
      "sonnet 4.6",
      "sonnet 5",
      "opus 5.5",
      "fable 5.1",
      "workesim",
      "đối tác 2",
      "partner2",
      "vpnfast",
      "vpnfast-claude",
      "portal workesim",
      "đổi mã",
    ],
    summary:
      "Kích hoạt mã trên portal Workesim, nhận API key và cấu hình Claude Code, Cline với Base URL https://workesim.com.",
  },
  {
    slug: "doi-tac-2-deepseek",
    url: "/guides/doi-tac-2-deepseek",
    fullUrl: "https://rinqshop.vercel.app/guides/doi-tac-2-deepseek",
    title: "Hướng dẫn cấu hình DeepSeek Bypass · Đối tác 2 (Workesim)",
    shortTitle: "DeepSeek Bypass · Đối tác 2 (Workesim)",
    category: "Đối tác 2",
    partner: "Đối tác 2 (Workesim)",
    modelFamily: "DeepSeek",
    keywords: [
      "deepseek",
      "bypass",
      "jailbreak",
      "deepseek v4",
      "v4 flash",
      "v4 pro",
      "workesim",
      "đối tác 2",
      "vpnfast-deepseek",
    ],
    summary:
      "Kích hoạt mã nhận key DeepSeek trên portal Workesim, chọn model bypass không kiểm duyệt và cấu hình Cline / Continue.",
  },
  {
    slug: "qwen-agent",
    url: "/guides/qwen-agent",
    fullUrl: "https://rinqshop.vercel.app/guides/qwen-agent",
    title: "Hướng dẫn cấu hình Qwen Agent (NexusAPI)",
    shortTitle: "Qwen Agent (NexusAPI)",
    category: "Nexus & Mirai",
    partner: "NexusAPI",
    modelFamily: "Qwen",
    keywords: [
      "qwen",
      "qwen agent",
      "qwen3.8",
      "qwen-max",
      "nexus",
      "nexusapi",
      "nexus-qwen",
      "chu kỳ 5 giờ",
      "28m token",
    ],
    summary:
      "API key sử dụng trực tiếp, hạn 7 ngày từ lúc tạo, chu kỳ 28M token mỗi 5 giờ. Cấu hình OpenAI Compatible.",
  },
  {
    slug: "grok-api",
    url: "/guides/grok-api",
    fullUrl: "https://rinqshop.vercel.app/guides/grok-api",
    title: "Hướng dẫn cấu hình Grok API (NexusAPI)",
    shortTitle: "Grok API (NexusAPI)",
    category: "Nexus & Mirai",
    partner: "NexusAPI",
    modelFamily: "Grok",
    keywords: [
      "grok",
      "grok-4",
      "grok-4.6",
      "grok-4.5",
      "xai",
      "coding-agent",
      "nexus",
      "nexusapi",
      "nexus-grok",
    ],
    summary:
      "Cấu hình Grok 4.6 và Coding Agent cho Cline, Continue và lập trình độc lập qua OpenAI Compatible.",
  },
  {
    slug: "kimi-api",
    url: "/guides/kimi-api",
    fullUrl: "https://rinqshop.vercel.app/guides/kimi-api",
    title: "Hướng dẫn cấu hình Kimi API & K2D6 Reasoning",
    shortTitle: "Kimi API & K2D6 (NexusAPI)",
    category: "Nexus & Mirai",
    partner: "NexusAPI",
    modelFamily: "Kimi",
    keywords: [
      "kimi",
      "kimi-k3",
      "k2d6",
      "k2d6-thinking",
      "moonshot",
      "nexus",
      "nexusapi",
      "nexus-kimi",
    ],
    summary:
      "Cấu hình Kimi K3 và mô hình suy luận K2D6 Agent qua Base URL https://api.nexusapi.co/kimi/v1.",
  },
  {
    slug: "kimi-deepseek-mirai",
    url: "/guides/kimi-deepseek-mirai",
    fullUrl: "https://rinqshop.vercel.app/guides/kimi-deepseek-mirai",
    title: "Hướng dẫn kích hoạt & cấu hình Kimi / DeepSeek (Mirai API)",
    shortTitle: "Kimi & DeepSeek (Mirai API)",
    category: "Nexus & Mirai",
    partner: "Mirai API",
    modelFamily: "Kimi & DeepSeek",
    keywords: [
      "mirai",
      "miraiapi",
      "mr-",
      "kimi",
      "deepseek",
      "qwen",
      "glm",
      "hy3",
      "50m quota",
      "mirai-kimi-deepseek",
    ],
    summary:
      "Đổi mã MR- lấy 50M quota dùng chung trong 48 giờ, cấu hình Cline / Continue với Base URL https://api.miraiapi.com/v1.",
  },
  {
    slug: "read-mail-oauth",
    url: "/guides/read-mail-oauth",
    fullUrl: "https://rinqshop.vercel.app/guides/read-mail-oauth",
    title: "Hướng dẫn sử dụng Trình đọc mail OAuth & lấy mã OTP",
    shortTitle: "Đọc mail OAuth & Lấy OTP",
    category: "Mail",
    partner: "Hotmail / Outlook",
    modelFamily: "OAuth REST API",
    keywords: [
      "mail",
      "hotmail",
      "outlook",
      "oauth",
      "refresh token",
      "client id",
      "otp",
      "read mail",
      "đọc thư",
      "lấy otp",
    ],
    summary:
      "Cách nhập email|refreshToken|clientId, đọc thư HTML an toàn và trích xuất mã OTP một chạm.",
  },
  {
    slug: "mail-check-bulk",
    url: "/guides/mail-check-bulk",
    fullUrl: "https://rinqshop.vercel.app/guides/mail-check-bulk",
    title: "Hướng dẫn Lọc trùng & Kiểm tra Mail LIVE hàng loạt",
    shortTitle: "Lọc trùng & Check Mail LIVE",
    category: "Mail",
    partner: "Hotmail / Outlook",
    modelFamily: "Bulk Verification",
    keywords: [
      "mail check",
      "check mail",
      "lọc trùng",
      "mail live",
      "hotmail",
      "outlook",
      "hàng loạt",
      "bulk",
      "csv",
    ],
    summary:
      "Quy trình xử lý file danh sách lên tới 10.000 dòng: loại bỏ email trùng, kiểm tra OAuth và xuất CSV.",
  },
  {
    slug: "mail-rest-api",
    url: "/guides/mail-rest-api",
    fullUrl: "https://rinqshop.vercel.app/guides/mail-rest-api",
    title: "Tài liệu tích hợp REST API đọc mail vào Script / Bot",
    shortTitle: "REST API Đọc mail cho Dev",
    category: "Mail",
    partner: "Hotmail / Outlook",
    modelFamily: "REST API",
    keywords: [
      "rest api",
      "api mail",
      "curl",
      "python",
      "tự động hóa",
      "script",
      "bot mail",
      "endpoint",
    ],
    summary:
      "Hướng dẫn gọi trực tiếp API đọc thư một lần hoặc quản lý phiên kết nối bằng cURL và JSON.",
  },
];

export interface PredictResult {
  match: GuideItem | null;
  confidence: "high" | "medium" | "low" | "none";
  score: number;
  reason: string;
}

/**
 * Predict best matching guide for product name, description, category, and supplier variant ID
 */
export function predictGuideUrl(input: {
  name?: string;
  description?: string;
  category?: string;
  supplierVariantId?: string;
}): PredictResult {
  const combined = `${input.name || ""} ${input.description || ""} ${input.category || ""} ${
    input.supplierVariantId || ""
  }`.toLowerCase();

  let bestMatch: GuideItem | null = null;
  let highestScore = 0;
  let matchReason = "";

  for (const item of GUIDES_CATALOG) {
    let score = 0;
    const hitKeywords: string[] = [];

    // Exact partner / slug matches get huge weight
    if (combined.includes(item.slug)) {
      score += 50;
      hitKeywords.push(item.slug);
    }

    // Specific partner matches
    if (combined.includes("đối tác 1") || combined.includes("partner1") || combined.includes("nghimmo")) {
      if (item.category === "Đối tác 1") score += 30;
      else if (item.category === "Đối tác 2") score -= 20;
    }
    if (combined.includes("đối tác 2") || combined.includes("partner2") || combined.includes("workesim")) {
      if (item.category === "Đối tác 2") score += 30;
      else if (item.category === "Đối tác 1") score -= 20;
    }
    if (combined.includes("nexus") || combined.includes("nexusapi")) {
      if (item.partner.toLowerCase().includes("nexus")) score += 30;
    }
    if (combined.includes("mirai")) {
      if (item.slug === "kimi-deepseek-mirai") score += 40;
    }

    for (const kw of item.keywords) {
      const lowerKw = kw.toLowerCase();
      if (combined.includes(lowerKw)) {
        score += lowerKw.length > 5 ? 12 : 6;
        hitKeywords.push(kw);
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = item;
      matchReason = hitKeywords.slice(0, 4).join(", ");
    }
  }

  if (!bestMatch || highestScore < 10) {
    return {
      match: null,
      confidence: "none",
      score: 0,
      reason: "Không tìm thấy bài viết phù hợp",
    };
  }

  const confidence = highestScore >= 35 ? "high" : highestScore >= 18 ? "medium" : "low";
  return {
    match: bestMatch,
    confidence,
    score: highestScore,
    reason: `Khớp từ khóa: ${matchReason}`,
  };
}
