import React from "react";
import { Link, useParams } from "react-router-dom";
import SectionHeader from "../components/SectionHeader";
import FormField from "../components/FormField";
import { apiFetch } from "../lib/api";

type OrderItem = {
  storyBlockId: string;
  orderIndex: number;
  storyBlock?: any;
};

const ReadingOrderDetailPage = () => {
  const { id } = useParams();
  const [order, setOrder] = React.useState<any | null>(null);
  const [form, setForm] = React.useState({ name: "", description: "" });
  const [items, setItems] = React.useState<OrderItem[]>([]);
  const [search, setSearch] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const saveTimerRef = React.useRef<number | null>(null);

  const load = React.useCallback(() => {
    apiFetch<any>(`/api/reading-orders/${id}`).then((data) => {
      setOrder(data);
      setForm({ name: data.name ?? "", description: data.description ?? "" });
      setItems(
        (data.items || []).map((item: any) => ({
          storyBlockId: item.storyBlockId,
          orderIndex: item.orderIndex,
          storyBlock: item.storyBlock
        }))
      );
    });
  }, [id]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    const params = new URLSearchParams();
    params.set("q", search);
    params.set("pageSize", "50");
    apiFetch<{ items: any[] }>(`/api/story-blocks?${params.toString()}`).then((data) =>
      setSearchResults(data.items)
    );
  }, [search]);

  if (!order) {
    return <div className="text-ink-700">Loading...</div>;
  }

  const usedIds = new Set(items.map((item) => item.storyBlockId));

  const saveItems = async (nextItems: OrderItem[], formOverride?: { name: string; description: string }) => {
    if (!id) return;
    setError(null);
    const payloadForm = formOverride ?? form;
    try {
      await apiFetch(`/api/reading-orders/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: payloadForm.name,
          description: payloadForm.description || null,
          items: nextItems.map((item) => ({
            storyBlockId: item.storyBlockId,
            orderIndex: Number(item.orderIndex)
          }))
        })
      });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const scheduleSave = (
    nextItems: OrderItem[],
    formOverride?: { name: string; description: string },
    delay = 400
  ) => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveItems(nextItems, formOverride);
      saveTimerRef.current = null;
    }, delay);
  };

  const handleAdd = async (block: any) => {
    if (usedIds.has(block.id)) return;
    const nextIndex = items.length ? Math.max(...items.map((item) => item.orderIndex)) + 1 : 1;
    const nextItems = [...items, { storyBlockId: block.id, orderIndex: nextIndex, storyBlock: block }];
    setItems(nextItems);
    await saveItems(nextItems);
  };

  const handleRemove = (storyBlockId: string) => {
    const nextItems = items.filter((item) => item.storyBlockId !== storyBlockId);
    setItems(nextItems);
    scheduleSave(nextItems);
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        title={order.name}
        subtitle={`${order.status ?? "NOT_STARTED"} · ${order.description || "Custom story-block sequence."}`}
        action={
          <Link className="btn-secondary" to="/reading-orders">
            Back to list
          </Link>
        }
      />

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">Order Details</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <FormField
            label="Name"
            value={form.name}
            onChange={(value) => {
              const nextForm = { ...form, name: value };
              setForm(nextForm);
              scheduleSave(items, nextForm);
            }}
          />
          <FormField
            label="Description"
            value={form.description}
            onChange={(value) => {
              const nextForm = { ...form, description: value };
              setForm(nextForm);
              scheduleSave(items, nextForm);
            }}
          />
        </div>
        {error ? <p className="mt-3 text-sm text-ember-600">{error}</p> : null}
      </div>

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">Add Story Blocks</h3>
        <FormField
          label="Search Story Blocks"
          value={search}
          onChange={setSearch}
          placeholder="Search by name"
        />
        {searchResults.length ? (
          <div className="mt-3 rounded-2xl border border-mist-200 bg-white shadow-card">
            {searchResults
              .filter((block) => !usedIds.has(block.id))
              .slice(0, 8)
              .map((block) => (
                <button
                  key={block.id}
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-ink-900 hover:bg-mist-100"
                  onClick={() => handleAdd(block)}
                >
                  <span>{block.name}</span>
                  <span className="text-xs text-ink-500">Add</span>
                </button>
              ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-ink-600">Type a name to search.</p>
        )}
      </div>

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">Order Lineup</h3>
        <div className="mt-4 space-y-3">
          {items
            .slice()
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((item) => (
              <div
                key={item.storyBlockId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-mist-200 bg-white px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-ink-900">{item.storyBlock?.name || "Story Block"}</p>
                  <p className="text-xs text-ink-600">{item.storyBlock?.status}</p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    className="w-24 rounded-2xl border border-mist-200 bg-white px-3 py-2 text-sm text-ink-900"
                    type="number"
                    step="0.1"
                    value={item.orderIndex}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setItems((prev) => {
                        const nextItems = prev.map((entry) =>
                          entry.storyBlockId === item.storyBlockId
                            ? { ...entry, orderIndex: Number.isNaN(value) ? entry.orderIndex : value }
                            : entry
                        );
                        scheduleSave(nextItems);
                        return nextItems;
                      });
                    }}
                  />
                  <button className="btn-secondary" onClick={() => handleRemove(item.storyBlockId)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          {items.length === 0 ? <p className="text-sm text-ink-600">No story blocks yet.</p> : null}
        </div>
      </div>
    </div>
  );
};

export default ReadingOrderDetailPage;
