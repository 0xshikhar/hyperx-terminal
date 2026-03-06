import { useMarketStore } from "@/store/marketStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OpenPositionsTable } from "@/components/positions/OpenPositionsTable";
import { OpenOrdersTable } from "@/components/positions/OpenOrdersTable";
import { TradeHistoryTable } from "@/components/positions/TradeHistoryTable";
import { FundingHistoryTable } from "@/components/positions/FundingHistoryTable";

export function PositionsTabs() {
  const activeMarket = useMarketStore((state) => state.activeMarket);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Positions</h3>
        <span className="text-xs text-muted-foreground">{activeMarket}</span>
      </div>

      <Tabs defaultValue="open" className="mt-3">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="funding">Funding</TabsTrigger>
        </TabsList>
        <TabsContent value="open">
          <OpenPositionsTable />
        </TabsContent>
        <TabsContent value="orders">
          <OpenOrdersTable />
        </TabsContent>
        <TabsContent value="history">
          <TradeHistoryTable />
        </TabsContent>
        <TabsContent value="funding">
          <FundingHistoryTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
