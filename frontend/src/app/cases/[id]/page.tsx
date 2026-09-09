"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, Case, CaseStatus } from "@/lib/api";
import { useCaseEvents } from "@/lib/useCaseEvents";
import { StatusBadge } from "@/components/StatusBadge";

const STATUSES: CaseStatus[] = ["open", "in_progress", "resolved"];

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const caseId = Number(id);

  const [caseData, setCaseData] = useState<Case | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [livePulse, setLivePulse] = useState(false);

  useEffect(() => {
    api.getCase(caseId).then((c) => { setCaseData(c); setNotesDraft(c.notes ?? ""); }).catch((e) => setError(String(e)));
  }, [caseId]);

  useCaseEvents((evt) => {
    if (evt.case.id !== caseId) return;
    setCaseData(evt.case);
    setNotesDraft((prev) => (document.activeElement?.id === "notes" ? prev : evt.case.notes ?? ""));
    setLivePulse(true);
    setTimeout(() => setLivePulse(false), 1000);
  });

  async function handleStatusChange(status: CaseStatus) {
    if (!caseData) return;
    setSaving(true);
    try {
      const updated = await api.updateCase(caseData.id, { status });
      setCaseData(updated);
    } catch (e) { setError(String(e)); } finally { setSaving(false); }
  }

  async function handleSaveNotes() {
    if (!caseData) return;
    setSaving(true);
    try {
      const updated = await api.updateCase(caseData.id, { notes: notesDraft });
      setCaseData(updated);
    } catch (e) { setError(String(e)); } finally { setSaving(false); }
  }

  if (error) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
        <button onClick={() => router.push("/")} className="mt-4 text-sm text-blue-600 hover:underline">← Back to dashboard</button>
      </main>
    );
  }

  if (!caseData) {
    return <main className="mx-auto max-w-2xl p-8"><p className="text-sm text-gray-500">Loading case…</p></main>;
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <Link href="/" className="text-sm text-blue-600 hover:underline">← All cases</Link>
      <div className="mt-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Case #{caseData.id} — {caseData.name}</h1>
          <p className="text-sm text-gray-500">{caseData.phone}</p>
        </div>
        <span className={`transition-opacity ${livePulse ? "opacity-100" : "opacity-0"}`}>
          <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700">live update</span>
        </span>
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div><dt className="text-xs font-medium uppercase text-gray-500">Issue Type</dt><dd className="mt-1 text-sm text-gray-900">{caseData.issue_type.replace("_", " ")}</dd></div>
        <div><dt className="text-xs font-medium uppercase text-gray-500">Created</dt><dd className="mt-1 text-sm text-gray-900">{new Date(caseData.created_at).toLocaleString()}</dd></div>
        <div className="sm:col-span-2"><dt className="text-xs font-medium uppercase text-gray-500">Description</dt><dd className="mt-1 text-sm text-gray-900">{caseData.description}</dd></div>
      </dl>

      <div className="mt-6">
        <div className="mb-2 flex items-center gap-3">
          <span className="text-xs font-medium uppercase text-gray-500">Status</span>
          <StatusBadge status={caseData.status} />
        </div>
        <div className="flex gap-2">
          {STATUSES.map((s) => (
            <button key={s} disabled={saving || s === caseData.status} onClick={() => handleStatusChange(s)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">
              Mark {s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <label htmlFor="notes" className="text-xs font-medium uppercase text-gray-500">Notes</label>
        <textarea id="notes" value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} rows={4}
          className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm" placeholder="Internal notes about this case…" />
        <button onClick={handleSaveNotes} disabled={saving}
          className="mt-2 rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700 disabled:opacity-50">
          {saving ? "Saving…" : "Save notes"}
        </button>
      </div>
    </main>
  );
}
