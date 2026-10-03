import { useState } from "react";
import { backendApi, getApiError } from "../lib/api";
import { field, VisibilityToggle } from "./shared";
import type { User } from "./types";

export default function Auth({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [registering, setRegistering] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const passwordsMatch = registering && confirmPassword.length > 0 && password === confirmPassword;
  const passwordsDoNotMatch = registering && confirmPassword.length > 0 && password !== confirmPassword;

  function switchAuthMode() {
    setRegistering(!registering);
    setUsername("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setPhoneNumber("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (registering && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      const response = registering
        ? await backendApi.auth.register({ username, email, password, confirmPassword, phoneNumber: phoneNumber || undefined })
        : await backendApi.auth.login({ email, password });
      onAuthenticated(response.data.user);
    } catch (requestError: unknown) {
      setError(getApiError(requestError, "Unable to authenticate"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <div className="page-enter mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-6xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.08)] lg:grid-cols-[1.05fr_.95fr]">
        <section className="relative overflow-hidden bg-slate-900 px-7 py-8 text-white sm:px-12 sm:py-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(52,211,153,0.22),transparent_45%)]" />
          <div className="relative flex h-full flex-col">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-400 text-xs font-bold text-slate-900">CF</span>
              <span className="text-lg font-semibold tracking-tight">CloudForge</span>
            </div>
            <div className="mt-20 max-w-lg sm:mt-auto sm:mb-auto sm:pt-20">
              <p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-300">Deploy with clarity</p>
              <h2 className="mt-5 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Your app, running in a few minutes.</h2>
              <p className="mt-5 max-w-md text-sm leading-7 text-slate-300">
                Connect a repository, add your environment variables, and keep every deployment in one calm workspace.
              </p>
              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                <div className="border-t border-slate-700 pt-3">
                  <strong className="block text-sm">01</strong>
                  <span className="mt-1 block text-xs text-slate-400">Connect code</span>
                </div>
                <div className="border-t border-slate-700 pt-3">
                  <strong className="block text-sm">02</strong>
                  <span className="mt-1 block text-xs text-slate-400">Configure env</span>
                </div>
                <div className="border-t border-slate-700 pt-3">
                  <strong className="block text-sm">03</strong>
                  <span className="mt-1 block text-xs text-slate-400">Ship confidently</span>
                </div>
              </div>
            </div>
            <p className="mt-16 text-xs text-slate-500 sm:mt-auto">A focused control room for modern deployments.</p>
          </div>
        </section>
        <section className="flex items-center px-6 py-10 sm:px-12">
          <form autoComplete="off" className="mx-auto w-full max-w-md" onSubmit={submit}>
            <div className="mb-8">
              <p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-700">
                {registering ? "New workspace" : "CloudForge account"}
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
                {registering ? "Start building." : "Welcome back."}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {registering ? "Create your workspace and make the next deployment simple." : "Sign in to manage your applications."}
              </p>
            </div>
            {registering && (
              <label className="mb-4 grid gap-2 text-sm font-semibold text-slate-600">
                Username
                <input className={field} value={username} onChange={(event) => setUsername(event.target.value)} required />
              </label>
            )}
            {registering && (
              <label className="mb-4 grid gap-2 text-sm font-semibold text-slate-600">
                Phone number
                <span className="text-xs font-normal text-slate-400">Optional</span>
                <input className={field} type="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} />
              </label>
            )}
            <label className="mb-4 grid gap-2 text-sm font-semibold text-slate-600">
              Email
              <input className={field} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label className="mb-4 grid gap-2 text-sm font-semibold text-slate-600">
              Password
              <div className="flex overflow-hidden rounded-xl border border-slate-200 focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-500/10">
                <input
                  autoComplete="off"
                  className="min-w-0 flex-1 px-3.5 py-2.5 font-normal outline-none"
                  type={showPassword ? "text" : "password"}
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <VisibilityToggle visible={showPassword} onClick={() => setShowPassword(!showPassword)} />
              </div>
            </label>
            {registering && (
              <label className="mb-4 grid gap-2 text-sm font-semibold text-slate-600">
                Confirm password
                <div
                  className={`flex overflow-hidden rounded-xl border focus-within:ring-4 ${
                    passwordsDoNotMatch
                      ? "border-red-300 focus-within:ring-red-500/10"
                      : passwordsMatch
                        ? "border-emerald-400 focus-within:ring-emerald-500/10"
                        : "border-slate-200 focus-within:border-emerald-400 focus-within:ring-emerald-500/10"
                  }`}
                >
                  <input
                    autoComplete="off"
                    className="min-w-0 flex-1 px-3.5 py-2.5 font-normal outline-none"
                    type={showConfirmPassword ? "text" : "password"}
                    minLength={8}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                  />
                  <VisibilityToggle visible={showConfirmPassword} onClick={() => setShowConfirmPassword(!showConfirmPassword)} />
                </div>
                {passwordsMatch && <span className="text-xs font-medium text-emerald-600">Passwords match</span>}
                {passwordsDoNotMatch && <span className="text-xs font-medium text-red-600">Passwords do not match</span>}
              </label>
            )}
            {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
            <button
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700"
              disabled={submitting}
            >
              {submitting ? "Please wait..." : registering ? "Create account" : "Sign in"}
            </button>
            <button type="button" className="mt-5 w-full text-sm text-slate-500 transition hover:text-slate-800" onClick={switchAuthMode}>
              {registering ? "Already have an account? Sign in" : "Need an account? Register"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
