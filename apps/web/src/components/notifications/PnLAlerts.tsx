/**
 * PnL Alerts Component
 * 
 * Advanced notification system for profit/loss thresholds.
 * See docs/phase4/index.md for implementation details.
 */

import { useState, useEffect, useCallback } from "react";
import { Bell, Trash2 } from "lucide-react";

interface Alert {
  id: string;
  type: "pnl_absolute" | "pnl_percent" | "price_target" | "drawdown";
  condition: "above" | "below";
  value: number;
  market?: string; // Optional: specific market or "portfolio" for all
  triggered: boolean;
  createdAt: number;
}

interface PnLAlertsProps {
  portfolioPnl: number;
  portfolioPnlPercent: number;
  maxDrawdown: number;
  positions: { market: string; pnl: number; pnlPercent: number; markPrice: number }[];
  onAlertTrigger: (alert: Alert) => void;
}

export function PnLAlerts({
  portfolioPnl,
  portfolioPnlPercent,
  maxDrawdown,
  positions,
  onAlertTrigger,
}: PnLAlertsProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newAlert, setNewAlert] = useState<Partial<Alert>>({
    type: "pnl_percent",
    condition: "above",
    value: 10,
    market: "portfolio",
  });

  // Check alerts against current PnL
  useEffect(() => {
    alerts.forEach(alert => {
      if (alert.triggered) return;

      let currentValue: number;
      switch (alert.type) {
        case "pnl_absolute":
          currentValue = alert.market === "portfolio" 
            ? portfolioPnl 
            : (positions.find(p => p.market === alert.market)?.pnl || 0);
          break;
        case "pnl_percent":
          currentValue = alert.market === "portfolio"
            ? portfolioPnlPercent
            : (positions.find(p => p.market === alert.market)?.pnlPercent || 0);
          break;
        case "drawdown":
          currentValue = Math.abs(maxDrawdown);
          break;
        default:
          return;
      }

      const shouldTrigger = alert.condition === "above" 
        ? currentValue >= alert.value
        : currentValue <= alert.value;

      if (shouldTrigger) {
        const triggeredAlert = { ...alert, triggered: true };
        setAlerts(prev => prev.map(a => a.id === alert.id ? triggeredAlert : a));
        onAlertTrigger(triggeredAlert);
      }
    });
  }, [portfolioPnl, portfolioPnlPercent, maxDrawdown, positions, alerts, onAlertTrigger]);

  const addAlert = useCallback(() => {
    if (!newAlert.type || !newAlert.condition || newAlert.value === undefined) return;

    const alert: Alert = {
      id: Math.random().toString(36).substr(2, 9),
      type: newAlert.type,
      condition: newAlert.condition,
      value: newAlert.value,
      market: newAlert.market || "portfolio",
      triggered: false,
      createdAt: Date.now(),
    };

    setAlerts(prev => [...prev, alert]);
    setShowForm(false);
  }, [newAlert]);

  const removeAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const getAlertLabel = (alert: Alert): string => {
    const typeLabels: Record<string, string> = {
      pnl_absolute: "PnL $",
      pnl_percent: "PnL %",
      price_target: "Price",
      drawdown: "Drawdown",
    };

    const conditionSymbol = alert.condition === "above" ? "≥" : "≤";
    
    if (alert.type === "pnl_absolute") {
      return `${typeLabels[alert.type]} ${conditionSymbol} $${alert.value.toFixed(2)}`;
    }
    if (alert.type === "pnl_percent" || alert.type === "drawdown") {
      return `${typeLabels[alert.type]} ${conditionSymbol} ${alert.value.toFixed(1)}%`;
    }
    return `${typeLabels[alert.type]} ${conditionSymbol} ${alert.value}`;
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Bell className="w-4 h-4" />
          PnL Alerts
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs text-primary hover:underline"
        >
          {showForm ? "Cancel" : "Add Alert"}
        </button>
      </div>

      {/* Add Alert Form */}
      {showForm && (
        <div className="bg-muted rounded-lg p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">
                Type
              </label>
              <select
                value={newAlert.type}
                onChange={(e) => setNewAlert({ ...newAlert, type: e.target.value as Alert["type"] })}
                className="w-full bg-card rounded px-2 py-1 text-sm"
              >
                <option value="pnl_absolute">PnL ($)</option>
                <option value="pnl_percent">PnL (%)</option>
                <option value="drawdown">Drawdown</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">
                Condition
              </label>
              <select
                value={newAlert.condition}
                onChange={(e) => setNewAlert({ ...newAlert, condition: e.target.value as Alert["condition"] })}
                className="w-full bg-card rounded px-2 py-1 text-sm"
              >
                <option value="above">Above</option>
                <option value="below">Below</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">
              {newAlert.type === "pnl_absolute" ? "Value ($)" : "Value (%)"}
            </label>
            <input
              type="number"
              value={newAlert.value}
              onChange={(e) => setNewAlert({ ...newAlert, value: Number(e.target.value) })}
              className="w-full bg-card rounded px-2 py-1 text-sm"
            />
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">
              Market (or &quot;portfolio&quot;)
            </label>
            <select
              value={newAlert.market}
              onChange={(e) => setNewAlert({ ...newAlert, market: e.target.value })}
              className="w-full bg-card rounded px-2 py-1 text-sm"
            >
              <option value="portfolio">Portfolio (All)</option>
              {positions.map(p => (
                <option key={p.market} value={p.market}>{p.market}</option>
              ))}
            </select>
          </div>

          <button
            onClick={addAlert}
            className="w-full py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
          >
            Create Alert
          </button>
        </div>
      )}

      {/* Active Alerts */}
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">
          Active Alerts ({alerts.filter(a => !a.triggered).length})
        </div>
        {alerts.filter(a => !a.triggered).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No active alerts
          </p>
        ) : (
          <div className="space-y-1">
            {alerts.filter(a => !a.triggered).map(alert => (
              <div
                key={alert.id}
                className="flex items-center justify-between p-2 bg-muted rounded-md"
              >
                <div className="flex items-center gap-2">
                  <Bell className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs">{getAlertLabel(alert)}</span>
                  <span className="text-[10px] text-muted-foreground">
                    ({alert.market})
                  </span>
                </div>
                <button
                  onClick={() => removeAlert(alert.id)}
                  className="p-1 hover:bg-destructive/20 rounded text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Triggered Alerts */}
      {alerts.filter(a => a.triggered).length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-emerald-400">
            Triggered ({alerts.filter(a => a.triggered).length})
          </div>
          <div className="space-y-1">
            {alerts.filter(a => a.triggered).map(alert => (
              <div
                key={alert.id}
                className="flex items-center justify-between p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-md"
              >
                <div className="flex items-center gap-2">
                  <Bell className="w-3 h-3 text-emerald-400" />
                  <span className="text-xs line-through opacity-70">
                    {getAlertLabel(alert)}
                  </span>
                </div>
                <button
                  onClick={() => removeAlert(alert.id)}
                  className="p-1 hover:bg-emerald-500/20 rounded text-emerald-400"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current Status */}
      <div className="bg-muted rounded-lg p-3 space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Portfolio PnL</span>
          <span className={portfolioPnl >= 0 ? "text-emerald-400" : "text-red-400"}>
            {portfolioPnl >= 0 ? "+" : ""}${portfolioPnl.toFixed(2)} 
            ({portfolioPnlPercent >= 0 ? "+" : ""}{portfolioPnlPercent.toFixed(2)}%)
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Max Drawdown</span>
          <span className="text-red-400">
            -${Math.abs(maxDrawdown).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}

export type { Alert };
