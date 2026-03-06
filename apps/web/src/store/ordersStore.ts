import { create } from "zustand";
import { listOpenOrders } from "@/services/apiClient/positions.api";

export type OrderSide = "buy" | "sell";
export type OrderType = "limit" | "market" | "stop";
export type OrderStatus = "open" | "partial" | "filled" | "canceled";

export type Order = {
  id: string;
  market: string;
  side: OrderSide;
  type: OrderType;
  price: number;
  size: number;
  status: OrderStatus;
};

type OrdersState = {
  openOrders: Order[];
  isLoading: boolean;
  error: string | null;
  setOpenOrders: (orders: Order[]) => void;
  upsertOrder: (order: Order) => void;
  removeOrder: (id: string) => void;
  fetchOrders: () => Promise<void>;
};

const seedOrders: Order[] = [
  {
    id: "ord-btc-1",
    market: "BTC-USD",
    side: "buy",
    type: "limit",
    price: 94750,
    size: 0.12,
    status: "open",
  },
  {
    id: "ord-eth-1",
    market: "ETH-USD",
    side: "sell",
    type: "limit",
    price: 4888,
    size: 2.0,
    status: "partial",
  },
  {
    id: "ord-strk-1",
    market: "STRK-USD",
    side: "buy",
    type: "stop",
    price: 2.2,
    size: 900,
    status: "open",
  },
];

export const useOrdersStore = create<OrdersState>()((set) => ({
  openOrders: seedOrders,
  isLoading: false,
  error: null,
  setOpenOrders: (orders) => set({ openOrders: orders }),
  upsertOrder: (order) =>
    set((state) => {
      const existingIndex = state.openOrders.findIndex((item) => item.id === order.id);
      if (existingIndex === -1) {
        return { openOrders: [order, ...state.openOrders] };
      }
      const next = [...state.openOrders];
      next[existingIndex] = order;
      return { openOrders: next };
    }),
  removeOrder: (id) =>
    set((state) => ({ openOrders: state.openOrders.filter((order) => order.id !== id) })),
  fetchOrders: async () => {
    set({ isLoading: true, error: null });
    try {
      const orders = await listOpenOrders();
      const mapped: Order[] = orders.map((o) => ({
        id: o.id,
        market: o.market,
        side: o.side,
        type: o.type,
        price: Number(o.price),
        size: Number(o.size),
        status: o.status as OrderStatus,
      }));
      set({ openOrders: mapped, isLoading: false });
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : "Failed to fetch orders" 
      });
    }
  },
}));
