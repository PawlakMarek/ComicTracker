import React from "react";
import { Link } from "react-router-dom";
import SectionHeader from "../components/SectionHeader";
import FormField from "../components/FormField";
import { apiFetch } from "../lib/api";

const ReadingOrdersPage = () => {
  const [items, setItems] = React.useState<any[]>([]);
  const [form, setForm] = React.useState({ name: "", description: "" });
  const [search, setSearch] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [total, setTotal] = React.useState(0);

  const load = React.useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    const query = params.toString();
    apiFetch<{ items: any[]; total: number }>(`/api/reading-orders${query ? `?${query}` : ""}`)
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
      })
      .catch((err) => setError(err.message));
  }, [page, pageSize, search]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    setPage(1);
  }, [search]);

  const handleCreate = async () => {
    setError(null);
    try {
      await apiFetch("/api/reading-orders", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          description: form.description || null
        })
      });
      setForm({ name: "", description: "" });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await apiFetch(`/api/reading-orders/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-10">
      <SectionHeader title="Reading Orders" subtitle="Curated sequences of story blocks for any focus." />

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">New Reading Order</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <FormField label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
          <FormField
            label="Description"
            value={form.description}
            onChange={(value) => setForm({ ...form, description: value })}
          />
        </div>
        {error ? <p className="mt-3 text-sm text-ember-600">{error}</p> : null}
        <button className="btn-primary mt-4" onClick={handleCreate}>
          Create Reading Order
        </button>
      </div>

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">Reading Order Library</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <FormField label="Search" value={search} onChange={setSearch} placeholder="Search by name" />
        </div>
        <div className="mt-4 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.2em] text-ink-600">
              <tr>
                <th className="pb-2">Name</th>
                <th className="pb-2">Blocks</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm text-ink-800">
              {items.map((item) => (
                <tr key={item.id} className="border-t border-mist-100">
                  <td className="py-3 font-semibold text-ink-900">
                    <Link to={`/reading-orders/${item.id}`}>{item.name}</Link>
                  </td>
                  <td className="py-3">{item._count?.items ?? 0}</td>
                  <td className="py-3 text-xs uppercase tracking-[0.2em] text-ink-500">
                    {item.status || "NOT_STARTED"}
                  </td>
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

export default ReadingOrdersPage;
