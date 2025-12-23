import React from "react";
import { Link, useParams } from "react-router-dom";
import SectionHeader from "../components/SectionHeader";
import FormField from "../components/FormField";
import { apiFetch } from "../lib/api";

const EventDetailPage = () => {
  const { id } = useParams();
  const [event, setEvent] = React.useState<any | null>(null);
  const [publishers, setPublishers] = React.useState<any[]>([]);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const saveTimerRef = React.useRef<number | null>(null);
  const [form, setForm] = React.useState({
    name: "",
    publisherId: "",
    startYear: "",
    endYear: "",
    sequenceOrder: "",
    notes: ""
  });

  React.useEffect(() => {
    apiFetch<{ items: any[] }>("/api/publishers").then((data) => setPublishers(data.items));
    apiFetch<any>(`/api/events/${id}`).then((data) => {
      setEvent(data);
      setForm({
        name: data.name,
        publisherId: data.publisherId,
        startYear: String(data.startYear),
        endYear: data.endYear ? String(data.endYear) : "",
        sequenceOrder: String(data.sequenceOrder),
        notes: data.notes || ""
      });
    });
  }, [id]);

  const saveEvent = React.useCallback(
    async (nextForm: typeof form) => {
      if (!id) return;
      setSaveError(null);
      try {
        await apiFetch(`/api/events/${id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: nextForm.name,
            publisherId: nextForm.publisherId,
            startYear: Number(nextForm.startYear),
            endYear: nextForm.endYear ? Number(nextForm.endYear) : null,
            sequenceOrder: Number(nextForm.sequenceOrder),
            notes: nextForm.notes || null
          })
        });
      } catch (err) {
        setSaveError((err as Error).message);
      }
    },
    [id]
  );

  const scheduleSave = React.useCallback(
    (nextForm: typeof form) => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        saveEvent(nextForm);
        saveTimerRef.current = null;
      }, 500);
    },
    [saveEvent]
  );

  React.useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  if (!event) {
    return <div className="text-ink-700">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        title={event.name}
        subtitle="Adjust event sequencing and see linked story blocks."
        action={
          <Link className="btn-secondary" to="/library/events">
            Back to list
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <FormField
          label="Name"
          value={form.name}
          onChange={(value) => {
            const nextForm = { ...form, name: value };
            setForm(nextForm);
            scheduleSave(nextForm);
          }}
        />
        <FormField
          label="Publisher"
          value={form.publisherId}
          onChange={(value) => {
            const nextForm = { ...form, publisherId: value };
            setForm(nextForm);
            scheduleSave(nextForm);
          }}
          options={publishers.map((publisher) => ({ label: publisher.name, value: publisher.id }))}
        />
        <FormField
          label="Sequence Order"
          value={form.sequenceOrder}
          onChange={(value) => {
            const nextForm = { ...form, sequenceOrder: value };
            setForm(nextForm);
            scheduleSave(nextForm);
          }}
        />
        <FormField
          label="Start Year"
          value={form.startYear}
          onChange={(value) => {
            const nextForm = { ...form, startYear: value };
            setForm(nextForm);
            scheduleSave(nextForm);
          }}
        />
        <FormField
          label="End Year"
          value={form.endYear}
          onChange={(value) => {
            const nextForm = { ...form, endYear: value };
            setForm(nextForm);
            scheduleSave(nextForm);
          }}
        />
      </div>
      <div className="mt-4">
        <FormField
          label="Notes"
          value={form.notes}
          onChange={(value) => {
            const nextForm = { ...form, notes: value };
            setForm(nextForm);
            scheduleSave(nextForm);
          }}
          textarea
        />
      </div>
      {saveError ? <p className="mt-3 text-sm text-ember-600">{saveError}</p> : null}

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">Story Blocks</h3>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {event.storyBlocks.map((block: any) => (
            <li key={block.id} className="rounded-2xl border border-mist-200 bg-white px-4 py-3">
              <Link to={`/story-blocks/${block.id}`} className="font-semibold text-ink-900">
                {block.name}
              </Link>
              <p className="text-xs text-ink-600">{block.status}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default EventDetailPage;
