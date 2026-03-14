/**
 * Audit Log Viewer Component
 * 
 * Activity history with filtering and export capabilities.
 * See docs/phase5/index.md for implementation details.
 */

import { useState, useMemo } from "react";
import { History, Download, Search, ChevronLeft, ChevronRight } from "lucide-react";

type AuditAction = 
  | "order_created" 
  | "order_cancelled" 
  | "order_filled"
  | "position_closed"
  | "deposit"
  | "withdrawal"
  | "api_key_created"
  | "api_key_revoked"
  | "login"
  | "logout"
  | "settings_changed";

type AuditSeverity = "info" | "warning" | "critical";

interface AuditLog {
  id: string;
  timestamp: number;
  userId: string;
  userEmail: string;
  action: AuditAction;
  severity: AuditSeverity;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
}

interface AuditLogViewerProps {
  logs: AuditLog[];
  onExport: (logs: AuditLog[], format: "csv" | "json") => void;
}

export function AuditLogViewer({ logs, onExport }: AuditLogViewerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<AuditAction | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<AuditSeverity | "all">("all");
  const [dateRange] = useState<{ start?: number; end?: number }>({});
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          log.userEmail.toLowerCase().includes(searchLower) ||
          log.action.toLowerCase().includes(searchLower) ||
          log.ipAddress.includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Action filter
      if (actionFilter !== "all" && log.action !== actionFilter) return false;

      // Severity filter
      if (severityFilter !== "all" && log.severity !== severityFilter) return false;

      // Date range filter
      if (dateRange.start && log.timestamp < dateRange.start) return false;
      if (dateRange.end && log.timestamp > dateRange.end) return false;

      return true;
    }).sort((a, b) => b.timestamp - a.timestamp);
  }, [logs, searchTerm, actionFilter, severityFilter, dateRange]);

  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

  const formatTimestamp = (ts: number): string => {
    return new Date(ts).toLocaleString();
  };

  const getActionIcon = (action: AuditAction) => {
    const iconMap: Record<AuditAction, string> = {
      order_created: "📝",
      order_cancelled: "❌",
      order_filled: "✅",
      position_closed: "🔒",
      deposit: "📥",
      withdrawal: "📤",
      api_key_created: "🔑",
      api_key_revoked: "🚫",
      login: "🔓",
      logout: "🔐",
      settings_changed: "⚙️",
    };
    return iconMap[action] || "📋";
  };

  const getSeverityColor = (severity: AuditSeverity): string => {
    const colors: Record<AuditSeverity, string> = {
      info: "text-slate-400",
      warning: "text-amber-400",
      critical: "text-red-400",
    };
    return colors[severity];
  };

  const handleExportCSV = () => {
    const headers = ["Timestamp", "User", "Action", "Severity", "IP Address", "Details"];
    const rows = filteredLogs.map(log => [
      new Date(log.timestamp).toISOString(),
      log.userEmail,
      log.action,
      log.severity,
      log.ipAddress,
      JSON.stringify(log.details),
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    onExport(filteredLogs, "csv");
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <History className="w-4 h-4" />
          Audit Logs
        </h3>
        <button
          onClick={handleExportCSV}
          className="text-xs flex items-center gap-1 text-primary hover:underline"
        >
          <Download className="w-3 h-3" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by email, action, IP..."
              className="w-full bg-muted rounded-lg pl-9 pr-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as AuditAction | "all")}
            className="bg-muted rounded-lg px-3 py-1.5 text-xs"
          >
            <option value="all">All Actions</option>
            <option value="order_created">Order Created</option>
            <option value="order_cancelled">Order Cancelled</option>
            <option value="order_filled">Order Filled</option>
            <option value="position_closed">Position Closed</option>
            <option value="deposit">Deposit</option>
            <option value="withdrawal">Withdrawal</option>
            <option value="login">Login</option>
            <option value="logout">Logout</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as AuditSeverity | "all")}
            className="bg-muted rounded-lg px-3 py-1.5 text-xs"
          >
            <option value="all">All Severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>Total: {logs.length}</span>
        <span>Filtered: {filteredLogs.length}</span>
        <span>Page {currentPage} of {totalPages}</span>
      </div>

      {/* Log List */}
      <div className="space-y-1 max-h-96 overflow-y-auto">
        {paginatedLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No logs match your filters
          </p>
        ) : (
          paginatedLogs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
            >
              <span className="text-lg">{getActionIcon(log.action)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium capitalize">
                    {log.action.replace(/_/g, " ")}
                  </p>
                  <span className={`text-xs ${getSeverityColor(log.severity)}`}>
                    {log.severity}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {log.userEmail} • {formatTimestamp(log.timestamp)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  IP: {log.ipAddress}
                </p>
                {Object.keys(log.details).length > 0 && (
                  <details className="mt-1">
                    <summary className="text-[10px] text-primary cursor-pointer">
                      View Details
                    </summary>
                    <pre className="text-[10px] bg-background rounded p-2 mt-1 overflow-x-auto">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <span className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export type { AuditLog, AuditAction, AuditSeverity, AuditLogViewerProps };
