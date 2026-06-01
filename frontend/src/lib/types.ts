export type SequenceStats = {
  name: string;
  sequence: string;
  sequence_type: "DNA" | "RNA" | "Mixed";
  length: number;
  gc_content: number;
  base_counts: Record<"A" | "T" | "G" | "C" | "U" | "N", number>;
  base_ratios: Record<"A" | "T" | "G" | "C" | "U" | "N", number>;
  invalid_characters: string[];
  quality_score: number;
};

export type GenomadPrediction = {
  label: string;
  confidence: number;
  virus_score: number;
  plasmid_score: number;
  source: string;
  evidence: string[];
};

export type BlastHit = {
  rank: number;
  accession: string;
  title: string;
  organism: string;
  identity: number;
  coverage: number;
  evalue: number;
  bit_score: number;
  source: string;
  annotations: Record<string, unknown>;
};

export type FusionResult = {
  candidate_source: string;
  confidence_score: number;
  risk_level: "Low" | "Medium" | "High";
  requires_validation: boolean;
  reasoning: string[];
};

export type ReportResult = {
  markdown: string;
  source: string;
  model: string;
};

export type PipelineStep = {
  key: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
  detail: string;
  elapsed_ms: number;
};

export type AnalysisResult = {
  id: string;
  created_at: string;
  status: "completed" | "failed";
  sequence: SequenceStats;
  genomad: GenomadPrediction;
  blast_hits: BlastHit[];
  fusion: FusionResult;
  report: ReportResult;
  timeline: PipelineStep[];
  warnings: string[];
};

export type DashboardStats = {
  total_analyses: number;
  average_confidence: number;
  recent: Array<{
    id: string;
    created_at: string;
    status: string;
    sequence_name: string;
    sequence_type: string;
    confidence_score: number;
    candidate_source: string;
  }>;
};

export type ChatResponse = {
  answer: string;
  source: string;
  model: string;
};
