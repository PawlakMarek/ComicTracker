import React from "react";

type Option = { label: string; value: string };

type FormFieldProps = {
  label: string;
  value: string | number | undefined | null;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  step?: string | number;
  min?: string | number;
  max?: string | number;
  options?: Option[];
  suggestions?: string[];
  listId?: string;
  textarea?: boolean;
};

const FormField: React.FC<FormFieldProps> = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  step,
  min,
  max,
  options,
  suggestions,
  listId,
  textarea
}) => {
  const resolvedListId =
    suggestions && suggestions.length
      ? listId || `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-list`
      : undefined;
  return (
    <label className="flex flex-col gap-2 text-sm text-ink-700">
      <span className="text-xs uppercase tracking-[0.2em] text-ink-600">{label}</span>
      {options ? (
        <select
          className="rounded-2xl border border-mist-200 bg-white px-3 py-2 text-sm text-ink-900"
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Select</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : textarea ? (
        <textarea
          className="min-h-[120px] rounded-2xl border border-mist-200 bg-white px-3 py-2 text-sm text-ink-900"
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          className="rounded-2xl border border-mist-200 bg-white px-3 py-2 text-sm text-ink-900"
          type={type}
          value={value ?? ""}
          placeholder={placeholder}
          step={step}
          min={min}
          max={max}
          list={resolvedListId}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {resolvedListId ? (
        <datalist id={resolvedListId}>
          {suggestions!.map((entry) => (
            <option key={entry} value={entry} />
          ))}
        </datalist>
      ) : null}
    </label>
  );
};

export default FormField;
