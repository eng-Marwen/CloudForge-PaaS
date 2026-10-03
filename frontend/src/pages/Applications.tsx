import { useState } from "react";
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { backendApi, getApiError } from "../lib/api";
import { ConfirmDialog, EmptyState, Header, RepoLink, Status, formatDate, panel } from "./shared";
import type { AppRecord, DeploymentStatus } from "./types";

type FilterStatus = "all" | DeploymentStatus;
const actionButton =
  "inline-flex h-8 min-w-20 items-center justify-center rounded-lg border px-3 text-xs font-semibold transition duration-200";
const filters: { value: FilterStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "running", label: "Running" },
  { value: "deploying", label: "Deploying" },
  { value: "failed", label: "Failed" },
];

export default function Applications({
  apps,
  loading,
  onAppsChange,
}: {
  apps: AppRecord[];
  loading: boolean;
  onAppsChange: (apps: AppRecord[]) => void;
}) {
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AppRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function filterApps(value: FilterStatus) {
    setFilter(value);
    try {
      const { data } = await backendApi.apps.list(value === "all" ? undefined : value);
      onAppsChange(data.apps);
    } catch (requestError: unknown) {
      setError(getApiError(requestError, "Unable to filter applications"));
    }
  }

  async function toggleDeployment(app: AppRecord) {
    try {
      const nextStatus = app.status === "running" ? "failed" : "deploying";
      const { data } = await backendApi.apps.update(app.id, { status: nextStatus, isDeployed: false });
      onAppsChange(apps.map((item) => (item.id === app.id ? data.app : item)));
    } catch (requestError: unknown) {
      setError(getApiError(requestError, "Unable to update application"));
    }
  }

  async function removeApplication() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await backendApi.apps.remove(deleteTarget.id);
      onAppsChange(apps.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (requestError: unknown) {
      setError(getApiError(requestError, "Unable to delete application"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Header
        title="Applications"
        subtitle="Everything you have deployed through CloudForge."
        action={
          <Link
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700"
            to="/applications/new"
          >
            <span className="grid h-5 w-5 place-items-center rounded-md bg-white/15 text-white">
              <Plus className="h-3.5 w-3.5 text-white" strokeWidth={2.6} />
            </span>
            New application
          </Link>
        }
      />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap rounded-xl bg-white p-1 ring-1 ring-slate-200">
          {filters.map((item) => (
            <button
              key={item.value}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filter === item.value ? "bg-emerald-50 text-emerald-800" : "text-slate-500 hover:text-slate-800"
              }`}
              onClick={() => {
                void filterApps(item.value);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">{loading ? "Loading..." : `${apps.length} applications`}</p>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <div className={`${panel} overflow-x-auto`}>
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead className="bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-5 py-3">Application</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Repository</th>
              <th className="px-5 py-3">Branch</th>
              <th className="px-5 py-3">Created</th>
              <th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                  Loading applications...
                </td>
              </tr>
            ) : apps.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState title="No applications yet" message="Start by deploying a repository." />
                </td>
              </tr>
            ) : (
              apps.map((app) => (
                <tr key={app.id} className="transition hover:bg-slate-50/80">
                  <td className="px-5 py-4">
                    <Link
                      className="font-semibold text-slate-800 underline decoration-slate-300 underline-offset-2 hover:text-emerald-700"
                      title={app.name}
                      to={`/applications/${app.id}`}
                    >
                      {app.name.length > 9 ? `${app.name.slice(0, 9)}...` : app.name}
                    </Link>
                  </td>
                  <td className="px-5 py-4">
                    <Status status={app.status} deployed={app.isDeployed} />
                  </td>
                  <td className="max-w-52 px-5 py-4">
                    <RepoLink className="block truncate" repository={app.repository} />
                  </td>
                  <td className="px-5 py-4 text-slate-500">{app.branch}</td>
                  <td className="px-5 py-4 text-slate-500">{formatDate(app.createdAt)}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Link className={`${actionButton} border-slate-200 bg-white text-slate-600 hover:bg-slate-50`} to={`/applications/${app.id}?edit=1`}>
                        Edit
                      </Link>
                      <button
                        className={`${actionButton} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
                        onClick={() => {
                          void toggleDeployment(app);
                        }}
                      >
                        {app.status === "running" ? "Stop" : "Deploy"}
                      </button>
                      <button
                        className={`${actionButton} border-red-200 bg-red-50 text-red-700 hover:bg-red-100`}
                        onClick={() => setDeleteTarget(app)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {deleteTarget && (
        <ConfirmDialog
          title={`Delete ${deleteTarget.name}?`}
          message="This permanently deletes the application and its environment variables. This action cannot be undone."
          confirmLabel="Delete application"
          busy={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            void removeApplication();
          }}
        />
      )}
    </>
  );
}
