import { useCallback, useEffect, useState } from "react";
import {
  wsClient,
  type CandlesChannel,
  type ChannelPayloadMap,
  type ConnectionState,
  type SubscribableChannel,
  type WSChannel,
} from "@/services/wsClient";

type Listener<T> = { bivarianceHack(payload: T): void }["bivarianceHack"];

export function useWebSocket(autoConnect = true) {
  const [state, setState] = useState<ConnectionState>(wsClient.connectionState);

  useEffect(() => {
    const unsubscribe = wsClient.onStateChange(setState);
    if (autoConnect) {
      wsClient.connect();
    }
    return () => unsubscribe();
  }, [autoConnect]);

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
