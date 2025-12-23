import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import SectionHeader from "../components/SectionHeader";
import FormField from "../components/FormField";
import AsyncSearchableMultiSelect from "../components/AsyncSearchableMultiSelect";
import { apiFetch } from "../lib/api";
import { fatigueLevels } from "../lib/enums";

const SessionDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = React.useState<any | null>(null);
  const [form, setForm] = React.useState({
    sessionDate: "",
    durationMinutes: "",
    fatigueLevel: "UNKNOWN",
    notes: ""
  });
  const [issueIds, setIssueIds] = React.useState<string[]>([]);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const saveTimerRef = React.useRef<number | null>(null);

  const load = React.useCallback(() => {
    apiFetch<any>(`/api/sessions/${id}`).then((data) => {
      setSession(data);
      setForm({
        sessionDate: data.sessionDate ? new Date(data.sessionDate).toISOString().slice(0, 16) : "",
        durationMinutes: String(data.durationMinutes ?? ""),
        fatigueLevel: data.fatigueLevel ?? "UNKNOWN",
        notes: data.notes || ""
      });
      setIssueIds(data.readingSessionIssues?.map((link: any) => link.issueId) ?? []);
    });
  }, [id]);

  React.useEffect(() => {
    load();
  }, [load]);

  const seedIssueOptions = React.useMemo(() => {
    if (!session?.issues) return [];
    return session.issues.map((issue: any) => ({
      label: `${issue.series?.name || "Series"} #${issue.issueNumber}`,
      value: issue.id
    }));
  }, [session]);

  const fetchIssueOptions = React.useCallback(async (query: string) => {
    const data = await apiFetch<{ items: any[] }>(
      `/api/issues?q=${encodeURIComponent(query)}&pageSize=20&sort=series&order=asc`
    );
    return data.items.map((issue) => ({
      label: `${issue.series?.name || "Series"} #${issue.issueNumber}`,
      value: issue.id
    }));
  }, []);

  const saveSession = React.useCallback(
    async (nextForm: typeof form, nextIssueIds: string[]) => {
      if (!id) return;
      setSaveError(null);
      try {
        await apiFetch(`/api/sessions/${id}`, {
          method: "PUT",
          body: JSON.stringify({
            sessionDate: nextForm.sessionDate,
            durationMinutes: Number(nextForm.durationMinutes),
            fatigueLevel: nextForm.fatigueLevel,
            notes: nextForm.notes || null,
            issueIds: nextIssueIds
          })
        });
        load();
      } catch (err) {
        setSaveError((err as Error).message);
      }
    },
    [id, load]
  );

  const scheduleSave = React.useCallback(
    (nextForm: typeof form, nextIssueIds: string[]) => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        saveSession(nextForm, nextIssueIds);
        saveTimerRef.current = null;
      }, 500);
    },
    [saveSession]
  );

  React.useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const updateForm = (patch: Partial<typeof form>) => {
    const nextForm = { ...form, ...patch };
    setForm(nextForm);
    scheduleSave(nextForm, issueIds);
  };

  const handleIssuesChange = (values: string[]) => {
    setIssueIds(values);
    scheduleSave(form, values);
  };

  const handleDelete = async () => {
    if (!session) return;
    if (!window.confirm("Delete this session? This cannot be undone.")) return;
    await apiFetch(`/api/sessions/${session.id}`, { method: "DELETE" });
    navigate("/sessions");
  };

  if (!session) {
    return <div className="text-ink-700">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Session Detail"
        subtitle={new Date(session.sessionDate).toLocaleString()}
        action={
          <Link className="btn-secondary" to="/sessions">
            Back to list
          </Link>
        }
      />

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">Session Details</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <FormField
            label="Session Date"
            type="datetime-local"
            value={form.sessionDate}
            onChange={(value) => updateForm({ sessionDate: value })}
          />
          <FormField
            label="Duration (minutes)"
            value={form.durationMinutes}
            onChange={(value) => updateForm({ durationMinutes: value })}
          />
          <FormField
            label="Fatigue"
            value={form.fatigueLevel}
            onChange={(value) => updateForm({ fatigueLevel: value })}
            options={fatigueLevels}
          />
        </div>
        <div className="mt-4">
          <FormField label="Notes" value={form.notes} onChange={(value) => updateForm({ notes: value })} textarea />
        </div>
        <div className="mt-4">
          <AsyncSearchableMultiSelect
            label="Issues Read"
            selectedValues={issueIds}
            onChange={handleIssuesChange}
            placeholder="Search issues..."
            fetchOptions={fetchIssueOptions}
            seedOptions={seedIssueOptions}
          />
        </div>
        {saveError ? <p className="mt-3 text-sm text-ember-600">{saveError}</p> : null}
        <button className="btn-secondary mt-4" onClick={handleDelete}>
          Delete Session
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-600">Duration</p>
          <p className="mt-2 text-lg font-semibold text-ink-900">{session.durationMinutes} min</p>
        </div>
        <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-600">Fatigue</p>
          <p className="mt-2 text-lg font-semibold text-ink-900">{session.fatigueLevel}</p>
        </div>
        <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-600">Dominant</p>
          <p className="mt-2 text-lg font-semibold text-ink-900">
            {session.dominantCharacter?.name || "Not enough data"}
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">Switch Suggestion</h3>
        <p className="mt-2 text-sm text-ink-700">{session.suggestion?.reason || "No suggestion yet."}</p>
        {session.suggestion?.candidate ? (
          <div className="mt-4 rounded-2xl border border-mist-200 bg-mist-100/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-ink-600">Candidate</p>
            <p className="mt-2 text-sm text-ink-900">{session.suggestion.candidate.storyBlock?.name}</p>
            <p className="text-xs text-ink-600">{session.suggestion.candidate.character?.name}</p>
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
          <h3 className="text-lg font-semibold text-ink-900">Issues Read</h3>
          <ul className="mt-4 space-y-2">
            {session.issues.map((issue: any) => (
              <li key={issue.id} className="text-sm text-ink-900">
              <Link to={`/issues/${issue.id}`}>#{issue.issueNumber}</Link> - {issue.series?.name}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
          <h3 className="text-lg font-semibold text-ink-900">Story Blocks Touched</h3>
          <ul className="mt-4 space-y-2">
            {session.storyBlocks.map((block: any) => (
              <li key={block.id} className="text-sm text-ink-900">
                <Link to={`/story-blocks/${block.id}`}>{block.name}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SessionDetailPage;
