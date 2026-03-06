import { useCallback, useEffect, useRef, useState } from "react";
import {
  wsClient,
  type CandlesChannel,
  type ChannelPayloadMap,
  type ConnectionState,
  type SubscribableChannel,
  type WSChannel,
} from "@/services/wsClient";
import { useLatencyStore } from "@/store/latencyStore";

type Listener<T> = { bivarianceHack(payload: T): void }["bivarianceHack"];

export function useWSClient() {
  return wsClient;
}

export function useWebSocket(autoConnect = true) {
  const [state, setState] = useState<ConnectionState>(wsClient.connectionState);
  const pingIntervalRef = useRef<number | null>(null);
  const pongUnsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsubscribe = wsClient.onStateChange(setState);
    if (autoConnect) {
      wsClient.connect();
    }
    return () => {
      unsubscribe();
    };
  }, [autoConnect]);

  useEffect(() => {
    if (state !== "connected") {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (pongUnsubscribeRef.current) {
        pongUnsubscribeRef.current();
        pongUnsubscribeRef.current = null;
      }
      return;
    }

    const sendPing = () => {
      const startTime = performance.now();
      const handlePong = () => {
        const ping = performance.now() - startTime;
        useLatencyStore.getState().setWsPing(ping);
      };
      
      pongUnsubscribeRef.current = wsClient.on("pong", handlePong as Listener<unknown>);
      wsClient.ping();
      
      setTimeout(() => {
        if (pongUnsubscribeRef.current) {
          pongUnsubscribeRef.current();
          pongUnsubscribeRef.current = null;
        }
      }, 1000);
    };

    sendPing();
    pingIntervalRef.current = window.setInterval(sendPing, 5000);

    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (pongUnsubscribeRef.current) {
        pongUnsubscribeRef.current();
        pongUnsubscribeRef.current = null;
      }
    };
  }, [state]);

  const subscribe = useCallback(
    (channel: SubscribableChannel | CandlesChannel, market?: string) => {
      wsClient.subscribe(channel, market);
      return () => wsClient.unsubscribe(channel, market);
    },
    []
  );

  const on = useCallback(
    <T extends WSChannel>(channel: T, listener: Listener<ChannelPayloadMap[T]>) =>
      wsClient.on(channel, listener),
    []
  );

  return { state, subscribe, on, send: wsClient.send.bind(wsClient) };
}
