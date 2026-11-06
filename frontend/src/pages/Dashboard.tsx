import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState, Header, RepoLink, Status, formatDate, panel } from "./shared";
import type { AppRecord } from "./types";

function greeting(username: string) {
  const hour = new Date().getHours();
  const time = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return `${time}, ${username}`;
}

export default function Dashboard({ apps, username }: { apps: AppRecord[]; username: string }) {
  const running = apps.filter((app) => app.status === "running" || (!app.status && app.isDeployed)).length;
  const deploying = apps.filter((app) => app.status === "deploying").length;
  const failed = apps.filter((app) => app.status === "failed" || (!app.status && !app.isDeployed)).length;

  return (
    <>
      <Header
        title={greeting(username)}
        subtitle="Manage and deploy your applications from one quiet workspace."
        action={
          <Link
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-indigo-500 px-4 text-sm font-semibold text-white shadow-sm shadow-indigo-500/20 transition hover:bg-indigo-400"
            to="/applications/new"
          >
            <span className="grid h-5 w-5 place-items-center rounded-md bg-white/15 text-white">
              <Plus className="h-3.5 w-3.5 text-white" strokeWidth={2.6} />
            </span>
            New application
          </Link>
        }
      />
      <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Applications", apps.length, "text-slate-100"],
          ["Running", running, "text-emerald-400"],
          ["Deploying", deploying, "text-amber-300"],
          ["Failed", failed, "text-red-400"],
        ].map(([label, value, color]) => (
          <div key={label} className={`${panel} px-6 py-5 transition duration-200 hover:-translate-y-0.5`}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
            <strong className={`mt-2 block text-3xl font-semibold ${color}`}>{value}</strong>
          </div>
        ))}
      </div>
      <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-slate-100">Recent applications</h2>
            <p className="mt-1 text-xs text-slate-400">Your latest deployment activity.</p>
          </div>
          <Link className="text-sm font-medium text-indigo-300 transition hover:text-indigo-200" to="/applications">
            View all
          </Link>
        </div>
        <div className={`${panel} overflow-x-auto`}>
          <table className="w-full min-w-160 text-left text-sm">
            <thead className="bg-[#0d1320] text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Application</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Repository</th>
                <th className="px-5 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1b2537]">
              {apps.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState title="No applications yet" message="Create your first app to see it here." />
                  </td>
                </tr>
              ) : (
                apps.slice(0, 4).map((app) => (
                  <tr key={app.id} className="transition hover:bg-[#172033]">
                    <td className="px-5 py-4">
                      <Link className="block max-w-48 truncate font-semibold text-slate-100 underline decoration-slate-600 underline-offset-2 hover:text-indigo-300" title={app.name} to={`/applications/${app.id}`}>
                        {app.name}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <Status status={app.status} deployed={app.isDeployed} />
                    </td>
                    <td className="max-w-64 px-5 py-4">
                      <RepoLink className="block truncate" repository={app.repository} />
                    </td>
                    <td className="px-5 py-4 text-slate-500">{formatDate(app.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
