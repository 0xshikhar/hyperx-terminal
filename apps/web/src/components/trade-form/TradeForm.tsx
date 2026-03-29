import { useEffect, useRef, useState } from "react";
import { useMarketStore } from "@/store/marketStore";
import { cn } from "@/lib/utils";
import { placeOrder } from "@/services/apiClient/orders.api";
import type { PlaceOrderPayload } from "@/services/apiClient/orders.api";
import { getAccountSummary } from "@/services/apiClient/account.api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTradeForm } from "@/hooks/useTradeForm";
import { addTerminalActionListener } from "@/lib/terminalActions";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useOrdersStore } from "@/store/ordersStore";
import { useWallet } from "@/components/wallet/useWallet";
import { useNetworkStore } from "@/store/networkStore";
import { getParadexSigner } from "@/services/paradex/l2Signer";
import { toParadexMarketSymbol } from "@hyperx/types/common";
import { WalletConnectDialog } from "@/components/wallet/WalletConnectDialog";
import { useQuery } from "@tanstack/react-query";
import { usePaperTradingStore } from "@/store/paperTradingStore";

export type TradeOrder = {
  market: string;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop";
  size: string;
  price?: string;
  stopPrice?: string;
  takeProfit?: string;
  stopLoss?: string;
  leverage?: number;
};

type TradeFormProps = {
  onSubmit?: (order: TradeOrder) => Promise<void> | void;
};

export function TradeForm({ onSubmit }: TradeFormProps) {
  const activeMarket = useMarketStore((s) => s.activeMarket);
  const market = useMarketStore((s) => s.markets.find((item) => item.symbol === s.activeMarket));
  const createOptimisticOrder = useOrdersStore((state) => state.createOptimisticOrder);
  const acknowledgeOrder = useOrdersStore((state) => state.acknowledgeOrder);
  const rejectOrder = useOrdersStore((state) => state.rejectOrder);
  const isWalletConnected = useWallet((state) => state.isConnected);
  const isPaperWallet = useWallet((state) => state.isPaperWallet);
  const isPaperTrading = useNetworkStore((s) => s.isPaperTrading) || isPaperWallet;
  const canTrade = isWalletConnected || isPaperTrading;
  const paperBalance = usePaperTradingStore((s) => s.balance);
  const paperPositions = usePaperTradingStore((s) => s.positions);
  const paperPosition = paperPositions.find((p) => p.market === activeMarket);
  const faucet = usePaperTradingStore((s) => s.faucet);
  const paperMarginUsed = paperPositions.reduce((acc, p) => acc + p.margin, 0);
  const paperPnl = paperPositions.reduce((acc, p) => acc + p.pnl, 0);
  const paperEquity = paperBalance + paperMarginUsed + paperPnl;

  const setSizePercentage = (percent: number) => {
    const priceRef = market?.lastPrice || (orderType === "limit" ? Number(price) : 0);
    if (priceRef <= 0) return;
    const availableFunds = isPaperTrading ? paperBalance : (account?.available || 0);
    if (availableFunds <= 0) return;
    const maxNotional = availableFunds * leverage * (percent / 100);
    const calculatedSize = maxNotional / priceRef;
    setSize(calculatedSize.toFixed(4));
  };
  const { data: accountData } = useQuery({
    queryKey: ["account-summary"],
    queryFn: getAccountSummary,
    enabled: isWalletConnected && !isPaperTrading,
    staleTime: 30_000,
  });
  const account = accountData ?? null;
  const { registerShortcut, unregisterShortcut } = useKeyboardShortcuts();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit" | "stop">("market");
  const [size, setSize] = useState("");
  const [price, setPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [leverage, setLeverage] = useState(10);
  const [executionPreset, setExecutionPreset] = useState<"cross" | "scaled" | "classic">("cross");
  const [reduceOnly, setReduceOnly] = useState(false);
  const [bracketEnabled, setBracketEnabled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [walletPromptOpen, setWalletPromptOpen] = useState(false);
  const sizeInputRef = useRef<HTMLInputElement | null>(null);
  const priceInputRef = useRef<HTMLInputElement | null>(null);
  const stopPriceInputRef = useRef<HTMLInputElement | null>(null);

  const resetForm = () => {
    setSize("");
    setPrice("");
    setStopPrice("");
    setTakeProfit("");
    setStopLoss("");
    setLeverage(10);
    setOrderType("market");
  };

  const {
    errors,
    isValid,
    notional,
    margin,
    liquidationEstimate,
  } = useTradeForm({
    market: activeMarket,
    side,
    type: orderType,
    size,
    price,
    stopPrice,
    takeProfit,
    stopLoss,
    leverage,
    lastPrice: market?.lastPrice,
  });

  const walletAccount = useWallet((state) => state.account);

  const submit = async () => {
    if (isSubmitting || !isValid) return;
    const order: PlaceOrderPayload = {
      market: activeMarket,
      side,
      type: orderType,
      size,
      price: orderType === "limit" ? price : undefined,
      stopPrice: orderType === "stop" ? stopPrice : undefined,
      takeProfit: takeProfit || undefined,
      stopLoss: stopLoss || undefined,
      leverage,
    };
    setIsSubmitting(true);
    const effectivePrice = market?.lastPrice || Number(price) || Number(stopPrice) || 100;
    const optimisticOrderId = createOptimisticOrder(order, effectivePrice);
    try {
      if (isPaperTrading) {
        const res = usePaperTradingStore.getState().executeOrder(
          {
            market: activeMarket,
            side,
            type: orderType,
            size,
            price: orderType === "limit" ? price : undefined,
            stopPrice: orderType === "stop" ? stopPrice : undefined,
            leverage,
          },
          effectivePrice
        );
        acknowledgeOrder(optimisticOrderId, res.orderId);
        toast.success(
          `⚡ Paper ${orderType.toUpperCase()} ${res.status}: ${side.toUpperCase()} ${size} ${activeMarket} @ $${res.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        );
        resetForm();
        return;
      }

      if (onSubmit) {
        await onSubmit(order);
        acknowledgeOrder(optimisticOrderId, optimisticOrderId);
        toast.success("Order submitted");
      } else {
        const signer = getParadexSigner(walletAccount);
        if (signer) {
          try {
            const network = useNetworkStore.getState().network;
            const chainId =
              network === "mainnet"
                ? "PRIVATE_SN_PARADEX_MAINNET"
                : "PRIVATE_SN_PARADEX_SEPOLIA";
            const signed = await signer.signOrder({
              market: toParadexMarketSymbol(activeMarket),
              side: side === "buy" ? "BUY" : "SELL",
              orderType:
                orderType === "limit"
                  ? "LIMIT"
                  : orderType === "stop"
                    ? "STOP_MARKET"
                    : "MARKET",
              size,
              price: orderType === "limit" ? price : undefined,
              chainId,
            });
            order.signature = signed.signature;
            order.signatureTimestamp = signed.signatureTimestamp;
          } catch (e) {
            console.warn("Client signing skipped or failed:", e);
          }
        }
        const placed = await placeOrder(order);
        acknowledgeOrder(optimisticOrderId, placed.id);
        toast.success(`Order submitted (${placed.id})`);
      }
      resetForm();
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { error?: string; message?: string } } })
          ?.response?.data?.message ||
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ||
        (err instanceof Error ? err.message : null) ||
        "Order submission failed";
      rejectOrder(optimisticOrderId, errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    setConfirmOpen(false);
  }, [activeMarket]);

  useEffect(() => {
    if (!canTrade) return;

    return addTerminalActionListener((action) => {
      if (action.type === "focus-trade-form" || action.type === "focus-size-input") {
        sizeInputRef.current?.focus();
        return;
      }

      if (action.type === "set-order-side") {
        setSide(action.side);
        sizeInputRef.current?.focus();
        return;
      }

      if (action.type === "set-order-type") {
        setOrderType(action.orderType);
        const targetRef = action.orderType === "limit" ? priceInputRef : action.orderType === "stop" ? stopPriceInputRef : sizeInputRef;
        targetRef.current?.focus();
        return;
      }

      if (action.type === "prepare-order") {
        setSide(action.side);
        setOrderType(action.orderType);
        const targetRef =
          action.focusField === "price"
            ? priceInputRef
            : action.focusField === "stop"
              ? stopPriceInputRef
              : sizeInputRef;
        window.setTimeout(() => targetRef.current?.focus(), 0);
      }
    });
  }, [canTrade]);

  useEffect(() => {
    if (!canTrade) return;

    const shortcuts = [
      {
        key: "b",
        description: "Prepare buy order",
        action: () => {
          setSide("buy");
          sizeInputRef.current?.focus();
        },
      },
      {
        key: "s",
        description: "Prepare sell order",
        action: () => {
          setSide("sell");
          sizeInputRef.current?.focus();
        },
      },
      {
        key: "m",
        description: "Switch to market order",
        action: () => {
          setOrderType("market");
          sizeInputRef.current?.focus();
        },
      },
      {
        key: "l",
        description: "Switch to limit order",
        action: () => {
          setOrderType("limit");
          window.setTimeout(() => priceInputRef.current?.focus(), 0);
        },
      },
    ] as const;

    shortcuts.forEach((shortcut) =>
      registerShortcut({
        key: shortcut.key,
        description: shortcut.description,
        action: shortcut.action,
        scope: "terminal",
      })
    );

    return () => {
      shortcuts.forEach((shortcut) => unregisterShortcut(shortcut.key));
    };
  }, [isWalletConnected, registerShortcut, unregisterShortcut]);

  return (
    <div id="terminal-trade-form" className="flex h-full min-h-0 flex-col bg-[#091416] text-[#c8d4d7] overflow-y-auto">
      {/* ── Preset selector ── */}
      <div className="grid grid-cols-3 gap-1.5 border-b border-[#1a2830] bg-[#0a1518] p-2.5">
        {(
          [
            { value: "cross", label: "Cross" },
            { value: "scaled", label: `${leverage}x` },
            { value: "classic", label: "Classic" },
          ] as const
        ).map((preset) => (
          <button
            key={preset.value}
            onClick={() => setExecutionPreset(preset.value)}
            className={cn(
              "rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
              executionPreset === preset.value
                ? "bg-[#16272c] text-[#22d3ee] border border-[#1d4a50]"
                : "bg-[#0c181b] text-[#6b7c82] hover:bg-[#112025] hover:text-[#c8d4d7]"
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* ── Order type tabs ── */}
      <div className="grid grid-cols-3 border-b border-[#1a2830] bg-[#081214]">
        {(["market", "limit", "stop"] as const).map((value) => (
          <button
            key={value}
            onClick={() => setOrderType(value)}
            className={cn(
              "py-2 text-xs font-semibold uppercase tracking-wider transition-colors",
              orderType === value
                ? "border-b-2 border-[#22d3ee] bg-[#0c181b] text-white"
                : "text-[#64748b] hover:bg-[#0a1518] hover:text-[#c8d4d7]"
            )}
          >
            {value}
          </button>
        ))}
      </div>

      {/* ── Side selection: Buy / Long vs Sell / Short ── */}
      <div className="grid grid-cols-2 border-b border-[#1a2830]">
        <button
          onClick={() => setSide("buy")}
          className={cn(
            "py-2.5 text-xs font-bold uppercase tracking-wider transition-colors",
            side === "buy"
              ? "bg-[#00d084] text-[#051518]"
              : "bg-[#091416] text-[#7f8c90] hover:bg-[#0c181b] hover:text-white"
          )}
        >
          Buy / Long
        </button>
        <button
          onClick={() => setSide("sell")}
          className={cn(
            "py-2.5 text-xs font-bold uppercase tracking-wider transition-colors",
            side === "sell"
              ? "bg-[#ff4757] text-white"
              : "bg-[#091416] text-[#7f8c90] hover:bg-[#0c181b] hover:text-white"
          )}
        >
          Sell / Short
        </button>
      </div>

      {/* ── Form Inputs ── */}
      <div className="flex flex-1 flex-col gap-3 p-3 min-h-0">
        {/* Account balance preview */}
        <div className="space-y-1.5 border-b border-[#1a2830] pb-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[#64748b]">Available to Trade</span>
            <span className="font-mono font-medium text-white">
              {isPaperTrading
                ? `${paperBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`
                : isWalletConnected && account
                  ? `${account.available.toFixed(2)} USDC`
                  : isWalletConnected
                    ? "Loading..."
                    : "0.00 USDC"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#64748b]">Current Position</span>
            <span className="font-mono text-white">
              {isPaperTrading
                ? paperPosition
                  ? `${paperPosition.side.toUpperCase()} ${paperPosition.size} (${paperPosition.pnl >= 0 ? "+" : ""}$${paperPosition.pnl.toFixed(2)})`
                  : "None"
                : isWalletConnected && account
                  ? `${(account.balance - account.available).toFixed(2)} USDC`
                  : isWalletConnected
                    ? "Loading..."
                    : "None"}
            </span>
          </div>
        </div>

        {/* Size Input + Quick % buttons */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-[#64748b]">Size</label>
            <span className="font-mono text-xs text-[#64748b]">{activeMarket.split("-")[0]}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              ref={sizeInputRef}
              type="number"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              placeholder="0.00"
              className="flex-1 rounded border border-[#1a2830] bg-[#0c181b] px-3 py-2 font-mono text-sm text-white placeholder-[#3e4f55] outline-none focus:border-[#22d3ee]"
            />
            <button
              type="button"
              className="rounded border border-[#1a2830] bg-[#0c181b] px-3 py-2 text-xs font-medium text-[#64748b] hover:border-[#2a3a44] hover:text-[#c8d4d7]"
              onClick={() => setSizePercentage(100)}
            >
              Max
            </button>
          </div>
          {/* Quick percentage buttons */}
          <div className="grid grid-cols-4 gap-1 pt-0.5">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setSizePercentage(pct)}
                className="rounded border border-[#142327] bg-[#0a1518] py-1 text-[11px] font-mono text-[#64748b] transition-colors hover:border-[#22d3ee]/40 hover:text-[#22d3ee]"
              >
                {pct}%
              </button>
            ))}
          </div>
          {errors.size && (
            <p className="text-xs text-[#ff4757]">{errors.size}</p>
          )}
        </div>

        {/* Limit Price */}
        {orderType === "limit" && (
          <div className="space-y-1.5">
            <label className="text-xs text-[#64748b]">Limit Price</label>
            <input
              ref={priceInputRef}
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="w-full rounded border border-[#1a2830] bg-[#0c181b] px-3 py-2 font-mono text-sm text-white placeholder-[#3e4f55] outline-none focus:border-[#22d3ee]"
            />
            {errors.price && (
              <p className="text-xs text-[#ff4757]">{errors.price}</p>
            )}
          </div>
        )}

        {/* Stop Price */}
        {orderType === "stop" && (
          <div className="space-y-1.5">
            <label className="text-xs text-[#64748b]">Stop Price</label>
            <input
              ref={stopPriceInputRef}
              type="number"
              value={stopPrice}
              onChange={(e) => setStopPrice(e.target.value)}
              placeholder="0.00"
              className="w-full rounded border border-[#1a2830] bg-[#0c181b] px-3 py-2 font-mono text-sm text-white placeholder-[#3e4f55] outline-none focus:border-[#22d3ee]"
            />
            {errors.stopPrice && (
              <p className="text-xs text-[#ff4757]">{errors.stopPrice}</p>
            )}
          </div>
        )}

        {/* Reduce only & TP/SL toggles */}
        <div className="grid grid-cols-2 gap-2">
          <ToggleField
            label="Reduce Only"
            checked={reduceOnly}
            onToggle={() => setReduceOnly((value) => !value)}
          />
          <ToggleField
            label="TP / SL"
            checked={bracketEnabled}
            onToggle={() => setBracketEnabled((value) => !value)}
          />
        </div>

        {/* Order details summary box */}
        <div className="space-y-1.5 rounded border border-[#1a2830] bg-[#0c181b] p-2.5">
          <InfoRow label="Est. Entry" value={market?.lastPrice ? `$${market.lastPrice.toFixed(2)}` : "--"} />
          <InfoRow 
            label="Liq. Price" 
            value={liquidationEstimate ? `$${liquidationEstimate.toFixed(2)}` : "--"} 
          />
          <InfoRow 
            label="Margin" 
            value={margin ? `$${margin.toFixed(2)}` : "--"}
          />
          <InfoRow 
            label="Notional" 
            value={notional ? `$${notional.toFixed(2)}` : "--"}
          />
          <InfoRow 
            label="Slippage" 
            value="0.00%"
            suffix="Est: 0% / Max: 0.05%"
          />
          <InfoRow 
            label="Fee" 
            value="0.035%"
            suffix="$0.00"
          />
        </div>

        {/* Leverage slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-[#64748b]">Leverage</label>
            <span className="font-mono text-xs font-semibold text-[#22d3ee]">{leverage}x</span>
          </div>
          <input
            type="range"
            min={1}
            max={50}
            value={leverage}
            onChange={(e) => setLeverage(Number(e.target.value))}
            className="w-full accent-[#00d084]"
          />
          <div className="flex items-center justify-between text-[10px] text-[#506068]">
            <span>1x</span>
            <span>25x</span>
            <span>50x</span>
          </div>
        </div>

        {/* Action CTA buttons */}
        {!canTrade ? (
          <div className="space-y-2 pt-1">
            <button
              onClick={() => useWallet.getState().setModalOpen(true)}
              className="w-full rounded bg-[#22d3ee] py-3 text-center text-sm font-bold text-[#051518] transition-colors hover:bg-[#38e1fa]"
            >
              Connect Wallet
            </button>
            <button
              onClick={() => useWallet.getState().setModalOpen(true)}
              className="w-full rounded border border-[#1d4a50] bg-[#0e252a] py-2 text-center text-xs font-semibold text-[#22d3ee] transition-colors hover:bg-[#102c32]"
            >
              ⚡ Instant Paper Trading ($10k)
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => {
                setSide("buy");
                setConfirmOpen(true);
              }}
              disabled={isSubmitting || !isValid}
              className="rounded bg-[#00d084] px-4 py-3 text-sm font-bold text-black transition-colors hover:bg-[#00e090] disabled:opacity-50"
            >
              {isPaperTrading ? "Buy / Long" : "Buy / Long"}
            </button>
            <button
              onClick={() => {
                setSide("sell");
                setConfirmOpen(true);
              }}
              disabled={isSubmitting || !isValid}
              className="rounded bg-[#ff4757] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#ff5e6c] disabled:opacity-50"
            >
              {isPaperTrading ? "Sell / Short" : "Sell / Short"}
            </button>
          </div>
        )}
      </div>

      {/* ── Unified Account Summary (Hyperliquid style) ── */}
      <div className="mt-auto border-t border-[#1a2830] bg-[#071113] p-3 space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              if (isPaperTrading) {
                faucet(10000);
                toast.success("Added $10,000 virtual USDC");
              } else {
                toast.info("Starknet bridge & deposit portal");
              }
            }}
            className="rounded border border-[#1a2830] bg-[#0a171a] py-1.5 text-center text-xs font-medium text-[#c8d4d7] hover:border-[#2a3a44] hover:bg-[#0e2024]"
          >
            {isPaperTrading ? "Deposit (Faucet)" : "Deposit"}
          </button>
          <button
            onClick={() => {
              if (isPaperTrading) {
                toast.info("Withdraw disabled in paper trading simulation");
              } else {
                toast.info("Starknet withdrawal portal");
              }
            }}
            className="rounded border border-[#1a2830] bg-[#0a171a] py-1.5 text-center text-xs font-medium text-[#c8d4d7] hover:border-[#2a3a44] hover:bg-[#0e2024]"
          >
            Withdraw
          </button>
        </div>

        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[#506068]">
            <span>Account Summary</span>
            <span className="font-mono text-[#22d3ee]">{isPaperTrading ? "Paper Sim" : "Starknet L2"}</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#64748b]">Portfolio Value</span>
            <span className="font-mono font-medium text-white">
              ${isPaperTrading ? paperEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (account ? account.balance.toFixed(2) : "0.00")}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#64748b]">Available Margin</span>
            <span className="font-mono font-medium text-white">
              ${isPaperTrading ? paperBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (account ? account.available.toFixed(2) : "0.00")}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#64748b]">Unrealized PNL</span>
            <span className={cn("font-mono font-medium", (isPaperTrading ? paperPnl : 0) >= 0 ? "text-[#00d084]" : "text-[#ff4757]")}>
              {(isPaperTrading ? paperPnl : 0) >= 0 ? "+" : ""}${isPaperTrading ? paperPnl.toFixed(2) : "0.00"}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#64748b]">Account Leverage</span>
            <span className="font-mono font-medium text-white">
              {isPaperTrading && paperEquity > 0 ? `${((paperMarginUsed * leverage) / paperEquity).toFixed(2)}x` : "0.00x"}
            </span>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="border-[#2a2a2e] bg-[#0d0d0f]">
          <DialogHeader>
            <DialogTitle className="text-white">
              {isPaperTrading ? "⚡ Confirm Paper Order (Simulated)" : "Confirm Order"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[#6b6b74]">Market</span>
              <span className="font-semibold text-white">{activeMarket}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#6b6b74]">Side</span>
              <span className={side === "buy" ? "text-[#00d084]" : "text-[#ff4757]"}>
                {side === "buy" ? "Buy / Long" : "Sell / Short"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#6b6b74]">Type</span>
              <span className="font-semibold text-white uppercase">{orderType}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#6b6b74]">Size</span>
              <span className="font-mono text-white">{size} {activeMarket}</span>
            </div>
            {orderType !== "market" && (
              <div className="flex items-center justify-between">
                <span className="text-[#6b6b74]">
                  {orderType === "limit" ? "Limit Price" : "Stop Price"}
                </span>
                <span className="font-mono text-white">
                  ${orderType === "limit" ? price : stopPrice}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[#6b6b74]">Leverage</span>
              <span className="font-semibold text-white">{leverage}x</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#6b6b74]">Margin</span>
              <span className="font-mono text-white">
                {margin ? `$${margin.toFixed(2)}` : "--"}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button 
              variant="outline" 
              onClick={() => setConfirmOpen(false)}
              className="border-[#2a2a2e] bg-transparent text-white hover:bg-[#1a1a1e]"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setConfirmOpen(false);
                await submit();
              }}
              disabled={isSubmitting || !isValid}
              className={cn(
                "font-semibold",
                side === "buy" 
                  ? "bg-[#00d084] text-black hover:bg-[#00e090]" 
                  : "bg-[#ff4757] text-white hover:bg-[#ff5e6c]"
              )}
            >
              {isSubmitting ? "Submitting..." : "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <WalletConnectDialog
        open={walletPromptOpen}
        onOpenChange={setWalletPromptOpen}
        title="Connect to trade"
        description="Trading actions are disabled until you connect a Starknet wallet."
      />
    </div>
  );
}

function InfoRow({ 
  label, 
  value, 
  suffix 
}: { 
  label: string; 
  value: string; 
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[#6b6b74]">{label}</span>
      <div className="flex items-center gap-1">
        <span className="font-mono text-white">{value}</span>
        {suffix && <span className="text-[#4a4a52]">{suffix}</span>}
      </div>
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex items-center justify-between rounded-md border px-3 py-2 text-xs transition-colors",
        checked
          ? "border-[#53d8c8] bg-[#102125] text-white"
          : "border-[#253237] bg-[#11181b] text-[#7f8c90] hover:border-[#304046] hover:text-[#d4dbdd]"
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "h-3.5 w-3.5 rounded-sm border",
          checked ? "border-[#53d8c8] bg-[#53d8c8]" : "border-[#435459]"
        )}
      />
    </button>
  );
}
