import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import SectionHeader from "../components/SectionHeader";
import FormField from "../components/FormField";
import { apiFetch } from "../lib/api";
import { seriesTypes } from "../lib/enums";

const SeriesDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [series, setSeries] = React.useState<any | null>(null);
  const [publishers, setPublishers] = React.useState<any[]>([]);
  const [seriesOptions, setSeriesOptions] = React.useState<any[]>([]);
  const [storyBlocks, setStoryBlocks] = React.useState<any[]>([]);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const saveTimerRef = React.useRef<number | null>(null);
  const [form, setForm] = React.useState({
    name: "",
    publisherId: "",
    startYear: "",
    endYear: "",
    era: "",
    chronology: "",
    type: "",
    notes: ""
  });

  const collectSuggestions = React.useCallback((entries: any[], field: string) => {
    const values = entries
      .map((entry) => (typeof entry?.[field] === "string" ? entry[field].trim() : ""))
      .filter(Boolean);
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, []);

  const eraSuggestions = React.useMemo(
    () => collectSuggestions([...seriesOptions, ...storyBlocks], "era"),
    [collectSuggestions, seriesOptions, storyBlocks]
  );
  const chronologySuggestions = React.useMemo(
    () => collectSuggestions([...seriesOptions, ...storyBlocks], "chronology"),
    [collectSuggestions, seriesOptions, storyBlocks]
  );

  React.useEffect(() => {
    apiFetch<{ items: any[] }>("/api/publishers").then((data) => setPublishers(data.items));
    apiFetch<{ items: any[] }>("/api/series?pageSize=200").then((data) => setSeriesOptions(data.items));
    apiFetch<{ items: any[] }>("/api/story-blocks?pageSize=200").then((data) => setStoryBlocks(data.items));
    apiFetch<any>(`/api/series/${id}`).then((data) => {
      setSeries(data);
      setForm({
        name: data.name,
        publisherId: data.publisherId,
        startYear: String(data.startYear),
        endYear: data.endYear ? String(data.endYear) : "",
        era: data.era || "",
        chronology: data.chronology || "",
        type: data.type,
        notes: data.notes || ""
      });
    });
  }, [id]);

  const saveSeries = React.useCallback(
    async (nextForm: typeof form) => {
      if (!id) return;
      setSaveError(null);
      try {
        await apiFetch(`/api/series/${id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: nextForm.name,
            publisherId: nextForm.publisherId,
            startYear: Number(nextForm.startYear),
            endYear: nextForm.endYear ? Number(nextForm.endYear) : null,
            era: nextForm.era || null,
            chronology: nextForm.chronology || null,
            type: nextForm.type,
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
        saveSeries(nextForm);
        saveTimerRef.current = null;
      }, 500);
    },
    [saveSeries]
  );

  React.useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const handleDelete = async () => {
    const deps = await apiFetch<any>(`/api/series/${id}/dependencies`);
    let message = `Delete "${series.name}"? This will remove ${deps.issueCount} issues and ${deps.storyBlockCount} story blocks.`;
    if (deps.multiSeriesStoryBlocks?.length) {
      message += `\nWarning: ${deps.multiSeriesStoryBlocks.length} story blocks include multiple series.`;
    }
    message += "\nThis cannot be undone.";
    if (!window.confirm(message)) return;
    await apiFetch(`/api/series/${id}`, { method: "DELETE" });
    navigate("/library/series");
  };

  if (!series) {
    return <div className="text-ink-700">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        title={series.name}
        subtitle="Edit volume details and view connected issues."
        action={
          <Link className="btn-secondary" to="/library/series">
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
          label="Type"
          value={form.type}
          onChange={(value) => {
            const nextForm = { ...form, type: value };
            setForm(nextForm);
            scheduleSave(nextForm);
          }}
          options={seriesTypes}
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
        <FormField
          label="Era"
          value={form.era}
          onChange={(value) => {
            const nextForm = { ...form, era: value };
            setForm(nextForm);
            scheduleSave(nextForm);
          }}
          suggestions={eraSuggestions}
          listId="series-detail-era-options"
        />
        <FormField
          label="Chronology"
          value={form.chronology}
          onChange={(value) => {
            const nextForm = { ...form, chronology: value };
            setForm(nextForm);
            scheduleSave(nextForm);
          }}
          suggestions={chronologySuggestions}
          listId="series-detail-chronology-options"
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
      <div className="flex flex-wrap gap-3">
        <button className="btn-secondary" onClick={handleDelete}>
          Delete Series
        </button>
      </div>
      {saveError ? <p className="text-sm text-ember-600">{saveError}</p> : null}

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">Issues</h3>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {series.issues.map((issue: any) => (
            <li key={issue.id} className="rounded-2xl border border-mist-200 bg-white px-4 py-3">
              <Link to={`/issues/${issue.id}`} className="font-semibold text-ink-900">
                #{issue.issueNumber}
              </Link>
              <p className="text-xs text-ink-600">{issue.status}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">Story Blocks</h3>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {series.storyBlockSeries.map((link: any) => (
            <li key={link.storyBlock.id} className="rounded-2xl border border-mist-200 bg-white px-4 py-3">
              <Link to={`/story-blocks/${link.storyBlock.id}`} className="font-semibold text-ink-900">
                {link.storyBlock.name}
              </Link>
              <p className="text-xs text-ink-600">{link.storyBlock.status}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default SeriesDetailPage;
