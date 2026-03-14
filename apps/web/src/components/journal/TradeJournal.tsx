import { useEffect, useMemo, useState } from "react";
import { BookText, Plus, Tag } from "lucide-react";
import { usePositions } from "@/hooks/usePositions";

type JournalEntry = {
  id: string;
  market: string;
  note: string;
  tags: string[];
  createdAt: number;
};

const STORAGE_KEY = "hyperx-trade-journal";

export function TradeJournal() {
  const { positions } = usePositions();
  const [market, setMarket] = useState(positions[0]?.market ?? "BTC-USD");
  const [note, setNote] = useState("");
  const [tags, setTags] = useState("");
  const [entries, setEntries] = useState<JournalEntry[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      setEntries(JSON.parse(raw) as JournalEntry[]);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries]);

  const groupedEntries = useMemo(
    () => entries.sort((a, b) => b.createdAt - a.createdAt),
    [entries]
  );

  const addEntry = () => {
    if (!note.trim()) return;
    setEntries((prev) => [
      {
        id: Math.random().toString(36).slice(2, 11),
        market,
        note: note.trim(),
        tags: tags
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        createdAt: Date.now(),
      },
      ...prev,
    ]);
    setNote("");
    setTags("");
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <BookText className="h-4 w-4" />
          Trade Journal
        </h3>
        <span className="text-xs text-muted-foreground">
          {entries.length} entries
        </span>
      </div>

      <div className="space-y-3">
        <select
          value={market}
          onChange={(event) => setMarket(event.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          {positions.map((position) => (
            <option key={position.id} value={position.market}>
              {position.market}
            </option>
          ))}
          {positions.length === 0 && <option value="BTC-USD">BTC-USD</option>}
        </select>

        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={4}
          placeholder="What happened on the trade, what you expected, and what to repeat or avoid..."
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />

        <div className="grid gap-2 md:grid-cols-[1fr,auto]">
          <input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="breakout, risk-off, revenge-trade"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={addEntry}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Add Note
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {groupedEntries.length === 0 ? (
          <div className="text-xs text-muted-foreground">No journal entries yet.</div>
        ) : (
          groupedEntries.map((entry) => (
            <div key={entry.id} className="rounded-md border border-border bg-background p-3">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-semibold">{entry.market}</span>
                <span className="text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-sm">{entry.note}</p>
              {entry.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {entry.tags.map((tag) => (
                    <span
                      key={`${entry.id}-${tag}`}
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground"
                    >
                      <Tag className="h-3 w-3" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
