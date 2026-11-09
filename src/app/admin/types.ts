export interface Product {
  id: number;
  name: string;
  price: number;
  description: string | null;
  category: string | null;
  warranty?: string | null;
  priceNote?: string | null;
  imageUrl?: string | null;
  supplierVariantId?: string | null;
  fulfillmentType?: string | null;
  retailMarginPercent?: number;
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
  status: "PENDING" | "PROCESSING" | "PAID_PENDING_FULFILLMENT" | "PAID" | "EXPIRED" | "CANCELLED";
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
  fulfillmentPendingOrders?: number;
  totalStockAvailable: number;
  totalStockSold: number;
  subscriberCount?: number;
}

export interface Coupon {
  id: number;
  code: string;
  discount: number;
  isPercent: number | boolean;
  maxUsage: number;
  usedCount: number;
  isActive: number | boolean;
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

export interface Customer {
  id: string;
  username: string | null;
  firstName: string | null;
  balance?: number;
  createdAt: string;
  orderCount: number;
  paidOrderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  source: "telegram" | "order";
}

