import * as React from "react";
import { GripVertical, GripHorizontal } from "lucide-react";
import * as ResizablePrimitive from "react-resizable-panels";
import { cn } from "@/lib/utils";

const ResizablePanelGroup = ({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) => (
  <ResizablePrimitive.PanelGroup
    className={cn(
      "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
      className
    )}
    {...props}
  />
);

const ResizablePanel = ResizablePrimitive.Panel;

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean;
}) => (
  <ResizablePrimitive.PanelResizeHandle
    className={cn(
      "group relative flex w-1 items-center justify-center bg-[#152327] transition-colors hover:bg-[#22d3ee]/60 active:bg-[#22d3ee] data-[panel-group-direction=vertical]:h-1 data-[panel-group-direction=vertical]:w-full focus-visible:outline-none cursor-col-resize data-[panel-group-direction=vertical]:cursor-row-resize",
      "after:absolute after:inset-y-0 after:left-1/2 after:w-3 after:-translate-x-1/2 data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-3 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0",
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-[2px] border border-[#1e3b43] bg-[#0c1f24] text-[#557077] group-hover:text-[#22d3ee] group-hover:border-[#22d3ee]/50 transition-colors group-data-[panel-group-direction=vertical]:h-3 group-data-[panel-group-direction=vertical]:w-4">
        <GripVertical className="h-2.5 w-2.5 group-data-[panel-group-direction=vertical]:hidden" />
        <GripHorizontal className="hidden h-2.5 w-2.5 group-data-[panel-group-direction=vertical]:block" />
      </div>
    )}
  </ResizablePrimitive.PanelResizeHandle>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
