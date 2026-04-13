'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import LOCATIONS from '@/data/locations';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  inputStyle?: React.CSSProperties;
  /** Optional focus/blur callbacks so the parent can manage focus state */
  onFocus?: () => void;
  onBlur?: () => void;
}

const MAX_SUGGESTIONS = 10;

function getSuggestions(query: string): string[] {
  if (query.length < 2) return [];
  const q = query.toLowerCase();

  // Entries that START with the query come first, then substring matches
  const starts: string[] = [];
  const contains: string[] = [];

  for (const loc of LOCATIONS) {
    const l = loc.toLowerCase();
    if (l.startsWith(q)) starts.push(loc);
    else if (l.includes(q)) contains.push(loc);
    if (starts.length + contains.length >= MAX_SUGGESTIONS * 3) break;
  }

  return [...starts, ...contains].slice(0, MAX_SUGGESTIONS);
}

const defaultInputStyle: React.CSSProperties = {
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'rgba(138,130,120,0.25)',
  borderRadius: '8px',
  padding: '12px 16px',
  fontFamily: 'var(--font-inter), sans-serif',
  fontSize: '14px',
  color: '#3A3530',
  background: '#FFFFFF',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  transition: 'border-color 0.3s, box-shadow 0.3s',
};

export function LocationAutocomplete({
  value,
  onChange,
  placeholder = 'Start typing a city…',
  required,
  inputStyle,
  onFocus,
  onBlur,
}: Props) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep query in sync when value is set externally
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val); // allow free-text too
    const s = getSuggestions(val);
    setSuggestions(s);
    setOpen(s.length > 0);
    setActiveIndex(-1);
  };

  const select = useCallback((loc: string) => {
    setQuery(loc);
    onChange(loc);
    setOpen(false);
    setSuggestions([]);
    setActiveIndex(-1);
  }, [onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      select(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const merged: React.CSSProperties = { ...defaultInputStyle, ...inputStyle };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
          onFocus?.();
        }}
        onBlur={() => {
          // Small delay so click on suggestion fires before blur closes the list
          setTimeout(() => setOpen(false), 150);
          onBlur?.();
        }}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        style={merged}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-haspopup="listbox"
      />

      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 200,
            background: '#FFFFFF',
            border: '1px solid rgba(232,184,75,0.35)',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(58,53,48,0.1)',
            padding: '4px 0',
            margin: 0,
            listStyle: 'none',
            maxHeight: '260px',
            overflowY: 'auto',
          }}
        >
          {suggestions.map((loc, i) => (
            <li
              key={loc}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={() => select(loc)}
              onMouseEnter={() => setActiveIndex(i)}
              style={{
                padding: '10px 16px',
                fontSize: '13px',
                fontFamily: 'var(--font-inter), sans-serif',
                color: i === activeIndex ? '#3A3530' : '#5A5450',
                background: i === activeIndex ? 'rgba(232,184,75,0.1)' : 'transparent',
                cursor: 'pointer',
                userSelect: 'none',
                borderLeft: i === activeIndex ? '3px solid #E8B84B' : '3px solid transparent',
                transition: 'background 0.1s',
              }}
            >
              {highlight(loc, query)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Bold the matching portion of the suggestion text */
function highlight(text: string, query: string) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <strong style={{ color: '#E8B84B', fontWeight: 600 }}>{text.slice(idx, idx + query.length)}</strong>
      {text.slice(idx + query.length)}
    </>
  );
}
