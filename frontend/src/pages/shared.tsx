import type { ReactNode } from "react";

export const panel = "border border-slate-200 bg-white shadow-sm";
const button =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold";

export const formatDate = (date: string) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));

export function Header({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-800">
          {title}
        </h1>
        {subtitle && <p className="mt-2 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PrimaryButton({
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
      className={`${button} border-slate-700 bg-slate-700 text-white hover:bg-slate-800`}
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
      className={`${button} border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}
    >
      {children}
    </button>
  );
}

export function Status({ deployed }: { deployed: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 text-sm ${deployed ? "text-emerald-700" : "text-slate-500"}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${deployed ? "bg-emerald-500" : "bg-slate-400"}`}
      />
      {deployed ? "Running" : "Undeployed"}
    </span>
  );
}
