const TERMINAL_ACTION_EVENT = "hyperx:terminal-action";

export type TerminalAction =
  | { type: "focus-trade-form" }
  | { type: "focus-size-input" }
  | { type: "set-order-side"; side: "buy" | "sell" }
  | { type: "set-order-type"; orderType: "market" | "limit" | "stop" }
  | {
      type: "prepare-order";
      side: "buy" | "sell";
      orderType: "market" | "limit" | "stop";
      focusField?: "size" | "price" | "stop";
    };

export function dispatchTerminalAction(action: TerminalAction) {
  window.dispatchEvent(new CustomEvent<TerminalAction>(TERMINAL_ACTION_EVENT, { detail: action }));
}

export function addTerminalActionListener(listener: (action: TerminalAction) => void) {
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<TerminalAction>;
    listener(customEvent.detail);
  };

  window.addEventListener(TERMINAL_ACTION_EVENT, handler);
  return () => window.removeEventListener(TERMINAL_ACTION_EVENT, handler);
}
