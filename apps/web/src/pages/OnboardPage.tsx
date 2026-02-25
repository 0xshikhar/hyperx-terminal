import { useState } from "react";

export function OnboardPage() {
  const [username, setUsername] = useState("");

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
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="hyperx-trader"
          />
        </div>
        <button className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
          Save and continue
        </button>
      </div>
    </div>
  );
}
