/**
 * Order State Machine Hook
 * 
 * Manages order lifecycle states and transitions.
 * See docs/phase3/index.md for implementation details.
 */

import { useReducer, useCallback } from "react";

export type OrderState = 
  | "draft"           // Initial, user editing
  | "pending"         // Submitted, waiting for exchange
  | "open"            // Accepted by exchange, in orderbook
  | "partially_filled" // Some quantity filled
  | "filled"          // Complete fill
  | "cancel_pending"  // Cancel request sent
  | "cancelled"       // Confirmed cancelled
  | "rejected";       // Exchange rejected

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
  state: OrderState;
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
  submitOrder: (order: Omit<Order, "id" | "state" | "filledSize" | "createdAt" | "updatedAt">) => string;
  cancelOrder: (orderId: string) => void;
  getOrder: (orderId: string) => Order | undefined;
  getOrdersByState: (state: OrderState) => Order[];
}

// State transition table
const transitions: Record<OrderState, Partial<Record<OrderEvent["type"], OrderState>>> = {
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

function orderReducer(state: Order, event: OrderEvent): Order {
  const currentTransitions = transitions[state.state];
  const nextState = currentTransitions?.[event.type];

  if (!nextState) {
    console.warn(`Invalid transition: ${state.state} -> ${event.type}`);
    return state;
  }

  const updates: Partial<Order> = { state: nextState, updatedAt: Date.now() };

  switch (event.type) {
    case "ACCEPTED":
      updates.id = event.orderId;
      break;
    case "FILL":
      updates.filledSize = event.filledSize;
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

function ordersReducer(state: Order[], action: OrderEvent & { orderId: string }): Order[] {
  const index = state.findIndex(o => o.id === action.orderId);
  if (index === -1) return state;

  const newState = [...state];
  newState[index] = orderReducer(state[index], action);
  return newState;
}

export function useOrderStateMachine(): OrderStateMachine {
  const [orders, dispatch] = useReducer(ordersReducer, []);

  const submitOrder = useCallback((order: Omit<Order, "id" | "state" | "filledSize" | "createdAt" | "updatedAt">): string => {
    const id = Math.random().toString(36).substr(2, 9);
    const newOrder: Order = {
      ...order,
      id,
      state: "draft",
      filledSize: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    dispatch({ type: "SUBMIT", orderId: id });
    return id;
  }, [dispatch]);

  const cancelOrder = useCallback((orderId: string) => {
    dispatch({ type: "CANCEL", orderId });
  }, [dispatch]);

  const getOrder = useCallback((orderId: string) => {
    return orders.find(o => o.id === orderId);
  }, [orders]);

  const getOrdersByState = useCallback((state: OrderState) => {
    return orders.filter(o => o.state === state);
  }, [orders]);

  return {
    orders,
    dispatch,
    submitOrder,
    cancelOrder,
    getOrder,
    getOrdersByState,
  };
}

export { transitions };
