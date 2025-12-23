import React from "react";
import { Link, useParams } from "react-router-dom";
import SectionHeader from "../components/SectionHeader";
import FormField from "../components/FormField";
import { apiFetch } from "../lib/api";
import { issueStatus } from "../lib/enums";

const IssueDetailPage = () => {
  const { id } = useParams();
  const [issue, setIssue] = React.useState<any | null>(null);
  const [series, setSeries] = React.useState<any[]>([]);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const saveTimerRef = React.useRef<number | null>(null);
  const [form, setForm] = React.useState({
    seriesId: "",
    issueNumber: "",
    title: "",
    releaseDate: "",
    readingOrderIndex: "",
    status: "UNREAD",
    readDate: "",
    notes: ""
  });

  React.useEffect(() => {
    apiFetch<{ items: any[] }>("/api/series").then((data) => setSeries(data.items));
    apiFetch<any>(`/api/issues/${id}`).then((data) => {
      setIssue(data);
      setForm({
        seriesId: data.seriesId,
        issueNumber: data.issueNumber,
        title: data.title || "",
        releaseDate: data.releaseDate ? data.releaseDate.slice(0, 10) : "",
        readingOrderIndex: data.readingOrderIndex ? String(data.readingOrderIndex) : "",
        status: data.status,
        readDate: data.readDate ? data.readDate.slice(0, 10) : "",
        notes: data.notes || ""
      });
    });
  }, [id]);

  const saveIssue = React.useCallback(
    async (nextForm: typeof form) => {
      if (!issue || !id) return;
      setSaveError(null);
    const characterIds = issue.issueCharacters
      .filter((link: any) => link.characterOrTeam.type === "CHARACTER")
      .map((link: any) => link.characterOrTeamId);
    const teamIds = issue.issueCharacters
      .filter((link: any) => link.characterOrTeam.type === "TEAM")
      .map((link: any) => link.characterOrTeamId);

      try {
        await apiFetch(`/api/issues/${id}`, {
          method: "PUT",
          body: JSON.stringify({
            seriesId: nextForm.seriesId,
            issueNumber: nextForm.issueNumber,
            title: nextForm.title || null,
            releaseDate: nextForm.releaseDate || null,
            readingOrderIndex: nextForm.readingOrderIndex ? Number(nextForm.readingOrderIndex) : null,
            status: nextForm.status,
            readDate: nextForm.readDate || null,
            notes: nextForm.notes || null,
            storyBlockIds: issue.storyBlockIssues?.map((link: any) => link.storyBlockId),
            characterIds,
            teamIds,
            eventIds: issue.issueEvents?.map((link: any) => link.eventId)
          })
        });
      } catch (err) {
        setSaveError((err as Error).message);
      }
    },
    [id, issue]
  );

  const scheduleSave = React.useCallback(
    (nextForm: typeof form) => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        saveIssue(nextForm);
        saveTimerRef.current = null;
      }, 500);
    },
    [saveIssue]
  );

  React.useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  if (!issue) {
    return <div className="text-ink-700">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        title={`Issue #${issue.issueNumber}`}
        subtitle={issue.series?.name}
        action={
          <Link className="btn-secondary" to="/issues">
            Back to list
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <FormField
          label="Series"
          value={form.seriesId}
          onChange={(value) => {
            const nextForm = { ...form, seriesId: value };
            setForm(nextForm);
            scheduleSave(nextForm);
          }}
          options={series.map((entry) => ({ label: entry.name, value: entry.id }))}
        />
        <FormField
          label="Issue Number"
          value={form.issueNumber}
          onChange={(value) => {
            const nextForm = { ...form, issueNumber: value };
            setForm(nextForm);
            scheduleSave(nextForm);
          }}
        />
        <FormField
          label="Title"
          value={form.title}
          onChange={(value) => {
            const nextForm = { ...form, title: value };
            setForm(nextForm);
            scheduleSave(nextForm);
          }}
        />
        <FormField
          label="Release Date"
          type="date"
          value={form.releaseDate}
          onChange={(value) => {
            const nextForm = { ...form, releaseDate: value };
            setForm(nextForm);
            scheduleSave(nextForm);
          }}
        />
        <FormField
          label="Reading Order Index"
          value={form.readingOrderIndex}
          onChange={(value) => {
            const nextForm = { ...form, readingOrderIndex: value };
            setForm(nextForm);
            scheduleSave(nextForm);
          }}
        />
        <FormField
          label="Status"
          value={form.status}
          onChange={(value) => {
            const nextForm = { ...form, status: value };
            setForm(nextForm);
            scheduleSave(nextForm);
          }}
          options={issueStatus}
        />
        <FormField
          label="Read Date"
          type="date"
          value={form.readDate}
          onChange={(value) => {
            const nextForm = { ...form, readDate: value };
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
          <h3 className="text-lg font-semibold text-ink-900">Story Blocks</h3>
          <ul className="mt-4 space-y-2">
            {issue.storyBlockIssues.map((link: any) => (
              <li key={link.storyBlock.id}>
                <Link to={`/story-blocks/${link.storyBlock.id}`} className="text-sm text-ink-900">
                  {link.storyBlock.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
          <h3 className="text-lg font-semibold text-ink-900">Characters / Teams</h3>
          <ul className="mt-4 space-y-2">
            {issue.issueCharacters.map((link: any) => (
              <li key={link.characterOrTeam.id}>
                <Link to={`/characters/${link.characterOrTeam.id}`} className="text-sm text-ink-900">
                  {link.characterOrTeam.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
          <h3 className="text-lg font-semibold text-ink-900">Events</h3>
          <ul className="mt-4 space-y-2">
            {issue.issueEvents.map((link: any) => (
              <li key={link.event.id}>
                <Link to={`/library/events/${link.event.id}`} className="text-sm text-ink-900">
                  {link.event.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default IssueDetailPage;
