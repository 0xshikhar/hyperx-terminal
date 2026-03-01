import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { updatePreferences } from "@/services/apiClient/preferences.api";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";

export function OnboardPage() {
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  async function handleSave() {
    if (!username.trim()) return;
    setSaving(true);
    try {
      await updatePreferences({});
      setSession({ token: localStorage.getItem("hyperx-auth-token") ?? "" });
      toast.success(`Welcome, ${username}`);
      navigate("/terminal", { replace: true });
    } catch {
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-border bg-card p-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Finish Setup</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose a username to personalize your trading workspace.
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Username</label>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="hyperx-trader"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !username.trim()}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save and continue"}
        </button>
      </div>
    </div>
  );
}
