import type { AnalysisResult, ChatResponse, DashboardStats } from "@/lib/types";

export type AnalysisMode = "fast_nn" | "end_to_end";

const CONFIGURED_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "auto";

function apiBase(): string {
  if (CONFIGURED_API_BASE !== "auto") {
    return CONFIGURED_API_BASE.replace(/\/$/, "");
  }
  if (typeof window === "undefined") {
    return "http://127.0.0.1:8008/api";
  }
  return "/api";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, init);
  if (!response.ok) {
    const bodyText = await response.text();
    let detail = bodyText;
    try {
      detail = JSON.parse(bodyText).detail ?? bodyText;
    } catch {
      detail = bodyText;
    }
    const message = typeof detail === "string" ? detail : JSON.stringify(detail);
    throw new Error(message || `请求失败：HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchDashboard(): Promise<DashboardStats> {
  return request<DashboardStats>("/dashboard", { cache: "no-store" });
}

export async function createAnalysis(
  sequenceText: string,
  file?: File | null,
  analysisMode: AnalysisMode = "fast_nn",
  deepseekPrecheck = false,
): Promise<AnalysisResult> {
  const form = new FormData();
  form.append("analysis_mode", analysisMode);
  form.append("deepseek_precheck", deepseekPrecheck ? "true" : "false");
  if (file) {
    form.append("file", file);
  } else {
    form.append("sequence_text", sequenceText);
  }
  return request<AnalysisResult>("/analyses", {
    method: "POST",
    body: form,
  });
}

export async function askAnalysis(analysisId: string, message: string): Promise<ChatResponse> {
  return request<ChatResponse>(`/analyses/${analysisId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
}

export function reportDownloadUrl(analysisId: string): string {
  return `${apiBase()}/analyses/${analysisId}/report.md`;
}
