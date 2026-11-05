import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { backendApi, getApiError } from "../lib/api";
import { parseEnvironmentText } from "../lib/env";
import { Header, PrimaryButton, RepoLink, SecondaryButton, Status, VisibilityToggle, field, formatDate, panel } from "./shared";
import type { AppRecord, ApplicationForm } from "./types";

export default function ApplicationDetails({ onAppChange }: { onAppChange: (app: AppRecord) => void }) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [app, setApp] = useState<AppRecord | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(searchParams.get("edit") === "1");
  const [envText, setEnvText] = useState("");
  const [visibleValues, setVisibleValues] = useState<Set<string>>(new Set());
  const [logs, setLogs] = useState("");
  const [logsError, setLogsError] = useState("");
  const [loadingLogs, setLoadingLogs] = useState(false);
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<ApplicationForm>({
    defaultValues: { name: "", repository: "", branch: "", environmentVariables: [] },
  });
  const { fields, append, remove, replace } = useFieldArray({ control, name: "environmentVariables" });

  useEffect(() => {
    if (!id) return;
    backendApi.apps
      .get(Number(id))
      .then(({ data }) => {
        setApp(data.app);
        reset({
          name: data.app.name,
          repository: data.app.repository,
          branch: data.app.branch,
          environmentVariables: data.app.environmentVariables,
        });
      })
      .catch((requestError: unknown) => setError(getApiError(requestError, "Unable to load application")));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const events = new EventSource(`/api/apps/${id}/events`);
    events.addEventListener("deployment", (event) => {
      const updatedApp = JSON.parse((event as MessageEvent).data) as AppRecord;
      setApp(updatedApp);
      onAppChange(updatedApp);
    });
    events.onerror = () => {
      // EventSource automatically reconnects; no polling is needed.
    };
    return () => events.close();
  }, [id, onAppChange]);

  function importEnvironmentFile() {
    const result = parseEnvironmentText(envText);
    if (result.variables === null) {
      setError(result.error);
      return;
    }
    replace(result.variables);
    setVisibleValues(new Set());
    setError("");
  }

  async function saveApplication(data: ApplicationForm) {
    setError("");
    let environmentVariables = data.environmentVariables;
    if (envText.trim()) {
      const result = parseEnvironmentText(envText);
      if (result.variables === null) {
        setError(`${result.error}. The application cannot be saved.`);
        return;
      }

      environmentVariables = result.variables;
    }

    try {
      const { data: response } = await backendApi.apps.update(Number(id), { ...data, environmentVariables, status: "deploying" });
      setApp(response.app);
      onAppChange(response.app);
      setEnvText("");
      reset({
        name: response.app.name,
        repository: response.app.repository,
        branch: response.app.branch,
        environmentVariables: response.app.environmentVariables,
      });
      setEditing(false);
    } catch (requestError: unknown) {
      setError(getApiError(requestError, "Unable to update application"));
    }
  }

  async function inspectLogs() {
    setLoadingLogs(true);
    setLogsError("");
    try {
      const { data } = await backendApi.apps.logs(Number(id));
      setLogs(data.logs || "No application logs yet.");
    } catch (requestError: unknown) {
      setLogsError(getApiError(requestError, "Unable to read application logs"));
    } finally {
      setLoadingLogs(false);
    }
  }

  if (error && !app) {
    return <p className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</p>;
  }
  if (!app) {
    return <p className="text-sm text-slate-500">Loading application...</p>;
  }

  return (
    <>
      <Header
        title={app.name}
        underlineTitle
        subtitle="Application details and environment configuration."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="inline-flex h-10 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/20"
              onClick={() => {
                setEditing(!editing);
                setError("");
              }}
            >
              {editing ? "Cancel edit" : "Edit application"}
            </button>
            <Link
              className="inline-flex h-10 items-center justify-center rounded-xl border border-[#253047] bg-[#111827] px-3 text-sm font-semibold text-slate-300 transition hover:border-indigo-400 hover:bg-[#172033]"
              to="/applications"
            >
              Back to applications
            </Link>
          </div>
        }
      />
      {editing ? (
        <form className={`${panel} grid max-w-2xl gap-4 overflow-hidden p-6 sm:p-8`} onSubmit={handleSubmit(saveApplication)}>
          <label className="grid gap-2 text-sm font-semibold text-slate-300">
            Application name
            <input
              className={field}
              maxLength={20}
              {...register("name", {
                required: "Application name is required",
                maxLength: {
                  value: 20,
                  message: "Application name cannot exceed 20 characters",
                },
              })}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-300">
            Repository
            <input className={field} {...register("repository", { required: true })} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-300">
            Branch
            <input className={field} {...register("branch", { required: true })} />
          </label>
          <fieldset className="grid min-w-0 gap-3 border-t border-[#253047] pt-4">
            <legend className="text-sm font-semibold text-slate-300">Environment variables</legend>
            <textarea
              className={`${field} min-h-24 font-mono text-sm`}
              placeholder="Paste .env values to replace the list"
              value={envText}
              onChange={(event) => setEnvText(event.target.value)}
            />
            <div>
              <SecondaryButton onClick={importEnvironmentFile}>Import .env values</SecondaryButton>
            </div>
            {fields.map((fieldItem, index) => (
              <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" key={fieldItem.id}>
                <input className={field} placeholder="KEY" {...register(`environmentVariables.${index}.key`, { required: true })} />
                <div className="flex min-w-0 overflow-hidden rounded-xl border border-[#253047] bg-[#0d1320] focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-500/10">
                  <input
                    className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 font-normal text-slate-100 outline-none placeholder:text-slate-500"
                    type={visibleValues.has(fieldItem.id) ? "text" : "password"}
                    placeholder="Value"
                    {...register(`environmentVariables.${index}.value`)}
                  />
                  <VisibilityToggle
                    visible={visibleValues.has(fieldItem.id)}
                    onClick={() =>
                      setVisibleValues((current) => {
                        const next = new Set(current);
                        if (next.has(fieldItem.id)) next.delete(fieldItem.id);
                        else next.add(fieldItem.id);
                        return next;
                      })
                    }
                  />
                </div>
                <SecondaryButton onClick={() => remove(index)}>Remove</SecondaryButton>
              </div>
            ))}
            <div>
              <SecondaryButton onClick={() => append({ key: "", value: "" })}>+ Add variable</SecondaryButton>
            </div>
          </fieldset>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-[#253047] pt-4">
            <SecondaryButton onClick={() => setEditing(false)}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving and redeploying..." : "Save changes and redeploy"}
            </PrimaryButton>
          </div>
        </form>
      ) : (
        <section className={`${panel} grid min-w-0 max-w-2xl gap-6 overflow-hidden p-6 sm:p-8`}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</p>
            <div className="mt-2">
              <Status status={app.status} deployed={app.isDeployed} />
            </div>
          </div>
          <div className="rounded-2xl border border-[#253047] bg-[#0d1320] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Deployment progress</p>
            <div className="mt-5 overflow-x-auto pb-2">
              <div className="flex min-w-[560px] items-start">
                {["cloned", "built", "pushed", "k8s-applied", "deployed"].map((stage, index, stages) => {
                  const reached = app.deploymentStage === "deployed"
                    || index <= stages.indexOf(app.deploymentStage ?? "");
                  return (
                    <div className="flex min-w-0 flex-1 items-start" key={stage}>
                      <div className="flex min-w-0 flex-1 flex-col items-center gap-2.5 text-center">
                        <span
                          className={`grid h-11 w-11 place-items-center rounded-full border-2 text-lg font-bold ${
                            reached
                              ? "border-emerald-300 bg-emerald-400/20 text-emerald-200"
                              : "border-red-400/70 bg-red-400/10 text-red-300"
                          }`}
                          aria-label={`${stage}: ${reached ? "completed" : "not completed"}`}
                        >
                          {reached ? "✓" : "×"}
                        </span>
                        <span className={`text-xs font-semibold ${reached ? "text-emerald-200" : "text-red-300"}`}>
                          {stage}
                        </span>
                      </div>
                      {index < stages.length - 1 && (
                        <span className={`mt-[22px] h-0.5 flex-1 ${reached ? "bg-emerald-400/70" : "bg-[#3a465e]"}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-4 min-w-0 max-w-full overflow-hidden rounded-xl bg-slate-950 p-4 font-mono text-xs leading-6 text-emerald-200">
              <p className="break-all">$ cloudforge deploy {app.name}</p>
              {[
                ["cloned", "Repository cloned successfully."],
                ["built", "Container image built successfully."],
                ["pushed", "Image pushed to Docker Hub."],
                ["k8s-applied", "Kubernetes manifests applied."],
                ["deployed", "Application is live and ready."],
              ].map(([stage, message]) => {
                const stageIndex = ["cloned", "built", "pushed", "k8s-applied", "deployed"].indexOf(stage);
                const currentIndex = ["cloned", "built", "pushed", "k8s-applied", "deployed"].indexOf(app.deploymentStage ?? "");
                return stageIndex <= currentIndex ? <p key={stage}>✓ {message}</p> : null;
              })}
              {app.status === "deploying" && <p className="text-amber-300">… {app.deploymentMessage ?? "Deployment in progress."}</p>}
              {app.status === "failed" && <p className="text-red-300">✕ {app.deploymentMessage ?? "Deployment failed."}</p>}
            </div>
            {app.deploymentError && <p className="mt-3 text-sm text-red-300">{app.deploymentError}</p>}
            {app.deploymentMessage && <p className="mt-3 text-sm text-slate-300">{app.deploymentMessage}</p>}
            {app.deploymentUrl && (() => {
              let address = app.deploymentUrl;
              try {
                address = new URL(app.deploymentUrl).host;
              } catch {
                // Preserve older deployment records with a non-standard URL.
              }
              return (
                <div className="mt-4 min-w-0 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Application address</p>
                  <p className="mt-2 break-all font-mono text-sm text-slate-100">{address}</p>
                  <a className="mt-3 inline-flex max-w-full truncate text-sm font-semibold text-emerald-300 underline" href={app.deploymentUrl} target="_blank" rel="noreferrer">
                    Open live application
                  </a>
                </div>
              );
            })()}
            {app.deploymentImage && <p className="mt-3 break-all font-mono text-xs text-slate-500">{app.deploymentImage}</p>}
            <button
              className="mt-4 inline-flex min-h-9 items-center rounded-lg border border-[#253047] bg-[#111827] px-3 text-xs font-semibold text-slate-300 transition hover:border-indigo-400 hover:bg-[#172033] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!app.isDeployed || loadingLogs}
              onClick={() => void inspectLogs()}
            >
              {loadingLogs ? "Reading logs..." : "Inspect application logs"}
            </button>
            {logsError && <p className="mt-3 text-sm text-red-300">{logsError}</p>}
            {logs && (
              <pre className="mt-3 max-h-80 max-w-full overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-4 text-xs leading-5 text-emerald-100">
                {logs}
              </pre>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Repository</p>
            <p className="mt-1 break-all text-sm">
              <RepoLink repository={app.repository} />
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Branch</p>
            <p className="mt-1 text-sm text-slate-300">{app.branch}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Created</p>
            <p className="mt-1 text-sm text-slate-300">{formatDate(app.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Environment variables</p>
            {app.environmentVariables.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">None configured</p>
            ) : (
              <div className="mt-3 grid gap-2">
                {app.environmentVariables.map((variable) => {
                  const detailKey = `detail:${variable.id ?? variable.key}`;
                  const isVisible = visibleValues.has(detailKey);
                  return (
                    <div className="flex items-center justify-between gap-4 rounded-xl bg-[#0d1320] px-3 py-2.5 text-sm" key={variable.id ?? variable.key}>
                      <span className="font-medium text-slate-300">{variable.key}</span>
                      <span className="flex items-center gap-3">
                        <span className="break-all text-slate-500">{isVisible ? variable.value : "••••••••"}</span>
                        <VisibilityToggle
                          visible={isVisible}
                          onClick={() =>
                            setVisibleValues((current) => {
                              const next = new Set(current);
                              if (next.has(detailKey)) next.delete(detailKey);
                              else next.add(detailKey);
                              return next;
                            })
                          }
                        />
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
