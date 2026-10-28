export interface Product {
  id: number;
  name: string;
  price: number;
  description: string | null;
  category: string | null;
  priceNote?: string | null;
  imageUrl?: string | null;
  supplierVariantId?: string | null;
  fulfillmentType?: string | null;
  isActive: boolean;
  createdAt: string;
  stockAvailable: number;
  stockSold: number;
  totalStock: number;
}

export interface Order {
  id: string;
  telegramId: string;
  username: string | null;
  productId: number;
  quantity?: number;
  totalAmount: number;
  status: "PENDING" | "PAID" | "EXPIRED";
  createdAt: string;
  paidAt: string | null;
  product?: {
    id: number;
    name: string;
    price: number;
  };
  stocks?: {
    id: number;
    data: string;
  }[];
}

export interface Stats {
  totalRevenue: number;
  totalOrders: number;
  paidOrders: number;
  pendingOrders: number;
  totalStockAvailable: number;
  totalStockSold: number;
  subscriberCount?: number;
}

export interface Coupon {
  id: number;
  code: string;
  discount: number;
  isPercent: number;
  maxUsage: number;
  usedCount: number;
  isActive: number;
  createdAt: string;
}

export interface Giveaway {
  id: number;
  title: string;
  reward: string;
  description: string | null;
  winnerCount: number;
  status: string;
  createdAt: string;
  participantCount?: number;
  winners?: {
    telegramId: string;
    username: string | null;
  }[];
}

