import React from "react";
import { Link, useParams } from "react-router-dom";
import SectionHeader from "../components/SectionHeader";
import FormField from "../components/FormField";
import { apiFetch } from "../lib/api";

const PublisherDetailPage = () => {
  const { id } = useParams();
  const [publisher, setPublisher] = React.useState<any | null>(null);
  const [name, setName] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const saveTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    apiFetch<any>(`/api/publishers/${id}`)
      .then((data) => {
        setPublisher(data);
        setName(data.name);
        setCountry(data.country || "");
        setNotes(data.notes || "");
      })
      .catch(() => setPublisher(null));
  }, [id]);

  const savePublisher = React.useCallback(
    async (nextValues: { name: string; country: string; notes: string }) => {
      if (!id) return;
      setSaveError(null);
      try {
        await apiFetch(`/api/publishers/${id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: nextValues.name,
            country: nextValues.country || null,
            notes: nextValues.notes || null
          })
        });
      } catch (err) {
        setSaveError((err as Error).message);
      }
    },
    [id]
  );

  const scheduleSave = React.useCallback(
    (nextValues: { name: string; country: string; notes: string }) => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        savePublisher(nextValues);
        saveTimerRef.current = null;
      }, 500);
    },
    [savePublisher]
  );

  React.useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  if (!publisher) {
    return <div className="text-ink-700">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        title={publisher.name}
        subtitle="Update publisher details or explore connected series and events."
        action={
          <Link className="btn-secondary" to="/library/publishers">
            Back to list
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <FormField
          label="Name"
          value={name}
          onChange={(value) => {
            setName(value);
            scheduleSave({ name: value, country, notes });
          }}
        />
        <FormField
          label="Country"
          value={country}
          onChange={(value) => {
            setCountry(value);
            scheduleSave({ name, country: value, notes });
          }}
        />
        <FormField
          label="Notes"
          value={notes}
          onChange={(value) => {
            setNotes(value);
            scheduleSave({ name, country, notes: value });
          }}
        />
      </div>
      {saveError ? <p className="mt-3 text-sm text-ember-600">{saveError}</p> : null}

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">Series</h3>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {publisher.series.map((series: any) => (
            <li key={series.id} className="rounded-2xl border border-mist-200 bg-white px-4 py-3">
              <Link to={`/library/series/${series.id}`} className="font-semibold text-ink-900">
                {series.name}
              </Link>
              <p className="text-xs text-ink-600">{series.startYear}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">Events</h3>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {publisher.events.map((event: any) => (
            <li key={event.id} className="rounded-2xl border border-mist-200 bg-white px-4 py-3">
              <Link to={`/library/events/${event.id}`} className="font-semibold text-ink-900">
                {event.name}
              </Link>
              <p className="text-xs text-ink-600">Sequence #{event.sequenceOrder}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default PublisherDetailPage;
