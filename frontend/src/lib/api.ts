export type CaseStatus = "open" | "in_progress" | "resolved";

export interface Case {
  id: number;
  name: string;
  phone: string;
  issue_type: string;
  description: string;
  status: CaseStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws/cases";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listCases: (): Promise<Case[]> =>
    fetch(`${API_URL}/cases`, { cache: "no-store" }).then((r) => handle(r)),
  getCase: (id: number): Promise<Case> =>
    fetch(`${API_URL}/cases/${id}`, { cache: "no-store" }).then((r) => handle(r)),
  updateCase: (id: number, patch: Partial<Case>): Promise<Case> =>
    fetch(`${API_URL}/cases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then((r) => handle(r)),
};
