import React from "react";

const SectionHeader: React.FC<{ title: string; subtitle?: string; action?: React.ReactNode }> = ({
  title,
  subtitle,
  action
}) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div>
      <h2 className="text-2xl font-semibold text-ink-900">{title}</h2>
      {subtitle ? <p className="mt-2 text-sm text-ink-700">{subtitle}</p> : null}
    </div>
    {action ? <div>{action}</div> : null}
  </div>
);

export default SectionHeader;
