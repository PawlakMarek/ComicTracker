import React from "react";

type Option = { label: string; value: string };

type Props = {
  label: string;
  options: Option[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  helper?: string;
  maxResults?: number;
  allowCustom?: boolean;
};

const SearchableMultiSelect = ({
  label,
  options,
  selectedValues,
  onChange,
  placeholder,
  helper,
  maxResults = 8,
  allowCustom = false
}: Props) => {
  const [query, setQuery] = React.useState("");
  const selectedSet = React.useMemo(() => new Set(selectedValues), [selectedValues]);
  const trimmedQuery = query.trim();

  const filtered = React.useMemo(() => {
    if (!query.trim()) return [];
    const lower = query.toLowerCase();
    return options
      .filter((option) => !selectedSet.has(option.value))
      .filter((option) => option.label.toLowerCase().includes(lower))
      .slice(0, maxResults);
  }, [maxResults, options, query, selectedSet]);

  const exactOption = React.useMemo(() => {
    if (!trimmedQuery) return null;
    const lower = trimmedQuery.toLowerCase();
    return options.find(
      (option) => option.value.toLowerCase() === lower || option.label.toLowerCase() === lower
    );
  }, [options, trimmedQuery]);

  const showCustomAdd =
    allowCustom && trimmedQuery && !selectedSet.has(trimmedQuery) && !exactOption;

  const handleAdd = (value: string) => {
    if (selectedSet.has(value)) return;
    onChange([...selectedValues, value]);
    setQuery("");
  };

  const handleRemove = (value: string) => {
    onChange(selectedValues.filter((entry) => entry !== value));
  };

  return (
    <div className="flex flex-col gap-2 text-sm text-ink-700">
      <span className="text-xs uppercase tracking-[0.2em] text-ink-600">{label}</span>
      {helper ? <p className="text-xs text-ink-600">{helper}</p> : null}
      <input
        className="rounded-2xl border border-mist-200 bg-white px-3 py-2 text-sm text-ink-900"
        value={query}
        placeholder={placeholder || "Search to add..."}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && showCustomAdd) {
            event.preventDefault();
            handleAdd(trimmedQuery);
          }
        }}
      />
      {showCustomAdd || filtered.length ? (
        <div className="rounded-2xl border border-mist-200 bg-white shadow-card">
          {showCustomAdd ? (
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-ink-900 hover:bg-mist-100"
              onClick={() => handleAdd(trimmedQuery)}
            >
              <span>{trimmedQuery}</span>
              <span className="text-xs text-ink-500">Add new</span>
            </button>
          ) : null}
          {filtered.map((option) => (
            <button
              type="button"
              key={option.value}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-ink-900 hover:bg-mist-100"
              onClick={() => handleAdd(option.value)}
            >
              <span>{option.label}</span>
              <span className="text-xs text-ink-500">Add</span>
            </button>
          ))}
        </div>
      ) : null}
      {selectedValues.length ? (
        <div className="flex flex-wrap gap-2">
          {selectedValues.map((value) => {
            const labelValue = options.find((option) => option.value === value)?.label || value;
            return (
              <span
                key={value}
                className="inline-flex items-center gap-2 rounded-full border border-mist-200 bg-white px-3 py-1 text-xs text-ink-700"
              >
                {labelValue}
                <button type="button" className="text-ink-500" onClick={() => handleRemove(value)}>
                  ✕
                </button>
              </span>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-ink-500">No selections yet.</p>
      )}
    </div>
  );
};

export default SearchableMultiSelect;
