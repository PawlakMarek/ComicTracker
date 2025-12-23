import React from "react";

const StatCard: React.FC<{
  label: string;
  value: string;
  helper?: string;
}> = ({ label, value, helper }) => (
  <div className="rounded-3xl border border-mist-200 bg-white/80 p-5 shadow-card">
    <p className="text-xs uppercase tracking-[0.3em] text-moss-600">{label}</p>
    <h3 className="mt-3 text-2xl font-semibold text-ink-900">{value}</h3>
    {helper ? <p className="mt-2 text-sm text-ink-700">{helper}</p> : null}
  </div>
);

export default StatCard;
