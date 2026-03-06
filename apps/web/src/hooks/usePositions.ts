import { useEffect } from "react";
import { usePositionsStore } from "@/store/positionsStore";

export function usePositions() {
  const positions = usePositionsStore((state) => state.positions);
  const isLoading = usePositionsStore((state) => state.isLoading);
  const error = usePositionsStore((state) => state.error);
  const setSnapshot = usePositionsStore((state) => state.setSnapshot);
  const applyDelta = usePositionsStore((state) => state.applyDelta);
  const fetchPositions = usePositionsStore((state) => state.fetchPositions);
  
  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);
  
  return { positions, isLoading, error, setSnapshot, applyDelta, fetchPositions };
}

export function usePositionsPnl() {
  return usePositionsStore((state) => state.pnlById);
}
