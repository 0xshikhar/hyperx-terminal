/**
 * useThrottledWebSocket Hook
 * 
 * WebSocket message throttling with requestAnimationFrame batching.
 * See docs/phase1/index.md for implementation details and interview context.
 * 
 * @example
 * const { subscribeThrottled } = useThrottledWebSocket({ throttleMs: 100 });
 * useEffect(() => {
 *   return subscribeThrottled("orderbook", market, handleUpdate);
 * }, [market]);
 */

import { useEffect, useRef, useCallback } from "react";
import { wsClient, type WSChannel, type ChannelPayloadMap, type SubscribableChannel } from "@/services/wsClient";

type Listener<T> = { bivarianceHack(payload: T): void }["bivarianceHack"];

export interface ThrottledWSOptions {
  /** Throttle interval in milliseconds (default: 100ms for trading data) */
  throttleMs?: number;
  /** Use requestAnimationFrame for visual updates (default: true) */
  useRAF?: boolean;
  /** Batch multiple messages (default: true) */
  batch?: boolean;
  /** Maximum batch size before forced flush (default: 100) */
  maxBatchSize?: number;
}

interface PendingMessage<T = unknown> {
  subscriptionKey: string;
  channel: WSChannel;
  payload: T;
  timestamp: number;
}

/**
 * Hook that provides throttled WebSocket subscriptions
 * 
 * USAGE EXAMPLE:
 * ```typescript
 * // OrderBook component - needs smooth 60fps
 * const { state, subscribeThrottled } = useThrottledWebSocket({ 
 *   throttleMs: 100,  // Update UI max 10 times/second
 *   useRAF: true        // Sync with display refresh
 * });
 * 
 * useEffect(() => {
 *   return subscribeThrottled("orderbook", market, (data) => {
 *     // Called at most 10 times/sec, but batched updates contain all changes
 *     updateOrderbook(data);
 *   });
 * }, [market]);
 * ```
 * 
 * 
 */
export function useThrottledWebSocket(options: ThrottledWSOptions = {}) {
  const {
    throttleMs = 100,
    useRAF = true,
    batch = true,
    maxBatchSize = 100,
  } = options;

  // Refs to avoid re-renders during high-frequency updates
  const pendingRef = useRef<PendingMessage[]>([]);
  const callbacksRef = useRef<Map<string, Set<Listener<unknown>>>>(new Map());
  const rafIdRef = useRef<number | null>(null);
  const timeoutIdRef = useRef<number | null>(null);
  const lastFlushRef = useRef<number>(0);
  const mountedRef = useRef(true);

  const flush = useCallback(() => {
    if (!mountedRef.current) return;

    const now = performance.now();
    const pending = pendingRef.current;
    
    if (pending.length === 0) return;
    
    // Clear pending before invoking callbacks (prevents race conditions)
    pendingRef.current = [];
    lastFlushRef.current = now;

    // Group by channel for efficient batching
    if (batch) {
      const bySubscription = new Map<string, unknown[]>();
      
      for (const msg of pending) {
        const existing = bySubscription.get(msg.subscriptionKey) ?? [];
        existing.push(msg.payload);
        bySubscription.set(msg.subscriptionKey, existing);
      }

      // Invoke callbacks with batched data
      for (const [subscriptionKey, payloads] of bySubscription) {
        const callbacks = callbacksRef.current.get(subscriptionKey);
        if (callbacks) {
          for (const cb of callbacks) {
            // Pass array if multiple messages, single payload if one
            cb(payloads.length === 1 ? payloads[0] : payloads);
          }
        }
      }
    } else {
      // Non-batched: invoke per message
      for (const msg of pending) {
        const callbacks = callbacksRef.current.get(msg.subscriptionKey);
        if (callbacks) {
          for (const cb of callbacks) {
            cb(msg.payload);
          }
        }
      }
    }
  }, [batch]);

  const scheduleFlush = useCallback(() => {
    // Cancel any pending flush
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }

    const now = performance.now();
    const elapsed = now - lastFlushRef.current;
    const remaining = Math.max(0, throttleMs - elapsed);

    if (useRAF && remaining <= 16) {
      // Use RAF if we're close to throttle time and want display sync
      rafIdRef.current = requestAnimationFrame(() => {
        flush();
        rafIdRef.current = null;
      });
    } else {
      // Use setTimeout for precise throttling
      timeoutIdRef.current = window.setTimeout(() => {
        flush();
        timeoutIdRef.current = null;
      }, remaining);
    }
  }, [flush, throttleMs, useRAF]);

  /**
   * Handle incoming WebSocket message
   */
  const handleMessage = useCallback(<T extends WSChannel>(
    subscriptionKey: string,
    channel: T,
    payload: ChannelPayloadMap[T]
  ) => {
    const pending = pendingRef.current;
    
    pending.push({
      subscriptionKey,
      channel,
      payload,
      timestamp: performance.now(),
    });

    // Force flush if batch gets too large (prevents memory pressure)
    if (pending.length >= maxBatchSize) {
      flush();
      return;
    }

    // Schedule throttled flush
    scheduleFlush();
  }, [flush, scheduleFlush, maxBatchSize]);

  const subscribeThrottled = useCallback(<T extends SubscribableChannel>(
    channel: T,
    market: string | undefined,
    listener: Listener<ChannelPayloadMap[T]>
  ): (() => void) => {
    const subscriptionKey = `${channel}::${market ?? "*"}`;

    // Register throttled listener
    const callbacks = callbacksRef.current.get(subscriptionKey) ?? new Set();
    callbacks.add(listener as Listener<unknown>);
    callbacksRef.current.set(subscriptionKey, callbacks);

    // Subscribe to actual WebSocket
    const wrappedListener = (payload: ChannelPayloadMap[T]) => {
      const payloadMarket =
        typeof payload === "object" && payload !== null && "market" in payload
          ? String((payload as { market?: string }).market ?? "")
          : undefined;

      if (market && payloadMarket && payloadMarket !== market) {
        return;
      }

      handleMessage(subscriptionKey, channel as WSChannel, payload);
    };

    const wsUnsubscribe = wsClient.on(channel as WSChannel, wrappedListener);
    wsClient.subscribe(channel, market);

    // Return cleanup function
    return () => {
      wsUnsubscribe();
      wsClient.unsubscribe(channel, market);
      callbacks.delete(listener as Listener<unknown>);
      if (callbacks.size === 0) {
        callbacksRef.current.delete(subscriptionKey);
        pendingRef.current = pendingRef.current.filter(
          (message) => message.subscriptionKey !== subscriptionKey
        );
        if (pendingRef.current.length === 0) {
          if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
          }
          if (timeoutIdRef.current) {
            clearTimeout(timeoutIdRef.current);
            timeoutIdRef.current = null;
          }
        }
      }
    };
  }, [handleMessage]);

  /**
   * Manual flush for immediate updates (e.g., user actions)
   */
  const flushNow = useCallback(() => {
    flush();
  }, [flush]);

  /**
   * Get pending message count (for debugging)
   */
  const getPendingCount = useCallback(() => {
    return pendingRef.current.length;
  }, []);

    // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      pendingRef.current = [];
    };
  }, []);

  return {
    /** Connection state from wsClient */
    state: wsClient.connectionState,
    /** Subscribe with automatic throttling */
    subscribeThrottled,
    /** Force immediate flush of pending messages */
    flushNow,
    /** Debug: get count of pending batched messages */
    getPendingCount,
  };
}

export function useThrottledOrderbook(market: string) {
  const { subscribeThrottled, flushNow } = useThrottledWebSocket({
    throttleMs: 100,  // 10 updates/sec is plenty for orderbook display
    useRAF: true,      // Sync with display
    batch: true,       // Batch rapid updates
    maxBatchSize: 50,  // Safety limit
  });

  return {
    subscribe: (callback: Listener<ChannelPayloadMap["orderbook"]>) =>
      subscribeThrottled("orderbook", market, callback),
    flushNow,
  };
}

export function useThrottledTrades(market: string) {
  const { subscribeThrottled, flushNow } = useThrottledWebSocket({
    throttleMs: 50,   // 20 updates/sec for trades
    useRAF: false,     // Precision timing more important than display sync
    batch: true,
    maxBatchSize: 100,
  });

  return {
    subscribe: (callback: Listener<ChannelPayloadMap["trades"]>) =>
      subscribeThrottled("trades", market, callback),
    flushNow,
  };
}
