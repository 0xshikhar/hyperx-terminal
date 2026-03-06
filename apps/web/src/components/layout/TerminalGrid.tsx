import type { ReactNode } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useUIStore } from "@/store/uiStore";

type TerminalGridProps = {
  marketSelector: ReactNode;
  orderBook: ReactNode;
  tradeForm: ReactNode;
  chart: ReactNode;
  recentTrades: ReactNode;
  positions: ReactNode;
};

export function TerminalGrid({
  marketSelector,
  orderBook,
  tradeForm,
  chart,
  recentTrades,
  positions,
}: TerminalGridProps) {
  const panelLayout = useUIStore((s) => s.panelLayout);
  const setPanelLayout = useUIStore((s) => s.setPanelLayout);

  const mainLayout = panelLayout.main ?? [75, 25];
  const leftLayout = panelLayout.left ?? [10, 50, 40];
  const rightLayout = panelLayout.right ?? [60, 20, 20];

  return (
    <PanelGroup
      direction="horizontal"
      className="h-full p-4"
      onLayout={(sizes) => setPanelLayout({ main: sizes })}
    >
      <Panel defaultSize={mainLayout[0]} minSize={30}>
        <PanelGroup
          direction="vertical"
          onLayout={(sizes) => setPanelLayout({ left: sizes })}
        >
          <Panel defaultSize={leftLayout[0]} minSize={5}>
            {marketSelector}
          </Panel>
          <PanelResizeHandle className="h-1 bg-transparent hover:bg-border transition-colors" />
          <Panel defaultSize={leftLayout[1]} minSize={20}>
            {chart}
          </Panel>
          <PanelResizeHandle className="h-1 bg-transparent hover:bg-border transition-colors" />
          <Panel defaultSize={leftLayout[2]} minSize={15}>
            {positions}
          </Panel>
        </PanelGroup>
      </Panel>
      <PanelResizeHandle className="w-1 bg-transparent hover:bg-border transition-colors" />
      <Panel defaultSize={mainLayout[1]} minSize={15}>
        <PanelGroup
          direction="vertical"
          onLayout={(sizes) => setPanelLayout({ right: sizes })}
        >
          <Panel defaultSize={rightLayout[0]} minSize={20}>
            {orderBook}
          </Panel>
          <PanelResizeHandle className="h-1 bg-transparent hover:bg-border transition-colors" />
          <Panel defaultSize={rightLayout[1]} minSize={10}>
            {tradeForm}
          </Panel>
          <PanelResizeHandle className="h-1 bg-transparent hover:bg-border transition-colors" />
          <Panel defaultSize={rightLayout[2]} minSize={10}>
            {recentTrades}
          </Panel>
        </PanelGroup>
      </Panel>
    </PanelGroup>
  );
}
