/**
 * Order State Machine Hook
 *
 * Manages order lifecycle states and transitions.
 * See docs/phase3/index.md for implementation details.
 */

import { useCallback, useReducer } from "react";

export type OrderStatus =
  | "draft"
  | "pending"
  | "open"
  | "partially_filled"
  | "filled"
  | "cancel_pending"
  | "cancelled"
  | "rejected";

export type OrderEvent =
  | { type: "SUBMIT" }
  | { type: "ACCEPTED"; orderId: string }
  | { type: "FILL"; filledSize: number; totalSize: number }
  | { type: "CANCEL" }
  | { type: "CANCELLED" }
  | { type: "REJECTED"; reason: string }
  | { type: "RESET" };

export interface Order {
  id: string;
  exchangeOrderId?: string;
  state: OrderStatus;
  side: "buy" | "sell";
  size: number;
  filledSize: number;
  price: number;
  type: "market" | "limit";
  createdAt: number;
  updatedAt: number;
  rejectReason?: string;
}

interface OrderStateMachine {
  orders: Order[];
  dispatch: React.Dispatch<OrderEvent & { orderId: string }>;
  submitOrder: (
    order: Omit<Order, "id" | "state" | "filledSize" | "createdAt" | "updatedAt">
  ) => string;
  addDraftOrder: (
    order: Omit<Order, "id" | "state" | "filledSize" | "createdAt" | "updatedAt">
  ) => string;
  cancelOrder: (orderId: string) => void;
  getOrder: (orderId: string) => Order | undefined;
  getOrdersByState: (state: OrderStatus) => Order[];
}

export const transitions: Record<OrderStatus, Partial<Record<OrderEvent["type"], OrderStatus>>> = {
  draft: {
    SUBMIT: "pending",
  },
  pending: {
    ACCEPTED: "open",
    REJECTED: "rejected",
    CANCEL: "cancel_pending",
  },
  open: {
    FILL: "partially_filled",
    CANCEL: "cancel_pending",
  },
  partially_filled: {
    FILL: "filled",
    CANCEL: "cancel_pending",
  },
  filled: {},
  cancel_pending: {
    CANCELLED: "cancelled",
  },
  cancelled: {},
  rejected: {
    RESET: "draft",
  },
};

export const createDraftOrder = (
  order: Omit<Order, "id" | "state" | "filledSize" | "createdAt" | "updatedAt">
): Order => {
  const now = Date.now();
  return {
    ...order,
    id: Math.random().toString(36).slice(2, 11),
    state: "draft",
    filledSize: 0,
    createdAt: now,
    updatedAt: now,
  };
};

export function orderReducer(state: Order, event: OrderEvent): Order {
  const nextState = transitions[state.state]?.[event.type];

  if (!nextState) {
    return state;
  }

  const updates: Partial<Order> = {
    state: nextState,
    updatedAt: Date.now(),
  };

  switch (event.type) {
    case "ACCEPTED":
      updates.exchangeOrderId = event.orderId;
      break;
    case "FILL":
      updates.filledSize = Math.min(event.filledSize, event.totalSize);
      if (event.filledSize >= event.totalSize) {
        updates.state = "filled";
      }
      break;
    case "REJECTED":
      updates.rejectReason = event.reason;
      break;
  }

  return { ...state, ...updates };
}

type OrderAction =
  | { type: "ADD"; order: Order }
  | ({ orderId: string } & OrderEvent);

function ordersReducer(state: Order[], action: OrderAction): Order[] {
  if (action.type === "ADD") {
    return [action.order, ...state];
  }

  const index = state.findIndex((order) => order.id === action.orderId);
  if (index === -1) return state;

  const next = [...state];
  next[index] = orderReducer(state[index], action);
  return next;
}

export function useOrderStateMachine(): OrderStateMachine {
  const [orders, dispatch] = useReducer(ordersReducer, []);

  const addDraftOrder = useCallback(
    (
      order: Omit<Order, "id" | "state" | "filledSize" | "createdAt" | "updatedAt">
    ) => {
      const draftOrder = createDraftOrder(order);
      dispatch({ type: "ADD", order: draftOrder });
      return draftOrder.id;
    },
    []
  );

  const submitOrder = useCallback(
    (
      order: Omit<Order, "id" | "state" | "filledSize" | "createdAt" | "updatedAt">
    ) => {
      const id = addDraftOrder(order);
      dispatch({ type: "SUBMIT", orderId: id });
      return id;
    },
    [addDraftOrder]
  );

  const cancelOrder = useCallback((orderId: string) => {
    dispatch({ type: "CANCEL", orderId });
  }, []);

  const getOrder = useCallback(
    (orderId: string) => orders.find((order) => order.id === orderId),
    [orders]
  );

  const getOrdersByState = useCallback(
    (state: OrderStatus) => orders.filter((order) => order.state === state),
    [orders]
  );

  return {
    orders,
    dispatch: dispatch as React.Dispatch<OrderEvent & { orderId: string }>,
    submitOrder,
    addDraftOrder,
    cancelOrder,
    getOrder,
    getOrdersByState,
  };
}
