"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function StaffLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const next = searchParams.get("next") || "/staff/check-in";

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setError(payload.error || "Unable to login");
        return;
      }

      router.push(next);
      router.refresh();
    } catch {
      setError("Login failed unexpectedly");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Staff Login</h1>
        <p className="mt-1 text-sm text-slate-600">Sign in to access protected event check-in tools.</p>

        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="username" className="mb-1 block text-sm font-medium text-slate-700">
              Username (optional)
            </label>
            <input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500"
              placeholder="staff"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500"
              required
            />
          </div>

          {error ? <p className="text-sm text-red-700">{error}</p> : null}

          <button
            type="submit"
            disabled={loading || password.length < 1}
            className="w-full rounded-lg bg-cyan-700 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
