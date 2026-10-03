import { useState } from "react";
import { GitBranch, Github, Plus } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { backendApi, getApiError } from "../lib/api";
import { parseEnvironmentText } from "../lib/env";
import { PrimaryButton, SecondaryButton, VisibilityToggle, field, panel } from "./shared";
import type { ApplicationForm } from "./types";

function AddLogo() {
  return (
    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-400 text-white shadow-sm shadow-emerald-400/25">
      <Plus className="h-6 w-6 text-white" strokeWidth={2.6} />
    </span>
  );
}

export default function NewApplication() {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ApplicationForm>({
    defaultValues: { branch: "main", environmentVariables: [] },
  });
  const { fields, append, remove, replace } = useFieldArray({ control, name: "environmentVariables" });
  const [error, setError] = useState("");
  const [envText, setEnvText] = useState("");
  const [visibleValues, setVisibleValues] = useState<Set<string>>(new Set());

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

  const submit = async (data: ApplicationForm) => {
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
      await backendApi.apps.create({ ...data, environmentVariables });
      setEnvText("");
      window.location.href = "/applications";
    } catch (requestError: unknown) {
      setError(getApiError(requestError, "Unable to create application"));
    }
  };

  return (
    <>
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-4">
          <AddLogo />
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-700">New application</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Add application</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
              Connect a GitHub repository and CloudForge will handle the deployment.
            </p>
          </div>
        </div>
      </div>

      <form className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)]" onSubmit={handleSubmit(submit)}>
        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 lg:col-span-2">{error}</p>
        )}

        <section className={`${panel} overflow-hidden`}>
          <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-6 py-5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500 text-white">
              <Plus className="h-4 w-4 text-white" strokeWidth={2.5} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Application details</h2>
              <p className="text-xs text-slate-400">Name, repository, and branch</p>
            </div>
          </div>
          <div className="grid gap-5 p-6 sm:p-8">
            <label className="grid gap-2 text-sm font-semibold text-slate-600">
              Application name
              <input
                className={field}
                placeholder="my-api"
                maxLength={20}
                {...register("name", { required: "Application name is required", maxLength: "Application name cannot exceed 20 characters" })}
              />
              {errors.name && <span className="text-xs text-red-600">{errors.name.message}</span>}
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-600">
              GitHub repository
              <div className="relative">
                <Github className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className={`${field} pl-10`}
                  placeholder="https://github.com/user/my-api"
                  {...register("repository", {
                    required: "Repository is required",
                    pattern: {
                      value: /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/,
                      message: "Enter a valid GitHub URL",
                    },
                  })}
                />
              </div>
              {errors.repository && <span className="text-xs text-red-600">{errors.repository.message}</span>}
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-600">
              Branch
              <div className="relative">
                <GitBranch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input className={`${field} pl-10`} {...register("branch", { required: "Branch is required" })} />
              </div>
              {errors.branch && <span className="text-xs text-red-600">{errors.branch.message}</span>}
            </label>
          </div>
        </section>

        <section className={`${panel} overflow-hidden`}>
          <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-6 py-5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-slate-500 ring-1 ring-slate-200">
              <span className="text-[11px] font-bold">.env</span>
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Environment variables</h2>
              <p className="text-xs text-slate-400">Used during deployment for this application</p>
            </div>
          </div>
          <div className="grid min-w-0 gap-3 p-6 sm:p-8">
            <textarea
              className={`${field} min-h-28 resize-y font-mono text-sm`}
              placeholder={'Paste your .env file here\nDATABASE_URL=...\nAPI_KEY="..."'}
              value={envText}
              onChange={(event) => setEnvText(event.target.value)}
            />
            <div>
              <SecondaryButton onClick={importEnvironmentFile}>Import .env values</SecondaryButton>
            </div>
            {fields.map((fieldItem, index) => (
              <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" key={fieldItem.id}>
                <input
                  className={field}
                  placeholder="KEY"
                  {...register(`environmentVariables.${index}.key`, {
                    pattern: { value: /^[A-Za-z_][A-Za-z0-9_]*$/, message: "Use letters, numbers, and underscores" },
                  })}
                />
                <div className="flex min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-500/10">
                  <input
                    className="w-full min-w-0 flex-1 bg-transparent px-3.5 py-2.5 font-normal outline-none"
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
                {errors.environmentVariables?.[index]?.key && (
                  <span className="text-xs text-red-600 sm:col-span-2">{errors.environmentVariables[index]?.key?.message}</span>
                )}
              </div>
            ))}
            <div>
              <SecondaryButton onClick={() => append({ key: "", value: "" })}>
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                Add variable
              </SecondaryButton>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-2 lg:col-span-2">
          <Link to="/applications">
            <SecondaryButton>Cancel</SecondaryButton>
          </Link>
          <PrimaryButton type="submit" disabled={isSubmitting}>
            <Plus className="h-4 w-4 text-white" strokeWidth={2.5} />
            {isSubmitting ? "Deploying..." : "Add application"}
          </PrimaryButton>
        </div>
      </form>
    </>
  );
}
