import React from "react";
import SectionHeader from "../components/SectionHeader";
import FormField from "../components/FormField";
import { apiFetch } from "../lib/api";

const resourceOptions = [
  { label: "Publisher", value: "publisher" },
  { label: "Series (Volume)", value: "volume" },
  { label: "Issue", value: "issue" },
  { label: "Character", value: "character" },
  { label: "Team", value: "team" }
];

const duplicateEntities = [
  { label: "Publishers", value: "publishers" },
  { label: "Series", value: "series" },
  { label: "Characters & Teams", value: "characters" },
  { label: "Events", value: "events" },
  { label: "Story Blocks", value: "story-blocks" },
  { label: "Issues", value: "issues" }
];

type Job = {
  id: string;
  status: string;
  type: string;
  createdAt: string;
  result?: any;
  error?: string | null;
};

const ToolsPage = () => {
  const [apiKey, setApiKey] = React.useState("");
  const [settingsStatus, setSettingsStatus] = React.useState<string | null>(null);
  const apiKeyReadyRef = React.useRef(false);
  const apiKeySaveTimerRef = React.useRef<number | null>(null);

  const [query, setQuery] = React.useState("");
  const [resource, setResource] = React.useState("volume");
  const [includeIssues, setIncludeIssues] = React.useState(false);
  const [results, setResults] = React.useState<any[]>([]);
  const [selectedUrls, setSelectedUrls] = React.useState<string[]>([]);
  const [searchStatus, setSearchStatus] = React.useState<string | null>(null);

  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [jobsStatus, setJobsStatus] = React.useState<string | null>(null);

  const [duplicateEntity, setDuplicateEntity] = React.useState("publishers");
  const [duplicateGroups, setDuplicateGroups] = React.useState<any[]>([]);
  const [mergeSelections, setMergeSelections] = React.useState<
    Record<string, { targetId: string; sourceIds: string[] }>
  >({});
  const [duplicatesStatus, setDuplicatesStatus] = React.useState<string | null>(null);

  const loadSettings = React.useCallback(() => {
    apiFetch<{ comicVineApiKey: string | null }>("/api/settings")
      .then((data) => {
        setApiKey(data.comicVineApiKey || "");
        apiKeyReadyRef.current = true;
      })
      .catch((err) => {
        apiKeyReadyRef.current = true;
        setSettingsStatus(err.message);
      });
  }, []);

  const loadJobs = React.useCallback(() => {
    apiFetch<{ items: Job[] }>("/api/jobs?take=20")
      .then((data) => setJobs(data.items))
      .catch((err) => setJobsStatus(err.message));
  }, []);

  React.useEffect(() => {
    loadSettings();
    loadJobs();
  }, [loadJobs, loadSettings]);

  const saveApiKey = React.useCallback(async (nextKey: string) => {
    setSettingsStatus(null);
    try {
      await apiFetch("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ comicVineApiKey: nextKey || null })
      });
      setSettingsStatus("API key saved.");
    } catch (err) {
      setSettingsStatus((err as Error).message);
    }
  }, []);

  const scheduleApiKeySave = React.useCallback(
    (nextKey: string) => {
      if (!apiKeyReadyRef.current) return;
      if (apiKeySaveTimerRef.current) {
        window.clearTimeout(apiKeySaveTimerRef.current);
      }
      apiKeySaveTimerRef.current = window.setTimeout(() => {
        saveApiKey(nextKey);
        apiKeySaveTimerRef.current = null;
      }, 600);
    },
    [saveApiKey]
  );

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    setSettingsStatus(null);
    scheduleApiKeySave(value);
  };

  React.useEffect(() => {
    return () => {
      if (apiKeySaveTimerRef.current) {
        window.clearTimeout(apiKeySaveTimerRef.current);
      }
    };
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearchStatus(null);
    try {
      const params = new URLSearchParams({ query, resource });
      const data = await apiFetch<{ results: any[] }>(`/api/comicvine/search?${params.toString()}`);
      setResults(data.results);
      setSelectedUrls([]);
    } catch (err) {
      setSearchStatus((err as Error).message);
    }
  };

  const handleQueueImport = async () => {
    if (!selectedUrls.length) return;
    setSearchStatus(null);
    try {
      await apiFetch("/api/comicvine/import", {
        method: "POST",
        body: JSON.stringify({
          resource,
          detailUrls: selectedUrls,
          includeIssues: resource === "volume" ? includeIssues : false
        })
      });
      setSearchStatus(`Queued ${selectedUrls.length} items for import.`);
      setSelectedUrls([]);
      loadJobs();
    } catch (err) {
      setSearchStatus((err as Error).message);
    }
  };

  const handleDuplicatesScan = async () => {
    setDuplicatesStatus(null);
    try {
      const data = await apiFetch<{ groups: any[] }>(`/api/duplicates?entity=${duplicateEntity}`);
      setDuplicateGroups(data.groups || []);
      const defaults: Record<string, { targetId: string; sourceIds: string[] }> = {};
      (data.groups || []).forEach((group) => {
        const targetId = group.items[0]?.id || "";
        const sourceIds = group.items.slice(1).map((item: any) => item.id);
        defaults[group.key] = { targetId, sourceIds };
      });
      setMergeSelections(defaults);
    } catch (err) {
      setDuplicatesStatus((err as Error).message);
    }
  };

  const handleTargetChange = (groupKey: string, newTargetId: string) => {
    setMergeSelections((prev) => {
      const current = prev[groupKey] || { targetId: "", sourceIds: [] };
      const previousTarget = current.targetId;
      let sourceIds = current.sourceIds.filter((id) => id !== newTargetId);
      if (previousTarget && previousTarget !== newTargetId && !sourceIds.includes(previousTarget)) {
        sourceIds = [...sourceIds, previousTarget];
      }
      return { ...prev, [groupKey]: { targetId: newTargetId, sourceIds } };
    });
  };

  const handleSourceToggle = (groupKey: string, sourceId: string) => {
    setMergeSelections((prev) => {
      const current = prev[groupKey] || { targetId: "", sourceIds: [] };
      if (current.targetId === sourceId) return prev;
      const sourceIds = current.sourceIds.includes(sourceId)
        ? current.sourceIds.filter((id) => id !== sourceId)
        : [...current.sourceIds, sourceId];
      return { ...prev, [groupKey]: { ...current, sourceIds } };
    });
  };

  const handleMerge = async (groupKey: string) => {
    const selection = mergeSelections[groupKey];
    if (!selection?.targetId || !selection.sourceIds.length) return;
    setDuplicatesStatus(null);
    try {
      await apiFetch("/api/merge", {
        method: "POST",
        body: JSON.stringify({
          entity: duplicateEntity,
          targetId: selection.targetId,
          sourceIds: selection.sourceIds
        })
      });
      setDuplicatesStatus("Merge completed.");
      handleDuplicatesScan();
    } catch (err) {
      setDuplicatesStatus((err as Error).message);
    }
  };

  return (
    <div className="space-y-10">
      <SectionHeader title="Tools & Integrations" subtitle="Bulk helpers, ComicVine imports, and cleanup utilities." />

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">ComicVine API Key</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <FormField label="API Key" value={apiKey} onChange={handleApiKeyChange} placeholder="Paste key" />
        </div>
        {settingsStatus ? <p className="mt-3 text-sm text-ember-600">{settingsStatus}</p> : null}
      </div>

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">ComicVine Search & Import</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <FormField label="Query" value={query} onChange={setQuery} placeholder="Search terms" />
          <FormField
            label="Resource"
            value={resource}
            onChange={setResource}
            options={resourceOptions}
          />
          <button className="btn-secondary mt-6 h-[44px]" onClick={handleSearch}>
            Search ComicVine
          </button>
        </div>
        {resource === "volume" ? (
          <label className="mt-4 flex items-center gap-3 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={includeIssues}
              onChange={(event) => setIncludeIssues(event.target.checked)}
            />
            <span>Also import issues for selected volumes (up to ~200 per volume)</span>
          </label>
        ) : null}
        {searchStatus ? <p className="mt-3 text-sm text-ember-600">{searchStatus}</p> : null}
        <div className="mt-4 space-y-2">
          {results.map((result) => (
            <label
              key={result.apiDetailUrl}
              className="flex items-start gap-3 rounded-2xl border border-mist-200 bg-white px-4 py-3"
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={selectedUrls.includes(result.apiDetailUrl)}
                onChange={() =>
                  setSelectedUrls((prev) =>
                    prev.includes(result.apiDetailUrl)
                      ? prev.filter((url) => url !== result.apiDetailUrl)
                      : [...prev, result.apiDetailUrl]
                  )
                }
              />
              <div>
                <p className="text-sm font-semibold text-ink-900">{result.name}</p>
                <p className="text-xs text-ink-600">
                  {result.resourceType}
                  {result.startYear ? ` · ${result.startYear}` : ""}
                  {result.issueNumber ? ` · #${result.issueNumber}` : ""}
                </p>
                {result.deck ? <p className="mt-1 text-xs text-ink-600">{result.deck}</p> : null}
              </div>
            </label>
          ))}
        </div>
        <button className="btn-primary mt-4" onClick={handleQueueImport}>
          Queue Import ({selectedUrls.length})
        </button>
      </div>

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-ink-900">Import Jobs</h3>
          <button className="btn-secondary" onClick={loadJobs}>
            Refresh
          </button>
        </div>
        {jobsStatus ? <p className="mt-3 text-sm text-ember-600">{jobsStatus}</p> : null}
        <div className="mt-4 space-y-2">
          {jobs.map((job) => (
            <div key={job.id} className="rounded-2xl border border-mist-200 bg-white px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink-900">{job.type}</p>
                <span className="text-xs font-semibold text-ink-700">{job.status}</span>
              </div>
              <p className="text-xs text-ink-600">{new Date(job.createdAt).toLocaleString()}</p>
              {job.error ? <p className="mt-1 text-xs text-ember-600">{job.error}</p> : null}
              {job.result?.imported ? (
                <div className="mt-2 text-xs text-ink-600">
                  <p>{job.result.imported} items imported</p>
                  {job.result.includeIssues ? (
                    <p>
                      Issues: {job.result.issuesImported} / {job.result.issuesAttempted}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {job.result?.results?.length ? (
                <div className="mt-2 text-xs text-ink-600">
                  <p className="uppercase tracking-[0.2em] text-ink-500">Imported</p>
                  <ul className="mt-1 space-y-1">
                    {job.result.results.slice(0, 6).map((item: any, index: number) => (
                      <li key={`${job.id}-result-${index}`}>
                        {item.type}: {item.name}
                      </li>
                    ))}
                  </ul>
                  {job.result.results.length > 6 ? <p className="mt-1">...and more</p> : null}
                </div>
              ) : null}
            </div>
          ))}
          {!jobs.length ? <p className="text-sm text-ink-600">No jobs yet.</p> : null}
        </div>
      </div>

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">Duplicates & Merge</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <FormField
            label="Entity"
            value={duplicateEntity}
            onChange={setDuplicateEntity}
            options={duplicateEntities}
          />
          <button className="btn-secondary mt-6 h-[44px]" onClick={handleDuplicatesScan}>
            Scan Duplicates
          </button>
        </div>
        {duplicatesStatus ? <p className="mt-3 text-sm text-ember-600">{duplicatesStatus}</p> : null}
        <div className="mt-4 space-y-4">
          {duplicateGroups.map((group) => {
            const selection = mergeSelections[group.key];
            return (
              <div key={group.key} className="rounded-2xl border border-mist-200 bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-ink-600">Group</p>
                <div className="mt-3 space-y-2">
                  {group.items.map((item: any) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <input
                        type="radio"
                        name={`target-${group.key}`}
                        checked={selection?.targetId === item.id}
                        onChange={() => handleTargetChange(group.key, item.id)}
                      />
                      <label className="text-sm text-ink-900">{item.label}</label>
                      <input
                        type="checkbox"
                        className="ml-auto"
                        checked={selection?.sourceIds.includes(item.id) || false}
                        onChange={() => handleSourceToggle(group.key, item.id)}
                      />
                    </div>
                  ))}
                </div>
                <button className="btn-primary mt-3" onClick={() => handleMerge(group.key)}>
                  Merge Selected into Target
                </button>
              </div>
            );
          })}
          {!duplicateGroups.length ? <p className="text-sm text-ink-600">No duplicate groups found.</p> : null}
        </div>
      </div>
    </div>
  );
};

export default ToolsPage;
