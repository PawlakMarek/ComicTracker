import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../lib/auth";
import clsx from "clsx";

const navItems = [
  { label: "Dashboard", path: "/" },
  { label: "Library", path: "/library" },
  { label: "Story Blocks", path: "/story-blocks" },
  { label: "Reading Orders", path: "/reading-orders" },
  { label: "Characters & Teams", path: "/characters" },
  { label: "Issues", path: "/issues" },
  { label: "Reading Sessions", path: "/sessions" },
  { label: "Import / Export", path: "/import" },
  { label: "Tools", path: "/tools" }
];

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <div className="relative z-10 flex min-h-screen">
        <aside className="hidden w-64 flex-col gap-10 border-r border-mist-200 bg-mist-50/70 px-6 py-8 lg:flex">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-moss-600">ComicTracker</p>
            <h1 className="mt-2 text-2xl font-semibold text-ink-900">Story-Block Focus</h1>
          </div>
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  clsx(
                    "rounded-2xl px-4 py-2 text-sm font-semibold transition",
                    isActive
                      ? "bg-ink-900 text-mist-50 shadow-card"
                      : "text-ink-700 hover:bg-mist-100 hover:text-ink-900"
                  )
                }
                end={item.path === "/"}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto space-y-3 text-xs text-ink-700">
            <p className="font-semibold">Signed in as</p>
            <p className="rounded-xl border border-mist-200 bg-mist-100/70 px-3 py-2 text-[11px]">
              {user?.email}
            </p>
            <button onClick={logout} className="btn-secondary w-full">
              Sign out
            </button>
          </div>
        </aside>

        <main className="flex-1 px-6 py-8 lg:px-12">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 flex items-center justify-between lg:hidden">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-moss-600">ComicTracker</p>
                <h1 className="text-2xl font-semibold text-ink-900">Story-Block Focus</h1>
              </div>
              <button onClick={logout} className="btn-secondary">
                Sign out
              </button>
            </div>
            <div className="surface-panel rounded-[32px] px-6 py-8 shadow-soft lg:px-10">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppShell;
