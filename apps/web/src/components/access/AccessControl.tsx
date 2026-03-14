/**
 * Access Control Component
 * 
 * Role-based permissions and API key management.
 * See docs/phase5/index.md for implementation details.
 */

import { useState, useCallback } from "react";
import { Key, User, Lock, Eye, EyeOff, Copy, Trash2, Check } from "lucide-react";

type Permission = 
  | "trade:spot"
  | "trade:futures"
  | "trade:margin"
  | "view:orders"
  | "view:positions"
  | "view:history"
  | "withdraw"
  | "deposit"
  | "api:read"
  | "api:write"
  | "admin:users"
  | "admin:settings";

type Role = "admin" | "trader" | "viewer" | "api_only";

interface APIKey {
  id: string;
  name: string;
  key: string; // Masked
  secret: string; // Only shown once on creation
  permissions: Permission[];
  createdAt: number;
  lastUsed?: number;
  ipWhitelist?: string[];
  isActive: boolean;
}

interface User {
  id: string;
  email: string;
  role: Role;
  permissions: Permission[];
  lastLogin?: number;
  isActive: boolean;
}

interface AccessControlProps {
  currentUser: User;
  apiKeys: APIKey[];
  users: User[];
  onCreateAPIKey: (name: string, permissions: Permission[]) => void;
  onRevokeAPIKey: (keyId: string) => void;
  onUpdateUserRole: (userId: string, role: Role) => void;
}

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    "trade:spot", "trade:futures", "trade:margin",
    "view:orders", "view:positions", "view:history",
    "withdraw", "deposit", "api:read", "api:write",
    "admin:users", "admin:settings"
  ],
  trader: [
    "trade:spot", "trade:futures",
    "view:orders", "view:positions", "view:history",
    "withdraw", "api:read", "api:write"
  ],
  viewer: ["view:orders", "view:positions", "view:history", "api:read"],
  api_only: ["api:read", "api:write"],
};

export function AccessControl({
  currentUser,
  apiKeys,
  users,
  onCreateAPIKey,
  onRevokeAPIKey,
  onUpdateUserRole,
}: AccessControlProps) {
  const [activeTab, setActiveTab] = useState<"api" | "users">("api");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>(["api:read"]);
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCreateKey = useCallback(() => {
    if (!newKeyName.trim()) return;
    onCreateAPIKey(newKeyName, selectedPermissions);
    setShowCreateForm(false);
    setNewKeyName("");
    setSelectedPermissions(["api:read"]);
  }, [newKeyName, selectedPermissions, onCreateAPIKey]);

  const togglePermission = (perm: Permission) => {
    setSelectedPermissions(prev => 
      prev.includes(perm)
        ? prev.filter(p => p !== perm)
        : [...prev, perm]
    );
  };

  const copyToClipboard = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const maskKey = (key: string): string => {
    if (key.length <= 8) return "****";
    return key.slice(0, 4) + "****" + key.slice(-4);
  };

  const canManageUsers = currentUser.permissions.includes("admin:users");

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Lock className="w-4 h-4" />
          Access Control
        </h3>
        <div className="flex items-center gap-2 text-xs">
          <User className="w-3 h-3" />
          <span className="text-muted-foreground">{currentUser.email}</span>
          <span className="bg-primary/20 text-primary px-2 py-0.5 rounded">
            {currentUser.role.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("api")}
          className={`pb-2 text-sm font-medium transition-colors ${
            activeTab === "api"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Key className="w-4 h-4 inline mr-1" />
          API Keys ({apiKeys.length})
        </button>
        {canManageUsers && (
          <button
            onClick={() => setActiveTab("users")}
            className={`pb-2 text-sm font-medium transition-colors ${
              activeTab === "users"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <User className="w-4 h-4 inline mr-1" />
            Users ({users.length})
          </button>
        )}
      </div>

      {/* API Keys Tab */}
      {activeTab === "api" && (
        <div className="space-y-3">
          <button
            onClick={() => setShowCreateForm(true)}
            className="w-full py-2 rounded-lg border border-dashed border-border hover:bg-muted transition-colors flex items-center justify-center gap-2 text-sm text-muted-foreground"
          >
            <Key className="w-4 h-4" />
            Create New API Key
          </button>

          {/* Create Form */}
          {showCreateForm && (
            <div className="bg-muted rounded-lg p-3 space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  Key Name
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., Trading Bot"
                  className="w-full bg-card rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  Permissions
                </label>
                <div className="grid grid-cols-2 gap-1">
                  {ROLE_PERMISSIONS[currentUser.role].map((perm) => (
                    <label
                      key={perm}
                      className="flex items-center gap-2 text-xs p-2 rounded hover:bg-card cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPermissions.includes(perm)}
                        onChange={() => togglePermission(perm)}
                        className="rounded"
                      />
                      {perm}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 py-2 rounded-lg text-sm text-muted-foreground hover:bg-card"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateKey}
                  className="flex-1 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Create
                </button>
              </div>
            </div>
          )}

          {/* API Key List */}
          <div className="space-y-2">
            {apiKeys.map((apiKey) => (
              <div
                key={apiKey.id}
                className={`p-3 rounded-lg border ${
                  apiKey.isActive ? "bg-muted border-border" : "bg-muted/50 border-border/50 opacity-50"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">{apiKey.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(apiKey.createdAt).toLocaleDateString()}
                      {apiKey.lastUsed && ` • Last used ${new Date(apiKey.lastUsed).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => copyToClipboard(apiKey.key, apiKey.id)}
                      className="p-1.5 hover:bg-card rounded"
                      title="Copy key"
                    >
                      {copiedKey === apiKey.id ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => onRevokeAPIKey(apiKey.id)}
                      className="p-1.5 hover:bg-red-500/20 rounded text-red-400"
                      title="Revoke key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Key Display */}
                <div className="mt-2 flex items-center gap-2">
                  <code className="text-xs bg-card px-2 py-1 rounded flex-1 font-mono">
                    {maskKey(apiKey.key)}
                  </code>
                </div>

                {/* Permissions */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {apiKey.permissions.slice(0, 4).map((perm) => (
                    <span
                      key={perm}
                      className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded"
                    >
                      {perm}
                    </span>
                  ))}
                  {apiKey.permissions.length > 4 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{apiKey.permissions.length - 4} more
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users Tab (Admin Only) */}
      {activeTab === "users" && canManageUsers && (
        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-3 bg-muted rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{user.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {user.isActive ? "Active" : "Inactive"}
                    {user.lastLogin && ` • Last login ${new Date(user.lastLogin).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
              <select
                value={user.role}
                onChange={(e) => onUpdateUserRole(user.id, e.target.value as Role)}
                className="bg-card rounded-lg px-2 py-1 text-xs"
              >
                <option value="admin">Admin</option>
                <option value="trader">Trader</option>
                <option value="viewer">Viewer</option>
                <option value="api_only">API Only</option>
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export type { Permission, Role, APIKey, User, AccessControlProps };
