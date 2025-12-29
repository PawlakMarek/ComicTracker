import React, { useState, useEffect, useRef } from "react";
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
  { label: "Tools", path: "/tools" },
];

const FOCUSABLE_ELEMENTS_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const Branding: React.FC = () => (
  <div>
    <p className="text-xs uppercase tracking-[0.3em] text-moss-600">
      ComicTracker
    </p>
    <h1 className="mt-2 text-2xl font-semibold text-ink-900">
      Story-Block Focus
    </h1>
  </div>
);

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isMenuOpen]);

  // Handle Escape key to close menu and focus trap
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle Escape key
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
        return;
      }

      // Handle Tab key for focus trap
      if (event.key === 'Tab' && menuRef.current) {
        const focusableElements = menuRef.current.querySelectorAll<HTMLElement>(
          FOCUSABLE_ELEMENTS_SELECTOR
        );
        
        // Only set up focus trap if there are focusable elements
        if (focusableElements.length === 0) return;
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement?.focus();
            event.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement?.focus();
            event.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  // Auto-focus first element when menu opens
  useEffect(() => {
    if (isMenuOpen && menuRef.current) {
      const focusableElements = menuRef.current.querySelectorAll<HTMLElement>(
        FOCUSABLE_ELEMENTS_SELECTOR
      );
      const firstElement = focusableElements[0];

      firstElement?.focus();
    }
  }, [isMenuOpen]);

  return (
    <div className="app-shell">
      {/* Floating hamburger menu button */}
      {!isMenuOpen && (
        <div className="fixed top-6 left-6 z-30 lg:hidden">
          <button
            className="rounded-full bg-mist-50/70 p-3 shadow-md backdrop-blur-sm transition hover:bg-mist-100"
            onClick={() => setIsMenuOpen(true)}
            aria-label="Open navigation menu"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>
      )}

      <div className="relative z-10 flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 flex-col gap-10 border-r border-mist-200 bg-mist-50/70 px-6 py-8 lg:flex">
          <Branding />
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

        {/* Mobile menu */}
        {isMenuOpen && (
          <div
            ref={menuRef}
            className="fixed inset-0 z-20 flex flex-col bg-mist-50/95 p-6 lg:hidden"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between">
              <Branding />
              <button
                onClick={() => setIsMenuOpen(false)}
                className="p-2"
                aria-label="Close menu"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <nav className="mt-10 flex flex-col gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMenuOpen(false)}
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
          </div>
        )}

        <main className="flex-1 px-6 py-8 lg:px-12">
          <div className="mx-auto max-w-6xl">
            {/* Mobile header */}
            <div className="mb-6 flex items-center justify-center text-center lg:hidden">
              <h1 className="text-xl font-semibold text-ink-900">
                Story-Block Focus
              </h1>
            </div>
            <div className="surface-panel rounded-[32px] px-6 py-8 shadow-soft lg:px-10">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppShell;