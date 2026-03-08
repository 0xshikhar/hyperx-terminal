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

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function sanitizeSizes(
  sizes: number[] | undefined,
  fallback: number[],
  min: number
): number[] {
  if (!sizes || sizes.length !== fallback.length) return fallback;
  const numeric = sizes.map((value) =>
    Number.isFinite(value) ? clamp(value, min, 100) : min
  );
  const total = numeric.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return fallback;
  return numeric.map((value) => Number(((value / total) * 100).toFixed(2)));
}

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

  const mainLayout = sanitizeSizes(panelLayout.main, [75, 25], 5);
  const leftLayout = sanitizeSizes(panelLayout.left, [10, 50, 40], 5);
  const rightLayout = sanitizeSizes(panelLayout.right, [60, 20, 20], 5);

  return (
    <PanelGroup
      direction="horizontal"
      className="h-full min-h-0"
      onLayout={(sizes) => setPanelLayout({ main: sizes })}
    >
      <Panel defaultSize={mainLayout[0]} minSize={30}>
        <PanelGroup
          direction="vertical"
          onLayout={(sizes) => setPanelLayout({ left: sizes })}
        >
          <Panel defaultSize={leftLayout[0]} minSize={5}>
            <div className="h-full min-h-0">{marketSelector}</div>
          </Panel>
          <PanelResizeHandle className="h-1 bg-transparent hover:bg-border transition-colors" />
          <Panel defaultSize={leftLayout[1]} minSize={20}>
            <div className="h-full min-h-0">{chart}</div>
          </Panel>
          <PanelResizeHandle className="h-1 bg-transparent hover:bg-border transition-colors" />
          <Panel defaultSize={leftLayout[2]} minSize={15}>
            <div className="h-full min-h-0">{positions}</div>
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
            <div className="h-full min-h-0">{orderBook}</div>
          </Panel>
          <PanelResizeHandle className="h-1 bg-transparent hover:bg-border transition-colors" />
          <Panel defaultSize={rightLayout[1]} minSize={10}>
            <div className="h-full min-h-0">{tradeForm}</div>
          </Panel>
          <PanelResizeHandle className="h-1 bg-transparent hover:bg-border transition-colors" />
          <Panel defaultSize={rightLayout[2]} minSize={10}>
            <div className="h-full min-h-0">{recentTrades}</div>
          </Panel>
        </PanelGroup>
      </Panel>
    </PanelGroup>
  );
}
