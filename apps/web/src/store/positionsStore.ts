import { create } from "zustand";
import { listOpenPositions } from "@/services/apiClient/positions.api";

export type PositionSide = "long" | "short";

export type Position = {
  id: string;
  market: string;
  side: PositionSide;
  size: number;
  entryPrice: number;
  markPrice: number;
  leverage: number;
  margin: number;
  openedAt: string;
  pnl: number;
  pnlPercent: number;
};

export type PositionDelta = {
  id: string;
  closed?: boolean;
} & Partial<Omit<Position, "id" | "pnl" | "pnlPercent">>;

type PositionsState = {
  positions: Position[];
  pnlById: Record<string, { pnl: number; pnlPercent: number }>;
  isLoading: boolean;
  error: string | null;
  setSnapshot: (positions: Position[]) => void;
  applyDelta: (deltas: PositionDelta[]) => void;
  fetchPositions: () => Promise<void>;
};

const computeMargin = (position: Pick<Position, "entryPrice" | "size" | "leverage">) =>
  (position.entryPrice * position.size) / Math.max(position.leverage, 1);

const computePnl = (position: Pick<Position, "side" | "entryPrice" | "markPrice" | "size" | "margin">) => {
  const direction = position.side === "long" ? 1 : -1;
  const pnl = (position.markPrice - position.entryPrice) * position.size * direction;
  const pnlPercent = position.margin ? (pnl / position.margin) * 100 : 0;
  return { pnl, pnlPercent };
};

const normalizePosition = (position: Position) => {
  const margin = position.margin || computeMargin(position);
  const derived = computePnl({ ...position, margin });
  return { ...position, margin, ...derived };
};

const buildPnlById = (positions: Position[]) =>
  Object.fromEntries(
    positions.map((position) => [position.id, { pnl: position.pnl, pnlPercent: position.pnlPercent }])
  );

const seedPositions: Position[] = [
  {
    id: "pos-btc-1",
    market: "BTC-USD",
    side: "long" as PositionSide,
    size: 0.25,
    entryPrice: 94200,
    markPrice: 95410,
    leverage: 8,
    margin: 0,
    openedAt: "2026-03-08T00:20:00Z",
    pnl: 0,
    pnlPercent: 0,
  },
  {
    id: "pos-eth-1",
    market: "ETH-USD",
    side: "short" as PositionSide,
    size: 3.1,
    entryPrice: 4810,
    markPrice: 4762,
    leverage: 6,
    margin: 0,
    openedAt: "2026-03-08T00:10:00Z",
    pnl: 0,
    pnlPercent: 0,
  },
  {
    id: "pos-strk-1",
    market: "STRK-USD",
    side: "long" as PositionSide,
    size: 1200,
    entryPrice: 2.12,
    markPrice: 2.34,
    leverage: 4,
    margin: 0,
    openedAt: "2026-03-07T23:40:00Z",
    pnl: 0,
    pnlPercent: 0,
  },
].map(normalizePosition);

const canHydrate = (delta: PositionDelta): delta is Position =>
  typeof delta.market === "string" &&
  (delta.side === "long" || delta.side === "short") &&
  typeof delta.size === "number" &&
  typeof delta.entryPrice === "number" &&
  typeof delta.markPrice === "number" &&
  typeof delta.leverage === "number" &&
  typeof delta.openedAt === "string";

export const usePositionsStore = create<PositionsState>()((set) => ({
  positions: [...seedPositions].sort((a, b) => b.openedAt.localeCompare(a.openedAt)),
  pnlById: buildPnlById(seedPositions),
  isLoading: false,
  error: null,
  setSnapshot: (positions) => {
    const normalized = positions.map(normalizePosition).sort((a, b) => b.openedAt.localeCompare(a.openedAt));
    set({ positions: normalized, pnlById: buildPnlById(normalized) });
  },
  applyDelta: (deltas) =>
    set((state) => {
      const byId = new Map(state.positions.map((position) => [position.id, position]));
      deltas.forEach((delta) => {
        if (delta.closed) {
          byId.delete(delta.id);
          return;
        }
        const existing = byId.get(delta.id);
        if (existing) {
          byId.set(delta.id, normalizePosition({ ...existing, ...delta }));
        } else if (canHydrate(delta)) {
          byId.set(delta.id, normalizePosition(delta));
        }
      });
      const next = Array.from(byId.values()).sort((a, b) => b.openedAt.localeCompare(a.openedAt));
      return { positions: next, pnlById: buildPnlById(next) };
    }),
  fetchPositions: async () => {
    set({ isLoading: true, error: null });
    try {
      const positions = await listOpenPositions();
      const normalized = (positions as Position[]).map(normalizePosition).sort((a, b) => b.openedAt.localeCompare(a.openedAt));
      set({ positions: normalized, pnlById: buildPnlById(normalized), isLoading: false });
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : "Failed to fetch positions" 
      });
    }
  },
}));
