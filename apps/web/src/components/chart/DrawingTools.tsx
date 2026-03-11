/**
 * Chart Drawing Tools Component
 * 
 * Interactive drawing tools for technical analysis.
 * See docs/phase2/index.md for implementation details.
 */

import { useState, useRef, useCallback } from "react";
import { TrendingUp, Minus, Move, Trash2, MousePointer } from "lucide-react";

export type DrawingTool = "pointer" | "trendline" | "horizontal" | "ray" | "clear";

interface DrawingToolsProps {
  activeTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  onClear: () => void;
}

interface DrawingLine {
  id: string;
  type: "trendline" | "horizontal" | "ray";
  startPrice: number;
  endPrice?: number;
  startTime: number;
  endTime?: number;
  color: string;
}

export function DrawingToolsToolbar({ activeTool, onToolChange, onClear }: DrawingToolsProps) {
  const tools: { id: DrawingTool; icon: React.ReactNode; label: string }[] = [
    { id: "pointer", icon: <MousePointer className="w-4 h-4" />, label: "Pointer" },
    { id: "trendline", icon: <TrendingUp className="w-4 h-4" />, label: "Trendline" },
    { id: "horizontal", icon: <Minus className="w-4 h-4" />, label: "Support/Resistance" },
    { id: "ray", icon: <Move className="w-4 h-4" />, label: "Ray" },
  ];

  return (
    <div className="flex items-center gap-1">
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => onToolChange(tool.id)}
          className={`
            p-1.5 rounded-md transition-colors
            ${activeTool === tool.id 
              ? "bg-primary text-primary-foreground" 
              : "hover:bg-muted text-muted-foreground"
            }
          `}
          title={tool.label}
        >
          {tool.icon}
        </button>
      ))}
      <div className="w-px h-4 bg-border mx-1" />
      <button
        onClick={onClear}
        className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive transition-colors"
        title="Clear all drawings"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export function useDrawingTools() {
  const [activeTool, setActiveTool] = useState<DrawingTool>("pointer");
  const [lines, setLines] = useState<DrawingLine[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentLineRef = useRef<Partial<DrawingLine> | null>(null);

  const startDrawing = useCallback((price: number, time: number) => {
    if (activeTool === "pointer" || activeTool === "clear") return;
    
    setIsDrawing(true);
    currentLineRef.current = {
      type: activeTool === "trendline" ? "trendline" : activeTool === "horizontal" ? "horizontal" : "ray",
      startPrice: price,
      startTime: time,
      color: activeTool === "horizontal" ? "#ef4444" : "#22c55e",
    };
  }, [activeTool]);

  const updateDrawing = useCallback((price: number, time: number) => {
    if (!isDrawing || !currentLineRef.current) return;
    
    currentLineRef.current.endPrice = price;
    currentLineRef.current.endTime = time;
  }, [isDrawing]);

  const endDrawing = useCallback(() => {
    if (!isDrawing || !currentLineRef.current) return;
    
    const line = currentLineRef.current;
    if (line.endPrice && line.endTime) {
      setLines(prev => [...prev, {
        id: Math.random().toString(36).substr(2, 9),
        type: line.type as "trendline" | "horizontal" | "ray",
        startPrice: line.startPrice!,
        endPrice: line.endPrice,
        startTime: line.startTime!,
        endTime: line.endTime,
        color: line.color!,
      }]);
    }
    
    setIsDrawing(false);
    currentLineRef.current = null;
  }, [isDrawing]);

  const clearLines = useCallback(() => {
    setLines([]);
    setActiveTool("pointer");
  }, []);

  return {
    activeTool,
    setActiveTool,
    lines,
    isDrawing,
    startDrawing,
    updateDrawing,
    endDrawing,
    clearLines,
  };
}

export type { DrawingLine };
