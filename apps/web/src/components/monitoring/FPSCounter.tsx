/**
 * FPS Counter Component
 * 
 * Real-time render performance monitoring using requestAnimationFrame.
 * See docs/phase1/index.md for implementation details and interview context.
 */

import { useEffect, useRef, useState } from "react";
import { Activity, Zap, AlertTriangle } from "lucide-react";

interface FPSData {
  fps: number;
  frameTime: number;
  droppedFrames: number;
  isStable: boolean;
}

function useFPSMonitor(): FPSData {
  const [fpsData, setFpsData] = useState<FPSData>({
    fps: 60,
    frameTime: 16.67,
    droppedFrames: 0,
    isStable: true,
  });

  // Refs to avoid re-renders during RAF loop
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const droppedFramesRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    const updateFPS = () => {
      const now = performance.now();
      const delta = now - lastTimeRef.current;
      frameCountRef.current++;

      // Update every ~1 second (1000ms)
      if (delta >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / delta);
        const frameTime = delta / frameCountRef.current;
        
        // Count dropped frames (any frame > 16.67ms = 60fps budget)
        const expectedFrames = delta / 16.67;
        const actualFrames = frameCountRef.current;
        if (actualFrames < expectedFrames * 0.9) {
          droppedFramesRef.current += Math.round(expectedFrames - actualFrames);
        }

        setFpsData({
          fps: Math.min(fps, 60), // Cap at 60 (monitor refresh rate)
          frameTime,
          droppedFrames: droppedFramesRef.current,
          isStable: fps >= 55 && frameTime <= 20,
      // _isStable is used in PerformancePanel component
        });

        // Reset counters
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      rafIdRef.current = requestAnimationFrame(updateFPS);
    };

    rafIdRef.current = requestAnimationFrame(updateFPS);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return fpsData;
}

interface FPSCounterProps {
  /** Show detailed metrics (default: false) */
  detailed?: boolean;
  /** Position on screen (default: top-right) */
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /** Minimum FPS before showing warning (default: 30) */
  warningThreshold?: number;
}

/**
 * FPS Counter Component
 * 
 * USAGE:
 * ```tsx
 * // Minimal indicator
 * <FPSCounter />
 * 
 * // Detailed metrics for debugging
 * <FPSCounter detailed position="bottom-right" />
 * ```
 */
export function FPSCounter({
  detailed = false,
  position = "top-right",
  warningThreshold = 30,
}: FPSCounterProps) {
  const { fps, frameTime, droppedFrames } = useFPSMonitor();
  const [isExpanded, setIsExpanded] = useState(detailed);

  const positionClasses = {
    "top-left": "top-4 left-4",
    "top-right": "top-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "bottom-right": "bottom-4 right-4",
  };

  // Color coding based on performance
  const getColorClass = () => {
    if (fps >= 55) return "text-emerald-400 border-emerald-400/30";
    if (fps >= warningThreshold) return "text-yellow-400 border-yellow-400/30";
    return "text-red-400 border-red-400/30 animate-pulse";
  };

  const getBgClass = () => {
    if (fps >= 55) return "bg-emerald-500/10";
    if (fps >= warningThreshold) return "bg-yellow-500/10";
    return "bg-red-500/10";
  };

  const getIcon = () => {
    if (fps >= 55) return <Zap className="w-3 h-3" />;
    if (fps >= warningThreshold) return <Activity className="w-3 h-3" />;
    return <AlertTriangle className="w-3 h-3" />;
  };

  return (
    <div
      className={`fixed ${positionClasses[position]} z-50 font-mono text-xs transition-all duration-300`}
      onClick={() => setIsExpanded(!isExpanded)}
      style={{ cursor: "pointer" }}
      title="Click to toggle detailed view"
    >
      <div
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg border backdrop-blur-sm
          ${getColorClass()} ${getBgClass()}
          transition-all duration-300 hover:scale-105
        `}
      >
        {getIcon()}
        <span className="font-bold">{fps} FPS</span>
        
        {isExpanded && (
          <div className="flex flex-col gap-1 ml-2 pl-2 border-l border-current/30">
            <span className="text-[10px] opacity-80">
              {frameTime.toFixed(1)}ms
            </span>
            {droppedFrames > 0 && (
              <span className="text-[10px] opacity-80 text-red-400">
                {droppedFrames} dropped
              </span>
            )}
          </div>
        )}
      </div>

      {/* Mini sparkline graph (shows trend) */}
      {isExpanded && <FPSSparkline fps={fps} />}
    </div>
  );
}

function FPSSparkline({ fps }: { fps: number }) {
  const historyRef = useRef<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Keep last 60 seconds of FPS data
  if (historyRef.current.length > 60) {
    historyRef.current.shift();
  }
  historyRef.current.push(fps);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const history = historyRef.current;
    if (history.length < 2) return;

    // Draw sparkline
    const width = canvas.width;
    const height = canvas.height;
    const maxFPS = 60;

    ctx.beginPath();
    ctx.strokeStyle = fps >= 55 ? "#34d399" : fps >= 30 ? "#fbbf24" : "#f87171";
    ctx.lineWidth = 2;

    history.forEach((value, index) => {
      const x = (index / (history.length - 1)) * width;
      const y = height - (value / maxFPS) * height;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw 60fps target line
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.setLineDash([2, 2]);
    const targetY = height - (60 / maxFPS) * height;
    ctx.moveTo(0, targetY);
    ctx.lineTo(width, targetY);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [fps]);

  return (
    <canvas
      ref={canvasRef}
      width={100}
      height={30}
      className="mt-1 rounded bg-black/20"
    />
  );
}

export function PerformanceBadge({ fps }: { fps: number }) {
  if (fps >= 55) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">
        <Zap className="w-3 h-3" />
        60 FPS
      </span>
    );
  }
  
  if (fps >= 30) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs">
        <Activity className="w-3 h-3" />
        {fps} FPS
      </span>
    );
  }
  
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs animate-pulse">
      <AlertTriangle className="w-3 h-3" />
      {fps} FPS
    </span>
  );
}

export function PerformancePanel() {
  const fpsData = useFPSMonitor();

  return (
    <div className="p-4 rounded-lg bg-card border border-border">
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <Activity className="w-4 h-4" />
        Performance Monitor
      </h3>

      <div className="grid grid-cols-3 gap-4">
        <MetricCard
          label="FPS"
          value={fpsData.fps}
          unit=""
          status={fpsData.fps >= 55 ? "good" : fpsData.fps >= 30 ? "warning" : "critical"}
        />
        <MetricCard
          label="Frame Time"
          value={fpsData.frameTime.toFixed(1)}
          unit="ms"
          status={fpsData.frameTime <= 16.67 ? "good" : fpsData.frameTime <= 33 ? "warning" : "critical"}
        />
        <MetricCard
          label="Dropped Frames"
          value={fpsData.droppedFrames}
          unit=""
          status={fpsData.droppedFrames === 0 ? "good" : "warning"}
        />
      </div>

      <div className="mt-4 text-xs text-muted-foreground">
        <p>Target: 60 FPS (16.67ms per frame)</p>
        <p>Last update: {new Date().toLocaleTimeString()}</p>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  unit,
  status,
}: {
  label: string;
  value: string | number;
  unit: string;
  status: "good" | "warning" | "critical";
}) {
  const statusColors = {
    good: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    warning: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    critical: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  return (
    <div className={`p-3 rounded border ${statusColors[status]}`}>
      <p className="text-[10px] uppercase tracking-wider opacity-80">{label}</p>
      <p className="text-lg font-bold">
        {value}
        {unit && <span className="text-xs ml-1">{unit}</span>}
      </p>
    </div>
  );
}
