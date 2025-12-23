import React from "react";
import { Link, useParams } from "react-router-dom";
import SectionHeader from "../components/SectionHeader";
import FormField from "../components/FormField";
import SearchableMultiSelect from "../components/SearchableMultiSelect";
import { apiFetch } from "../lib/api";
import { characterTypes, trackingPriorities } from "../lib/enums";

const CharacterDetailPage = () => {
  const { id } = useParams();
  const [character, setCharacter] = React.useState<any | null>(null);
  const [publishers, setPublishers] = React.useState<any[]>([]);
  const [teams, setTeams] = React.useState<any[]>([]);
  const [characters, setCharacters] = React.useState<any[]>([]);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const saveTimerRef = React.useRef<number | null>(null);
  const [form, setForm] = React.useState({
    name: "",
    realName: "",
    type: "",
    publisherId: "",
    aliases: "",
    continuity: "",
    majorStatusQuoNotes: "",
    currentTrackingPriority: "NONE",
    teamIds: [] as string[],
    memberIds: [] as string[]
  });

  const splitAliasParts = (value: string) => {
    const normalized = value.replace(/<br\s*\/?>/gi, "\n").replace(/\r/g, "\n");
    const parts = normalized
      .split(/[\n,;]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (parts.length <= 1) {
      const single = parts[0] ?? "";
    if (single && single.split(/\s+/).length > 3) {
      const expanded = single
        .replace(/([a-z0-9])([A-Z])/g, "$1|$2")
        .replace(/([A-Z])([A-Z][a-z])/g, "$1|$2")
        .split("|")
        .map((entry) => entry.trim())
        .filter(Boolean);
      if (expanded.length > 1) {
        return expanded;
      }
    }
  }

    return parts;
  };

  const formatAliases = (value: string | string[] | null | undefined) => {
    if (!value) return "";
    const entries = Array.isArray(value) ? value : [value];
    const cleaned = entries.flatMap((entry) => splitAliasParts(entry));
    return cleaned.join(", ");
  };

  React.useEffect(() => {
    apiFetch<{ items: any[] }>("/api/publishers").then((data) => setPublishers(data.items));
    apiFetch<{ items: any[] }>("/api/characters?type=TEAM&pageSize=100").then((data) =>
      setTeams(data.items)
    );
    apiFetch<{ items: any[] }>("/api/characters?type=CHARACTER&pageSize=100").then((data) =>
      setCharacters(data.items)
    );
    apiFetch<any>(`/api/characters/${id}`).then((data) => {
      setCharacter(data);
      setForm({
        name: data.name,
        realName: data.realName || "",
        type: data.type,
        publisherId: data.publisherId || "",
        aliases: formatAliases(data.aliases),
        continuity: data.continuity || "",
        majorStatusQuoNotes: data.majorStatusQuoNotes || "",
        currentTrackingPriority: data.currentTrackingPriority,
        teamIds: (data.characterTeams || []).map((link: any) => link.teamId || link.team?.id),
        memberIds: (data.teamMembers || []).map((link: any) => link.characterId || link.character?.id)
      });
    });
  }, [id]);

  const saveCharacter = React.useCallback(
    async (nextForm: typeof form) => {
      if (!id) return;
      setSaveError(null);
      try {
        await apiFetch(`/api/characters/${id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: nextForm.name,
            realName: nextForm.realName || null,
            type: nextForm.type,
            publisherId: nextForm.publisherId || null,
            aliases: nextForm.aliases || null,
            continuity: nextForm.continuity || null,
            majorStatusQuoNotes: nextForm.majorStatusQuoNotes || null,
            currentTrackingPriority: nextForm.currentTrackingPriority,
            teamIds: nextForm.teamIds,
            memberIds: nextForm.memberIds
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
        saveCharacter(nextForm);
        saveTimerRef.current = null;
      }, 500);
    },
    [saveCharacter]
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
    scheduleSave(nextForm);
  };

  if (!character) {
    return <div className="text-ink-700">Loading...</div>;
  }

  const storyBlocks = character.storyBlockCharacters.map((link: any) => link.storyBlock);
  const sortedBlocks = [...storyBlocks].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  const nextBlock = sortedBlocks.find((block) => block.status !== "FINISHED");

  return (
    <div className="space-y-8">
      <SectionHeader
        title={character.name}
        subtitle={`Tracking priority: ${character.currentTrackingPriority}`}
        action={
          <Link className="btn-secondary" to="/characters">
            Back to list
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <FormField label="Name" value={form.name} onChange={(value) => updateForm({ name: value })} />
        <FormField
          label="Real Name"
          value={form.realName}
          onChange={(value) => updateForm({ realName: value })}
        />
        <FormField
          label="Type"
          value={form.type}
          onChange={(value) => updateForm({ type: value })}
          options={characterTypes}
        />
        <FormField
          label="Publisher"
          value={form.publisherId}
          onChange={(value) => updateForm({ publisherId: value })}
          options={publishers.map((publisher) => ({ label: publisher.name, value: publisher.id }))}
        />
        <FormField
          label="Priority"
          value={form.currentTrackingPriority}
          onChange={(value) => updateForm({ currentTrackingPriority: value })}
          options={trackingPriorities}
        />
        <FormField label="Aliases" value={form.aliases} onChange={(value) => updateForm({ aliases: value })} />
        <FormField
          label="Continuity"
          value={form.continuity}
          onChange={(value) => updateForm({ continuity: value })}
        />
      </div>
      <div className="mt-4">
        <FormField
          label="Major Status Quo Notes"
          value={form.majorStatusQuoNotes}
          onChange={(value) => updateForm({ majorStatusQuoNotes: value })}
          textarea
        />
      </div>
      {form.type === "CHARACTER" ? (
        <div className="mt-4">
          <SearchableMultiSelect
            label="Teams"
            options={teams.map((team) => ({ label: team.name, value: team.id }))}
            selectedValues={form.teamIds}
            onChange={(values) => updateForm({ teamIds: values })}
            placeholder="Search teams..."
          />
        </div>
      ) : null}
      {form.type === "TEAM" ? (
        <div className="mt-4">
          <SearchableMultiSelect
            label="Members"
            options={characters.map((entry) => ({ label: entry.name, value: entry.id }))}
            selectedValues={form.memberIds}
            onChange={(values) => updateForm({ memberIds: values })}
            placeholder="Search members..."
          />
        </div>
      ) : null}
      {saveError ? <p className="mt-3 text-sm text-ember-600">{saveError}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
          <h3 className="text-lg font-semibold text-ink-900">Story Blocks</h3>
          <p className="mt-2 text-sm text-ink-700">
            Next block: {nextBlock ? nextBlock.name : "All blocks finished."}
          </p>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {sortedBlocks.map((block: any) => (
              <li key={block.id} className="rounded-2xl border border-mist-200 bg-white px-4 py-3">
                <Link to={`/story-blocks/${block.id}`} className="font-semibold text-ink-900">
                  {block.name}
                </Link>
                <p className="text-xs text-ink-600">{block.status}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
          <h3 className="text-lg font-semibold text-ink-900">Recent Dominant Sessions</h3>
          <ul className="mt-4 space-y-3">
            {character.dominantSessions?.length ? (
              character.dominantSessions.map((session: any) => (
                <li key={session.id} className="rounded-2xl border border-mist-200 bg-white px-4 py-3">
                  <Link to={`/sessions/${session.id}`} className="text-sm font-semibold text-ink-900">
                    {new Date(session.sessionDate).toLocaleString()}
                  </Link>
                  <p className="text-xs text-ink-600">
                    {session.durationMinutes} min - {session.fatigueLevel}
                  </p>
                </li>
              ))
            ) : (
              <p className="text-sm text-ink-600">No dominant sessions logged yet.</p>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CharacterDetailPage;
