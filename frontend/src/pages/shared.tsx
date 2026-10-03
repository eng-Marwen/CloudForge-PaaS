import type { ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { DeploymentStatus } from "./types";

export const panel =
  "rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
export const field =
  "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-normal text-slate-800 outline-none transition duration-200 placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10";
const button =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition duration-200";

export function VisibilityToggle({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="grid shrink-0 place-items-center px-3 text-slate-400 transition hover:text-slate-700"
      onClick={onClick}
      aria-label={visible ? "Hide value" : "Show value"}
    >
      {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
    </button>
  );
}

export const formatDate = (date: string) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));

export function RepoLink({ repository, className = "" }: { repository: string; className?: string }) {
  const href = /^https?:\/\//i.test(repository) ? repository : `https://${repository}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`text-slate-500 underline decoration-slate-300 underline-offset-2 transition hover:text-slate-700 ${className}`}
      title={repository}
    >
      {repository}
    </a>
  );
}

export function Header({
  title,
  subtitle,
  action,
  underlineTitle = false,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  underlineTitle?: boolean;
}) {
  return (
    <div className="mb-8 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
      <div>
        <h1 className={`text-3xl font-semibold tracking-tight text-slate-900 ${underlineTitle ? "underline decoration-slate-300 underline-offset-4" : ""}`}>
          {title}
        </h1>
        {subtitle && <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  type = "button",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${button} border-emerald-600 bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-700`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`${button} border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50`}
    >
      {children}
    </button>
  );
}

export function Status({ status, deployed }: { status?: DeploymentStatus; deployed?: boolean }) {
  const currentStatus = status ?? (deployed ? "running" : "failed");
  const statusStyles = {
    deploying: "bg-amber-50 text-amber-800 ring-amber-200",
    running: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    failed: "bg-red-50 text-red-700 ring-red-200",
  } as const;
  const dotStyles = {
    deploying: "bg-amber-500",
    running: "bg-emerald-500",
    failed: "bg-red-500",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusStyles[currentStatus]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotStyles[currentStatus]}`} />
      {currentStatus[0].toUpperCase() + currentStatus.slice(1)}
    </span>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-5 backdrop-blur-sm">
      <div className={`dialog-enter ${panel} w-full max-w-md p-6 shadow-2xl`}>
        <p className="text-xs font-bold uppercase tracking-[.16em] text-red-600">Confirm action</p>
        <h2 className="mt-3 text-xl font-semibold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
          <button
            className="inline-flex min-h-10 items-center rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-65"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Please wait..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-400">{message}</p>
    </div>
  );
}
