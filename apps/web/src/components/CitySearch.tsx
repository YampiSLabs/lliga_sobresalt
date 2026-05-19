import { useEffect, useState, useRef } from "preact/hooks";
import Fuse from "fuse.js";
import { Command } from "cmdk";
import { Search } from "lucide-preact";
import type { CityScore } from "../lib/schemas";

type Props = {
  scores: CityScore[];
};

export default function CitySearch({ scores }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const fuse = new Fuse(scores, {
    keys: ["city.name"],
    threshold: 0.3,
  });

  const results = query
    ? fuse.search(query).map((r) => r.item)
    : scores;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-400 transition-colors hover:border-slate-600 hover:text-amber-300"
        aria-label="Buscar ciudad"
      >
        <Search size={14} />
        <span>Buscar</span>
        <kbd className="ml-1 rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-500">⌘K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
          <div className="fixed inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <Command className="relative w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
            <Command.Input
              ref={inputRef}
              placeholder="Buscar ciudad…"
              value={query}
              onValueChange={setQuery}
              className="w-full border-b border-slate-700 bg-transparent px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none"
            />
            <Command.List className="max-h-64 overflow-y-auto p-2">
              <Command.Empty className="py-6 text-center text-sm text-slate-500">
                No se encontraron ciudades.
              </Command.Empty>
              {results.slice(0, 20).map((score) => (
                <Command.Item
                  key={score.city.slug}
                  value={score.city.name}
                  onSelect={() => {
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm text-slate-200 aria-selected:bg-slate-800 aria-selected:text-amber-300"
                >
                  <span>{score.city.name}</span>
                  <span className="font-mono text-xs text-slate-500">{score.points} pts</span>
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </div>
      )}
    </>
  );
}
