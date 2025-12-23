import React from "react";
import { Link } from "react-router-dom";
import SectionHeader from "../components/SectionHeader";
import FormField from "../components/FormField";
import { apiFetch } from "../lib/api";

const EventsPage = () => {
  const [items, setItems] = React.useState<any[]>([]);
  const [publishers, setPublishers] = React.useState<any[]>([]);
  const [form, setForm] = React.useState({
    name: "",
    publisherId: "",
    startYear: "",
    endYear: "",
    sequenceOrder: "",
    notes: ""
  });
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [publisherFilter, setPublisherFilter] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [total, setTotal] = React.useState(0);
  const [sort, setSort] = React.useState({ field: "sequenceOrder", order: "asc" });

  const load = React.useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (publisherFilter) params.set("publisherId", publisherFilter);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    params.set("sort", sort.field);
    params.set("order", sort.order);
    const query = params.toString();
    apiFetch<{ items: any[]; total: number }>(`/api/events${query ? `?${query}` : ""}`)
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
      })
      .catch((err) => setError(err.message));
  }, [page, pageSize, publisherFilter, search, sort.field, sort.order]);

  React.useEffect(() => {
    load();
    apiFetch<{ items: any[] }>("/api/publishers").then((data) => setPublishers(data.items));
  }, [load]);

  React.useEffect(() => {
    setPage(1);
  }, [publisherFilter, search]);

  const handleSort = (field: string) => {
    setSort((prev) => {
      if (prev.field === field) {
        return { field, order: prev.order === "asc" ? "desc" : "asc" };
      }
      return { field, order: "asc" };
    });
  };

  const handleDelete = async (id: string, name: string) => {
    const message = `Delete "${name}"? Story blocks referencing this event will be unlinked.`;
    if (!window.confirm(message)) return;
    await apiFetch(`/api/events/${id}`, { method: "DELETE" });
    load();
  };

  const handleCreate = async () => {
    setError(null);
    try {
      await apiFetch("/api/events", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          publisherId: form.publisherId,
          startYear: Number(form.startYear),
          endYear: form.endYear ? Number(form.endYear) : null,
          sequenceOrder: Number(form.sequenceOrder),
          notes: form.notes || null
        })
      });
      setForm({ name: "", publisherId: "", startYear: "", endYear: "", sequenceOrder: "", notes: "" });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="space-y-10">
      <SectionHeader title="Events" subtitle="Map macro events and their reading sequence." />

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">New Event</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <FormField label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
          <FormField
            label="Publisher"
            value={form.publisherId}
            onChange={(value) => setForm({ ...form, publisherId: value })}
            options={publishers.map((publisher) => ({ label: publisher.name, value: publisher.id }))}
          />
          <FormField
            label="Sequence Order"
            value={form.sequenceOrder}
            onChange={(value) => setForm({ ...form, sequenceOrder: value })}
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
        </div>
        <div className="mt-4">
          <FormField label="Notes" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} textarea />
        </div>
        {error ? <p className="mt-3 text-sm text-ember-600">{error}</p> : null}
        <button className="btn-primary mt-4" onClick={handleCreate}>
          Create Event
        </button>
        {error ? <p className="mt-3 text-sm text-ember-600">{error}</p> : null}
      </div>

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">Event Catalog</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <FormField label="Search" value={search} onChange={setSearch} placeholder="Search by name" />
          <FormField
            label="Publisher"
            value={publisherFilter}
            onChange={setPublisherFilter}
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
                <th className="pb-2">Publisher</th>
                <th className="pb-2">
                  <button className="text-left" onClick={() => handleSort("sequenceOrder")}>
                    Order
                  </button>
                </th>
                <th className="pb-2">
                  <button className="text-left" onClick={() => handleSort("startYear")}>
                    Start Year
                  </button>
                </th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm text-ink-800">
              {items.map((item) => (
                <tr key={item.id} className="border-t border-mist-100">
                  <td className="py-3 font-semibold text-ink-900">
                    <Link to={`/library/events/${item.id}`}>{item.name}</Link>
                  </td>
                  <td className="py-3">{item.publisher?.name}</td>
                  <td className="py-3">{item.sequenceOrder}</td>
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
    </div>
  );
};

export default EventsPage;
