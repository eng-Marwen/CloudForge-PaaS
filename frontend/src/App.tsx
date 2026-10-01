import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
    BrowserRouter,
    NavLink,
    Navigate,
    Route,
    Routes,
} from "react-router-dom";
import api from "./lib/api";
import Applications from "./pages/Applications";
import Dashboard from "./pages/Dashboard";
import NewApplication from "./pages/NewApplication";
import Settings from "./pages/Settings";
import type { AppRecord } from "./pages/types";

const links = [
  ["/", "Dashboard", "▦"],
  ["/applications", "Applications", "□"],
  ["/settings", "Settings", "⚙"],
] as const;

const mockApps: AppRecord[] = [
  {
    id: 1,
    name: "api-server",
    repository: "github.com/cloudforge/api-server",
    branch: "main",
    isDeployed: true,
    createdAt: "2026-09-26T09:30:00Z",
  },
  {
    id: 2,
    name: "frontend",
    repository: "github.com/cloudforge/frontend",
    branch: "main",
    isDeployed: false,
    createdAt: "2026-09-20T13:10:00Z",
  },
];

function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-slate-200 bg-white px-4 py-6">
        <strong className="flex items-center gap-3 text-base">
        <span className="flex h-8 w-8 items-center justify-center rounded bg-slate-700 text-xs text-white">CF</span>
        CloudForge
        </strong>
        <p className="mt-10 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">
          Workspace
        </p>
        
        <nav className="mt-3 space-y-1">
          {links.map(([to, label, icon]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm ${isActive ? "bg-slate-100 font-semibold text-slate-800" : "text-slate-500 hover:bg-slate-50"}`
              }
            >
              <span>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <header className="fixed inset-x-0 top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white pl-68 pr-10">
        <strong>CloudForge</strong>
        <span className="flex items-center gap-2 text-sm text-slate-600">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 font-semibold">
            M
          </span>
          Marwen
        </span>
      </header>

      <main className="ml-60 min-w-0 pt-16">
        <div className="mx-auto max-w-6xl px-10 py-9">{children}</div>
      </main>
    </div>
  );
}

export default function App() {
  const [apps, setApps] = useState<AppRecord[]>(mockApps);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ apps?: AppRecord[] }>("/apps")
      .then(({ data }) => {
        if (data.apps?.length) setApps(data.apps);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  return (
    <BrowserRouter>
        <Layout>
            <Routes>
                <Route path="/" element={<Dashboard apps={apps} />} />
                <Route path="/applications" element={<Applications apps={apps} loading={loading} />} />
                <Route path="/applications/new" element={<NewApplication />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Layout>
    </BrowserRouter>
  );
}
