import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-10 md:px-8">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-cyan-700">Tripetto Event Registration</p>
          <h1 className="mt-3 text-4xl font-black leading-tight text-slate-900 md:text-5xl">
            Webhook-driven registrations with secure QR tickets and protected staff check-in
          </h1>
          <p className="mt-4 text-base text-slate-600 md:text-lg">
            This app receives Tripetto submissions, stores registrations, sends QR ticket emails, and gives event staff a secured mobile check-in workflow.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 md:max-w-xl">
          <Link href="/staff/login" className="rounded-xl bg-cyan-700 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-cyan-800">
            Staff Login
          </Link>
          <a href="/api/staff/summary" className="rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-100">
            API Health (requires auth)
          </a>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Integration Endpoints</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            <li>POST /api/tripetto-webhook</li>
            <li>POST /api/staff/check-in</li>
            <li>GET /api/registration/[token]</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
