/**
 * Multi-Account Manager Component
 * 
 * Switch between multiple trading accounts/sub-accounts.
 * See docs/phase5/index.md for implementation details.
 */

import { useState, useCallback } from "react";
import { Users, Plus, ChevronDown } from "lucide-react";

interface TradingAccount {
  id: string;
  name: string;
  type: "main" | "sub" | "margin" | "futures";
  balance: number;
  equity: number;
  marginUsed: number;
  marginAvailable: number;
  positions: number;
  isActive: boolean;
  permissions: AccountPermission[];
}

type AccountPermission = "trade" | "withdraw" | "api" | "view_only" | "admin";

interface MultiAccountManagerProps {
  accounts: TradingAccount[];
  currentAccountId: string;
  onSwitchAccount: (accountId: string) => void;
  onCreateSubAccount: (name: string, type: TradingAccount["type"]) => void;
}

export function MultiAccountManager({
  accounts,
  currentAccountId,
  onSwitchAccount,
  onCreateSubAccount,
}: MultiAccountManagerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountType, setNewAccountType] = useState<TradingAccount["type"]>("sub");

  const currentAccount = accounts.find(a => a.id === currentAccountId);
  const totalEquity = accounts.reduce((sum, a) => sum + a.equity, 0);

  const handleCreate = useCallback(() => {
    if (!newAccountName.trim()) return;
    onCreateSubAccount(newAccountName, newAccountType);
    setShowCreateForm(false);
    setNewAccountName("");
  }, [newAccountName, newAccountType, onCreateSubAccount]);

  const getPermissionBadge = (perm: AccountPermission) => {
    const styles: Record<AccountPermission, string> = {
      trade: "bg-emerald-500/20 text-emerald-400",
      withdraw: "bg-amber-500/20 text-amber-400",
      api: "bg-blue-500/20 text-blue-400",
      view_only: "bg-slate-500/20 text-slate-400",
      admin: "bg-purple-500/20 text-purple-400",
    };
    return (
      <span key={perm} className={`text-[10px] px-1.5 py-0.5 rounded ${styles[perm]}`}>
        {perm}
      </span>
    );
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      {/* Header - Current Account */}
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">{currentAccount?.name || "Select Account"}</p>
            <p className="text-xs text-muted-foreground">
              {currentAccount?.type.toUpperCase()} • {currentAccount?.positions} positions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium">${currentAccount?.equity.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Equity</p>
          </div>
          <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
        </div>
      </div>

      {/* Account Selector */}
      {isExpanded && (
        <div className="border-t border-border pt-3 space-y-2">
          <div className="text-xs text-muted-foreground mb-2">
            All Accounts ({accounts.length}) • Total: ${totalEquity.toLocaleString()}
          </div>
          
          {accounts.map(account => (
            <div
              key={account.id}
              onClick={() => {
                onSwitchAccount(account.id);
                setIsExpanded(false);
              }}
              className={`
                flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors
                ${account.id === currentAccountId 
                  ? "bg-primary/10 border border-primary/30" 
                  : "hover:bg-muted"
                }
              `}
            >
              <div className="flex items-center gap-3">
                <div className={`
                  w-2 h-2 rounded-full
                  ${account.isActive ? "bg-emerald-500" : "bg-slate-500"}
                `} />
                <div>
                  <p className="text-sm font-medium">{account.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {account.type} • {account.positions} pos
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">${account.equity.toLocaleString()}</p>
                <div className="flex gap-1 mt-1">
                  {account.permissions.slice(0, 2).map(getPermissionBadge)}
                </div>
              </div>
            </div>
          ))}

          {/* Create Sub-Account Button */}
          <button
            onClick={() => setShowCreateForm(true)}
            className="w-full py-3 rounded-lg border border-dashed border-border hover:bg-muted transition-colors flex items-center justify-center gap-2 text-sm text-muted-foreground"
          >
            <Plus className="w-4 h-4" />
            Create Sub-Account
          </button>
        </div>
      )}

      {/* Create Account Form */}
      {showCreateForm && (
        <div className="border-t border-border pt-3 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              Account Name
            </label>
            <input
              type="text"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              placeholder="e.g., Trading Bot Sub-Account"
              className="w-full bg-muted rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              Account Type
            </label>
            <div className="grid grid-cols-4 gap-2">
              {["main", "sub", "margin", "futures"].map((type) => (
                <button
                  key={type}
                  onClick={() => setNewAccountType(type as TradingAccount["type"])}
                  className={`
                    py-2 rounded-md text-xs capitalize transition-colors
                    ${newAccountType === type 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted text-muted-foreground"
                    }
                  `}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateForm(false)}
              className="flex-1 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              className="flex-1 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-muted rounded-lg p-2 text-center">
          <p className="text-muted-foreground">Margin Used</p>
          <p className="font-medium">${currentAccount?.marginUsed.toLocaleString()}</p>
        </div>
        <div className="bg-muted rounded-lg p-2 text-center">
          <p className="text-muted-foreground">Available</p>
          <p className="font-medium">${currentAccount?.marginAvailable.toLocaleString()}</p>
        </div>
        <div className="bg-muted rounded-lg p-2 text-center">
          <p className="text-muted-foreground">Balance</p>
          <p className="font-medium">${currentAccount?.balance.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

export type { TradingAccount, AccountPermission, MultiAccountManagerProps };
