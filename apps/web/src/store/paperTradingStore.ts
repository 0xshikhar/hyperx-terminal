import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Position } from "./positionsStore.js";
import type { Order } from "./ordersStore.js";

export interface PaperTradeRecord {
  id: string;
  market: string;
  side: "buy" | "sell";
  type: "market" | "limit";
  price: number;
  size: number;
  realizedPnl?: number;
  timestamp: number;
}

export interface PaperTradingState {
  balance: number; // Available virtual USDC cash
  positions: Position[];
  openOrders: Order[];
  tradeHistory: PaperTradeRecord[];

  // Actions
  executeOrder: (
    order: {
      market: string;
      side: "buy" | "sell";
      type: "market" | "limit" | "stop";
      size: string | number;
      price?: string | number;
      stopPrice?: string | number;
      leverage?: number;
    },
    referencePrice?: number
  ) => { orderId: string; status: "filled" | "open"; price: number };

  onPriceTick: (market: string, markPrice: number) => void;
  closePosition: (positionId: string, currentPrice?: number) => { realizedPnl: number };
  cancelOrder: (orderId: string) => void;
  resetAccount: () => void;
  faucet: (amount?: number) => void;
}

const INITIAL_BALANCE = 10000;

function computePnl(
  side: "long" | "short",
  entryPrice: number,
  markPrice: number,
  size: number,
  margin: number
) {
  const direction = side === "long" ? 1 : -1;
  const pnl = (markPrice - entryPrice) * size * direction;
  const pnlPercent = margin > 0 ? (pnl / margin) * 100 : 0;
  return { pnl, pnlPercent };
}

export const usePaperTradingStore = create<PaperTradingState>()(
  persist(
    (set, get) => ({
      balance: INITIAL_BALANCE,
      positions: [],
      openOrders: [],
      tradeHistory: [],

      executeOrder: (order, referencePrice) => {
        const sizeNum = Math.abs(Number(order.size) || 0);
        if (sizeNum <= 0) throw new Error("Order size must be greater than 0");

        const leverage = Math.max(1, order.leverage || 10);
        const state = get();

        // 1. MARKET ORDER
        if (order.type === "market") {
          const execPrice = referencePrice || Number(order.price) || 100;
          if (execPrice <= 0) throw new Error("Invalid market reference price");

          const reqMargin = (execPrice * sizeNum) / leverage;
          if (state.balance < reqMargin) {
            throw new Error(
              `Insufficient virtual balance: need $${reqMargin.toFixed(2)}, available $${state.balance.toFixed(2)}`
            );
          }

          const targetSide = order.side === "buy" ? "long" : "short";
          const existingIndex = state.positions.findIndex((p) => p.market === order.market);

          let nextPositions = [...state.positions];
          let nextBalance = state.balance - reqMargin;
          let realizedPnl = 0;

          if (existingIndex !== -1) {
            const existing = state.positions[existingIndex];
            if (existing.side === targetSide) {
              // Same side: Average entry price & increase size
              const totalSize = existing.size + sizeNum;
              const avgEntry =
                (existing.entryPrice * existing.size + execPrice * sizeNum) / totalSize;
              const totalMargin = existing.margin + reqMargin;
              const { pnl, pnlPercent } = computePnl(
                targetSide,
                avgEntry,
                execPrice,
                totalSize,
                totalMargin
              );

              nextPositions[existingIndex] = {
                ...existing,
                size: totalSize,
                entryPrice: avgEntry,
                markPrice: execPrice,
                margin: totalMargin,
                leverage,
                pnl,
                pnlPercent,
              };
            } else {
              // Opposite side: Reduce or flip
              if (sizeNum < existing.size) {
                // Partial close
                const closeRatio = sizeNum / existing.size;
                const closeMargin = existing.margin * closeRatio;
                realizedPnl = (execPrice - existing.entryPrice) * sizeNum * (existing.side === "long" ? 1 : -1);

                // Return original margin for this order plus the released position margin + PnL
                nextBalance = state.balance + closeMargin + realizedPnl;

                const remainingSize = existing.size - sizeNum;
                const remainingMargin = existing.margin - closeMargin;
                const { pnl, pnlPercent } = computePnl(
                  existing.side,
                  existing.entryPrice,
                  execPrice,
                  remainingSize,
                  remainingMargin
                );

                nextPositions[existingIndex] = {
                  ...existing,
                  size: remainingSize,
                  margin: remainingMargin,
                  markPrice: execPrice,
                  pnl,
                  pnlPercent,
                };
              } else if (sizeNum === existing.size) {
                // Exact full close
                realizedPnl = (execPrice - existing.entryPrice) * sizeNum * (existing.side === "long" ? 1 : -1);
                nextBalance = state.balance + existing.margin + realizedPnl;
                nextPositions.splice(existingIndex, 1);
              } else {
                // Flip position: Close existing and open remaining in new direction
                const closePnl = (execPrice - existing.entryPrice) * existing.size * (existing.side === "long" ? 1 : -1);
                const flipSize = sizeNum - existing.size;
                const flipMargin = (execPrice * flipSize) / leverage;

                realizedPnl = closePnl;
                nextBalance = state.balance + existing.margin + closePnl - flipMargin;

                nextPositions[existingIndex] = {
                  id: `paper-pos-${Date.now()}`,
                  market: order.market,
                  side: targetSide,
                  size: flipSize,
                  entryPrice: execPrice,
                  markPrice: execPrice,
                  leverage,
                  margin: flipMargin,
                  openedAt: new Date().toISOString(),
                  pnl: 0,
                  pnlPercent: 0,
                };
              }
            }
          } else {
            // New position
            const newPos: Position = {
              id: `paper-pos-${Date.now()}`,
              market: order.market,
              side: targetSide,
              size: sizeNum,
              entryPrice: execPrice,
              markPrice: execPrice,
              leverage,
              margin: reqMargin,
              openedAt: new Date().toISOString(),
              pnl: 0,
              pnlPercent: 0,
            };
            nextPositions.unshift(newPos);
          }

          const tradeRecord: PaperTradeRecord = {
            id: `paper-trade-${Date.now()}`,
            market: order.market,
            side: order.side,
            type: "market",
            price: execPrice,
            size: sizeNum,
            realizedPnl: realizedPnl !== 0 ? realizedPnl : undefined,
            timestamp: Date.now(),
          };

          set({
            balance: Math.max(0, nextBalance),
            positions: nextPositions,
            tradeHistory: [tradeRecord, ...state.tradeHistory].slice(0, 100),
          });

          return { orderId: tradeRecord.id, status: "filled", price: execPrice };
        }

        // 2. LIMIT ORDER
        const limitPrice = Number(order.type === "stop" ? order.stopPrice : order.price);
        if (!limitPrice || limitPrice <= 0) throw new Error("Invalid limit price");

        const reqMargin = (limitPrice * sizeNum) / leverage;
        if (state.balance < reqMargin) {
          throw new Error(
            `Insufficient virtual balance for limit order: need $${reqMargin.toFixed(2)}, available $${state.balance.toFixed(2)}`
          );
        }

        const limitOrder: Order = {
          id: `paper-ord-${Date.now()}`,
          exchangeOrderId: `paper-ord-${Date.now()}`,
          market: order.market,
          side: order.side,
          type: order.type,
          price: limitPrice,
          size: sizeNum,
          status: "open",
          filledSize: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          source: "optimistic",
        };

        set({
          balance: state.balance - reqMargin,
          openOrders: [limitOrder, ...state.openOrders],
        });

        return { orderId: limitOrder.id, status: "open", price: limitPrice };
      },

      onPriceTick: (market, markPrice) => {
        if (!markPrice || markPrice <= 0) return;
        const state = get();

        const hasPos = state.positions.some((p) => p.market === market);
        const hasOrder = state.openOrders.some((o) => o.market === market);
        if (!hasPos && !hasOrder) return;

        // 1. Update positions mark price & PnL
        let positionsChanged = false;
        const updatedPositions = state.positions.map((pos) => {
          if (pos.market !== market) return pos;
          if (Math.abs(pos.markPrice - markPrice) < 0.0001) return pos;
          positionsChanged = true;
          const { pnl, pnlPercent } = computePnl(pos.side, pos.entryPrice, markPrice, pos.size, pos.margin);
          return {
            ...pos,
            markPrice,
            pnl,
            pnlPercent,
          };
        });

        // 2. Check if any open limit orders can trigger fill
        const remainingOrders: Order[] = [];
        const triggeredOrders: Order[] = [];

        for (const order of state.openOrders) {
          if (order.market !== market) {
            remainingOrders.push(order);
            continue;
          }

          const isBuyFill = order.side === "buy" && markPrice <= order.price;
          const isSellFill = order.side === "sell" && markPrice >= order.price;

          if (isBuyFill || isSellFill) {
            triggeredOrders.push(order);
          } else {
            remainingOrders.push(order);
          }
        }

        if (positionsChanged || triggeredOrders.length > 0) {
          set({
            positions: updatedPositions,
            openOrders: remainingOrders,
          });

          // Fill triggered orders
          for (const ord of triggeredOrders) {
            try {
              // Order margin was already reserved when placed
              const returnedMargin = (ord.price * ord.size) / 10;
              set((s) => ({ balance: s.balance + returnedMargin }));
              get().executeOrder(
                {
                  market: ord.market,
                  side: ord.side,
                  type: "market",
                  size: ord.size,
                  price: ord.price,
                  leverage: 10,
                },
                markPrice
              );
            } catch {}
          }
        }
      },

      closePosition: (positionId, currentPrice) => {
        const state = get();
        const pos = state.positions.find((p) => p.id === positionId);
        if (!pos) return { realizedPnl: 0 };

        const execPrice = currentPrice || pos.markPrice;
        const direction = pos.side === "long" ? 1 : -1;
        const realizedPnl = (execPrice - pos.entryPrice) * pos.size * direction;
        const returnedFunds = Math.max(0, pos.margin + realizedPnl);

        const tradeRecord: PaperTradeRecord = {
          id: `paper-close-${Date.now()}`,
          market: pos.market,
          side: pos.side === "long" ? "sell" : "buy",
          type: "market",
          price: execPrice,
          size: pos.size,
          realizedPnl,
          timestamp: Date.now(),
        };

        set({
          balance: state.balance + returnedFunds,
          positions: state.positions.filter((p) => p.id !== positionId),
          tradeHistory: [tradeRecord, ...state.tradeHistory].slice(0, 100),
        });

        return { realizedPnl };
      },

      cancelOrder: (orderId) => {
        const state = get();
        const order = state.openOrders.find((o) => o.id === orderId);
        if (!order) return;

        const reservedMargin = (order.price * order.size) / 10;
        set({
          balance: state.balance + reservedMargin,
          openOrders: state.openOrders.filter((o) => o.id !== orderId),
        });
      },

      resetAccount: () => {
        set({
          balance: INITIAL_BALANCE,
          positions: [],
          openOrders: [],
          tradeHistory: [],
        });
      },

      faucet: (amount = 10000) => {
        set((s) => ({ balance: s.balance + amount }));
      },
    }),
    {
      name: "hyperx-paper-trading-v1",
      partialize: (state) => ({
        balance: state.balance,
        positions: state.positions,
        openOrders: state.openOrders,
        tradeHistory: state.tradeHistory,
      }),
    }
  )
);
