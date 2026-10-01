import { Link } from "react-router-dom";
import { Header, Status, formatDate, panel } from "./shared";
import type { AppRecord } from "./types";

export default function Dashboard({ apps }: { apps: AppRecord[] }) {
  const running = apps.filter((app) => app.isDeployed).length;

  return (
    <>
      <Header
        title="Good morning, Marwen"
        subtitle="Manage and deploy your applications."
        action={
          <Link
            className="rounded-md bg-slate-700 px-4 py-2.5 text-sm font-semibold text-white"
            to="/applications/new"
          >
            ＋ New application
          </Link>
        }
      />
      <div className="mb-12 grid grid-cols-2 sm:grid-cols-4">
        {[
          ["Applications", apps.length, "text-slate-800"],
          ["Running", running, "text-emerald-700"],
          ["Deploying", 0, "text-amber-600"],
          ["Failed", 0, "text-red-700"],
        ].map(([label, value, color]) => (
          <div key={label} className={`${panel} px-6 py-5`}>
            <p className="text-xs text-slate-500">{label}</p>
            <strong className={`mt-2 block text-3xl font-semibold ${color}`}>
              {value}
            </strong>
          </div>
        ))}
      </div>
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-700">
              Recent applications
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Your latest deployment activity.
            </p>
          </div>
          <Link className="text-sm text-slate-600" to="/applications">
            View all →
          </Link>
        </div>
        <div className={`${panel} overflow-x-auto`}>
          <table className="w-full min-w-162.5 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-5 py-3">Application</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Repository</th>
                <th className="px-5 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {apps.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-slate-400">
                    No applications yet.
                  </td>
                </tr>
              ) : (
                apps.slice(0, 4).map((app) => (
                  <tr key={app.id}>
                    <td className="px-5 py-4 font-semibold text-slate-700">{app.name}</td>
                    <td className="px-5 py-4"><Status deployed={app.isDeployed} /></td>
                    <td className="px-5 py-4 text-slate-500">{app.repository}</td>
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
