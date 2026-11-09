/**
 * RINQ SHOP - Quản lý & Chuẩn hóa Danh mục Sản phẩm
 */

export interface StandardCategory {
  name: string;
  slug: string;
  icon: string;
  priority: number;
  description: string;
}

export const STANDARD_CATEGORIES: StandardCategory[] = [
  {
    name: "AI & Trí tuệ nhân tạo",
    slug: "ai",
    icon: "🤖",
    priority: 1,
    description: "ChatGPT, Claude, Midjourney, Cursor, Copilot, Perplexity...",
  },
  {
    name: "Giải trí & Streaming",
    slug: "entertainment",
    icon: "🎬",
    priority: 2,
    description: "Netflix, YouTube Premium, Spotify, Discord Nitro, Telegram Premium...",
  },
  {
    name: "Đồ họa & Sáng tạo",
    slug: "design",
    icon: "🎨",
    priority: 3,
    description: "Canva Pro, Adobe Creative Cloud, CapCut Pro, Freepik, Figma...",
  },
  {
    name: "Văn phòng & Công việc",
    slug: "office",
    icon: "💼",
    priority: 4,
    description: "Microsoft 365, Google Drive / One, Notion, Zoom Pro...",
  },
  {
    name: "Mạng & Bảo mật",
    slug: "security",
    icon: "🛡️",
    priority: 5,
    description: "VPN, 1.1.1.1 WARP+, Key Windows & Office bản quyền...",
  },
  {
    name: "Học tập & Ngoại ngữ",
    slug: "education",
    icon: "📚",
    priority: 6,
    description: "Duolingo Super, Elsa Speak, Coursera, Udemy, Grammarly...",
  },
  {
    name: "Dịch vụ & Tiện ích khác",
    slug: "other",
    icon: "📦",
    priority: 99,
    description: "Các sản phẩm, tài khoản và dịch vụ số khác...",
  },
];

const CATEGORY_MAP: Record<string, { icon: string; priority: number }> = Object.fromEntries(
  STANDARD_CATEGORIES.map((c) => [c.name, { icon: c.icon, priority: c.priority }])
);

/**
 * Lấy icon tương ứng cho danh mục
 */
export function getCategoryIcon(categoryName?: string | null): string {
  if (!categoryName) return "📦";
  const trimmed = categoryName.trim();
  if (CATEGORY_MAP[trimmed]) return CATEGORY_MAP[trimmed].icon;

  const lower = trimmed.toLowerCase();
  if (lower.includes("ai") || lower.includes("gpt") || lower.includes("claude")) return "🤖";
  if (lower.includes("giải trí") || lower.includes("phim") || lower.includes("nhạc") || lower.includes("stream")) return "🎬";
  if (lower.includes("đồ họa") || lower.includes("thiết kế") || lower.includes("canva") || lower.includes("adobe")) return "🎨";
  if (lower.includes("văn phòng") || lower.includes("office") || lower.includes("drive")) return "💼";
  if (lower.includes("bảo mật") || lower.includes("vpn") || lower.includes("key")) return "🛡️";
  if (lower.includes("học") || lower.includes("ngoại ngữ") || lower.includes("duo")) return "📚";
  return "📁";
}

/**
 * Lấy độ ưu tiên sắp xếp (số càng nhỏ hiển thị càng trước)
 */
export function getCategoryPriority(categoryName?: string | null): number {
  if (!categoryName) return 999;
  const trimmed = categoryName.trim();
  if (CATEGORY_MAP[trimmed]) return CATEGORY_MAP[trimmed].priority;
  return 50;
}

/**
 * Tự động phân loại danh mục thông minh dựa vào tên và category từ nhà cung cấp
 */
export function categorizeProductName(name: string, rawCategory?: string | null): string {
  const text = `${rawCategory || ""} ${name}`.toLowerCase();

  // 1. AI & Trí tuệ nhân tạo
  if (
    /chatgpt|openai|gpt-?4|claude|midjourney|perplexity|cursor|copilot|gemini|leonardo|elevenlabs|poe|suno|udio|runway|deepseek/i.test(
      text
    )
  ) {
    return "AI & Trí tuệ nhân tạo";
  }

  // 2. Giải trí & Streaming
  if (
    /netflix|youtube|spotify|discord|nitro|telegram\s*premium|apple\s*music|tidal|hulu|disney|prime\s*video|vieon|fpt\s*play|galaxy\s*play/i.test(
      text
    )
  ) {
    return "Giải trí & Streaming";
  }

  // 3. Đồ họa & Sáng tạo
  if (
    /canva|adobe|photoshop|illustrator|premiere|after\s*effects|lightroom|capcut|freepik|envato|figma|coreldraw/i.test(
      text
    )
  ) {
    return "Đồ họa & Sáng tạo";
  }

  // 4. Văn phòng & Công việc
  if (
    /office\s*365|microsoft\s*365|onedrive|google\s*(drive|one)|notion|zoom|slack|trello|asana|evernote/i.test(
      text
    )
  ) {
    return "Văn phòng & Công việc";
  }

  // 5. Học tập & Ngoại ngữ
  if (
    /duolingo|elsa\s*speak|quizlet|grammarly|coursera|udemy|skillshare|edx|babbel|memrise|chegg/i.test(
      text
    )
  ) {
    return "Học tập & Ngoại ngữ";
  }

  // 6. Mạng & Bảo mật
  if (
    /vpn|expressvpn|nordvpn|surfshark|1\.1\.1\.1|warp\+|adguard|windows\s*(10|11)|win\s*(10|11)|kaspersky|malwarebytes/i.test(
      text
    )
  ) {
    return "Mạng & Bảo mật";
  }

  // Nếu rawCategory đã là một trong các danh mục chuẩn
  if (rawCategory && CATEGORY_MAP[rawCategory.trim()]) {
    return rawCategory.trim();
  }

  return rawCategory?.trim() || "Dịch vụ & Tiện ích khác";
}
