import { Header, SecondaryButton, panel } from "./shared";

export default function Settings() {
  return (
    <>
      <Header title="Settings" subtitle="Manage your CloudForge workspace." />
      <div className="grid max-w-3xl gap-4">
        <section className={`${panel} p-6`}>
          <h2 className="font-semibold text-slate-700">Profile</h2>
          <p className="mt-1 text-sm text-slate-400">
            Account details for this workspace.
          </p>
          <div className="mt-5 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-200 font-semibold text-slate-600">
              M
            </span>
            <div className="flex-1">
              <strong className="block text-sm text-slate-700">Marwen</strong>
              <span className="text-xs text-slate-400">
                Workspace administrator
              </span>
            </div>
            <SecondaryButton>Edit profile</SecondaryButton>
          </div>
        </section>
        <section className={`${panel} p-6`}>
          <h2 className="font-semibold text-slate-700">Account settings</h2>
          <p className="mt-1 text-sm text-slate-400">
            Manage access and session preferences.
          </p>
          <button className="mt-4 text-sm font-semibold text-slate-600 hover:text-slate-900">
            Sign out →
          </button>
        </section>
      </div>
    </>
  );
}
