import React from "react";
import Papa from "papaparse";
import { Link } from "react-router-dom";
import SectionHeader from "../components/SectionHeader";
import FormField from "../components/FormField";
import SearchableMultiSelect from "../components/SearchableMultiSelect";
import { apiFetch } from "../lib/api";
import { characterTypes, trackingPriorities } from "../lib/enums";

const CharactersPage = () => {
  const [items, setItems] = React.useState<any[]>([]);
  const [publishers, setPublishers] = React.useState<any[]>([]);
  const [teams, setTeams] = React.useState<any[]>([]);
  const [form, setForm] = React.useState({
    name: "",
    realName: "",
    type: "",
    publisherId: "",
    aliases: "",
    continuity: "",
    majorStatusQuoNotes: "",
    currentTrackingPriority: "NONE"
  });
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [filters, setFilters] = React.useState({ type: "", priority: "" });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [total, setTotal] = React.useState(0);
  const [sort, setSort] = React.useState({ field: "name", order: "asc" });
  const [teamIds, setTeamIds] = React.useState<string[]>([]);
  const [bulkText, setBulkText] = React.useState("");
  const [bulkStatus, setBulkStatus] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (filters.type) params.set("type", filters.type);
    if (filters.priority) params.set("priority", filters.priority);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    params.set("sort", sort.field);
    params.set("order", sort.order);
    const query = params.toString();
    apiFetch<{ items: any[]; total: number }>(`/api/characters${query ? `?${query}` : ""}`)
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
      })
      .catch((err) => setError(err.message));
  }, [filters.priority, filters.type, page, pageSize, search, sort.field, sort.order]);

  React.useEffect(() => {
    load();
    apiFetch<{ items: any[] }>("/api/publishers").then((data) => setPublishers(data.items));
    apiFetch<{ items: any[] }>("/api/characters?type=TEAM&pageSize=100").then((data) =>
      setTeams(data.items)
    );
  }, [load]);

  React.useEffect(() => {
    setPage(1);
  }, [search, filters.type, filters.priority]);

  React.useEffect(() => {
    if (form.type !== "CHARACTER" && teamIds.length) {
      setTeamIds([]);
    }
  }, [form.type, teamIds.length]);

  const handleMultiSelect = (event: React.ChangeEvent<HTMLSelectElement>) =>
    Array.from(event.target.selectedOptions).map((option) => option.value);

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
    await apiFetch(`/api/characters/${id}`, { method: "DELETE" });
    load();
  };

  const handleCreate = async () => {
    setError(null);
    try {
      await apiFetch("/api/characters", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          realName: form.realName || null,
          type: form.type,
          publisherId: form.publisherId || null,
          aliases: form.aliases || null,
          continuity: form.continuity || null,
          majorStatusQuoNotes: form.majorStatusQuoNotes || null,
          currentTrackingPriority: form.currentTrackingPriority,
          teamIds
        })
      });
      setForm({
        name: "",
        realName: "",
        type: "",
        publisherId: "",
        aliases: "",
        continuity: "",
        majorStatusQuoNotes: "",
        currentTrackingPriority: "NONE"
      });
      setTeamIds([]);
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
      realName: row.realName?.trim(),
      type: row.type?.trim(),
      publisherName: row.publisherName?.trim() || row.publisher?.trim(),
      aliases: row.aliases?.trim(),
      continuity: row.continuity?.trim(),
      majorStatusQuoNotes: row.majorStatusQuoNotes?.trim(),
      currentTrackingPriority: row.currentTrackingPriority?.trim()
    }));

    try {
      const result = await apiFetch<{ imported: number; total: number }>("/api/characters/bulk", {
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
      <SectionHeader
        title="Characters & Teams"
        subtitle="Track who you are following and when to switch focus."
      />

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">New Entry</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <FormField label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
          <FormField
            label="Real Name"
            value={form.realName}
            onChange={(value) => setForm({ ...form, realName: value })}
          />
          <FormField
            label="Type"
            value={form.type}
            onChange={(value) => setForm({ ...form, type: value })}
            options={characterTypes}
          />
          <FormField
            label="Publisher"
            value={form.publisherId}
            onChange={(value) => setForm({ ...form, publisherId: value })}
            options={publishers.map((publisher) => ({ label: publisher.name, value: publisher.id }))}
          />
          <FormField
            label="Priority"
            value={form.currentTrackingPriority}
            onChange={(value) => setForm({ ...form, currentTrackingPriority: value })}
            options={trackingPriorities}
          />
          <FormField label="Aliases" value={form.aliases} onChange={(value) => setForm({ ...form, aliases: value })} />
          <FormField
            label="Continuity"
            value={form.continuity}
            onChange={(value) => setForm({ ...form, continuity: value })}
          />
        </div>
        <div className="mt-4">
          <FormField
            label="Major Status Quo Notes"
            value={form.majorStatusQuoNotes}
            onChange={(value) => setForm({ ...form, majorStatusQuoNotes: value })}
            textarea
          />
        </div>
        {form.type === "CHARACTER" ? (
          <div className="mt-4">
            <SearchableMultiSelect
              label="Teams"
              options={teams.map((team) => ({ label: team.name, value: team.id }))}
              selectedValues={teamIds}
              onChange={setTeamIds}
              placeholder="Search teams..."
            />
          </div>
        ) : null}
        {error ? <p className="mt-3 text-sm text-ember-600">{error}</p> : null}
        <button className="btn-primary mt-4" onClick={handleCreate}>
          Create Character/Team
        </button>
      </div>

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">Roster</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <FormField label="Search" value={search} onChange={setSearch} placeholder="Search by name" />
          <FormField
            label="Type"
            value={filters.type}
            onChange={(value) => setFilters({ ...filters, type: value })}
            options={characterTypes}
          />
          <FormField
            label="Priority"
            value={filters.priority}
            onChange={(value) => setFilters({ ...filters, priority: value })}
            options={trackingPriorities}
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
                  <button className="text-left" onClick={() => handleSort("type")}>
                    Type
                  </button>
                </th>
                <th className="pb-2">
                  <button className="text-left" onClick={() => handleSort("currentTrackingPriority")}>
                    Priority
                  </button>
                </th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm text-ink-800">
              {items.map((item) => (
                <tr key={item.id} className="border-t border-mist-100">
                  <td className="py-3 font-semibold text-ink-900">
                    <Link to={`/characters/${item.id}`}>{item.name}</Link>
                  </td>
                  <td className="py-3">{item.type}</td>
                  <td className="py-3">{item.currentTrackingPriority}</td>
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
        <h3 className="text-lg font-semibold text-ink-900">Bulk Add Characters/Teams</h3>
        <p className="mt-2 text-sm text-ink-700">
          Paste CSV with headers:{" "}
          <code>name,realName,type,publisherName,aliases,continuity,majorStatusQuoNotes,currentTrackingPriority</code>
        </p>
        <textarea
          className="mt-4 min-h-[180px] w-full rounded-2xl border border-mist-200 bg-white px-3 py-2 text-sm text-ink-900"
          value={bulkText}
          onChange={(event) => setBulkText(event.target.value)}
          placeholder="name,realName,type,publisherName,aliases,continuity,majorStatusQuoNotes,currentTrackingPriority\nThor,Thor Odinson,CHARACTER,Marvel,,Earth-616,,HIGH\nAvengers,,TEAM,Marvel,,Earth-616,,MEDIUM"
        />
        {bulkStatus ? <p className="mt-3 text-sm text-ember-600">{bulkStatus}</p> : null}
        <button className="btn-primary mt-4" onClick={handleBulkImport}>
          Import CSV
        </button>
      </div>
    </div>
  );
};

export default CharactersPage;
