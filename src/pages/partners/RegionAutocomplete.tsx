import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GHANA_REGIONS } from '@/services/partnerApi';

type RegionAutocompleteProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  className?: string;
  errorClassName?: string;
};

export default function RegionAutocomplete({
  id,
  value,
  onChange,
  error,
  placeholder = 'Start typing your region…',
  className = '',
  errorClassName = '',
}: RegionAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...GHANA_REGIONS];
    return GHANA_REGIONS.filter((r) => r.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (region: string) => {
    onChange(region);
    setQuery(region);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="address-level1"
        className={`${className} ${error ? errorClassName : ''}`}
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && suggestions[0]) {
            e.preventDefault();
            pick(suggestions[0]);
          }
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && suggestions.length > 0 ? (
        <ul
          className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-[14px] border border-[var(--sn-border)] bg-white py-1 shadow-lg"
          role="listbox"
        >
          {suggestions.map((region) => (
            <li key={region}>
              <button
                type="button"
                role="option"
                aria-selected={region === value}
                className={`w-full px-4 py-2.5 text-left text-[14px] font-medium transition hover:bg-emerald-50 ${
                  region === value ? 'bg-emerald-50 text-emerald-800' : 'text-[var(--ink)]'
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(region);
                }}
              >
                {region}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && query.trim() && suggestions.length === 0 ? (
        <div className="absolute z-20 mt-1 w-full rounded-[14px] border border-[var(--sn-border)] bg-white px-4 py-3 text-[13px] text-[var(--ink-subtle)] shadow-lg">
          No matching region — pick from the list as you type.
        </div>
      ) : null}
    </div>
  );
}
