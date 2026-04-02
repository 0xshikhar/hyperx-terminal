import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Position } from "./positionsStore.js";
import type { Order } from "./ordersStore.js";

export interface PaperTradeRecord {
  id: string;
  market: string;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop" | "twap";
  price: number;
  size: number;
  realizedPnl?: number;
  timestamp: number;
}

export interface PaperOrderHistoryRecord {
  id: string;
  market: string;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop" | "twap";
  price: number;
  avgFillPrice?: number;
  size: number;
  filledSize: number;
  status: "filled" | "cancelled" | "rejected";
  timestamp: number;
  triggerCondition?: string;
}

export interface PaperFundingRecord {
  id: string;
  market: string;
  rate: number;
  payment: number;
  time: string;
}

export interface PaperTwapOrder {
  id: string;
  market: string;
  side: "buy" | "sell";
  totalSize: number;
  executedSize: number;
  remainingSize: number;
  sliceSize: number;
  totalSlices: number;
  executedSlices: number;
  intervalSeconds: number;
  durationMinutes: number;
  status: "running" | "completed" | "cancelled";
  createdAt: number;
  nextSliceAt: number;
  avgFillPrice?: number;
}

export interface PaperTradingState {
  balance: number; // Available virtual USDC cash
  positions: Position[];
  openOrders: Order[];
  tradeHistory: PaperTradeRecord[];
  orderHistory: PaperOrderHistoryRecord[];
  fundingHistory: PaperFundingRecord[];
  twapOrders: PaperTwapOrder[];

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

  createTwapOrder: (params: {
    market: string;
    side: "buy" | "sell";
    totalSize: number;
    intervalSeconds?: number;
    durationMinutes?: number;
    totalSlices?: number;
  }) => string;

  cancelTwapOrder: (twapId: string) => void;
  executeTwapSlice: (twapId: string, currentPrice: number) => void;

  onPriceTick: (market: string, markPrice: number) => void;
  closePosition: (positionId: string, currentPrice?: number) => { realizedPnl: number };
  partialClosePosition: (
    positionId: string,
    sizeToClose: number,
    targetPrice?: number,
    orderType?: "market" | "limit"
  ) => { realizedPnl: number; remainingSize: number };
  updatePositionTPSL: (positionId: string, takeProfit?: number, stopLoss?: number) => void;
  cancelOrder: (orderId: string) => void;
  cancelAllOrders: (market?: string) => { cancelledCount: number; refundedMargin: number };
  settleFundingPeriod: (market: string, fundingRate: number) => void;
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
      orderHistory: [],
      fundingHistory: [],
      twapOrders: [],

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

          const orderId = `paper-trade-${Date.now()}`;
          const tradeRecord: PaperTradeRecord = {
            id: orderId,
            market: order.market,
            side: order.side,
            type: "market",
            price: execPrice,
            size: sizeNum,
            realizedPnl: realizedPnl !== 0 ? realizedPnl : undefined,
            timestamp: Date.now(),
          };

          const orderHistoryRecord: PaperOrderHistoryRecord = {
            id: orderId,
            market: order.market,
            side: order.side,
            type: "market",
            price: execPrice,
            avgFillPrice: execPrice,
            size: sizeNum,
            filledSize: sizeNum,
            status: "filled",
            timestamp: Date.now(),
          };

          set({
            balance: Math.max(0, nextBalance),
            positions: nextPositions,
            tradeHistory: [tradeRecord, ...state.tradeHistory].slice(0, 100),
            orderHistory: [orderHistoryRecord, ...state.orderHistory].slice(0, 100),
          });

          return { orderId: tradeRecord.id, status: "filled", price: execPrice };
        }

        // 2. LIMIT OR STOP ORDER
        const targetPrice = Number(order.type === "stop" ? order.stopPrice : order.price);
        if (!targetPrice || targetPrice <= 0) throw new Error("Invalid order price");

        const reqMargin = (targetPrice * sizeNum) / leverage;
        if (state.balance < reqMargin) {
          throw new Error(
            `Insufficient virtual balance for order: need $${reqMargin.toFixed(2)}, available $${state.balance.toFixed(2)}`
          );
        }

        const uniqueId = `paper-ord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const limitOrder: Order = {
          id: uniqueId,
          exchangeOrderId: uniqueId,
          market: order.market,
          side: order.side,
          type: order.type,
          price: targetPrice,
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

        return { orderId: limitOrder.id, status: "open", price: targetPrice };
      },

      createTwapOrder: (params) => {
        const state = get();
        const totalSize = Math.abs(Number(params.totalSize) || 0);
        if (totalSize <= 0) throw new Error("TWAP size must be greater than 0");

        const intervalSeconds = Math.max(5, params.intervalSeconds || 15);
        const totalSlices = Math.max(2, params.totalSlices || 5);
        const durationMinutes = params.durationMinutes || Math.ceil((intervalSeconds * totalSlices) / 60);
        const sliceSize = Number((totalSize / totalSlices).toFixed(4));

        const twapId = `twap-${Date.now()}`;
        const newTwap: PaperTwapOrder = {
          id: twapId,
          market: params.market,
          side: params.side,
          totalSize,
          executedSize: 0,
          remainingSize: totalSize,
          sliceSize,
          totalSlices,
          executedSlices: 0,
          intervalSeconds,
          durationMinutes,
          status: "running",
          createdAt: Date.now(),
          nextSliceAt: Date.now() + 1000, // First slice fires soon
        };

        set({
          twapOrders: [newTwap, ...state.twapOrders],
        });

        return twapId;
      },

      cancelTwapOrder: (twapId) => {
        set((state) => ({
          twapOrders: state.twapOrders.map((t) =>
            t.id === twapId ? { ...t, status: "cancelled" } : t
          ),
        }));
      },

      executeTwapSlice: (twapId, currentPrice) => {
        const state = get();
        const twap = state.twapOrders.find((t) => t.id === twapId && t.status === "running");
        if (!twap) return;

        const currentSliceSize = Math.min(twap.sliceSize, twap.remainingSize);
        if (currentSliceSize <= 0) {
          set((s) => ({
            twapOrders: s.twapOrders.map((t) =>
              t.id === twapId ? { ...t, status: "completed" } : t
            ),
          }));
          return;
        }

        try {
          get().executeOrder(
            {
              market: twap.market,
              side: twap.side,
              type: "market",
              size: currentSliceSize,
              leverage: 10,
            },
            currentPrice
          );

          const nextExecutedSize = twap.executedSize + currentSliceSize;
          const nextRemaining = Math.max(0, twap.totalSize - nextExecutedSize);
          const nextExecutedSlices = twap.executedSlices + 1;
          const isComplete = nextRemaining <= 0 || nextExecutedSlices >= twap.totalSlices;

          set((s) => ({
            twapOrders: s.twapOrders.map((t) =>
              t.id === twapId
                ? {
                    ...t,
                    executedSize: nextExecutedSize,
                    remainingSize: nextRemaining,
                    executedSlices: nextExecutedSlices,
                    status: isComplete ? "completed" : "running",
                    nextSliceAt: Date.now() + t.intervalSeconds * 1000,
                  }
                : t
            ),
          }));
        } catch {
          // If insufficient balance, pause TWAP
          set((s) => ({
            twapOrders: s.twapOrders.map((t) =>
              t.id === twapId ? { ...t, status: "cancelled" } : t
            ),
          }));
        }
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

        // 2. Check if any open limit or stop orders can trigger fill
        const remainingOrders: Order[] = [];
        const triggeredOrders: Order[] = [];

        for (const order of state.openOrders) {
          if (order.market !== market) {
            remainingOrders.push(order);
            continue;
          }

          let isTriggered = false;
          if (order.type === "stop") {
            // Buy Stop triggers when mark price rises to or above stop
            // Sell Stop triggers when mark price drops to or below stop
            if (order.side === "buy") {
              isTriggered = markPrice >= order.price;
            } else {
              isTriggered = markPrice <= order.price;
            }
          } else {
            // Standard Limit order:
            // Buy Limit fills when market <= limit price
            // Sell Limit fills when market >= limit price
            const isBuyFill = order.side === "buy" && markPrice <= order.price;
            const isSellFill = order.side === "sell" && markPrice >= order.price;
            isTriggered = isBuyFill || isSellFill;
          }

          if (isTriggered) {
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

              // Record fill in orderHistory
              set((s) => ({
                orderHistory: [
                  {
                    id: ord.id,
                    market: ord.market,
                    side: ord.side as "buy" | "sell",
                    type: ord.type as "market" | "limit" | "stop" | "twap",
                    price: ord.price,
                    avgFillPrice: markPrice,
                    size: ord.size,
                    filledSize: ord.size,
                    status: "filled" as const,
                    timestamp: Date.now(),
                    triggerCondition: ord.type === "stop" ? `Triggered @ $${markPrice}` : undefined,
                  },
                  ...s.orderHistory,
                ].slice(0, 100),
              }));
            } catch {}
          }
        }

        // 3. Check for Take Profit / Stop Loss triggers on open positions
        const activePositions = get().positions;
        for (const pos of activePositions) {
          if (pos.market !== market) continue;

          // Take Profit Check
          if (pos.takeProfit && pos.takeProfit > 0) {
            const isTpReached =
              pos.side === "long" ? markPrice >= pos.takeProfit : markPrice <= pos.takeProfit;
            if (isTpReached) {
              get().closePosition(pos.id, markPrice);
              continue;
            }
          }

          // Stop Loss Check
          if (pos.stopLoss && pos.stopLoss > 0) {
            const isSlReached =
              pos.side === "long" ? markPrice <= pos.stopLoss : markPrice >= pos.stopLoss;
            if (isSlReached) {
              get().closePosition(pos.id, markPrice);
              continue;
            }
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

        const closeId = `paper-close-${Date.now()}`;
        const tradeRecord: PaperTradeRecord = {
          id: closeId,
          market: pos.market,
          side: pos.side === "long" ? "sell" : "buy",
          type: "market",
          price: execPrice,
          size: pos.size,
          realizedPnl,
          timestamp: Date.now(),
        };

        const orderHistoryRecord: PaperOrderHistoryRecord = {
          id: closeId,
          market: pos.market,
          side: pos.side === "long" ? "sell" : "buy",
          type: "market",
          price: execPrice,
          avgFillPrice: execPrice,
          size: pos.size,
          filledSize: pos.size,
          status: "filled",
          timestamp: Date.now(),
        };

        set({
          balance: state.balance + returnedFunds,
          positions: state.positions.filter((p) => p.id !== positionId),
          tradeHistory: [tradeRecord, ...state.tradeHistory].slice(0, 100),
          orderHistory: [orderHistoryRecord, ...state.orderHistory].slice(0, 100),
        });

        return { realizedPnl };
      },

      partialClosePosition: (positionId, sizeToClose, targetPrice, orderType = "market") => {
        const state = get();
        const pos = state.positions.find((p) => p.id === positionId);
        if (!pos) return { realizedPnl: 0, remainingSize: 0 };

        const validCloseSize = Math.min(pos.size, Math.max(0, Number(sizeToClose) || 0));
        if (validCloseSize <= 0) return { realizedPnl: 0, remainingSize: pos.size };

        // Full close if requested size meets or exceeds current position size
        if (validCloseSize >= pos.size) {
          const res = get().closePosition(positionId, targetPrice);
          return { realizedPnl: res.realizedPnl, remainingSize: 0 };
        }

        // Limit reduce-only order
        if (orderType === "limit" && targetPrice && targetPrice > 0) {
          const limitOrder: Order = {
            id: `paper-ord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            market: pos.market,
            side: pos.side === "long" ? "sell" : "buy",
            type: "limit",
            price: targetPrice,
            size: validCloseSize,
            status: "open",
            filledSize: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            source: "optimistic",
          };
          set((s) => ({
            openOrders: [limitOrder, ...s.openOrders],
          }));
          return { realizedPnl: 0, remainingSize: pos.size };
        }

        // Market partial close
        const execPrice = targetPrice || pos.markPrice;
        const direction = pos.side === "long" ? 1 : -1;
        const closeRatio = validCloseSize / pos.size;
        const marginToRelease = pos.margin * closeRatio;
        const realizedPnl = (execPrice - pos.entryPrice) * validCloseSize * direction;
        const returnedFunds = Math.max(0, marginToRelease + realizedPnl);

        const remainingSize = pos.size - validCloseSize;
        const remainingMargin = pos.margin - marginToRelease;
        const { pnl: nextPnl, pnlPercent: nextPnlPercent } = computePnl(
          pos.side,
          pos.entryPrice,
          execPrice,
          remainingSize,
          remainingMargin
        );

        const closeId = `paper-partial-${Date.now()}`;
        const tradeRecord: PaperTradeRecord = {
          id: closeId,
          market: pos.market,
          side: pos.side === "long" ? "sell" : "buy",
          type: "market",
          price: execPrice,
          size: validCloseSize,
          realizedPnl,
          timestamp: Date.now(),
        };

        const orderHistoryRecord: PaperOrderHistoryRecord = {
          id: closeId,
          market: pos.market,
          side: pos.side === "long" ? "sell" : "buy",
          type: "market",
          price: execPrice,
          avgFillPrice: execPrice,
          size: validCloseSize,
          filledSize: validCloseSize,
          status: "filled",
          timestamp: Date.now(),
        };

        set({
          balance: state.balance + returnedFunds,
          positions: state.positions.map((p) =>
            p.id === positionId
              ? {
                  ...p,
                  size: remainingSize,
                  margin: remainingMargin,
                  markPrice: execPrice,
                  pnl: nextPnl,
                  pnlPercent: nextPnlPercent,
                }
              : p
          ),
          tradeHistory: [tradeRecord, ...state.tradeHistory].slice(0, 100),
          orderHistory: [orderHistoryRecord, ...state.orderHistory].slice(0, 100),
        });

        return { realizedPnl, remainingSize };
      },

      updatePositionTPSL: (positionId, takeProfit, stopLoss) => {
        set((s) => ({
          positions: s.positions.map((p) =>
            p.id === positionId
              ? {
                  ...p,
                  takeProfit: takeProfit !== undefined ? (takeProfit > 0 ? takeProfit : undefined) : undefined,
                  stopLoss: stopLoss !== undefined ? (stopLoss > 0 ? stopLoss : undefined) : undefined,
                }
              : p
          ),
        }));
      },

      cancelOrder: (orderId) => {
        const state = get();
        const order = state.openOrders.find((o) => o.id === orderId);
        if (!order) return;

        const reservedMargin = (order.price * order.size) / 10;

        const cancelledHistoryRecord: PaperOrderHistoryRecord = {
          id: order.id,
          market: order.market,
          side: order.side as "buy" | "sell",
          type: order.type as "market" | "limit" | "stop" | "twap",
          price: order.price,
          size: order.size,
          filledSize: 0,
          status: "cancelled",
          timestamp: Date.now(),
        };

        set({
          balance: state.balance + reservedMargin,
          openOrders: state.openOrders.filter((o) => o.id !== orderId),
          orderHistory: [cancelledHistoryRecord, ...state.orderHistory].slice(0, 100),
        });
      },

      cancelAllOrders: (market) => {
        const state = get();
        const ordersToCancel = state.openOrders.filter((o) => !market || o.market === market);
        if (ordersToCancel.length === 0) {
          return { cancelledCount: 0, refundedMargin: 0 };
        }

        const toCancelIds = new Set(ordersToCancel.map((o) => o.id));
        let totalRefunded = 0;
        const cancelledRecords: PaperOrderHistoryRecord[] = [];

        for (const order of ordersToCancel) {
          const reservedMargin = (order.price * order.size) / 10;
          totalRefunded += reservedMargin;
          cancelledRecords.push({
            id: order.id,
            market: order.market,
            side: order.side as "buy" | "sell",
            type: order.type as "market" | "limit" | "stop" | "twap",
            price: order.price,
            size: order.size,
            filledSize: 0,
            status: "cancelled",
            timestamp: Date.now(),
          });
        }

        set({
          balance: state.balance + totalRefunded,
          openOrders: state.openOrders.filter((o) => !toCancelIds.has(o.id)),
          orderHistory: [...cancelledRecords, ...state.orderHistory].slice(0, 100),
        });

        return {
          cancelledCount: ordersToCancel.length,
          refundedMargin: totalRefunded,
        };
      },

      settleFundingPeriod: (market, fundingRate) => {
        const state = get();
        const matchingPositions = state.positions.filter((p) => p.market === market);
        if (matchingPositions.length === 0) return;

        let totalPayment = 0;
        for (const pos of matchingPositions) {
          // Payment = -1 * notional * rate * direction
          // Long pays positive rate, Short receives positive rate
          const direction = pos.side === "long" ? -1 : 1;
          const notional = pos.size * pos.markPrice;
          const payment = notional * fundingRate * direction;
          totalPayment += payment;
        }

        const fundingRecord: PaperFundingRecord = {
          id: `fund-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          market,
          rate: fundingRate * 100,
          payment: Number(totalPayment.toFixed(2)),
          time: new Date().toISOString(),
        };

        set({
          balance: Math.max(0, state.balance + totalPayment),
          fundingHistory: [fundingRecord, ...state.fundingHistory].slice(0, 100),
        });
      },

      resetAccount: () => {
        set({
          balance: INITIAL_BALANCE,
          positions: [],
          openOrders: [],
          tradeHistory: [],
          orderHistory: [],
          fundingHistory: [],
          twapOrders: [],
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
        orderHistory: state.orderHistory,
        fundingHistory: state.fundingHistory,
        twapOrders: state.twapOrders,
      }),
    }
  )
);
