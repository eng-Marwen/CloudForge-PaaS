import type { ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { DeploymentStatus } from "./types";

export const panel =
  "rounded-xl border border-[#253047] bg-[#111827] shadow-[0_12px_30px_rgba(0,0,0,0.12)]";
export const field =
  "w-full min-w-0 rounded-lg border border-[#253047] bg-[#0d1320] px-3.5 py-2.5 font-normal text-slate-100 outline-none transition duration-200 placeholder:text-slate-500 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10";
const button =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition duration-200";

export function VisibilityToggle({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="grid shrink-0 place-items-center px-3 text-slate-500 transition hover:text-slate-200"
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
      className={`text-slate-400 underline decoration-slate-600 underline-offset-2 transition hover:text-indigo-300 ${className}`}
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
        <h1 className={`text-3xl font-semibold tracking-tight text-slate-50 ${underlineTitle ? "underline decoration-slate-600 underline-offset-4" : ""}`}>
          {title}
        </h1>
        {subtitle && <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">{subtitle}</p>}
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
      className={`${button} border-indigo-500 bg-indigo-500 text-white shadow-sm shadow-indigo-500/20 hover:bg-indigo-400`}
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
      className={`${button} border-[#253047] bg-[#111827] text-slate-300 hover:border-indigo-400 hover:bg-[#172033]`}
    >
      {children}
    </button>
  );
}

export function Status({ status, deployed }: { status?: DeploymentStatus; deployed?: boolean }) {
  const currentStatus = status ?? (deployed ? "running" : "failed");
  const statusStyles = {
    deploying: "bg-amber-400/10 text-amber-300 ring-amber-400/30",
    running: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30",
    failed: "bg-red-400/10 text-red-300 ring-red-400/30",
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#050811]/75 p-5 backdrop-blur-sm">
      <div className={`dialog-enter ${panel} w-full max-w-md p-6 shadow-2xl`}>
        <p className="text-xs font-bold uppercase tracking-[.16em] text-red-300">Confirm action</p>
        <h2 className="mt-3 text-xl font-semibold text-slate-100">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
          <button
            className="inline-flex min-h-10 items-center rounded-xl border border-red-400/30 bg-red-500 px-4 text-sm font-semibold text-white transition hover:bg-red-400 disabled:opacity-65"
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
