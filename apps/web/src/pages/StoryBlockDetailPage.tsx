import React from "react";
import { Link, useParams } from "react-router-dom";
import SectionHeader from "../components/SectionHeader";
import FormField from "../components/FormField";
import SearchableMultiSelect from "../components/SearchableMultiSelect";
import { apiFetch } from "../lib/api";
import { fatigueLevels, storyBlockImportance, storyBlockTypes, syncLevels } from "../lib/enums";

const StoryBlockDetailPage = () => {
  const { id } = useParams();
  const [storyBlock, setStoryBlock] = React.useState<any | null>(null);
  const [suggestion, setSuggestion] = React.useState<any | null>(null);
  const [publishers, setPublishers] = React.useState<any[]>([]);
  const [series, setSeries] = React.useState<any[]>([]);
  const [events, setEvents] = React.useState<any[]>([]);
  const [storyBlockOptions, setStoryBlockOptions] = React.useState<any[]>([]);
  const [issueOptions, setIssueOptions] = React.useState<any[]>([]);
  const [editForm, setEditForm] = React.useState({
    name: "",
    type: "",
    era: "",
    chronology: "",
    importance: "",
    syncLevel: "",
    publisherId: "",
    previousStoryBlockId: "",
    eventId: "",
    orderIndex: "",
    notes: ""
  });
  const [seriesIds, setSeriesIds] = React.useState<string[]>([]);
  const [issueIds, setIssueIds] = React.useState<string[]>([]);
  const [editError, setEditError] = React.useState<string | null>(null);
  const saveTimerRef = React.useRef<number | null>(null);
  const [derived, setDerived] = React.useState<any | null>(null);
  const [deriveError, setDeriveError] = React.useState<string | null>(null);
  const [rangeSeriesId, setRangeSeriesId] = React.useState("");
  const [rangeStart, setRangeStart] = React.useState("");
  const [rangeEnd, setRangeEnd] = React.useState("");
  const [rangeStatus, setRangeStatus] = React.useState<string | null>(null);
  const [sessionForm, setSessionForm] = React.useState({
    sessionDate: new Date().toISOString().slice(0, 16),
    durationMinutes: "60",
    fatigueLevel: "UNKNOWN"
  });
  const [selectedIssues, setSelectedIssues] = React.useState<string[]>([]);

  const collectSuggestions = React.useCallback((entries: any[], field: string) => {
    const values = entries
      .map((entry) => (typeof entry?.[field] === "string" ? entry[field].trim() : ""))
      .filter(Boolean);
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, []);

  const eraSuggestions = React.useMemo(
    () => collectSuggestions([...series, ...storyBlockOptions], "era"),
    [collectSuggestions, series, storyBlockOptions]
  );
  const chronologySuggestions = React.useMemo(
    () => collectSuggestions([...series, ...storyBlockOptions], "chronology"),
    [collectSuggestions, series, storyBlockOptions]
  );

  const load = React.useCallback(() => {
    apiFetch<any>(`/api/story-blocks/${id}`).then(setStoryBlock);
    apiFetch<any>(`/api/dashboard/suggestions?storyBlockId=${id}`).then(setSuggestion);
  }, [id]);

  const saveStoryBlock = React.useCallback(
    async (nextForm: typeof editForm, nextSeriesIds: string[], nextIssueIds: string[]) => {
      if (!id) return;
      setEditError(null);
      try {
        await apiFetch(`/api/story-blocks/${id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: nextForm.name,
            type: nextForm.type,
            era: nextForm.era || null,
            chronology: nextForm.chronology || null,
            importance: nextForm.importance,
            syncLevel: nextForm.syncLevel,
            publisherId: nextForm.publisherId || null,
            previousStoryBlockId: nextForm.previousStoryBlockId || null,
            eventId: nextForm.eventId || null,
            orderIndex: Number(nextForm.orderIndex),
            notes: nextForm.notes || null,
            seriesIds: nextSeriesIds,
            issueIds: nextIssueIds
          })
        });
      } catch (err) {
        setEditError((err as Error).message);
      }
    },
    [id]
  );

  const scheduleSave = React.useCallback(
    (nextForm: typeof editForm, nextSeriesIds: string[], nextIssueIds: string[]) => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        saveStoryBlock(nextForm, nextSeriesIds, nextIssueIds);
        saveTimerRef.current = null;
      }, 500);
    },
    [saveStoryBlock]
  );

  React.useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const updateEditForm = (patch: Partial<typeof editForm>) => {
    const nextForm = { ...editForm, ...patch };
    setEditForm(nextForm);
    scheduleSave(nextForm, seriesIds, issueIds);
  };

  const handlePublisherChange = (value: string) => {
    const nextForm = { ...editForm, publisherId: value, eventId: "", previousStoryBlockId: "" };
    setEditForm(nextForm);
    setSeriesIds([]);
    setIssueIds([]);
    setIssueOptions([]);
    setRangeSeriesId("");
    setRangeStart("");
    setRangeEnd("");
    setRangeStatus(null);
    scheduleSave(nextForm, [], []);
  };

  const handleSeriesChange = (values: string[]) => {
    const nextIssueIds = issueIds.filter((issueId) => {
      const issue = issueOptions.find((entry) => entry.id === issueId);
      return issue && values.includes(issue.seriesId);
    });
    setSeriesIds(values);
    setIssueIds(nextIssueIds);
    scheduleSave(editForm, values, nextIssueIds);
  };

  const handleIssueChange = (values: string[]) => {
    setIssueIds(values);
    scheduleSave(editForm, seriesIds, values);
  };

  const handleAddRange = async () => {
    setRangeStatus(null);
    if (!rangeSeriesId || !rangeStart.trim() || !rangeEnd.trim()) {
      setRangeStatus("Select a series and enter start/end issue numbers.");
      return;
    }

    try {
      const result = await apiFetch<{ items: any[] }>(
        `/api/issues/range?seriesId=${rangeSeriesId}&start=${encodeURIComponent(
          rangeStart.trim()
        )}&end=${encodeURIComponent(rangeEnd.trim())}`
      );
      const incoming = result.items || [];
      if (!incoming.length) {
        setRangeStatus("No issues found in that range.");
        return;
      }
      const nextSeriesIds = seriesIds.includes(rangeSeriesId)
        ? seriesIds
        : [...seriesIds, rangeSeriesId];
      setIssueOptions((prev) =>
        Array.from(new Map([...prev, ...incoming].map((issue) => [issue.id, issue])).values())
      );
      const nextIssueIds = Array.from(
        new Set([...issueIds, ...incoming.map((issue) => issue.id)])
      );
      setSeriesIds(nextSeriesIds);
      setIssueIds(nextIssueIds);
      scheduleSave(editForm, nextSeriesIds, nextIssueIds);
      setRangeStatus(`Added ${incoming.length} issues.`);
    } catch (err) {
      setRangeStatus((err as Error).message);
    }
  };

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    apiFetch<{ items: any[] }>("/api/publishers?pageSize=100").then((data) => setPublishers(data.items));
    apiFetch<{ items: any[] }>("/api/series?pageSize=100").then((data) => setSeries(data.items));
    apiFetch<{ items: any[] }>("/api/events?pageSize=100").then((data) => setEvents(data.items));
    apiFetch<{ items: any[] }>("/api/story-blocks?pageSize=100").then((data) => setStoryBlockOptions(data.items));
  }, []);

  React.useEffect(() => {
    if (!storyBlock) return;
    setEditForm({
      name: storyBlock.name ?? "",
      type: storyBlock.type ?? "",
      era: storyBlock.era ?? "",
      chronology: storyBlock.chronology ?? "",
      importance: storyBlock.importance ?? "",
      syncLevel: storyBlock.syncLevel ?? "",
      publisherId: storyBlock.publisherId ?? "",
      previousStoryBlockId: storyBlock.previousStoryBlockId ?? "",
      eventId: storyBlock.eventId ?? "",
      orderIndex: storyBlock.orderIndex != null ? String(storyBlock.orderIndex) : "",
      notes: storyBlock.notes ?? ""
    });
    setSeriesIds(storyBlock.storyBlockSeries?.map((link: any) => link.seriesId) ?? []);
    setIssueIds(storyBlock.storyBlockIssues?.map((link: any) => link.issueId) ?? []);
    const seededIssues = storyBlock.storyBlockIssues?.map((link: any) => link.issue) ?? [];
    setIssueOptions((prev) =>
      Array.from(new Map([...prev, ...seededIssues].map((issue: any) => [issue.id, issue])).values())
    );
    setEditError(null);
  }, [storyBlock]);

  React.useEffect(() => {
    if (!seriesIds.length) {
      setIssueIds([]);
      setIssueOptions([]);
      return;
    }
    const fetchIssues = async () => {
      const responses = await Promise.all(
        seriesIds.map((seriesId) => apiFetch<{ items: any[] }>(`/api/issues?seriesId=${seriesId}&pageSize=100`))
      );
      const combined = responses.flatMap((response) => response.items);
      const unique = Array.from(new Map(combined.map((issue) => [issue.id, issue])).values());
      setIssueOptions(unique);
      const allowedIds = new Set(unique.map((issue) => issue.id));
      setIssueIds((prev) => prev.filter((issueId) => allowedIds.has(issueId)));
    };
    fetchIssues().catch(() => setIssueOptions([]));
  }, [seriesIds]);

  React.useEffect(() => {
    if (!issueIds.length) {
      setDerived(null);
      setDeriveError(null);
      return;
    }
    setDeriveError(null);
    apiFetch<any>("/api/story-blocks/derive", {
      method: "POST",
      body: JSON.stringify({ issueIds })
    })
      .then((data) => setDerived(data))
      .catch((err) => setDeriveError(err.message));
  }, [issueIds]);

  const markIssueFinished = async (issue: any) => {
    const characterIds = issue.issueCharacters
      ?.filter((link: any) => link.characterOrTeam?.type === "CHARACTER")
      .map((link: any) => link.characterOrTeamId);
    const teamIds = issue.issueCharacters
      ?.filter((link: any) => link.characterOrTeam?.type === "TEAM")
      .map((link: any) => link.characterOrTeamId);

    await apiFetch(`/api/issues/${issue.id}`, {
      method: "PUT",
      body: JSON.stringify({
        seriesId: issue.seriesId,
        issueNumber: issue.issueNumber,
        title: issue.title,
        releaseDate: issue.releaseDate,
        readingOrderIndex: issue.readingOrderIndex,
        status: "FINISHED",
        readDate: new Date().toISOString(),
        notes: issue.notes,
        storyBlockIds: issue.storyBlockIssues?.map((link: any) => link.storyBlockId),
        characterIds,
        teamIds,
        eventIds: issue.issueEvents?.map((link: any) => link.eventId)
      })
    });
    load();
  };

  const markBlockFinished = async () => {
    await apiFetch(`/api/story-blocks/${id}/finish`, { method: "POST" });
    load();
  };

  const toggleIssueSelection = (issueId: string) => {
    setSelectedIssues((prev) =>
      prev.includes(issueId) ? prev.filter((id) => id !== issueId) : [...prev, issueId]
    );
  };

  const handleLogSession = async () => {
    await apiFetch("/api/sessions", {
      method: "POST",
      body: JSON.stringify({
        sessionDate: sessionForm.sessionDate,
        durationMinutes: Number(sessionForm.durationMinutes),
        fatigueLevel: sessionForm.fatigueLevel,
        issueIds: selectedIssues
      })
    });
    setSelectedIssues([]);
    load();
  };

  if (!storyBlock) {
    return <div className="text-ink-700">Loading...</div>;
  }

  const characters = (storyBlock.storyBlockCharacters || []).filter(
    (link: any) => link.characterOrTeam.type === "CHARACTER"
  );
  const teams = (storyBlock.storyBlockCharacters || []).filter(
    (link: any) => link.characterOrTeam.type === "TEAM"
  );

  const publisherLabel = storyBlock.publisher?.name ? `Publisher: ${storyBlock.publisher.name}` : "Publisher: —";
  const filteredSeries = editForm.publisherId
    ? series.filter((entry) => entry.publisherId === editForm.publisherId)
    : [];
  const filteredEvents = editForm.publisherId
    ? events.filter((entry) => entry.publisherId === editForm.publisherId)
    : [];
  const filteredPreviousBlocks = editForm.publisherId
    ? storyBlockOptions.filter((entry) => entry.publisherId === editForm.publisherId)
    : storyBlockOptions;
  const derivedSnapshot = derived ?? {
    startYear: storyBlock.startYear,
    endYear: storyBlock.endYear,
    status: storyBlock.status,
    characters,
    teams
  };
  const derivedCastCount = derived
    ? (derived.characters?.length || 0) + (derived.teams?.length || 0)
    : characters.length + teams.length;

  return (
    <div className="space-y-8">
      <SectionHeader
        title={storyBlock.name}
        subtitle={`${publisherLabel} · Status: ${storyBlock.status} - ${storyBlock.metrics?.completionPercent ?? 0}% complete`}
        action={
          <div className="flex flex-wrap gap-2">
            {storyBlock.nextStoryBlock ? (
              <Link className="btn-primary" to={`/story-blocks/${storyBlock.nextStoryBlock.id}`}>
                Next Story Block
              </Link>
            ) : null}
            <Link className="btn-secondary" to="/story-blocks">
              Back to list
            </Link>
          </div>
        }
      />

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">Story Block Details</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <FormField label="Name" value={editForm.name} onChange={(value) => updateEditForm({ name: value })} />
          <FormField
            label="Type"
            value={editForm.type}
            onChange={(value) => updateEditForm({ type: value })}
            options={storyBlockTypes}
          />
          <FormField
            label="Era"
            value={editForm.era}
            onChange={(value) => updateEditForm({ era: value })}
            suggestions={eraSuggestions}
            listId="story-block-detail-era-options"
          />
          <FormField
            label="Chronology"
            value={editForm.chronology}
            onChange={(value) => updateEditForm({ chronology: value })}
            suggestions={chronologySuggestions}
            listId="story-block-detail-chronology-options"
          />
          <FormField
            label="Importance"
            value={editForm.importance}
            onChange={(value) => updateEditForm({ importance: value })}
            options={storyBlockImportance}
          />
          <FormField
            label="Sync Level"
            value={editForm.syncLevel}
            onChange={(value) => updateEditForm({ syncLevel: value })}
            options={syncLevels}
          />
          <FormField
            label="Publisher"
            value={editForm.publisherId}
            onChange={handlePublisherChange}
            options={publishers.map((publisher) => ({ label: publisher.name, value: publisher.id }))}
          />
          <FormField
            label="Previous Story Block"
            value={editForm.previousStoryBlockId}
            onChange={(value) => updateEditForm({ previousStoryBlockId: value })}
            options={filteredPreviousBlocks
              .filter((entry) => entry.id !== storyBlock.id)
              .map((entry) => ({ label: entry.name, value: entry.id }))}
          />
          <FormField
            label="Event"
            value={editForm.eventId}
            onChange={(value) => updateEditForm({ eventId: value })}
            options={filteredEvents.map((event) => ({ label: event.name, value: event.id }))}
          />
          <FormField
            label="Order Index"
            value={editForm.orderIndex}
            onChange={(value) => updateEditForm({ orderIndex: value })}
            type="number"
            step="0.01"
          />
        </div>
        <p className="mt-3 text-xs text-ink-600">
          Start/end year, status, characters, and teams are derived from the issues attached below.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <SearchableMultiSelect
            label="Series"
            options={filteredSeries.map((entry) => ({ label: entry.name, value: entry.id }))}
            selectedValues={seriesIds}
            onChange={handleSeriesChange}
            helper={editForm.publisherId ? undefined : "Select a publisher to load series."}
            placeholder={editForm.publisherId ? "Search series..." : "Select a publisher first"}
          />
          <SearchableMultiSelect
            label="Issues"
            options={issueOptions.map((entry) => ({
              label: `${entry.series?.name || "Series"} #${entry.issueNumber}`,
              value: entry.id
            }))}
            selectedValues={issueIds}
            onChange={handleIssueChange}
            helper={seriesIds.length ? undefined : "Select series to load issues."}
            placeholder={seriesIds.length ? "Search issues..." : "Select series first"}
          />
        </div>
        <div className="mt-4 rounded-2xl border border-mist-200 bg-mist-50/60 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-600">Add Issue Range</p>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <FormField
              label="Series"
              value={rangeSeriesId}
              onChange={setRangeSeriesId}
              options={filteredSeries.map((entry) => ({ label: entry.name, value: entry.id }))}
            />
            <FormField label="Start Issue" value={rangeStart} onChange={setRangeStart} />
            <FormField label="End Issue" value={rangeEnd} onChange={setRangeEnd} />
            <div className="flex items-end">
              <button className="btn-secondary w-full" onClick={handleAddRange}>
                Add Range
              </button>
            </div>
          </div>
          {rangeStatus ? <p className="mt-2 text-xs text-ink-600">{rangeStatus}</p> : null}
        </div>
        <div className="mt-4 rounded-2xl border border-mist-200 bg-white px-4 py-3 text-sm text-ink-700">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-600">Derived Snapshot</p>
          {deriveError ? <p className="mt-2 text-xs text-ember-600">{deriveError}</p> : null}
          <div className="mt-2 grid gap-2 md:grid-cols-4">
            <div>
              <p className="text-xs text-ink-500">Start Year</p>
              <p className="text-sm font-semibold text-ink-900">{derivedSnapshot.startYear ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">End Year</p>
              <p className="text-sm font-semibold text-ink-900">{derivedSnapshot.endYear ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Status</p>
              <p className="text-sm font-semibold text-ink-900">{derivedSnapshot.status}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Cast</p>
              <p className="text-sm font-semibold text-ink-900">{derivedCastCount}</p>
            </div>
          </div>
          {storyBlock.previousStoryBlock ? (
            <p className="mt-2 text-xs text-ink-600">
              Previous: <span className="font-semibold text-ink-900">{storyBlock.previousStoryBlock.name}</span>
            </p>
          ) : null}
          {storyBlock.nextStoryBlock ? (
            <p className="mt-1 text-xs text-ink-600">
              Next: <span className="font-semibold text-ink-900">{storyBlock.nextStoryBlock.name}</span>
            </p>
          ) : null}
        </div>
        <div className="mt-4">
          <FormField label="Notes" value={editForm.notes} onChange={(value) => updateEditForm({ notes: value })} textarea />
        </div>
        {editError ? <p className="mt-3 text-sm text-ember-600">{editError}</p> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
          <h3 className="text-lg font-semibold text-ink-900">Progress</h3>
          <p className="mt-2 text-sm text-ink-700">
            Next issue: {storyBlock.metrics?.nextIssue?.issueNumber || "All caught up"}
          </p>
          <div className="mt-4 h-2 w-full rounded-full bg-mist-200">
            <div
              className="h-2 rounded-full bg-moss-500"
              style={{ width: `${storyBlock.metrics?.completionPercent ?? 0}%` }}
            />
          </div>
          <button className="btn-primary mt-4" onClick={markBlockFinished}>
            Mark Block as Finished
          </button>
        </div>

        <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
          <h3 className="text-lg font-semibold text-ink-900">Switch Suggestion</h3>
          <p className="mt-2 text-sm text-ink-700">{suggestion?.reason || "No suggestion yet."}</p>
          {suggestion?.candidate ? (
            <div className="mt-4 rounded-2xl border border-mist-200 bg-mist-100/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-ink-600">Candidate</p>
              <p className="mt-2 text-sm text-ink-900">{suggestion.candidate.storyBlock?.name}</p>
              <p className="text-xs text-ink-600">{suggestion.candidate.character?.name}</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">Issues</h3>
        <div className="mt-4 space-y-3">
          {storyBlock.storyBlockIssues.map((link: any) => (
            <div key={link.issue.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-mist-200 bg-white px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-ink-900">
                  #{link.issue.issueNumber} {link.issue.title || ""}
                </p>
                <p className="text-xs text-ink-600">{link.issue.status}</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-ink-600">
                  <input
                    type="checkbox"
                    checked={selectedIssues.includes(link.issue.id)}
                    onChange={() => toggleIssueSelection(link.issue.id)}
                  />
                  Add to session
                </label>
                <button className="btn-secondary" onClick={() => markIssueFinished(link.issue)}>
                  Mark finished
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
          <h3 className="text-lg font-semibold text-ink-900">Characters</h3>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {characters.map((link: any) => (
              <li key={link.characterOrTeam.id} className="rounded-2xl border border-mist-200 bg-white px-4 py-3">
                <Link to={`/characters/${link.characterOrTeam.id}`} className="font-semibold text-ink-900">
                  {link.characterOrTeam.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
          <h3 className="text-lg font-semibold text-ink-900">Teams</h3>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {teams.map((link: any) => (
              <li key={link.characterOrTeam.id} className="rounded-2xl border border-mist-200 bg-white px-4 py-3">
                <Link to={`/characters/${link.characterOrTeam.id}`} className="font-semibold text-ink-900">
                  {link.characterOrTeam.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">Log Reading Session</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <FormField
            label="Session Date"
            type="datetime-local"
            value={sessionForm.sessionDate}
            onChange={(value) => setSessionForm({ ...sessionForm, sessionDate: value })}
          />
          <FormField
            label="Duration (minutes)"
            value={sessionForm.durationMinutes}
            onChange={(value) => setSessionForm({ ...sessionForm, durationMinutes: value })}
          />
          <FormField
            label="Fatigue"
            value={sessionForm.fatigueLevel}
            onChange={(value) => setSessionForm({ ...sessionForm, fatigueLevel: value })}
            options={fatigueLevels}
          />
        </div>
        <button className="btn-primary mt-4" onClick={handleLogSession}>
          Save Session
        </button>
      </div>
    </div>
  );
};

export default StoryBlockDetailPage;
