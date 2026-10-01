import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { Header, PrimaryButton, SecondaryButton, panel } from "./shared";
import type {ApplicationForm} from  "./types"

export default function NewApplication() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ApplicationForm>({
    defaultValues: { branch: "main" },
  });

  const submit = async (data: ApplicationForm) => {
    await api.post("/apps", data);
    window.location.href = "/applications";
  };
  return (
    <>
      <Header
        title="Deploy a new application"
        subtitle="Connect a GitHub repository and CloudForge will handle the deployment."
      />
      <form className={`${panel} grid max-w-2xl gap-5 p-6`} onSubmit={handleSubmit(submit)}>
        <label className="grid gap-2 text-sm font-semibold text-slate-600">
          Application name
          <input
            className="rounded-md border border-slate-200 px-3 py-2.5 font-normal"
            placeholder="my-api"
            {...register("name", { required: "Application name is required" })}
          />
          {errors.name && <span className="text-xs text-red-600">{errors.name.message}</span>}
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-600">
        GitHub repository
        <input
        className="rounded-md border border-slate-200 px-3 py-2.5 font-normal"
        placeholder="https://github.com/user/my-api"
        {...register("repository", {
            required: "Repository is required",
            pattern: {
            value: /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/,
            message: "Enter a valid GitHub URL",
            },
        })}
        />
          {errors.repository && <span className="text-xs text-red-600">{errors.repository.message}</span>}
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-600">
          Branch
          <input
            className="rounded-md border border-slate-200 px-3 py-2.5 font-normal"
            {...register("branch", { required: "Branch is required" })}
          />
          {errors.branch && <span className="text-xs text-red-600">{errors.branch.message}</span>}
        </label>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-5">
          <Link to="/applications">
            <SecondaryButton>Cancel</SecondaryButton>
          </Link>
          <PrimaryButton type="submit">{isSubmitting ? "Deploying..." : "Deploy application"}</PrimaryButton>
        </div>
      </form>
    </>
  );
}
