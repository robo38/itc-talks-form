import Link from "next/link";

import { db } from "@/lib/db";

const PER_PAGE_OPTIONS = [20, 50, 100] as const;

type PerPageOption = (typeof PER_PAGE_OPTIONS)[number];

interface StaffUsersPageProps {
  searchParams: Promise<{
    q?: string | string[];
    page?: string | string[];
    perPage?: string | string[];
  }>;
}

function readFirstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function parsePositiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function parsePerPage(value: string): PerPageOption {
  const parsed = Number.parseInt(value, 10);
  if (PER_PAGE_OPTIONS.includes(parsed as PerPageOption)) {
    return parsed as PerPageOption;
  }

  return 20;
}

function buildHref(page: number, perPage: number, query: string): string {
  const params = new URLSearchParams();

  if (query.trim()) {
    params.set("q", query.trim());
  }

  if (perPage !== 20) {
    params.set("perPage", String(perPage));
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const queryString = params.toString();
  return queryString ? `/staff/users?${queryString}` : "/staff/users";
}

function formatDate(value: Date | null): string {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

export const runtime = "nodejs";

export default async function StaffUsersPage({ searchParams }: StaffUsersPageProps) {
  const params = await searchParams;
  const q = readFirstParam(params.q).trim();
  const perPage = parsePerPage(readFirstParam(params.perPage));
  const requestedPage = parsePositiveInt(readFirstParam(params.page), 1);

  const where = q ? { search: q } : undefined;
  const totalUsers = await db.registration.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalUsers / perPage));
  const page = Math.min(requestedPage, totalPages);
  const skip = (page - 1) * perPage;

  const rows = await db.registration.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take: perPage,
  });

  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const startIndex = totalUsers > 0 ? skip + 1 : 0;
  const endIndex = totalUsers > 0 ? Math.min(skip + rows.length, totalUsers) : 0;

  return (
    <main className="min-h-screen bg-slate-100 py-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 md:px-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Registered Users</h1>
              <p className="mt-1 text-sm text-slate-600">Full attendee information with check-in status.</p>
            </div>
            <Link href="/staff/check-in" className="rounded-lg border border-cyan-700 px-3 py-2 text-sm font-semibold text-cyan-700 hover:bg-cyan-50">
              Back to Check-In
            </Link>
          </div>

          <form method="GET" className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
            <div>
              <label htmlFor="q" className="mb-1 block text-sm font-medium text-slate-700">
                Search
              </label>
              <input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Name, email, phone, registration ID, token"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label htmlFor="perPage" className="mb-1 block text-sm font-medium text-slate-700">
                Show per page
              </label>
              <select
                id="perPage"
                name="perPage"
                defaultValue={String(perPage)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500"
              >
                {PER_PAGE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800">
              Apply
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              Showing {startIndex} - {endIndex} of {totalUsers}
            </p>
            <div className="flex items-center gap-2">
              {hasPrev ? (
                <Link
                  href={buildHref(page - 1, perPage, q)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  ← Prev
                </Link>
              ) : (
                <span className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-400">← Prev</span>
              )}

              <span className="px-2 text-sm text-slate-600">
                Page {page} / {totalPages}
              </span>

              {hasNext ? (
                <Link
                  href={buildHref(page + 1, perPage, q)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Next →
                </Link>
              ) : (
                <span className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-400">Next →</span>
              )}
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Phone</th>
                  <th className="py-2 pr-4">Registration ID</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Checked In At</th>
                  <th className="py-2 pr-4">Checked In By</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((user) => {
                  const isChecked = user.checkInStatus === "checked_in";

                  return (
                    <tr key={user.id} className="border-t border-slate-100 align-top">
                      <td className="py-3 pr-4 text-slate-800">
                        <p className="font-semibold">{user.fullName}</p>
                        <p className="mt-1 text-xs text-slate-500">ID: {user.id}</p>
                        <details className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2">
                          <summary className="cursor-pointer text-xs font-semibold text-slate-700">Show full data</summary>
                          <div className="mt-2 space-y-2 text-xs text-slate-700">
                            <div>
                              <p className="font-semibold">Ticket token</p>
                              <p className="break-all">{user.ticketToken}</p>
                            </div>
                            <div>
                              <p className="font-semibold">QR value</p>
                              <p className="break-all">{user.qrValue}</p>
                            </div>
                            <div>
                              <p className="font-semibold">Created</p>
                              <p>{formatDate(user.createdAt)}</p>
                            </div>
                            <div>
                              <p className="font-semibold">Updated</p>
                              <p>{formatDate(user.updatedAt)}</p>
                            </div>
                            <div>
                              <p className="font-semibold">Custom Fields</p>
                              <pre className="overflow-x-auto rounded bg-slate-100 p-2 text-[11px]">{JSON.stringify(user.customFields, null, 2)}</pre>
                            </div>
                            <div>
                              <p className="font-semibold">Tripetto Metadata</p>
                              <pre className="overflow-x-auto rounded bg-slate-100 p-2 text-[11px]">{JSON.stringify(user.tripettoMetadata, null, 2)}</pre>
                            </div>
                            <div>
                              <p className="font-semibold">Raw Payload</p>
                              <pre className="overflow-x-auto rounded bg-slate-100 p-2 text-[11px]">{JSON.stringify(user.rawPayload, null, 2)}</pre>
                            </div>
                          </div>
                        </details>
                      </td>
                      <td className="py-3 pr-4 text-slate-700">{user.email}</td>
                      <td className="py-3 pr-4 text-slate-700">{user.phone || "-"}</td>
                      <td className="py-3 pr-4 text-slate-700">{user.registrationId}</td>
                      <td className="py-3 pr-4">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${isChecked ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                          {isChecked ? "Checked In" : "Not Checked"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-slate-700">{formatDate(user.checkedInAt)}</td>
                      <td className="py-3 pr-4 text-slate-700">{user.checkedInBy || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {rows.length === 0 ? (
            <p className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No users found for this filter.</p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
