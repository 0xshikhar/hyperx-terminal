import { useMemo, useState } from "react";
import { Keyboard } from "lucide-react";

type ShortcutPreference = {
  id: string;
  label: string;
  keys: string;
};

const defaults: ShortcutPreference[] = [
  { id: "palette", label: "Command Palette", keys: "Ctrl/Cmd + K" },
  { id: "help", label: "Keyboard Help", keys: "?" },
  { id: "buy", label: "Buy Focus", keys: "B" },
  { id: "sell", label: "Sell Focus", keys: "S" },
];

export function ShortcutCustomizer() {
  const [preferences, setPreferences] = useState<ShortcutPreference[]>(defaults);
  const hasChanges = useMemo(
    () => JSON.stringify(preferences) !== JSON.stringify(defaults),
    [preferences]
  );

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Keyboard className="h-4 w-4" />
          Shortcut Customizer
        </h3>
        <button
          onClick={() => setPreferences(defaults)}
          className="text-xs text-primary disabled:text-muted-foreground"
          disabled={!hasChanges}
        >
          Reset
        </button>
      </div>

      <div className="space-y-2">
        {preferences.map((shortcut) => (
          <div key={shortcut.id} className="grid grid-cols-[1fr,140px] items-center gap-3 rounded-md bg-muted p-2">
            <span className="text-sm">{shortcut.label}</span>
            <input
              value={shortcut.keys}
              onChange={(event) =>
                setPreferences((prev) =>
                  prev.map((item) =>
                    item.id === shortcut.id
                      ? { ...item, keys: event.target.value }
                      : item
                  )
                )
              }
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
            />
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        This panel stores preferred bindings for interview/demo workflows. Runtime rebinding can be wired to the shortcut provider next.
      </p>
    </div>
  );
}
