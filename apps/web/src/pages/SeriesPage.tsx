import React from "react";
import Papa from "papaparse";
import { Link } from "react-router-dom";
import SectionHeader from "../components/SectionHeader";
import FormField from "../components/FormField";
import SearchableMultiSelect from "../components/SearchableMultiSelect";
import { apiFetch } from "../lib/api";
import { seriesTypes } from "../lib/enums";

const SeriesPage = () => {
  const [items, setItems] = React.useState<any[]>([]);
  const [publishers, setPublishers] = React.useState<any[]>([]);
  const [storyBlocks, setStoryBlocks] = React.useState<any[]>([]);
  const [form, setForm] = React.useState({
    name: "",
    publisherId: "",
    startYear: "",
    endYear: "",
    era: [] as string[],
    type: ""
  });
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [filters, setFilters] = React.useState({ publisherId: "", type: "" });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [total, setTotal] = React.useState(0);
  const [sort, setSort] = React.useState({ field: "name", order: "asc" });
  const [bulkText, setBulkText] = React.useState("");
  const [bulkStatus, setBulkStatus] = React.useState<string | null>(null);

  const collectSuggestions = React.useCallback((entries: any[], field: string) => {
    const values = entries
      .flatMap((entry) => {
        const value = entry?.[field];
        if (Array.isArray(value)) {
          return value.map((item) => String(item).trim()).filter(Boolean);
        }
        if (typeof value === "string") {
          return [value.trim()].filter(Boolean);
        }
        return [];
      })
      .filter(Boolean);
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, []);

  const eraSuggestions = React.useMemo(
    () => collectSuggestions([...items, ...storyBlocks], "era"),
    [collectSuggestions, items, storyBlocks]
  );
  const eraOptions = React.useMemo(
    () => eraSuggestions.map((value) => ({ label: value, value })),
    [eraSuggestions]
  );

  const load = React.useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (filters.publisherId) params.set("publisherId", filters.publisherId);
    if (filters.type) params.set("type", filters.type);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    params.set("sort", sort.field);
    params.set("order", sort.order);
    const query = params.toString();
    apiFetch<{ items: any[]; total: number }>(`/api/series${query ? `?${query}` : ""}`)
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
      })
      .catch((err) => setError(err.message));
  }, [filters.publisherId, filters.type, page, pageSize, search, sort.field, sort.order]);

  React.useEffect(() => {
    load();
    apiFetch<{ items: any[] }>("/api/publishers").then((data) => setPublishers(data.items));
    apiFetch<{ items: any[] }>("/api/story-blocks?pageSize=200").then((data) => setStoryBlocks(data.items));
  }, [load]);

  React.useEffect(() => {
    setPage(1);
  }, [search, filters.publisherId, filters.type]);

  const handleSort = (field: string) => {
    setSort((prev) => {
      if (prev.field === field) {
        return { field, order: prev.order === "asc" ? "desc" : "asc" };
      }
      return { field, order: "asc" };
    });
  };

  const handleDelete = async (id: string, name: string) => {
    const deps = await apiFetch<any>(`/api/series/${id}/dependencies`);
    let message = `Delete "${name}"? This will remove ${deps.issueCount} issues and ${deps.storyBlockCount} story blocks.`;
    if (deps.multiSeriesStoryBlocks?.length) {
      message += `\nWarning: ${deps.multiSeriesStoryBlocks.length} story blocks include multiple series.`;
    }
    message += "\nThis cannot be undone.";
    if (!window.confirm(message)) return;
    await apiFetch(`/api/series/${id}`, { method: "DELETE" });
    load();
  };

  const handleCreate = async () => {
    setError(null);
    try {
      await apiFetch("/api/series", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          startYear: Number(form.startYear),
          endYear: form.endYear ? Number(form.endYear) : null,
          era: form.era,
          notes: notes || null
        })
      });
      setForm({ name: "", publisherId: "", startYear: "", endYear: "", era: [], type: "" });
      setNotes("");
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleBulkImport = async () => {
    if (!bulkText.trim()) return;
    setBulkStatus(null);

    const parsed = Papa.parse(bulkText.trim(), {
      header: true,
      skipEmptyLines: true
    });

    if (parsed.errors.length) {
      setBulkStatus(`Parse error: ${parsed.errors[0].message}`);
      return;
    }

    const items = (parsed.data as Array<Record<string, string>>).map((row) => ({
      name: row.name?.trim(),
      publisherName: row.publisherName?.trim() || row.publisher?.trim(),
      startYear: row.startYear?.trim(),
      endYear: row.endYear?.trim(),
      era: row.era?.trim(),
      type: row.type?.trim(),
      notes: row.notes?.trim()
    }));

    try {
      const result = await apiFetch<{ imported: number; total: number }>("/api/series/bulk", {
        method: "POST",
        body: JSON.stringify({ items })
      });
      setBulkStatus(`Imported ${result.imported} of ${result.total} rows.`);
      setBulkText("");
      load();
    } catch (err) {
      setBulkStatus((err as Error).message);
    }
  };

  return (
    <div className="space-y-10">
      <SectionHeader title="Series" subtitle="Define volumes and titles that feed issues and story blocks." />

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">New Series</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <FormField label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
          <FormField
            label="Publisher"
            value={form.publisherId}
            onChange={(value) => setForm({ ...form, publisherId: value })}
            options={publishers.map((publisher) => ({ label: publisher.name, value: publisher.id }))}
          />
          <FormField
            label="Type"
            value={form.type}
            onChange={(value) => setForm({ ...form, type: value })}
            options={seriesTypes}
          />
          <FormField
            label="Start Year"
            value={form.startYear}
            onChange={(value) => setForm({ ...form, startYear: value })}
          />
          <FormField
            label="End Year"
            value={form.endYear}
            onChange={(value) => setForm({ ...form, endYear: value })}
          />
          <SearchableMultiSelect
            label="Era"
            options={eraOptions}
            selectedValues={form.era}
            onChange={(values) => setForm({ ...form, era: values })}
            placeholder="Search or add eras"
            helper="Add multiple eras if the series spans more than one publication period."
            allowCustom
          />
        </div>
        <div className="mt-4">
          <FormField label="Notes" value={notes} onChange={setNotes} textarea />
        </div>
        {error ? <p className="mt-3 text-sm text-ember-600">{error}</p> : null}
        <button className="btn-primary mt-4" onClick={handleCreate}>
          Create Series
        </button>
        {error ? <p className="mt-3 text-sm text-ember-600">{error}</p> : null}
      </div>

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">Series Library</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <FormField label="Search" value={search} onChange={setSearch} placeholder="Search by name" />
          <FormField
            label="Publisher"
            value={filters.publisherId}
            onChange={(value) => setFilters({ ...filters, publisherId: value })}
            options={publishers.map((publisher) => ({ label: publisher.name, value: publisher.id }))}
          />
          <FormField
            label="Type"
            value={filters.type}
            onChange={(value) => setFilters({ ...filters, type: value })}
            options={seriesTypes}
          />
        </div>
        <div className="mt-4 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.2em] text-ink-600">
              <tr>
                <th className="pb-2">
                  <button className="text-left" onClick={() => handleSort("name")}>
                    Name
                  </button>
                </th>
                <th className="pb-2">Publisher</th>
                <th className="pb-2">Eras</th>
                <th className="pb-2">
                  <button className="text-left" onClick={() => handleSort("type")}>
                    Type
                  </button>
                </th>
                <th className="pb-2">
                  <button className="text-left" onClick={() => handleSort("startYear")}>
                    Start
                  </button>
                </th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm text-ink-800">
              {items.map((item) => (
                <tr key={item.id} className="border-t border-mist-100">
                  <td className="py-3 font-semibold text-ink-900">
                    <Link to={`/library/series/${item.id}`}>{item.name}</Link>
                  </td>
                  <td className="py-3">{item.publisher?.name}</td>
                  <td className="py-3">
                    {Array.isArray(item.era) && item.era.length ? item.era.join(", ") : "N/A"}
                  </td>
                  <td className="py-3">{item.type}</td>
                  <td className="py-3">{item.startYear}</td>
                  <td className="py-3">
                    <button className="btn-secondary" onClick={() => handleDelete(item.id, item.name)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-700">
          <div>
            Page {page} of {Math.max(1, Math.ceil(total / pageSize))} · {total} total
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs uppercase tracking-[0.2em] text-ink-600">Page size</label>
            <select
              className="rounded-2xl border border-mist-200 bg-white px-3 py-2 text-sm"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <button className="btn-secondary" onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
              Prev
            </button>
            <button
              className="btn-secondary"
              onClick={() => setPage((prev) => Math.min(Math.ceil(total / pageSize), prev + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">Bulk Add Series</h3>
        <p className="mt-2 text-sm text-ink-700">
          Paste CSV with headers: <code>name,publisherName,startYear,endYear,era,type,notes</code>
        </p>
        <textarea
          className="mt-4 min-h-[180px] w-full rounded-2xl border border-mist-200 bg-white px-3 py-2 text-sm text-ink-900"
          value={bulkText}
          onChange={(event) => setBulkText(event.target.value)}
          placeholder="name,publisherName,startYear,endYear,era,type,notes\nThor (2018),Marvel,2018,,Fresh Start|Marvel NOW,ONGOING,\nAvengers (2018),Marvel,2018,,Fresh Start,ONGOING,"
        />
        {bulkStatus ? <p className="mt-3 text-sm text-ember-600">{bulkStatus}</p> : null}
        <button className="btn-primary mt-4" onClick={handleBulkImport}>
          Import CSV
        </button>
      </div>
    </div>
  );
};

export default SeriesPage;
