import { useEffect } from "react";
import { usePositionsStore } from "@/store/positionsStore";
import { useWallet } from "@/components/wallet/useWallet";

export function usePositions() {
  const positions = usePositionsStore((state) => state.positions);
  const isLoading = usePositionsStore((state) => state.isLoading);
  const error = usePositionsStore((state) => state.error);
  const setSnapshot = usePositionsStore((state) => state.setSnapshot);
  const applyDelta = usePositionsStore((state) => state.applyDelta);
  const fetchPositions = usePositionsStore((state) => state.fetchPositions);
  const isWalletConnected = useWallet((state) => state.isConnected);
  
  useEffect(() => {
    if (!isWalletConnected) return;
    fetchPositions();
  }, [fetchPositions, isWalletConnected]);
  
  return { positions, isLoading, error, setSnapshot, applyDelta, fetchPositions };
}

export function usePositionsPnl() {
  return usePositionsStore((state) => state.pnlById);
}
