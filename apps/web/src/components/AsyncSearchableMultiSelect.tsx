import React from "react";

type Option = { label: string; value: string };

type Props = {
  label: string;
  selectedValues: string[];
  onChange: (values: string[]) => void;
  fetchOptions: (query: string) => Promise<Option[]>;
  placeholder?: string;
  helper?: string;
  maxResults?: number;
  seedOptions?: Option[];
};

const AsyncSearchableMultiSelect = ({
  label,
  selectedValues,
  onChange,
  fetchOptions,
  placeholder,
  helper,
  maxResults = 8,
  seedOptions = []
}: Props) => {
  const [query, setQuery] = React.useState("");
  const [options, setOptions] = React.useState<Option[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const selectedSet = React.useMemo(() => new Set(selectedValues), [selectedValues]);
  const labelMapRef = React.useRef<Map<string, string>>(new Map());
  const timerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    seedOptions.forEach((option) => {
      labelMapRef.current.set(option.value, option.label);
    });
  }, [seedOptions]);

  React.useEffect(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    if (!query.trim()) {
      setOptions([]);
      setLoading(false);
      setError(null);
      return;
    }

    timerRef.current = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      fetchOptions(query.trim())
        .then((data) => {
          data.forEach((option) => {
            labelMapRef.current.set(option.value, option.label);
          });
          setOptions(data);
        })
        .catch((err) => setError((err as Error).message))
        .finally(() => setLoading(false));
      timerRef.current = null;
    }, 300);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [fetchOptions, query]);

  const filtered = React.useMemo(
    () => options.filter((option) => !selectedSet.has(option.value)).slice(0, maxResults),
    [maxResults, options, selectedSet]
  );

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
      />
      {loading ? <p className="text-xs text-ink-500">Searching...</p> : null}
      {error ? <p className="text-xs text-ember-600">{error}</p> : null}
      {filtered.length ? (
        <div className="rounded-2xl border border-mist-200 bg-white shadow-card">
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
            const labelValue = labelMapRef.current.get(value) || value;
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

export default AsyncSearchableMultiSelect;
