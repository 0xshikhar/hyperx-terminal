import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Share2, TrendingUp, TrendingDown, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Position } from "@/store/positionsStore";

interface PnLShareModalProps {
  position: Position | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PnLShareModal({ position, open, onOpenChange }: PnLShareModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  if (!position) return null;

  const isProfit = position.pnl >= 0;
  const pnlPercent = position.pnlPercent;
  const absPnlPercent = Math.abs(pnlPercent).toFixed(2);
  const formattedPnl = `${isProfit ? "+" : "-"}$${Math.abs(position.pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleShareOnTwitter = () => {
    const text = `Just hit ${isProfit ? "+" : ""}${pnlPercent.toFixed(2)}% on ${position.market} with ${position.leverage}x leverage on @HyperXTerminal! 🔥⚡\n\nEntry: $${position.entryPrice.toLocaleString()} | Mark: $${position.markPrice.toLocaleString()}\n\n#CryptoTrading #Perpetuals #Starknet`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleCopyCard = async () => {
    try {
      // Direct text summary copy to clipboard
      const summary = `HyperX Perp Position: ${position.side.toUpperCase()} ${position.market} (${position.leverage}x)\nROI: ${isProfit ? "+" : ""}${pnlPercent.toFixed(2)}% (${formattedPnl})\nEntry: $${position.entryPrice.toLocaleString()} | Mark: $${position.markPrice.toLocaleString()}`;
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      toast.success("Position stats copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[#1a2e35] bg-[#071317] p-0 text-white overflow-hidden shadow-2xl">
        <DialogHeader className="p-4 border-b border-[#14262c]">
          <DialogTitle className="flex items-center gap-2 font-mono text-sm tracking-wide text-[#a0b5ba]">
            <Share2 className="h-4 w-4 text-[#22d3ee]" />
            SHARE P&L CARD
          </DialogTitle>
        </DialogHeader>

        {/* ── Brag Card Container ── */}
        <div className="p-6">
          <div
            ref={cardRef}
            className={cn(
              "relative overflow-hidden rounded-xl border p-6 font-mono shadow-2xl transition-all",
              isProfit
                ? "border-[#00d084]/30 bg-gradient-to-br from-[#06241c] via-[#091a18] to-[#041013]"
                : "border-[#ff4757]/30 bg-gradient-to-br from-[#260a0f] via-[#1a080c] to-[#0a0406]"
            )}
          >
            {/* Background cyber grid & glow */}
            <div
              className={cn(
                "pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl opacity-20",
                isProfit ? "bg-[#00d084]" : "bg-[#ff4757]"
              )}
            />

            {/* Header: Logo & Market */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0e2a30] border border-[#22d3ee]/40 text-[#22d3ee] font-black text-xs">
                  HX
                </div>
                <div>
                  <div className="text-xs font-bold tracking-widest text-white">HYPERX</div>
                  <div className="text-[9px] text-[#6b858c] tracking-wider">PERPETUALS</div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    position.side === "long"
                      ? "bg-[#00d084]/20 text-[#00d084] border border-[#00d084]/40"
                      : "bg-[#ff4757]/20 text-[#ff4757] border border-[#ff4757]/40"
                  )}
                >
                  {position.side} {position.leverage}X
                </span>
                <span className="font-bold text-xs text-[#c8d4d7]">{position.market}</span>
              </div>
            </div>

            {/* Huge P&L Display */}
            <div className="my-6 text-center">
              <div className="text-[10px] uppercase tracking-widest text-[#728990] mb-1">
                Return on Equity
              </div>
              <div
                className={cn(
                  "flex items-center justify-center gap-2 text-4xl font-extrabold tracking-tight tabular-nums",
                  isProfit ? "text-[#00d084] drop-shadow-[0_0_15px_rgba(0,208,132,0.3)]" : "text-[#ff4757] drop-shadow-[0_0_15px_rgba(255,71,87,0.3)]"
                )}
              >
                {isProfit ? <TrendingUp className="h-8 w-8" /> : <TrendingDown className="h-8 w-8" />}
                <span>
                  {isProfit ? "+" : "-"}
                  {absPnlPercent}%
                </span>
              </div>
              <div className={cn("mt-1 text-sm font-semibold tabular-nums", isProfit ? "text-[#00d084]/80" : "text-[#ff4757]/80")}>
                {formattedPnl} USD
              </div>
            </div>

            {/* Price Grid */}
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-black/40 p-3 border border-white/5 text-[11px]">
              <div>
                <span className="text-[9px] uppercase tracking-wider text-[#637980] block">Entry Price</span>
                <span className="font-semibold text-white">${position.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="text-right">
                <span className="text-[9px] uppercase tracking-wider text-[#637980] block">Mark Price</span>
                <span className="font-semibold text-white">${position.markPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="mt-1">
                <span className="text-[9px] uppercase tracking-wider text-[#637980] block">Size</span>
                <span className="text-[#a5b8bc]">{position.size} {position.market.split("-")[0]}</span>
              </div>
              <div className="mt-1 text-right">
                <span className="text-[9px] uppercase tracking-wider text-[#637980] block">Margin</span>
                <span className="text-[#a5b8bc]">${position.margin.toFixed(2)}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-4 flex items-center justify-between text-[9px] text-[#4f646b] border-t border-white/5 pt-3">
              <span>POWERED BY HYPERX ENGINE</span>
              <span className="text-[#22d3ee]">terminal.hyperx.trade</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-4 flex items-center gap-2">
            <Button
              onClick={handleCopyCard}
              className="flex-1 bg-[#10242a] hover:bg-[#163038] text-white border border-[#1f424b] text-xs font-mono h-9"
            >
              {copied ? <Check className="mr-1.5 h-3.5 w-3.5 text-[#00d084]" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy Stats"}
            </Button>
            <Button
              onClick={handleShareOnTwitter}
              className="flex-1 bg-[#0e3b43] hover:bg-[#134d57] text-[#22d3ee] border border-[#22d3ee]/40 text-xs font-mono h-9 font-bold"
            >
              <Share2 className="mr-1.5 h-3.5 w-3.5" />
              Share on X
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
