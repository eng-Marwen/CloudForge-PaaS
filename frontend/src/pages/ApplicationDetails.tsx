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

  if (error && !app) {
    return <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>;
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
              className="inline-flex h-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
              onClick={() => {
                setEditing(!editing);
                setError("");
              }}
            >
              {editing ? "Cancel edit" : "Edit application"}
            </button>
            <Link
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              to="/applications"
            >
              Back to applications
            </Link>
          </div>
        }
      />
      {editing ? (
        <form className={`${panel} grid max-w-2xl gap-4 overflow-hidden p-6 sm:p-8`} onSubmit={handleSubmit(saveApplication)}>
          <label className="grid gap-2 text-sm font-semibold text-slate-600">
            Application name
            <input
              className={field}
              maxLength={20}
              {...register("name", { required: "Application name is required", maxLength: "Application name cannot exceed 20 characters" })}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-600">
            Repository
            <input className={field} {...register("repository", { required: true })} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-600">
            Branch
            <input className={field} {...register("branch", { required: true })} />
          </label>
          <fieldset className="grid min-w-0 gap-3 border-t border-slate-100 pt-4">
            <legend className="text-sm font-semibold text-slate-600">Environment variables</legend>
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
                <div className="flex min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-500/10">
                  <input
                    className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 font-normal outline-none"
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
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <SecondaryButton onClick={() => setEditing(false)}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving and redeploying..." : "Save changes and redeploy"}
            </PrimaryButton>
          </div>
        </form>
      ) : (
        <section className={`${panel} grid max-w-2xl gap-6 p-6 sm:p-8`}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</p>
            <div className="mt-2">
              <Status status={app.status} deployed={app.isDeployed} />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Repository</p>
            <p className="mt-1 break-all text-sm">
              <RepoLink repository={app.repository} />
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Branch</p>
            <p className="mt-1 text-sm text-slate-700">{app.branch}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Created</p>
            <p className="mt-1 text-sm text-slate-700">{formatDate(app.createdAt)}</p>
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
                    <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-3 py-2.5 text-sm" key={variable.id ?? variable.key}>
                      <span className="font-medium text-slate-700">{variable.key}</span>
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
