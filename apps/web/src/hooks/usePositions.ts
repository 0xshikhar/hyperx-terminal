import { usePositionsStore } from "@/store/positionsStore";

export function usePositions() {
  const positions = usePositionsStore((state) => state.positions);
  const setSnapshot = usePositionsStore((state) => state.setSnapshot);
  const applyDelta = usePositionsStore((state) => state.applyDelta);
  return { positions, setSnapshot, applyDelta };
}

export function usePositionsPnl() {
  return usePositionsStore((state) => state.pnlById);
}
