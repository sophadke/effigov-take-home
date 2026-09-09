"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, Case } from "@/lib/api";
import { useCaseEvents } from "@/lib/useCaseEvents";
import { StatusBadge } from "@/components/StatusBadge";

function upsert(cases: Case[], updated: Case): Case[] {
  const idx = cases.findIndex((c) => c.id === updated.id);
  if (idx === -1) return [updated, ...cases];
  const next = [...cases];
  next[idx] = updated;
  return next;
}

export default function DashboardPage() {
  const [cases, setCases] = useState<Case[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justUpdated, setJustUpdated] = useState<number | null>(null);

  function loadCases() {
    setError(null);
    api.listCases().then(setCases).catch((e) => setError(String(e)));
  }

  useEffect(() => {
    loadCases();
  }, []);

  useCaseEvents((evt) => {
    setCases((prev) => (prev ? upsert(prev, evt.case) : [evt.case]));
    setJustUpdated(evt.case.id);
    setTimeout(() => setJustUpdated(null), 1500);
  });

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">EffiGov Case Dashboard</h1>
        <span className="text-sm text-gray-500">
          {cases ? `${cases.length} case${cases.length === 1 ? "" : "s"}` : ""}
        </span>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          <span>
            Couldn&apos;t reach the backend at {process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}. Is it running? ({error})
          </span>
          <button onClick={loadCases} className="shrink-0 rounded-md border border-red-300 px-2.5 py-1 font-medium hover:bg-red-100">
            Retry
          </button>
        </div>
      )}

      {!cases && !error && <p className="text-sm text-gray-500">Loading cases…</p>}

      {cases && cases.length === 0 && (
        <p className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
          No cases yet. Start a call with the voice agent to create one.
        </p>
      )}

      {cases && cases.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Issue</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {cases.map((c) => (
                <tr key={c.id} className={`transition-colors ${justUpdated === c.id ? "bg-yellow-50" : ""}`}>
                  <td className="px-4 py-3 text-sm">
                    <Link href={`/cases/${c.id}`} className="font-medium text-gray-900 hover:underline">
                      {c.name}
                    </Link>
                    <div className="text-xs text-gray-500">{c.phone}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{c.issue_type.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-sm"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(c.updated_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
