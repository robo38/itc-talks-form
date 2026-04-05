"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type CheckResult = {
  ok: boolean;
  status?: "checked_in" | "already_checked_in" | "registered" | "invalid";
  error?: string;
  attendee?: {
    fullName: string;
    email: string;
    registrationId: string;
    checkInStatus?: string;
    checkedInAt?: string | null;
    checkedInBy?: string | null;
  };
};

type SummaryResponse = {
  ok: boolean;
  totalRegistrations: number;
  checkedInCount: number;
  recent: Array<{
    id: string;
    fullName: string;
    registrationId: string;
    checkInStatus: string;
    checkedInAt: string | null;
  }>;
};

interface Props {
  initialToken: string;
}

export default function StaffCheckInClient({ initialToken }: Props) {
  const [token, setToken] = useState(initialToken);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);

  const statusBadge = useMemo(() => {
    if (!result) {
      return { label: "Registered", className: "bg-slate-100 text-slate-800" };
    }

    if (!result.ok || result.status === "invalid") {
      return { label: "Invalid", className: "bg-red-100 text-red-700" };
    }

    if (result.status === "checked_in" || result.status === "already_checked_in") {
      return { label: "Checked In", className: "bg-emerald-100 text-emerald-700" };
    }

    return { label: "Registered", className: "bg-slate-100 text-slate-800" };
  }, [result]);

  async function loadSummary(): Promise<void> {
    const response = await fetch("/api/staff/summary", { cache: "no-store" });
    if (response.ok) {
      const payload = (await response.json()) as SummaryResponse;
      setSummary(payload);
    }
  }

  useEffect(() => {
    loadSummary().catch(() => undefined);
  }, []);

  async function resolveToken(confirm: boolean): Promise<void> {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/staff/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, confirm }),
      });

      const data = (await response.json()) as CheckResult;
      setResult(data);
      await loadSummary();
    } catch {
      setResult({ ok: false, error: "Request failed. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  function stopScanner(): void {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraEnabled(false);
  }

  async function startScanner(): Promise<void> {
    setScanError(null);

    if (!("BarcodeDetector" in window)) {
      setScanError("BarcodeDetector is not supported on this browser. Use manual token entry.");
      return;
    }

    try {
      detectorRef.current = new BarcodeDetector({ formats: ["qr_code"] });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraEnabled(true);
    } catch {
      setScanError("Unable to access camera. Check permissions or use manual token entry.");
    }
  }

  useEffect(() => {
    if (!cameraEnabled || !videoRef.current || !detectorRef.current) {
      return;
    }

    let frameId = 0;
    let stopped = false;

    const scan = async () => {
      if (stopped || !videoRef.current || !detectorRef.current) {
        return;
      }

      try {
        const barcodes = await detectorRef.current.detect(videoRef.current);
        const qr = barcodes.find((entry: DetectedBarcode) => entry.rawValue);

        if (qr?.rawValue) {
          const urlCandidate = qr.rawValue;
          const parsed = urlCandidate.includes("token=")
            ? new URL(urlCandidate).searchParams.get("token")
            : urlCandidate;

          if (parsed) {
            setToken(parsed);
            stopScanner();
          }
        }
      } catch {
        setScanError("Could not read QR code yet. Hold steady and try again.");
      }

      frameId = window.requestAnimationFrame(scan);
    };

    frameId = window.requestAnimationFrame(scan);

    return () => {
      stopped = true;
      window.cancelAnimationFrame(frameId);
    };
  }, [cameraEnabled]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  async function handleLogout(): Promise<void> {
    await fetch("/api/staff/logout", { method: "POST" });
    window.location.href = "/staff/login";
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Staff Check-In</h1>
            <p className="mt-1 text-sm text-slate-600">Scan attendee QR codes or paste ticket tokens manually.</p>
          </div>
          <div className="flex items-center gap-2">
            <a href="/staff/users" className="rounded-lg border border-cyan-700 px-3 py-2 text-sm font-semibold text-cyan-700 hover:bg-cyan-50">
              All Users
            </a>
            <button onClick={handleLogout} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              Logout
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="token">
              Ticket token
            </label>
            <input
              id="token"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Paste token or scan QR"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => resolveToken(false)}
                disabled={loading || token.trim().length < 8}
                className="rounded-lg border border-cyan-700 px-3 py-2 text-sm font-semibold text-cyan-700 disabled:opacity-50"
              >
                Lookup
              </button>
              <button
                onClick={() => resolveToken(true)}
                disabled={loading || token.trim().length < 8}
                className="rounded-lg bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-50"
              >
                Confirm Check-In
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-700">Scan from camera</p>
            <video ref={videoRef} muted playsInline className="mt-2 h-48 w-full rounded-lg bg-slate-950 object-cover" />
            <div className="mt-3 flex gap-2">
              <button onClick={startScanner} className="rounded-lg border border-emerald-600 px-3 py-2 text-sm font-semibold text-emerald-700">
                Start camera
              </button>
              <button onClick={stopScanner} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">
                Stop
              </button>
            </div>
            {scanError ? <p className="mt-2 text-xs text-red-600">{scanError}</p> : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge.className}`}>{statusBadge.label}</span>
          {loading ? <span className="text-xs text-slate-500">Processing...</span> : null}
        </div>

        {result?.error ? <p className="mt-3 text-sm text-red-700">{result.error}</p> : null}

        {result?.attendee ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-lg font-semibold text-slate-900">Attendee</h2>
            <p className="mt-2 text-sm text-slate-700">Name: {result.attendee.fullName}</p>
            <p className="text-sm text-slate-700">Email: {result.attendee.email}</p>
            <p className="text-sm text-slate-700">Registration ID: {result.attendee.registrationId}</p>
            {result.attendee.checkedInAt ? <p className="text-sm text-slate-700">Checked in at: {new Date(result.attendee.checkedInAt).toLocaleString()}</p> : null}
            {result.attendee.checkedInBy ? <p className="text-sm text-slate-700">Checked in by: {result.attendee.checkedInBy}</p> : null}
          </div>
        ) : null}
      </div>

      {summary?.ok ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Live Summary</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Total Registrations</p>
              <p className="text-2xl font-bold text-slate-900">{summary.totalRegistrations}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Total Checked-In</p>
              <p className="text-2xl font-bold text-emerald-700">{summary.checkedInCount}</p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2">Name</th>
                  <th className="py-2">Registration</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {summary.recent.map((entry) => (
                  <tr key={entry.id} className="border-t border-slate-100">
                    <td className="py-2 text-slate-700">{entry.fullName}</td>
                    <td className="py-2 text-slate-700">{entry.registrationId}</td>
                    <td className="py-2 text-slate-700">{entry.checkInStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
