import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type SidebarSearchItem = {
  id: string;
  label: string;
  group?: string;
  keywords?: string[];
};

type Props = {
  items: SidebarSearchItem[];
  activeId: string;
  onSelect: (id: string) => void;
  placeholder?: string;
  className?: string;
};

export default function SidebarMenuSearch({
  items,
  activeId,
  onSelect,
  placeholder = 'Search menu…',
  className,
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items.filter((item) => {
      const hay = [item.label, item.group, ...(item.keywords || [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(`[data-idx="${highlight}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  const pick = (id: string) => {
    onSelect(id);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
      setOpen(true);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      setOpen(true);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = results[highlight];
      if (item) pick(item.id);
    } else if (e.key === 'Escape') {
      setQuery('');
      setOpen(false);
    }
  };

  return (
    <div className={cn('relative px-2 pb-2 group-data-[collapsible=icon]:hidden', className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sidebar-foreground/40" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => query.trim() && setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="h-9 rounded-xl border-sidebar-border/60 bg-sidebar-accent/30 pl-8 pr-8 text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus-visible:ring-sidebar-primary/30"
          aria-label="Search sidebar menu"
          aria-expanded={open && results.length > 0}
          aria-controls="sidebar-menu-search-results"
          autoComplete="off"
        />
        {query ? (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-sidebar-foreground/40 hover:text-sidebar-foreground"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery('');
              setOpen(false);
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {open && query.trim() && (
        <div
          id="sidebar-menu-search-results"
          ref={listRef}
          className="absolute left-2 right-2 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-sidebar-border bg-sidebar shadow-xl"
          role="listbox"
        >
          {results.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-sidebar-foreground/50">No matching menu items</p>
          ) : (
            results.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                data-idx={idx}
                role="option"
                aria-selected={activeId === item.id || highlight === idx}
                className={cn(
                  'flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-xs transition-colors',
                  highlight === idx || activeId === item.id
                    ? 'bg-sidebar-primary/15 text-sidebar-primary'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent'
                )}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => pick(item.id)}
              >
                <span className="font-semibold">{item.label}</span>
                {item.group ? (
                  <span className="text-[10px] uppercase tracking-wide opacity-60">{item.group}</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
