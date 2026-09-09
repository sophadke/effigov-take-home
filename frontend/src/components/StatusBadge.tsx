import { CaseStatus } from "@/lib/api";

const STYLES: Record<CaseStatus, string> = {
  open: "bg-amber-100 text-amber-800 border-amber-300",
  in_progress: "bg-blue-100 text-blue-800 border-blue-300",
  resolved: "bg-emerald-100 text-emerald-800 border-emerald-300",
};

const LABELS: Record<CaseStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
};

export function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
