import { create } from "zustand";
import { listOpenOrders } from "@/services/apiClient/positions.api";
import type { TradeOrder } from "@/components/trade-form/TradeForm";

export type OrderSide = "buy" | "sell";
export type OrderType = "limit" | "market" | "stop";
export type OrderLifecycleStatus =
  | "pending"
  | "open"
  | "partially_filled"
  | "filled"
  | "cancel_pending"
  | "cancelled"
  | "rejected";

export type Order = {
  id: string;
  exchangeOrderId?: string;
  market: string;
  side: OrderSide;
  type: OrderType;
  price: number;
  size: number;
  status: OrderLifecycleStatus;
  filledSize: number;
  createdAt: number;
  updatedAt: number;
  rejectReason?: string;
  source: "api" | "optimistic";
};

type OrdersState = {
  openOrders: Order[];
  isLoading: boolean;
  error: string | null;
  setOpenOrders: (orders: Order[]) => void;
  upsertOrder: (order: Order) => void;
  removeOrder: (id: string) => void;
  createOptimisticOrder: (order: TradeOrder, referencePrice?: number) => string;
  acknowledgeOrder: (localOrderId: string, exchangeOrderId: string) => void;
  rejectOrder: (localOrderId: string, reason: string) => void;
  markOrderCancelled: (localOrderId: string) => void;
  markOrderFill: (localOrderId: string, filledSize: number) => void;
  fetchOrders: () => Promise<void>;
};

const now = () => Date.now();

const normalizeOrderStatus = (status: string): OrderLifecycleStatus => {
  switch (status) {
    case "partial":
      return "partially_filled";
    case "canceled":
      return "cancelled";
    case "filled":
      return "filled";
    default:
      return "open";
  }
};

const createTimestampedOrder = (order: Omit<Order, "createdAt" | "updatedAt">): Order => ({
  ...order,
  createdAt: now(),
  updatedAt: now(),
});

const seedOrders: Order[] = [
  createTimestampedOrder({
    id: "ord-btc-1",
    exchangeOrderId: "ex-btc-1",
    market: "BTC-USD",
    side: "buy",
    type: "limit",
    price: 94750,
    size: 0.12,
    status: "open",
    filledSize: 0,
    source: "api",
  }),
  createTimestampedOrder({
    id: "ord-eth-1",
    exchangeOrderId: "ex-eth-1",
    market: "ETH-USD",
    side: "sell",
    type: "limit",
    price: 4888,
    size: 2,
    status: "partially_filled",
    filledSize: 0.65,
    source: "api",
  }),
  createTimestampedOrder({
    id: "ord-strk-1",
    exchangeOrderId: "ex-strk-1",
    market: "STRK-USD",
    side: "buy",
    type: "stop",
    price: 2.2,
    size: 900,
    status: "open",
    filledSize: 0,
    source: "api",
  }),
];

const updateOrder = (
  orders: Order[],
  id: string,
  updater: (order: Order) => Order
) => orders.map((order) => (order.id === id ? updater(order) : order));

const nextOptimisticId = () => `local-${Math.random().toString(36).slice(2, 10)}`;

function resolveWorkingStatus(order: Order) {
  if (order.filledSize >= order.size) return "filled" as const;
  if (order.filledSize > 0) return "partially_filled" as const;
  return "open" as const;
}

function canAcknowledge(order: Order) {
  return order.status === "pending";
}

function canReject(order: Order) {
  return order.status === "pending" || order.status === "cancel_pending";
}

function canCancel(order: Order) {
  return ["pending", "open", "partially_filled", "cancel_pending"].includes(order.status);
}

function canFill(order: Order) {
  return ["pending", "open", "partially_filled", "cancel_pending"].includes(order.status);
}

export const useOrdersStore = create<OrdersState>()((set) => ({
  openOrders: seedOrders,
  isLoading: false,
  error: null,

  setOpenOrders: (orders) => set({ openOrders: orders }),

  upsertOrder: (order) =>
    set((state) => {
      const existingIndex = state.openOrders.findIndex((item) => item.id === order.id);
      if (existingIndex === -1) {
        return { openOrders: [order, ...state.openOrders].slice(0, 50) };
      }

      const next = [...state.openOrders];
      next[existingIndex] = order;
      return { openOrders: next };
    }),

  removeOrder: (id) =>
    set((state) => ({ openOrders: state.openOrders.filter((order) => order.id !== id) })),

  createOptimisticOrder: (order, referencePrice) => {
    const numericPrice =
      order.type === "market"
        ? referencePrice ?? 0
        : Number(order.type === "stop" ? order.stopPrice : order.price) || 0;
    const optimisticOrder: Order = {
      id: nextOptimisticId(),
      market: order.market,
      side: order.side,
      type: order.type,
      price: numericPrice,
      size: Number(order.size) || 0,
      status: "pending",
      filledSize: 0,
      source: "optimistic",
      createdAt: now(),
      updatedAt: now(),
    };

    set((state) => ({
      openOrders: [optimisticOrder, ...state.openOrders].slice(0, 50),
    }));

    return optimisticOrder.id;
  },

  acknowledgeOrder: (localOrderId, exchangeOrderId) =>
    set((state) => ({
      openOrders: updateOrder(state.openOrders, localOrderId, (order) => ({
        ...order,
        exchangeOrderId: canAcknowledge(order) ? exchangeOrderId : order.exchangeOrderId,
        status: canAcknowledge(order) ? resolveWorkingStatus(order) : order.status,
        updatedAt: canAcknowledge(order) ? now() : order.updatedAt,
      })),
    })),

  rejectOrder: (localOrderId, reason) =>
    set((state) => ({
      openOrders: updateOrder(state.openOrders, localOrderId, (order) => ({
        ...order,
        status: canReject(order) ? "rejected" : order.status,
        rejectReason: canReject(order) ? reason : order.rejectReason,
        updatedAt: canReject(order) ? now() : order.updatedAt,
      })),
    })),

  markOrderCancelled: (localOrderId) =>
    set((state) => ({
      openOrders: updateOrder(state.openOrders, localOrderId, (order) => ({
        ...order,
        status: canCancel(order) ? "cancelled" : order.status,
        updatedAt: canCancel(order) ? now() : order.updatedAt,
      })),
    })),

  markOrderFill: (localOrderId, filledSize) =>
    set((state) => ({
      openOrders: updateOrder(state.openOrders, localOrderId, (order) => {
        if (!canFill(order)) {
          return order;
        }
        const nextFilled = Math.min(Math.max(order.filledSize, filledSize), order.size);
        return {
          ...order,
          filledSize: nextFilled,
          status: nextFilled >= order.size ? "filled" : "partially_filled",
          updatedAt: now(),
        };
      }),
    })),

  fetchOrders: async () => {
    set({ isLoading: true, error: null });
    try {
      const orders = await listOpenOrders();
      const mapped: Order[] = orders.map((order) => ({
        id: order.id,
        exchangeOrderId: order.id,
        market: order.market,
        side: order.side,
        type: order.type,
        price: Number(order.price),
        size: Number(order.size),
        status: normalizeOrderStatus(order.status),
        filledSize: order.status === "partial" ? Number(order.size) * 0.5 : 0,
        createdAt: now(),
        updatedAt: now(),
        source: "api",
      }));
      set({
        openOrders: mapped.length > 0 ? mapped : seedOrders,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to fetch orders",
      });
    }
  },
}));
