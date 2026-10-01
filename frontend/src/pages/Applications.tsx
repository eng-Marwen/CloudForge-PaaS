import { Link } from "react-router-dom";
import { Header, PrimaryButton, Status, formatDate, panel } from "./shared";
import type { AppRecord } from "./types";

export default function Applications({ apps, loading }: { apps: AppRecord[]; loading: boolean }) {
  return (
    <>
      <Header
        title="Applications"
        subtitle="Applications deployed through CloudForge."
        action={
          <Link to="/applications/new">
            <PrimaryButton>＋ New application</PrimaryButton>
          </Link>
        }
      />
      <div className="mb-4 flex justify-end">
        <span className="text-xs text-slate-500">
          {loading ? "Loading..." : `${apps.length} applications`}
        </span>
      </div>
      <div className={`${panel} overflow-x-auto`}>
        <table className="w-full min-w-175 text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-5 py-3">Application</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Repository</th>
              <th className="px-5 py-3">Branch</th>
              <th className="px-5 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">Loading applications...</td></tr>
            ) : apps.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">No applications yet.</td></tr>
            ) : apps.map((app) => (
              <tr key={app.id} className="hover:bg-slate-50">
                <td className="px-5 py-4 font-semibold text-slate-700">
                  {app.name}
                </td>
                <td className="px-5 py-4">
                  <Status deployed={app.isDeployed} />
                </td>
                <td className="px-5 py-4 text-slate-500">{app.repository}</td>
                <td className="px-5 py-4 text-slate-500">{app.branch}</td>
                <td className="px-5 py-4 text-slate-500">
                  {formatDate(app.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
