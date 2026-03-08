import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Base skeleton component
interface SkeletonProps {
  className?: string;
  animated?: boolean;
  style?: React.CSSProperties;
}

export function Skeleton({ className, animated = true, style }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded bg-secondary",
        animated && "animate-pulse",
        className
      )}
      style={style}
    />
  );
}

// Table skeleton
interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function TableSkeleton({ rows = 5, columns = 4, className }: TableSkeletonProps) {
  return (
    <div className={cn("w-full", className)}>
      {/* Header */}
      <div className="flex gap-4 mb-3 pb-3 border-b border-border">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`header-${i}`} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={`row-${rowIdx}`} className="flex gap-4 mb-3">
          {Array.from({ length: columns }).map((_, colIdx) => (
            <Skeleton 
              key={`cell-${rowIdx}-${colIdx}`} 
              className="h-6 flex-1"
              style={{ animationDelay: `${rowIdx * 100}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// Card skeleton
interface CardSkeletonProps {
  hasHeader?: boolean;
  hasFooter?: boolean;
  lines?: number;
  className?: string;
}

export function CardSkeleton({ 
  hasHeader = true, 
  hasFooter = true, 
  lines = 3, 
  className 
}: CardSkeletonProps) {
  return (
    <div className={cn("terminal-panel p-4 space-y-4", className)}>
      {hasHeader && (
        <div className="flex items-center gap-3 pb-3 border-b border-border">
          <Skeleton className="h-8 w-8 rounded" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      )}
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton 
            key={i} 
            className="h-4"
            style={{ width: `${Math.random() * 40 + 60}%` }}
          />
        ))}
      </div>
      {hasFooter && (
        <div className="flex gap-2 pt-3 border-t border-border">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 flex-1" />
        </div>
      )}
    </div>
  );
}

// Chart skeleton
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("terminal-panel p-4", className)}>
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-6 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
      <Skeleton className="h-[300px] w-full" />
    </div>
  );
}

// Orderbook skeleton
export function OrderBookSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("terminal-panel", className)}>
      <div className="terminal-header">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="p-2">
        {/* Asks */}
        <div className="space-y-1 mb-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={`ask-${i}`} className="flex gap-2">
              <Skeleton className="h-5 flex-1" style={{ animationDelay: `${i * 50}ms` }} />
              <Skeleton className="h-5 flex-1" style={{ animationDelay: `${i * 50}ms` }} />
              <Skeleton className="h-5 flex-1" style={{ animationDelay: `${i * 50}ms` }} />
            </div>
          ))}
        </div>
        {/* Spread */}
        <Skeleton className="h-8 w-full my-2" />
        {/* Bids */}
        <div className="space-y-1 mt-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={`bid-${i}`} className="flex gap-2">
              <Skeleton className="h-5 flex-1" style={{ animationDelay: `${(i + 8) * 50}ms` }} />
              <Skeleton className="h-5 flex-1" style={{ animationDelay: `${(i + 8) * 50}ms` }} />
              <Skeleton className="h-5 flex-1" style={{ animationDelay: `${(i + 8) * 50}ms` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Trade form skeleton
export function TradeFormSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("terminal-panel", className)}>
      <div className="terminal-header">
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-16" />
        </div>
      </div>
      <div className="p-4 space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
        <Skeleton className="h-20 w-full" />
        <div className="space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}

// Stats skeleton
export function StatsSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="terminal-panel p-4">
          <Skeleton className="h-3 w-16 mb-2" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-3 w-12 mt-2" />
        </div>
      ))}
    </div>
  );
}

// Full page loading
export function PageLoading({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center min-h-[60vh]", className)}>
      <div className="text-center space-y-4">
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-2 border-primary/20 border-t-primary rounded-full"
          />
          <div className="absolute inset-0 blur-xl bg-primary/20" />
        </div>
        <p className="font-mono text-sm text-muted-foreground animate-pulse">
          Initializing Terminal...
        </p>
      </div>
    </div>
  );
}

// Staggered loading animation
export function StaggeredLoading({ 
  children, 
  isLoading 
}: { 
  children: React.ReactNode; 
  isLoading: boolean;
}) {
  if (!isLoading) return <>{children}</>;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <CardSkeleton />
    </motion.div>
  );
}
