import React from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import SectionHeader from "../components/SectionHeader";
import StatCard from "../components/StatCard";

type DashboardResponse = {
  readingBlocks: any[];
  highPriorityCharacters: { character: any; nextStoryBlock: any | null }[];
  upcomingEvents: any[];
  suggestion: any;
  readingOrders: {
    id: string;
    name: string;
    description?: string | null;
    totalBlocks: number;
    completedBlocks: number;
    nextStoryBlock: any | null;
  }[];
};

type StatsResponse = {
  counts: {
    publishers: number;
    series: number;
    storyBlocks: number;
    issues: number;
    events: number;
    sessions: number;
    characters: number;
    teams: number;
  };
  issues: {
    total: number;
    finished: number;
    completionPercent: number;
  };
  storyBlocks: {
    total: number;
    reading: number;
    finished: number;
  };
  sessions: {
    last30Days: number;
    avgDurationMinutes: number;
    fatigueBreakdown: Record<string, number>;
  };
};

const DashboardPage = () => {
  const [data, setData] = React.useState<DashboardResponse | null>(null);
  const [stats, setStats] = React.useState<StatsResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    Promise.all([apiFetch<DashboardResponse>("/api/dashboard"), apiFetch<StatsResponse>("/api/stats")])
      .then(([dashboardData, statsData]) => {
        setData(dashboardData);
        setStats(statsData);
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return <div className="text-ember-600">{error}</div>;
  }

  if (!data) {
    return <div className="text-ink-700">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-10">
      <SectionHeader
        title="Reading Command Center"
        subtitle="Track the arcs and teams you are actually moving through right now."
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <StatCard
          label="Active Story Blocks"
          value={String(data.readingBlocks.length)}
          helper="Blocks currently in READING status."
        />
        <StatCard
          label="High Priority Characters"
          value={String(data.highPriorityCharacters.length)}
          helper="Characters or teams marked as HIGH."
        />
        <StatCard
          label="Upcoming Events"
          value={String(data.upcomingEvents.length)}
          helper="Events in your global sequence order."
        />
        <StatCard
          label="Reading Orders"
          value={String(data.readingOrders.length)}
          helper="Custom story-block sequences."
        />
      </div>

      {stats ? (
        <div className="grid gap-4 lg:grid-cols-4">
          <StatCard
            label="Total Issues"
            value={String(stats.issues.total)}
            helper={`${stats.issues.completionPercent}% finished`}
          />
          <StatCard
            label="Issues Finished"
            value={String(stats.issues.finished)}
            helper="Marked as FINISHED."
          />
          <StatCard
            label="Sessions (30d)"
            value={String(stats.sessions.last30Days)}
            helper={`Avg ${stats.sessions.avgDurationMinutes} min`}
          />
          <StatCard
            label="Story Blocks Done"
            value={String(stats.storyBlocks.finished)}
            helper={`${stats.storyBlocks.reading} in READING`}
          />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
          <h3 className="text-lg font-semibold text-ink-900">Suggestions</h3>
          <p className="mt-2 text-sm text-ink-700">
            {data.suggestion?.shouldSwitch
              ? data.suggestion.reason
              : data.suggestion?.reason || "Keep steady. No fatigue flags yet."}
          </p>
          {data.suggestion?.candidate ? (
            <div className="mt-4 rounded-2xl border border-mist-200 bg-mist-100/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-ink-600">Switch candidate</p>
              <p className="mt-2 text-sm text-ink-900">
                {data.suggestion.candidate.storyBlock?.name} - {data.suggestion.candidate.character?.name}
              </p>
              <Link
                to={`/story-blocks/${data.suggestion.candidate.storyBlock?.id}`}
                className="mt-3 inline-flex text-sm font-semibold text-ember-600"
              >
                Review block
              </Link>
            </div>
          ) : null}
        </div>

        <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
          <h3 className="text-lg font-semibold text-ink-900">High Priority Watchlist</h3>
          <ul className="mt-4 space-y-3">
            {data.highPriorityCharacters.slice(0, 6).map((entry) => (
              <li key={entry.character.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink-900">{entry.character.name}</p>
                  <p className="text-xs text-ink-600">
                    Next: {entry.nextStoryBlock?.name || "No unfinished block"}
                  </p>
                </div>
                {entry.nextStoryBlock ? (
                  <Link
                    className="text-xs font-semibold text-ember-600"
                    to={`/story-blocks/${entry.nextStoryBlock.id}`}
                  >
                    Open
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">Active Story Blocks</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {data.readingBlocks.map((block) => (
            <div key={block.id} className="rounded-2xl border border-mist-200 bg-white px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink-900">{block.name}</p>
                  <p className="text-xs text-ink-600">{block.metrics?.completionPercent ?? 0}% complete</p>
                </div>
                <Link className="text-xs font-semibold text-ember-600" to={`/story-blocks/${block.id}`}>
                  Details
                </Link>
              </div>
              <div className="mt-3 h-2 w-full rounded-full bg-mist-200">
                <div
                  className="h-2 rounded-full bg-moss-500"
                  style={{ width: `${block.metrics?.completionPercent ?? 0}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-ink-600">
                Next issue: {block.metrics?.nextIssue?.issueNumber || "All caught up"}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">Upcoming Events</h3>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {data.upcomingEvents.map((event) => (
            <li key={event.id} className="rounded-2xl border border-mist-200 bg-white px-4 py-3">
              <p className="text-sm font-semibold text-ink-900">{event.name}</p>
              <p className="text-xs text-ink-600">
                {event.startYear} - {event.endYear || "ongoing"}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">Reading Orders</h3>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {data.readingOrders.map((order) => (
            <li key={order.id} className="rounded-2xl border border-mist-200 bg-white px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink-900">{order.name}</p>
                  <p className="text-xs text-ink-600">
                    {order.completedBlocks}/{order.totalBlocks} blocks complete
                  </p>
                  {order.status ? (
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-ink-500">{order.status}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-ink-600">
                    Next: {order.nextStoryBlock?.name || "All finished"}
                  </p>
                </div>
                <Link className="text-xs font-semibold text-ember-600" to={`/reading-orders/${order.id}`}>
                  Open
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {stats ? (
        <div className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
          <h3 className="text-lg font-semibold text-ink-900">30-Day Fatigue Snapshot</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {Object.entries(stats.sessions.fatigueBreakdown).map(([level, count]) => (
              <div key={level} className="rounded-2xl border border-mist-200 bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-ink-600">{level}</p>
                <p className="mt-2 text-lg font-semibold text-ink-900">{count}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DashboardPage;
