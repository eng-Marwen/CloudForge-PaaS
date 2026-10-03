import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { backendApi, getApiError } from "./lib/api";
import ApplicationDetails from "./pages/ApplicationDetails";
import ApplicationsPage from "./pages/Applications.tsx";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NewApplication from "./pages/NewApplication";
import SettingsPage from "./pages/Settings";
import { ConfirmDialog } from "./pages/shared";
import type { AppRecord, User } from "./pages/types";

const links = [
  { to: "/", label: "Dashboard", icon: DashboardIcon },
  { to: "/applications", label: "Applications", icon: AppsIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

function DashboardIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function AppsIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="2.5" width="12" height="11" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 6h12" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2.1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 1.7v1.5M8 12.8v1.5M1.7 8h1.5M12.8 8h1.5M3.3 3.3l1.1 1.1M11.6 11.6l1.1 1.1M12.7 3.3l-1.1 1.1M4.4 11.6l-1.1 1.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function Layout({ children, user, onLogout }: { children: ReactNode; user: User; onLogout: () => void }) {
  const [confirmLogout, setConfirmLogout] = useState(false);
  const { pathname } = useLocation();
  const initial = user.username.trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen text-slate-800">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-64 flex-col border-r border-slate-200/80 bg-white/90 px-4 py-6 backdrop-blur">
        <strong className="flex items-center gap-3 px-2 text-base tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400 text-xs font-bold text-slate-900">CF</span>
          CloudForge
        </strong>
        <p className="mt-10 px-3 text-[11px] font-bold uppercase tracking-[.18em] text-slate-400">
          Workspace
        </p>
        <nav className="mt-3 space-y-1">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition duration-200 ${
                  isActive
                    ? "bg-emerald-50 font-semibold text-emerald-800 shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`
              }
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl bg-slate-50 px-3 py-3">
          <p className="text-xs font-semibold text-slate-700">{user.username}</p>
          <p className="truncate text-xs text-slate-400">{user.email}</p>
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/80 pl-72 pr-8 backdrop-blur">
        <p className="text-sm text-slate-500">A calm workspace for your deployments.</p>
        <span className="flex items-center gap-3 text-sm text-slate-600">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-100 font-semibold text-emerald-800">
            {initial}
          </span>
          <span className="hidden font-medium sm:inline">{user.username}</span>
          <button
            className="rounded-lg px-2 py-1 text-xs font-semibold text-red-500 transition hover:bg-red-50 hover:text-red-700"
            onClick={() => setConfirmLogout(true)}
          >
            Sign out
          </button>
        </span>
      </header>

      <main className="ml-64 min-w-0 pt-16">
        <div key={pathname} className="page-enter mx-auto max-w-6xl px-6 py-9 sm:px-10">{children}</div>
      </main>
      {confirmLogout && (
        <ConfirmDialog
          title="Sign out of CloudForge?"
          message="Your session will end on this device. You can sign in again at any time."
          confirmLabel="Sign out"
          onCancel={() => setConfirmLogout(false)}
          onConfirm={() => {
            setConfirmLogout(false);
            onLogout();
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [apps, setApps] = useState<AppRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    Promise.all([backendApi.health(), backendApi.auth.me()])
      .then(([, { data }]) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    backendApi.apps.list()
      .then(({ data }) => setApps(data.apps))
      .catch((error: unknown) => setAuthError(getApiError(error, "Unable to load applications")));
  }, [user]);

  const handleAuthenticated = (authenticatedUser: User) => {
    setAuthError("");
    window.history.replaceState(null, "", "/");
    setUser(authenticatedUser);
  };

  const handleLogout = async () => {
    await backendApi.auth.logout().catch(() => undefined);
    setUser(null);
    setApps([]);
  };

  const handleAccountDeleted = () => {
    setUser(null);
    setApps([]);
  };

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-slate-500">
        <div className="flex flex-col items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400 text-xs font-bold text-slate-900">CF</span>
          Loading CloudForge...
        </div>
      </div>
    );
  }
  if (!user) return <Auth onAuthenticated={handleAuthenticated} />;

  return (
    <BrowserRouter>
      <Layout user={user} onLogout={handleLogout}>
        {authError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {authError}
          </div>
        )}
        <Routes>
          <Route path="/" element={<Dashboard apps={apps} username={user.username} />} />
          <Route path="/applications" element={<ApplicationsPage apps={apps} loading={loading} onAppsChange={setApps} />} />
          <Route path="/applications/new" element={<NewApplication />} />
          <Route
            path="/applications/:id"
            element={
              <ApplicationDetails
                onAppChange={(updatedApp) => {
                  setApps((currentApps) => currentApps.map((app) => (app.id === updatedApp.id ? updatedApp : app)));
                }}
              />
            }
          />
          <Route
            path="/settings"
            element={
              <SettingsPage
                user={user}
                onLogout={() => {
                  void handleLogout();
                }}
                onUserChange={setUser}
                onAccountDeleted={handleAccountDeleted}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
