import React from "react";
import Papa from "papaparse";
import SectionHeader from "../components/SectionHeader";
import { apiFetch, apiUpload } from "../lib/api";

const entityConfig: Record<string, { label: string; fields: string[] }> = {
  publishers: { label: "Publishers", fields: ["name", "country", "notes"] },
  series: {
    label: "Series",
    fields: ["name", "publisher", "startYear", "endYear", "era", "chronology", "type", "notes"]
  },
  characters: {
    label: "Characters / Teams",
    fields: [
      "name",
      "realName",
      "type",
      "publisher",
      "aliases",
      "continuity",
      "majorStatusQuoNotes",
      "currentTrackingPriority",
      "teams"
    ]
  },
  events: {
    label: "Events",
    fields: ["name", "publisher", "startYear", "endYear", "sequenceOrder", "notes"]
  },
  "story-blocks": {
    label: "Story Blocks",
    fields: [
      "name",
      "type",
      "era",
      "chronology",
      "startYear",
      "endYear",
      "importance",
      "syncLevel",
      "event",
      "publisher",
      "orderIndex",
      "status",
      "notes",
      "series",
      "issues",
      "characters",
      "teams"
    ]
  },
  issues: {
    label: "Issues",
    fields: [
      "series",
      "issueNumber",
      "title",
      "releaseDate",
      "readingOrderIndex",
      "status",
      "readDate",
      "notes",
      "storyBlocks",
      "characters",
      "teams",
      "events"
    ]
  }
};

const ImportPage = () => {
  const [entity, setEntity] = React.useState("series");
  const [file, setFile] = React.useState<File | null>(null);
  const [columns, setColumns] = React.useState<string[]>([]);
  const [mapping, setMapping] = React.useState<Record<string, string>>({});
  const [preview, setPreview] = React.useState<any>(null);
  const [status, setStatus] = React.useState<string | null>(null);

  const handleFile = React.useCallback(async (selected: File | null) => {
    setFile(selected);
    setPreview(null);
    setStatus(null);
    if (!selected) return;

    const text = await selected.text();
    if (selected.type.includes("json") || selected.name.toLowerCase().endsWith(".json")) {
      const parsed = JSON.parse(text);
      const rows = Array.isArray(parsed) ? parsed : parsed.items || [];
      const fields = rows[0] ? Object.keys(rows[0]) : [];
      setColumns(fields);
      const auto = entityConfig[entity].fields.reduce((acc, field) => {
        acc[field] = fields.includes(field) ? field : "";
        return acc;
      }, {} as Record<string, string>);
      setMapping(auto);
      return;
    }

    Papa.parse(text, {
      header: true,
      preview: 1,
      skipEmptyLines: true,
      complete: (result) => {
        const fields = result.meta.fields || [];
        setColumns(fields);
        const auto = entityConfig[entity].fields.reduce((acc, field) => {
          acc[field] = fields.includes(field) ? field : "";
          return acc;
        }, {} as Record<string, string>);
        setMapping(auto);
      }
    });
  }, [entity]);

  React.useEffect(() => {
    if (file) {
      handleFile(file);
    }
  }, [entity, file, handleFile]);

  const handlePreview = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mapping", JSON.stringify(mapping));
    const data = await apiUpload(`/api/import/${entity}/preview`, formData);
    setPreview(data);
  };

  const handleCommit = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mapping", JSON.stringify(mapping));
    try {
      const data = await apiUpload(`/api/import/${entity}/commit`, formData);
      setStatus(`Imported ${data.imported} rows into ${data.entity}.`);
    } catch (err) {
      setStatus((err as Error).message);
    }
  };

  const handleExport = async (target: string) => {
    const data = await apiFetch(`/api/export/${target}`);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${target}-export.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-10">
      <SectionHeader
        title="Import & Export"
        subtitle="Map CSV/JSON data into your tracker without preloaded business data."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
          <h3 className="text-lg font-semibold text-ink-900">Import Data</h3>
          <div className="mt-4 grid gap-4">
            <label className="text-sm text-ink-700">
              Entity
              <select
                className="mt-2 w-full rounded-2xl border border-mist-200 bg-white px-3 py-2 text-sm"
                value={entity}
                onChange={(event) => setEntity(event.target.value)}
              >
                {Object.entries(entityConfig).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-ink-700">
              CSV or JSON file
              <input
                className="mt-2 w-full rounded-2xl border border-mist-200 bg-white px-3 py-2 text-sm"
                type="file"
                accept=".csv,.json"
                onChange={(event) => handleFile(event.target.files?.[0] || null)}
              />
            </label>
          </div>

          {columns.length ? (
            <div className="mt-6">
              <p className="text-xs uppercase tracking-[0.2em] text-ink-600">Column mapping</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {entityConfig[entity].fields.map((field) => (
                  <label key={field} className="text-sm text-ink-700">
                    {field}
                    <select
                      className="mt-2 w-full rounded-2xl border border-mist-200 bg-white px-3 py-2 text-sm"
                      value={mapping[field] || ""}
                      onChange={(event) =>
                        setMapping({
                          ...mapping,
                          [field]: event.target.value
                        })
                      }
                    >
                      <option value="">Ignore</option>
                      {columns.map((column) => (
                        <option key={column} value={column}>
                          {column}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button className="btn-secondary" onClick={handlePreview}>
                  Preview
                </button>
                <button className="btn-primary" onClick={handleCommit}>
                  Import
                </button>
              </div>
            </div>
          ) : null}

          {status ? <p className="mt-4 text-sm text-ink-700">{status}</p> : null}
        </div>

        <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
          <h3 className="text-lg font-semibold text-ink-900">Export Backup</h3>
          <p className="mt-2 text-sm text-ink-700">Download JSON snapshots by entity.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {Object.keys(entityConfig).map((key) => (
              <button key={key} className="btn-secondary" onClick={() => handleExport(key)}>
                Export {entityConfig[key].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {preview ? (
        <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
          <h3 className="text-lg font-semibold text-ink-900">Preview</h3>
          <p className="mt-2 text-sm text-ink-700">
            {preview.errors?.length ? "Fix errors before import." : "Looks good!"}
          </p>
          <div className="mt-4 space-y-3">
            {preview.preview.map((row: any, index: number) => (
              <div key={index} className="rounded-2xl border border-mist-200 bg-white px-4 py-3">
                <pre className="text-xs text-ink-700">{JSON.stringify(row.data, null, 2)}</pre>
                {row.errors?.length ? (
                  <p className="mt-2 text-xs text-ember-600">{row.errors.join(", ")}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ImportPage;
