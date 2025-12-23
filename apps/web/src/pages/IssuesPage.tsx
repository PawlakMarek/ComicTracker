import React from "react";
import Papa from "papaparse";
import { Link } from "react-router-dom";
import SectionHeader from "../components/SectionHeader";
import FormField from "../components/FormField";
import SearchableMultiSelect from "../components/SearchableMultiSelect";
import { apiFetch } from "../lib/api";
import { issueStatus } from "../lib/enums";

const IssuesPage = () => {
  const [items, setItems] = React.useState<any[]>([]);
  const [series, setSeries] = React.useState<any[]>([]);
  const [storyBlocks, setStoryBlocks] = React.useState<any[]>([]);
  const [characters, setCharacters] = React.useState<any[]>([]);
  const [events, setEvents] = React.useState<any[]>([]);
  const [form, setForm] = React.useState({
    seriesId: "",
    issueNumber: "",
    title: "",
    releaseDate: "",
    readingOrderIndex: "",
    status: "UNREAD",
    readDate: "",
    notes: ""
  });
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [filters, setFilters] = React.useState({ seriesId: "", status: "" });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [total, setTotal] = React.useState(0);
  const [sort, setSort] = React.useState({ field: "issueNumber", order: "asc" });
  const [storyBlockIds, setStoryBlockIds] = React.useState<string[]>([]);
  const [characterIds, setCharacterIds] = React.useState<string[]>([]);
  const [teamIds, setTeamIds] = React.useState<string[]>([]);
  const [eventIds, setEventIds] = React.useState<string[]>([]);
  const [bulkText, setBulkText] = React.useState("");
  const [bulkStatus, setBulkStatus] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (filters.seriesId) params.set("seriesId", filters.seriesId);
    if (filters.status) params.set("status", filters.status);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    params.set("sort", sort.field);
    params.set("order", sort.order);
    const query = params.toString();
    apiFetch<{ items: any[]; total: number }>(`/api/issues${query ? `?${query}` : ""}`)
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
      })
      .catch((err) => setError(err.message));
  }, [filters.seriesId, filters.status, page, pageSize, search, sort.field, sort.order]);

  React.useEffect(() => {
    load();
    apiFetch<{ items: any[] }>("/api/series?pageSize=100").then((data) => setSeries(data.items));
    apiFetch<{ items: any[] }>("/api/story-blocks?pageSize=100").then((data) => setStoryBlocks(data.items));
    apiFetch<{ items: any[] }>("/api/characters?pageSize=100").then((data) => setCharacters(data.items));
    apiFetch<{ items: any[] }>("/api/events?pageSize=100").then((data) => setEvents(data.items));
  }, [load]);

  React.useEffect(() => {
    setPage(1);
  }, [search, filters.seriesId, filters.status]);

  const handleSort = (field: string) => {
    setSort((prev) => {
      if (prev.field === field) {
        return { field, order: prev.order === "asc" ? "desc" : "asc" };
      }
      return { field, order: "asc" };
    });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this issue? This cannot be undone.")) return;
    await apiFetch(`/api/issues/${id}`, { method: "DELETE" });
    load();
  };

  const handleCreate = async () => {
    setError(null);
    try {
      await apiFetch("/api/issues", {
        method: "POST",
        body: JSON.stringify({
          seriesId: form.seriesId,
          issueNumber: form.issueNumber,
          title: form.title || null,
          releaseDate: form.releaseDate || null,
          readingOrderIndex: form.readingOrderIndex ? Number(form.readingOrderIndex) : null,
          status: form.status,
          readDate: form.readDate || null,
          notes: form.notes || null,
          storyBlockIds,
          characterIds,
          teamIds,
          eventIds
        })
      });
      setForm({
        seriesId: "",
        issueNumber: "",
        title: "",
        releaseDate: "",
        readingOrderIndex: "",
        status: "UNREAD",
        readDate: "",
        notes: ""
      });
      setStoryBlockIds([]);
      setCharacterIds([]);
      setTeamIds([]);
      setEventIds([]);
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
      seriesName: row.seriesName?.trim() || row.series?.trim(),
      issueNumber: row.issueNumber?.trim(),
      title: row.title?.trim(),
      releaseDate: row.releaseDate?.trim(),
      readingOrderIndex: row.readingOrderIndex?.trim(),
      status: row.status?.trim(),
      readDate: row.readDate?.trim(),
      notes: row.notes?.trim()
    }));

    try {
      const result = await apiFetch<{ imported: number; total: number }>("/api/issues/bulk", {
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
      <SectionHeader title="Issues" subtitle="Atomic issues tied to series and story blocks." />

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">New Issue</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <FormField
            label="Series"
            value={form.seriesId}
            onChange={(value) => setForm({ ...form, seriesId: value })}
            options={series.map((entry) => ({ label: entry.name, value: entry.id }))}
          />
          <FormField
            label="Issue Number"
            value={form.issueNumber}
            onChange={(value) => setForm({ ...form, issueNumber: value })}
          />
          <FormField label="Title" value={form.title} onChange={(value) => setForm({ ...form, title: value })} />
          <FormField
            label="Release Date"
            type="date"
            value={form.releaseDate}
            onChange={(value) => setForm({ ...form, releaseDate: value })}
          />
          <FormField
            label="Reading Order Index"
            value={form.readingOrderIndex}
            onChange={(value) => setForm({ ...form, readingOrderIndex: value })}
          />
          <FormField
            label="Status"
            value={form.status}
            onChange={(value) => setForm({ ...form, status: value })}
            options={issueStatus}
          />
          <FormField
            label="Read Date"
            type="date"
            value={form.readDate}
            onChange={(value) => setForm({ ...form, readDate: value })}
          />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <SearchableMultiSelect
            label="Story Blocks"
            options={storyBlocks.map((entry) => ({ label: entry.name, value: entry.id }))}
            selectedValues={storyBlockIds}
            onChange={setStoryBlockIds}
            placeholder="Search story blocks..."
          />
          <SearchableMultiSelect
            label="Events"
            options={events.map((entry) => ({ label: entry.name, value: entry.id }))}
            selectedValues={eventIds}
            onChange={setEventIds}
            placeholder="Search events..."
          />
          <SearchableMultiSelect
            label="Characters"
            options={characters
              .filter((entry) => entry.type === "CHARACTER")
              .map((entry) => ({ label: entry.name, value: entry.id }))}
            selectedValues={characterIds}
            onChange={setCharacterIds}
            placeholder="Search characters..."
          />
          <SearchableMultiSelect
            label="Teams"
            options={characters
              .filter((entry) => entry.type === "TEAM")
              .map((entry) => ({ label: entry.name, value: entry.id }))}
            selectedValues={teamIds}
            onChange={setTeamIds}
            placeholder="Search teams..."
          />
        </div>
        <div className="mt-4">
          <FormField label="Notes" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} textarea />
        </div>
        {error ? <p className="mt-3 text-sm text-ember-600">{error}</p> : null}
        <button className="btn-primary mt-4" onClick={handleCreate}>
          Create Issue
        </button>
        {error ? <p className="mt-3 text-sm text-ember-600">{error}</p> : null}
      </div>

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">Issue List</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <FormField label="Search" value={search} onChange={setSearch} placeholder="Search issue or title" />
          <FormField
            label="Series"
            value={filters.seriesId}
            onChange={(value) => setFilters({ ...filters, seriesId: value })}
            options={series.map((entry) => ({ label: entry.name, value: entry.id }))}
          />
          <FormField
            label="Status"
            value={filters.status}
            onChange={(value) => setFilters({ ...filters, status: value })}
            options={issueStatus}
          />
        </div>
        <div className="mt-4 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.2em] text-ink-600">
              <tr>
                <th className="pb-2">
                  <button className="text-left" onClick={() => handleSort("issueNumber")}>
                    Issue
                  </button>
                </th>
                <th className="pb-2">
                  <button className="text-left" onClick={() => handleSort("series")}>
                    Series
                  </button>
                </th>
                <th className="pb-2">
                  <button className="text-left" onClick={() => handleSort("status")}>
                    Status
                  </button>
                </th>
                <th className="pb-2">
                  <button className="text-left" onClick={() => handleSort("releaseDate")}>
                    Release Date
                  </button>
                </th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm text-ink-800">
              {items.map((item) => (
                <tr key={item.id} className="border-t border-mist-100">
                  <td className="py-3 font-semibold text-ink-900">
                    <Link to={`/issues/${item.id}`}>#{item.issueNumber}</Link>
                  </td>
                  <td className="py-3">{item.series?.name}</td>
                  <td className="py-3">{item.status}</td>
                  <td className="py-3">{item.releaseDate ? item.releaseDate.slice(0, 10) : "—"}</td>
                  <td className="py-3">
                    <button className="btn-secondary" onClick={() => handleDelete(item.id)}>
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
        <h3 className="text-lg font-semibold text-ink-900">Bulk Add Issues</h3>
        <p className="mt-2 text-sm text-ink-700">
          Paste CSV with headers: <code>seriesName,issueNumber,title,releaseDate,readingOrderIndex,status,readDate,notes</code>
        </p>
        <textarea
          className="mt-4 min-h-[180px] w-full rounded-2xl border border-mist-200 bg-white px-3 py-2 text-sm text-ink-900"
          value={bulkText}
          onChange={(event) => setBulkText(event.target.value)}
          placeholder="seriesName,issueNumber,title,releaseDate,readingOrderIndex,status,readDate,notes\nThor (2018),1,The Devourer King,2018-06-01,1,UNREAD,,\nThor (2018),2,God of the Mjolnir,2018-07-01,2,UNREAD,,"
        />
        {bulkStatus ? <p className="mt-3 text-sm text-ember-600">{bulkStatus}</p> : null}
        <button className="btn-primary mt-4" onClick={handleBulkImport}>
          Import CSV
        </button>
      </div>
    </div>
  );
};

export default IssuesPage;
