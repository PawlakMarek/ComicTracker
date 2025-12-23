import React from "react";
import { Link } from "react-router-dom";
import SectionHeader from "../components/SectionHeader";

const LibraryPage = () => {
  return (
    <div className="space-y-10">
      <SectionHeader
        title="Library"
        subtitle="Publishers, series, and events tied to your reading order."
      />

      <div className="grid gap-6 md:grid-cols-3">
        <Link to="/library/publishers" className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
          <h3 className="text-lg font-semibold text-ink-900">Publishers</h3>
          <p className="mt-2 text-sm text-ink-700">Track imprints, eras, and notes per publisher.</p>
        </Link>
        <Link to="/library/series" className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
          <h3 className="text-lg font-semibold text-ink-900">Series</h3>
          <p className="mt-2 text-sm text-ink-700">Volumes and titles with eras, types, and status.</p>
        </Link>
        <Link to="/library/events" className="rounded-3xl border border-mist-200 bg-white/80 p-6 shadow-card">
          <h3 className="text-lg font-semibold text-ink-900">Events</h3>
          <p className="mt-2 text-sm text-ink-700">Macro events and their sequence order.</p>
        </Link>
      </div>
    </div>
  );
};

export default LibraryPage;
