import { useState } from "react";
import { backendApi, getApiError } from "../lib/api";
import { ConfirmDialog, Header, PrimaryButton, SecondaryButton, field, panel } from "./shared";
import type { User } from "./types";

export default function Settings({
  user,
  onLogout,
  onUserChange,
  onAccountDeleted,
}: {
  user: User;
  onLogout: () => void;
  onUserChange: (user: User) => void;
  onAccountDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(user.username);
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const initial = user.username.trim().charAt(0).toUpperCase();

  async function saveProfile() {
    setError("");
    setSaving(true);
    try {
      const { data } = await backendApi.auth.updateProfile({ username, phoneNumber: phoneNumber || null });
      onUserChange(data.user);
      setEditing(false);
    } catch (requestError: unknown) {
      setError(getApiError(requestError, "Unable to update profile"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    setError("");
    try {
      await backendApi.auth.deleteAccount();
      onAccountDeleted();
    } catch (requestError: unknown) {
      setError(getApiError(requestError, "Unable to delete account"));
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="mb-8 flex items-start gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-400/20">
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7h16M4 17h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            <circle cx="9" cy="7" r="2" fill="#6366F1" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="15" cy="17" r="2" fill="#6366F1" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-300">Control plane</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-50">Workspace settings</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Manage your CloudForge identity and deployment workspace.</p>
        </div>
      </div>
      <div className="grid max-w-3xl gap-4">
        <section className={`${panel} p-6 sm:p-8`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.14em] text-slate-400">Identity</p>
              <h2 className="mt-1 font-semibold text-slate-100">Profile</h2>
              <p className="mt-1 text-sm text-slate-400">Account details for this workspace.</p>
            </div>
            <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-[11px] font-semibold text-indigo-300 ring-1 ring-indigo-400/20">
              Workspace member
            </span>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-indigo-500/15 font-semibold text-indigo-300">
              {initial}
            </span>
            <div className="flex-1">
              <strong className="block text-sm text-slate-100">{user.username}</strong>
              <span className="block text-xs text-slate-400">{user.email}</span>
              <span className="text-xs text-slate-400">{user.phoneNumber || "No phone number"}</span>
            </div>
            <SecondaryButton
              onClick={() => {
                setEditing(!editing);
                setError("");
              }}
            >
              {editing ? "Close" : "Edit profile"}
            </SecondaryButton>
          </div>
          {editing && (
            <div className="mt-5 grid gap-4 border-t border-[#253047] pt-5">
              <label className="grid gap-2 text-sm font-semibold text-slate-300">
                Username
                <input className={field} value={username} onChange={(event) => setUsername(event.target.value)} />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-300">
                Phone number
                <input className={field} type="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} />
              </label>
              {error && <p className="text-sm text-red-300">{error}</p>}
              <div className="flex justify-end gap-2">
                <SecondaryButton onClick={() => setEditing(false)}>Cancel</SecondaryButton>
                <PrimaryButton
                  onClick={() => {
                    void saveProfile();
                  }}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save changes"}
                </PrimaryButton>
              </div>
            </div>
          )}
        </section>
        <section className={`${panel} p-6 sm:p-8`}>
          <p className="text-xs font-bold uppercase tracking-[.14em] text-slate-400">Access</p>
          <h2 className="mt-1 font-semibold text-slate-100">Account settings</h2>
          <p className="mt-1 text-sm text-slate-400">Manage access and session preferences.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <SecondaryButton onClick={() => setConfirmLogout(true)}>Sign out</SecondaryButton>
            <button
              className="inline-flex min-h-10 items-center rounded-xl border border-red-400/30 bg-red-400/10 px-4 text-sm font-semibold text-red-300 transition hover:bg-red-400/20"
              onClick={() => setConfirmDelete(true)}
            >
              Delete account
            </button>
          </div>
          {error && !editing && <p className="mt-4 text-sm text-red-300">{error}</p>}
        </section>
      </div>
      {confirmDelete && (
        <ConfirmDialog
          title="Delete your account?"
          message="This permanently deletes your account, applications, and environment variables. This action cannot be undone."
          confirmLabel="Delete account"
          busy={deleting}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            void deleteAccount();
          }}
        />
      )}
      {confirmLogout && (
        <ConfirmDialog
          title="Sign out of CloudForge?"
          message="Your session will end on this device. You can sign in again at any time."
          confirmLabel="Sign out"
          onCancel={() => setConfirmLogout(false)}
          onConfirm={() => {
            setConfirmLogout(false);
            onLogout();
          }}
        />
      )}
    </>
  );
}
