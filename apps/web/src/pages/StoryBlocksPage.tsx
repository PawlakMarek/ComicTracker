import React from "react";
import Papa from "papaparse";
import { Link } from "react-router-dom";
import SectionHeader from "../components/SectionHeader";
import FormField from "../components/FormField";
import SearchableMultiSelect from "../components/SearchableMultiSelect";
import { apiFetch } from "../lib/api";
import { storyBlockImportance, storyBlockStatus, storyBlockTypes, syncLevels } from "../lib/enums";

const StoryBlocksPage = () => {
  const [items, setItems] = React.useState<any[]>([]);
  const [events, setEvents] = React.useState<any[]>([]);
  const [series, setSeries] = React.useState<any[]>([]);
  const [publishers, setPublishers] = React.useState<any[]>([]);
  const [storyBlockOptions, setStoryBlockOptions] = React.useState<any[]>([]);
  const [issueOptions, setIssueOptions] = React.useState<any[]>([]);
  const [form, setForm] = React.useState({
    name: "",
    type: "",
    era: "",
    chronology: "",
    importance: "",
    syncLevel: "",
    publisherId: "",
    previousStoryBlockId: "",
    eventId: "",
    orderIndex: "",
    notes: ""
  });
  const [seriesIds, setSeriesIds] = React.useState<string[]>([]);
  const [issueIds, setIssueIds] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [derived, setDerived] = React.useState<any | null>(null);
  const [deriveError, setDeriveError] = React.useState<string | null>(null);
  const [rangeSeriesId, setRangeSeriesId] = React.useState("");
  const [rangeStart, setRangeStart] = React.useState("");
  const [rangeEnd, setRangeEnd] = React.useState("");
  const [rangeStatus, setRangeStatus] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [filters, setFilters] = React.useState({ status: "", importance: "", publisherId: "" });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [total, setTotal] = React.useState(0);
  const [sort, setSort] = React.useState({ field: "orderIndex", order: "asc" });
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
    () => collectSuggestions([...series, ...storyBlockOptions], "era"),
    [collectSuggestions, series, storyBlockOptions]
  );
  const chronologySuggestions = React.useMemo(
    () => collectSuggestions([...series, ...storyBlockOptions], "chronology"),
    [collectSuggestions, series, storyBlockOptions]
  );

  const load = React.useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (filters.status) params.set("status", filters.status);
    if (filters.importance) params.set("importance", filters.importance);
    if (filters.publisherId) params.set("publisherId", filters.publisherId);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    params.set("sort", sort.field);
    params.set("order", sort.order);
    const query = params.toString();
    apiFetch<{ items: any[]; total: number }>(`/api/story-blocks${query ? `?${query}` : ""}`)
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
      })
      .catch((err) => setError(err.message));
  }, [filters.importance, filters.publisherId, filters.status, page, pageSize, search, sort.field, sort.order]);

  React.useEffect(() => {
    load();
    apiFetch<{ items: any[] }>("/api/events?pageSize=100").then((data) => setEvents(data.items));
    apiFetch<{ items: any[] }>("/api/series?pageSize=100").then((data) => setSeries(data.items));
    apiFetch<{ items: any[] }>("/api/publishers?pageSize=100").then((data) => setPublishers(data.items));
    apiFetch<{ items: any[] }>("/api/story-blocks?pageSize=100").then((data) => setStoryBlockOptions(data.items));
  }, [load]);

  React.useEffect(() => {
    setPage(1);
  }, [filters.importance, filters.publisherId, filters.status, search]);

  React.useEffect(() => {
    setSeriesIds([]);
    setIssueIds([]);
    setForm((prev) => (prev.eventId ? { ...prev, eventId: "" } : prev));
    setForm((prev) => (prev.previousStoryBlockId ? { ...prev, previousStoryBlockId: "" } : prev));
    setRangeSeriesId("");
    setRangeStart("");
    setRangeEnd("");
    setRangeStatus(null);
  }, [form.publisherId]);

  React.useEffect(() => {
    if (!seriesIds.length) {
      setIssueIds([]);
      setIssueOptions([]);
      return;
    }
    const fetchIssues = async () => {
      const responses = await Promise.all(
        seriesIds.map((seriesId) =>
          apiFetch<{ items: any[] }>(`/api/issues?seriesId=${seriesId}&pageSize=100`)
        )
      );
      const combined = responses.flatMap((response) => response.items);
      const unique = Array.from(new Map(combined.map((issue) => [issue.id, issue])).values());
      setIssueOptions(unique);
      const allowedIds = new Set(unique.map((issue) => issue.id));
      setIssueIds((prev) => prev.filter((id) => allowedIds.has(id)));
    };
    fetchIssues().catch(() => setIssueOptions([]));
  }, [seriesIds]);

  React.useEffect(() => {
    if (!issueIds.length) {
      setDerived(null);
      setDeriveError(null);
      return;
    }
    setDeriveError(null);
    apiFetch<any>("/api/story-blocks/derive", {
      method: "POST",
      body: JSON.stringify({ issueIds })
    })
      .then((data) => setDerived(data))
      .catch((err) => setDeriveError(err.message));
  }, [issueIds]);

  const handleSort = (field: string) => {
    setSort((prev) => {
      if (prev.field === field) {
        return { field, order: prev.order === "asc" ? "desc" : "asc" };
      }
      return { field, order: "asc" };
    });
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await apiFetch(`/api/story-blocks/${id}`, { method: "DELETE" });
    load();
  };

  const handleAddRange = async () => {
    setRangeStatus(null);
    if (!rangeSeriesId || !rangeStart.trim() || !rangeEnd.trim()) {
      setRangeStatus("Select a series and enter start/end issue numbers.");
      return;
    }

    try {
      const result = await apiFetch<{ items: any[] }>(
        `/api/issues/range?seriesId=${rangeSeriesId}&start=${encodeURIComponent(
          rangeStart.trim()
        )}&end=${encodeURIComponent(rangeEnd.trim())}`
      );
      const incoming = result.items || [];
      if (!incoming.length) {
        setRangeStatus("No issues found in that range.");
        return;
      }
      if (!seriesIds.includes(rangeSeriesId)) {
        setSeriesIds((prev) => [...prev, rangeSeriesId]);
      }
      setIssueOptions((prev) =>
        Array.from(new Map([...prev, ...incoming].map((issue) => [issue.id, issue])).values())
      );
      setIssueIds((prev) => {
        const next = new Set(prev);
        incoming.forEach((issue) => next.add(issue.id));
        return Array.from(next);
      });
      setRangeStatus(`Added ${incoming.length} issues.`);
    } catch (err) {
      setRangeStatus((err as Error).message);
    }
  };

  const handleCreate = async () => {
    setError(null);
    if (!issueIds.length) {
      setError("Select at least one issue so the story block can derive dates, status, and cast.");
      return;
    }
    try {
      await apiFetch("/api/story-blocks", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          era: form.era || null,
          chronology: form.chronology || null,
          importance: form.importance,
          syncLevel: form.syncLevel,
          publisherId: form.publisherId || null,
          previousStoryBlockId: form.previousStoryBlockId || null,
          eventId: form.eventId || null,
          orderIndex: Number(form.orderIndex),
          notes: form.notes || null,
          seriesIds,
          issueIds
        })
      });
      setForm({
        name: "",
        type: "",
        era: "",
        chronology: "",
        importance: "",
        syncLevel: "",
        publisherId: "",
        previousStoryBlockId: "",
        eventId: "",
        orderIndex: "",
        notes: ""
      });
      setSeriesIds([]);
      setIssueIds([]);
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
      type: row.type?.trim(),
      era: row.era?.trim(),
      chronology: row.chronology?.trim(),
      publisherName: row.publisherName?.trim() || row.publisher?.trim(),
      startYear: row.startYear?.trim(),
      endYear: row.endYear?.trim(),
      importance: row.importance?.trim(),
      syncLevel: row.syncLevel?.trim(),
      eventName: row.eventName?.trim() || row.event?.trim(),
      orderIndex: row.orderIndex?.trim(),
      status: row.status?.trim(),
      notes: row.notes?.trim()
    }));

    try {
      const result = await apiFetch<{ imported: number; total: number }>("/api/story-blocks/bulk", {
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

  const filteredSeries = form.publisherId
    ? series.filter((entry) => entry.publisherId === form.publisherId)
    : [];
  const filteredEvents = form.publisherId
    ? events.filter((entry) => entry.publisherId === form.publisherId)
    : [];
  const filteredPreviousBlocks = form.publisherId
    ? storyBlockOptions.filter((entry) => entry.publisherId === form.publisherId)
    : storyBlockOptions;

  return (
    <div className="space-y-10">
      <SectionHeader title="Story Blocks" subtitle="Your primary reading units, sequenced and tracked." />

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">New Story Block</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <FormField label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
          <FormField
            label="Type"
            value={form.type}
            onChange={(value) => setForm({ ...form, type: value })}
            options={storyBlockTypes}
          />
          <FormField
            label="Era"
            value={form.era}
            onChange={(value) => setForm({ ...form, era: value })}
            suggestions={eraSuggestions}
            listId="story-block-era-options"
          />
          <FormField
            label="Chronology"
            value={form.chronology}
            onChange={(value) => setForm({ ...form, chronology: value })}
            suggestions={chronologySuggestions}
            listId="story-block-chronology-options"
          />
          <FormField
            label="Importance"
            value={form.importance}
            onChange={(value) => setForm({ ...form, importance: value })}
            options={storyBlockImportance}
          />
          <FormField
            label="Sync Level"
            value={form.syncLevel}
            onChange={(value) => setForm({ ...form, syncLevel: value })}
            options={syncLevels}
          />
          <FormField
            label="Publisher"
            value={form.publisherId}
            onChange={(value) => setForm({ ...form, publisherId: value })}
            options={publishers.map((publisher) => ({ label: publisher.name, value: publisher.id }))}
          />
          {publishers.length === 0 ? (
            <p className="text-xs text-ink-600">Create a publisher first to enable story block creation.</p>
          ) : null}
          <FormField
            label="Previous Story Block"
            value={form.previousStoryBlockId}
            onChange={(value) => setForm({ ...form, previousStoryBlockId: value })}
            options={filteredPreviousBlocks.map((entry) => ({ label: entry.name, value: entry.id }))}
          />
          <FormField
            label="Event"
            value={form.eventId}
            onChange={(value) => setForm({ ...form, eventId: value })}
            options={filteredEvents.map((event) => ({ label: event.name, value: event.id }))}
          />
          <FormField
            label="Order Index"
            value={form.orderIndex}
            onChange={(value) => setForm({ ...form, orderIndex: value })}
            type="number"
            step="0.01"
          />
        </div>
        <p className="mt-3 text-xs text-ink-600">
          Start/end year, status, characters, and teams are derived from the issues you attach.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <SearchableMultiSelect
            label="Series"
            options={filteredSeries.map((entry) => ({ label: entry.name, value: entry.id }))}
            selectedValues={seriesIds}
            onChange={setSeriesIds}
            helper={form.publisherId ? undefined : "Select a publisher to load series."}
            placeholder={form.publisherId ? "Search series..." : "Select a publisher first"}
          />
          <SearchableMultiSelect
            label="Issues"
            options={issueOptions.map((entry) => ({
              label: `${entry.series?.name || "Series"} #${entry.issueNumber}`,
              value: entry.id
            }))}
            selectedValues={issueIds}
            onChange={setIssueIds}
            helper={seriesIds.length ? undefined : "Select series to load issues."}
            placeholder={seriesIds.length ? "Search issues..." : "Select series first"}
          />
        </div>
        <div className="mt-4 rounded-2xl border border-mist-200 bg-mist-50/60 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-600">Add Issue Range</p>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <FormField
              label="Series"
              value={rangeSeriesId}
              onChange={setRangeSeriesId}
              options={filteredSeries.map((entry) => ({ label: entry.name, value: entry.id }))}
            />
            <FormField label="Start Issue" value={rangeStart} onChange={setRangeStart} />
            <FormField label="End Issue" value={rangeEnd} onChange={setRangeEnd} />
            <div className="flex items-end">
              <button className="btn-secondary w-full" onClick={handleAddRange}>
                Add Range
              </button>
            </div>
          </div>
          {rangeStatus ? <p className="mt-2 text-xs text-ink-600">{rangeStatus}</p> : null}
        </div>
        <div className="mt-4 rounded-2xl border border-mist-200 bg-white px-4 py-3 text-sm text-ink-700">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-600">Derived Preview</p>
          {deriveError ? (
            <p className="mt-2 text-xs text-ember-600">{deriveError}</p>
          ) : derived ? (
            <div className="mt-2 grid gap-2 md:grid-cols-4">
              <div>
                <p className="text-xs text-ink-500">Start Year</p>
                <p className="text-sm font-semibold text-ink-900">{derived.startYear ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-ink-500">End Year</p>
                <p className="text-sm font-semibold text-ink-900">{derived.endYear ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-ink-500">Status</p>
                <p className="text-sm font-semibold text-ink-900">{derived.status}</p>
              </div>
              <div>
                <p className="text-xs text-ink-500">Cast</p>
                <p className="text-sm font-semibold text-ink-900">
                  {(derived.characters?.length || 0) + (derived.teams?.length || 0)}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-ink-600">Select issues to see derived values.</p>
          )}
        </div>
        <div className="mt-4">
          <FormField label="Notes" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} textarea />
        </div>
        {error ? <p className="mt-3 text-sm text-ember-600">{error}</p> : null}
        <button className="btn-primary mt-4" onClick={handleCreate}>
          Create Story Block
        </button>
      </div>

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">Story Block Shelf</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <FormField label="Search" value={search} onChange={setSearch} placeholder="Search by name" />
          <FormField
            label="Status"
            value={filters.status}
            onChange={(value) => setFilters({ ...filters, status: value })}
            options={storyBlockStatus}
          />
          <FormField
            label="Importance"
            value={filters.importance}
            onChange={(value) => setFilters({ ...filters, importance: value })}
            options={storyBlockImportance}
          />
          <FormField
            label="Publisher"
            value={filters.publisherId}
            onChange={(value) => setFilters({ ...filters, publisherId: value })}
            options={publishers.map((publisher) => ({ label: publisher.name, value: publisher.id }))}
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
                <th className="pb-2">
                  <button className="text-left" onClick={() => handleSort("status")}>
                    Status
                  </button>
                </th>
                <th className="pb-2">
                  <button className="text-left" onClick={() => handleSort("orderIndex")}>
                    Order
                  </button>
                </th>
                <th className="pb-2">
                  <button className="text-left" onClick={() => handleSort("importance")}>
                    Importance
                  </button>
                </th>
                <th className="pb-2">
                  <button className="text-left" onClick={() => handleSort("syncLevel")}>
                    Sync
                  </button>
                </th>
                <th className="pb-2">
                  <button className="text-left" onClick={() => handleSort("startYear")}>
                    Start Year
                  </button>
                </th>
                <th className="pb-2">Publisher</th>
                <th className="pb-2">Completion</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm text-ink-800">
              {items.map((item) => (
                <tr key={item.id} className="border-t border-mist-100">
                  <td className="py-3 font-semibold text-ink-900">
                    <Link to={`/story-blocks/${item.id}`}>{item.name}</Link>
                  </td>
                  <td className="py-3">{item.status}</td>
                  <td className="py-3">{item.orderIndex}</td>
                  <td className="py-3">{item.importance}</td>
                  <td className="py-3">{item.syncLevel}</td>
                  <td className="py-3">{item.startYear}</td>
                  <td className="py-3">{item.publisher?.name || "—"}</td>
                  <td className="py-3">{item.metrics?.completionPercent ?? 0}%</td>
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
        <h3 className="text-lg font-semibold text-ink-900">Bulk Add Story Blocks</h3>
        <p className="mt-2 text-sm text-ink-700">
          Paste CSV with headers:{" "}
          <code>name,type,era,chronology,publisherName,startYear,endYear,importance,syncLevel,eventName,orderIndex,status,notes</code>
        </p>
        <textarea
          className="mt-4 min-h-[180px] w-full rounded-2xl border border-mist-200 bg-white px-3 py-2 text-sm text-ink-900"
          value={bulkText}
          onChange={(event) => setBulkText(event.target.value)}
          placeholder="name,type,era,chronology,publisherName,startYear,endYear,importance,syncLevel,eventName,orderIndex,status,notes\nGod Butcher,RUN,Fresh Start,,Marvel,2018,,CORE,ISOLATED_0,,1.0,NOT_STARTED,"
        />
        {bulkStatus ? <p className="mt-3 text-sm text-ember-600">{bulkStatus}</p> : null}
        <button className="btn-primary mt-4" onClick={handleBulkImport}>
          Import CSV
        </button>
      </div>
    </div>
  );
};

export default StoryBlocksPage;
