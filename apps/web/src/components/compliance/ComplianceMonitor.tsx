/**
 * Compliance Monitor Component
 * 
 * Real-time compliance checking and rule violation alerts.
 * See docs/phase5/index.md for implementation details.
 */

import { useMemo } from "react";
import { Shield, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

type ComplianceRule = 
  | "position_size_limit"
  | "max_drawdown_limit"
  | "daily_loss_limit"
  | "concentration_limit"
  | "wash_trade_detection"
  | "api_rate_limit";

type ComplianceStatus = "pass" | "warning" | "violation";

interface ComplianceCheck {
  rule: ComplianceRule;
  status: ComplianceStatus;
  current: number;
  limit: number;
  severity: "low" | "medium" | "high";
  message: string;
  lastChecked: number;
}

interface ComplianceMonitorProps {
  checks: ComplianceCheck[];
  isCompliant: boolean;
  onAcknowledge: (rule: ComplianceRule) => void;
}

export function ComplianceMonitor({ 
  checks, 
  isCompliant, 
  onAcknowledge 
}: ComplianceMonitorProps) {
  const groupedChecks = useMemo(() => {
    return {
      violations: checks.filter(c => c.status === "violation"),
      warnings: checks.filter(c => c.status === "warning"),
      passed: checks.filter(c => c.status === "pass"),
    };
  }, [checks]);

  const getStatusIcon = (status: ComplianceStatus) => {
    switch (status) {
      case "pass":
        return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case "violation":
        return <XCircle className="w-5 h-5 text-red-400" />;
    }
  };

  const getSeverityBadge = (severity: ComplianceCheck["severity"]) => {
    const colors = {
      low: "bg-slate-500/20 text-slate-400",
      medium: "bg-amber-500/20 text-amber-400",
      high: "bg-red-500/20 text-red-400",
    };
    return (
      <span className={`text-[10px] px-2 py-0.5 rounded ${colors[severity]}`}>
        {severity.toUpperCase()}
      </span>
    );
  };

  const formatRuleName = (rule: ComplianceRule): string => {
    return rule
      .split("_")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const calculateUtilization = (current: number, limit: number): number => {
    return Math.min(100, (current / limit) * 100);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Compliance Monitor
        </h3>
        <span className={`text-xs px-2 py-1 rounded-full ${
          isCompliant 
            ? "bg-emerald-500/20 text-emerald-400" 
            : "bg-red-500/20 text-red-400"
        }`}>
          {isCompliant ? "COMPLIANT" : "VIOLATIONS"}
        </span>
      </div>

      {/* Violations Section */}
      {groupedChecks.violations.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 text-red-400">
            <XCircle className="w-4 h-4" />
            <span className="text-sm font-medium">
              {groupedChecks.violations.length} Violation{groupedChecks.violations.length !== 1 ? "s" : ""}
            </span>
          </div>
          {groupedChecks.violations.map((check) => (
            <div
              key={check.rule}
              className="bg-card rounded-lg p-3 space-y-2"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-red-400">
                    {formatRuleName(check.rule)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {check.message}
                  </p>
                </div>
                {getSeverityBadge(check.severity)}
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    {check.current.toFixed(2)} / {check.limit}
                  </span>
                  <span className="text-red-400">
                    {calculateUtilization(check.current, check.limit).toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500"
                    style={{ width: `${calculateUtilization(check.current, check.limit)}%` }}
                  />
                </div>
              </div>
              <button
                onClick={() => onAcknowledge(check.rule)}
                className="text-xs text-red-400 hover:underline"
              >
                Acknowledge
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Warnings Section */}
      {groupedChecks.warnings.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">
              {groupedChecks.warnings.length} Warning{groupedChecks.warnings.length !== 1 ? "s" : ""}
            </span>
          </div>
          {groupedChecks.warnings.map((check) => (
            <div
              key={check.rule}
              className="bg-card rounded-lg p-3 space-y-2"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-400">
                    {formatRuleName(check.rule)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {check.message}
                  </p>
                </div>
                {getSeverityBadge(check.severity)}
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    {check.current.toFixed(2)} / {check.limit}
                  </span>
                  <span className="text-amber-400">
                    {calculateUtilization(check.current, check.limit).toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400"
                    style={{ width: `${calculateUtilization(check.current, check.limit)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Passed Rules */}
      {groupedChecks.passed.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            Passed Checks ({groupedChecks.passed.length})
          </div>
          <div className="space-y-1">
            {groupedChecks.passed.slice(0, 3).map((check) => (
              <div
                key={check.rule}
                className="flex items-center justify-between p-2 bg-muted rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm">{formatRuleName(check.rule)}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {calculateUtilization(check.current, check.limit).toFixed(1)}%
                </span>
              </div>
            ))}
            {groupedChecks.passed.length > 3 && (
              <p className="text-xs text-muted-foreground text-center">
                +{groupedChecks.passed.length - 3} more passed
              </p>
            )}
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-emerald-500/10 rounded-lg p-2">
          <p className="text-lg font-bold text-emerald-400">
            {groupedChecks.passed.length}
          </p>
          <p className="text-[10px] text-muted-foreground">Passed</p>
        </div>
        <div className="bg-amber-500/10 rounded-lg p-2">
          <p className="text-lg font-bold text-amber-400">
            {groupedChecks.warnings.length}
          </p>
          <p className="text-[10px] text-muted-foreground">Warnings</p>
        </div>
        <div className="bg-red-500/10 rounded-lg p-2">
          <p className="text-lg font-bold text-red-400">
            {groupedChecks.violations.length}
          </p>
          <p className="text-[10px] text-muted-foreground">Violations</p>
        </div>
      </div>
    </div>
  );
}

export type { ComplianceRule, ComplianceStatus, ComplianceCheck };
