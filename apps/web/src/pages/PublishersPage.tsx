import React from "react";
import { Link } from "react-router-dom";
import SectionHeader from "../components/SectionHeader";
import FormField from "../components/FormField";
import { apiFetch } from "../lib/api";

const PublishersPage = () => {
  const [items, setItems] = React.useState<any[]>([]);
  const [name, setName] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  const load = React.useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    const query = params.toString();
    apiFetch<{ items: any[] }>(`/api/publishers${query ? `?${query}` : ""}`)
      .then((data) => setItems(data.items))
      .catch((err) => setError(err.message));
  }, [search]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    setError(null);
    try {
      await apiFetch("/api/publishers", {
        method: "POST",
        body: JSON.stringify({ name, country: country || null, notes: notes || null })
      });
      setName("");
      setCountry("");
      setNotes("");
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const message = `Delete "${name}"? This will remove related series and events.`;
    if (!window.confirm(message)) return;
    await apiFetch(`/api/publishers/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-10">
      <SectionHeader title="Publishers" subtitle="Add and manage publishers for series and events." />

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">New Publisher</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <FormField label="Name" value={name} onChange={setName} />
          <FormField label="Country" value={country} onChange={setCountry} />
          <FormField label="Notes" value={notes} onChange={setNotes} />
        </div>
        {error ? <p className="mt-3 text-sm text-ember-600">{error}</p> : null}
        <button className="btn-primary mt-4" onClick={handleCreate}>
          Create Publisher
        </button>
      </div>

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">Publisher Library</h3>
        <div className="mt-4 max-w-md">
          <FormField label="Search" value={search} onChange={setSearch} placeholder="Search by name" />
        </div>
        <div className="mt-4 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.2em] text-ink-600">
              <tr>
                <th className="pb-2">Name</th>
                <th className="pb-2">Country</th>
                <th className="pb-2">Series</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm text-ink-800">
              {items.map((item) => (
                <tr key={item.id} className="border-t border-mist-100">
                  <td className="py-3 font-semibold text-ink-900">
                    <Link to={`/library/publishers/${item.id}`}>{item.name}</Link>
                  </td>
                  <td className="py-3">{item.country || "N/A"}</td>
                  <td className="py-3">{item._count?.series ?? 0}</td>
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
      </div>
    </div>
  );
};

export default PublishersPage;
