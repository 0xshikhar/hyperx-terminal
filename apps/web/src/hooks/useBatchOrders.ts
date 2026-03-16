import { useMemo, useState } from "react";
import { useOrdersStore } from "@/store/ordersStore";

export function useBatchOrders() {
  const orders = useOrdersStore((state) => state.openOrders);
  const markOrderCancelled = useOrdersStore((state) => state.markOrderCancelled);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectedOrders = useMemo(
    () => orders.filter((order) => selectedIds.includes(order.id)),
    [orders, selectedIds]
  );

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const clearSelection = () => setSelectedIds([]);

  const cancelSelected = () => {
    selectedIds.forEach((id) => markOrderCancelled(id));
    clearSelection();
  };

  return {
    orders,
    selectedIds,
    selectedOrders,
    toggleSelection,
    clearSelection,
    cancelSelected,
  };
}
