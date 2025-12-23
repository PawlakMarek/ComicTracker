import React from "react";
import { Link } from "react-router-dom";
import SectionHeader from "../components/SectionHeader";
import FormField from "../components/FormField";
import AsyncSearchableMultiSelect from "../components/AsyncSearchableMultiSelect";
import { apiFetch } from "../lib/api";
import { fatigueLevels } from "../lib/enums";

const SessionsPage = () => {
  const [items, setItems] = React.useState<any[]>([]);
  const [form, setForm] = React.useState({
    sessionDate: new Date().toISOString().slice(0, 16),
    durationMinutes: "60",
    fatigueLevel: "UNKNOWN",
    notes: ""
  });
  const [issueIds, setIssueIds] = React.useState<string[]>([]);
  const [filters, setFilters] = React.useState({ from: "", to: "" });

  const load = React.useCallback(() => {
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    const query = params.toString();
    apiFetch<{ items: any[] }>(`/api/sessions${query ? `?${query}` : ""}`).then((data) => setItems(data.items));
  }, [filters.from, filters.to]);

  React.useEffect(() => {
    load();
  }, [load]);

  const fetchIssueOptions = React.useCallback(async (query: string) => {
    const data = await apiFetch<{ items: any[] }>(
      `/api/issues?q=${encodeURIComponent(query)}&pageSize=20&sort=series&order=asc`
    );
    return data.items.map((issue) => ({
      label: `${issue.series?.name || "Series"} #${issue.issueNumber}`,
      value: issue.id
    }));
  }, []);

  const handleCreate = async () => {
    await apiFetch("/api/sessions", {
      method: "POST",
      body: JSON.stringify({
        sessionDate: form.sessionDate,
        durationMinutes: Number(form.durationMinutes),
        fatigueLevel: form.fatigueLevel,
        notes: form.notes || null,
        issueIds
      })
    });
    setIssueIds([]);
    load();
  };

  const handleDelete = async (sessionId: string) => {
    if (!window.confirm("Delete this session? This cannot be undone.")) return;
    await apiFetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-10">
      <SectionHeader title="Reading Sessions" subtitle="Log your reading and track fatigue signals." />

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">Quick Session Log</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <FormField
            label="Session Date"
            type="datetime-local"
            value={form.sessionDate}
            onChange={(value) => setForm({ ...form, sessionDate: value })}
          />
          <FormField
            label="Duration (minutes)"
            value={form.durationMinutes}
            onChange={(value) => setForm({ ...form, durationMinutes: value })}
          />
          <FormField
            label="Fatigue"
            value={form.fatigueLevel}
            onChange={(value) => setForm({ ...form, fatigueLevel: value })}
            options={fatigueLevels}
          />
        </div>
        <div className="mt-4">
          <FormField label="Notes" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} textarea />
        </div>
        <div className="mt-4">
          <AsyncSearchableMultiSelect
            label="Issues Read"
            selectedValues={issueIds}
            onChange={setIssueIds}
            placeholder="Search issues..."
            fetchOptions={fetchIssueOptions}
          />
        </div>
        <button className="btn-primary mt-4" onClick={handleCreate}>
          Log Session
        </button>
      </div>

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">Session History</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <FormField
            label="From"
            type="date"
            value={filters.from}
            onChange={(value) => setFilters({ ...filters, from: value })}
          />
          <FormField
            label="To"
            type="date"
            value={filters.to}
            onChange={(value) => setFilters({ ...filters, to: value })}
          />
        </div>
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-2xl border border-mist-200 bg-white px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link to={`/sessions/${item.id}`} className="text-sm font-semibold text-ink-900">
                    {new Date(item.sessionDate).toLocaleString()}
                  </Link>
                  <p className="text-xs text-ink-600">
                    {item.durationMinutes} min - {item.fatigueLevel} - {item.readingSessionIssues?.length ?? 0} issues
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link className="btn-secondary" to={`/sessions/${item.id}`}>
                    Edit
                  </Link>
                  <button className="btn-secondary" onClick={() => handleDelete(item.id)}>
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default SessionsPage;
