"use client";

import type { ChangeEvent, FormEvent, ReactNode, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Cpu,
  Database,
  Dna,
  Download,
  FileText,
  Gauge,
  Home,
  Layers3,
  Loader2,
  MessageSquare,
  Microscope,
  Network,
  Play,
  Radar,
  RotateCw,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Upload,
  Workflow,
  Zap,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { askAnalysis, createAnalysis, fetchDashboard, reportDownloadUrl, type AnalysisMode } from "@/lib/api";
import type { AnalysisResult, ChatResponse, DashboardStats, PipelineStep } from "@/lib/types";
import { BaseCompositionChart, BlastRankingChart, ConfidenceGauge } from "./charts";

type ViewId = "dashboard" | "upload" | "progress" | "overview" | "charts" | "report";

const navItems: Array<{ id: ViewId; label: string; eyebrow: string; icon: typeof Home }> = [
  { id: "upload", label: "序列控制台", eyebrow: "Input", icon: Upload },
  { id: "progress", label: "任务链路", eyebrow: "Run", icon: Workflow },
  { id: "overview", label: "证据总览", eyebrow: "Evidence", icon: Gauge },
  { id: "charts", label: "图谱分析", eyebrow: "Charts", icon: BarChart3 },
  { id: "report", label: "AI 报告", eyebrow: "Report", icon: Bot },
  { id: "dashboard", label: "运行看板", eyebrow: "Ops", icon: Home },
];

const pipelineBlueprint = [
  { key: "input_precheck", label: "DeepSeek 预检", icon: Sparkles },
  { key: "sequence", label: "序列质控", icon: Dna },
  { key: "genomad", label: "geNomad", icon: Radar },
  { key: "ncbi", label: "NCBI BLAST", icon: Database },
  { key: "fusion", label: "证据融合", icon: Layers3 },
  { key: "deepseek", label: "AI 解释", icon: Bot },
  { key: "report", label: "报告生成", icon: FileText },
];

const sampleSequence = ">BioSeqMind_demo_sequence\nATGCGTACGTTAGCTAGCTAGGCTTACGATCGATCGGATCCGATCGTACGATCGATCGTACG";

export function BioSeqMindWorkbench() {
  const [activeView, setActiveView] = useState<ViewId>("upload");
  const [sequenceText, setSequenceText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("fast_nn");
  const [deepseekPrecheck, setDeepseekPrecheck] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("geNomad 和 BLAST 的证据是否一致？");
  const [chat, setChat] = useState<Array<{ role: "user" | "assistant"; content: string; meta?: string }>>([]);
  const [isAsking, setIsAsking] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const sequenceRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    fetchDashboard()
      .then(setDashboard)
      .catch(() => setDashboard({ total_analyses: 0, average_confidence: 0, recent: [] }));
  }, []);

  const normalizedInputLength = sequenceText.replace(/\s/g, "").replace(/^>.*$/gm, "").length;
  const topHit = analysis?.blast_hits[0] ?? null;
  const completedSteps = analysis?.timeline.length ?? 0;

  const metrics = useMemo(
    () => [
      {
        label: "任务总量",
        value: dashboard?.total_analyses ?? 0,
        suffix: "runs",
        icon: Activity,
        tone: "text-[#68f0cf]",
      },
      {
        label: "平均可信度",
        value: Math.round(dashboard?.average_confidence ?? analysis?.fusion.confidence_score ?? 0),
        suffix: "%",
        icon: Gauge,
        tone: "text-[#ffd166]",
      },
      {
        label: "当前长度",
        value: analysis?.sequence.length ?? normalizedInputLength,
        suffix: "nt",
        icon: Dna,
        tone: "text-[#86b7ff]",
      },
      {
        label: "BLAST 命中",
        value: analysis?.blast_hits.length ?? 0,
        suffix: "hits",
        icon: Database,
        tone: "text-[#ff8fb3]",
      },
    ],
    [analysis, dashboard, normalizedInputLength],
  );

  async function refreshDashboard() {
    try {
      setDashboard(await fetchDashboard());
    } catch {
      setDashboard((current) => current ?? { total_analyses: 0, average_confidence: 0, recent: [] });
    }
  }

  async function handleAnalyze(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError("");
    const submittedSequence = sequenceText.trim() ? sequenceText : (sequenceRef.current?.value ?? "");
    if (!file && !submittedSequence.trim()) {
      setError("请输入 DNA/RNA 序列或上传 FASTA 文件。");
      setActiveView("upload");
      return;
    }
    setIsAnalyzing(true);
    setActiveView("progress");
    try {
      const result = await createAnalysis(submittedSequence, file, analysisMode, deepseekPrecheck);
      setAnalysis(result);
      setChat([
        {
          role: "assistant",
          content: result.report.markdown,
          meta: `${result.report.source} / ${result.report.model}`,
        },
      ]);
      await refreshDashboard();
      setActiveView("overview");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "分析失败");
      setActiveView("upload");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setError("");
    if (selected) {
      selected
        .text()
        .then((text) => {
          setSequenceText(text);
          setError("");
        })
        .catch(() => setError("FASTA 文件读取失败"));
    }
  }

  function handleSequenceText(value: string) {
    setSequenceText(value);
    if (error) setError("");
  }

  async function handleQuestion() {
    if (!analysis || !question.trim()) return;
    setIsAsking(true);
    const asked = question.trim();
    setQuestion("");
    setChat((items) => [...items, { role: "user", content: asked }]);
    try {
      const response: ChatResponse = await askAnalysis(analysis.id, asked);
      setChat((items) => [
        ...items,
        { role: "assistant", content: response.answer, meta: `${response.source} / ${response.model}` },
      ]);
    } catch (caught) {
      setChat((items) => [
        ...items,
        { role: "assistant", content: caught instanceof Error ? caught.message : "追问失败", meta: "error" },
      ]);
    } finally {
      setIsAsking(false);
    }
  }

  function navigate(view: ViewId) {
    setError("");
    setActiveView(view);
  }

  return (
    <div className="lab-shell min-h-screen bg-[#090a0a] text-[#eef7f2]">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#090a0a_0%,#10100d_44%,#080807_100%)]" />
        <div className="motion-grid absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.03)_1px,transparent_1px)] bg-[size:44px_44px]" />
        <div className="absolute inset-x-0 top-0 h-72 bg-[linear-gradient(180deg,rgba(101,240,207,.12),transparent)]" />
        <DnaBackdrop />
      </div>

      <div className="flex min-h-screen">
        <aside className="hidden w-[296px] shrink-0 border-r border-white/10 bg-[#0c0d0b]/90 px-4 py-5 backdrop-blur-2xl">
          <BrandLockup />
          <div className="mt-7 space-y-2">
            {navItems.map((item) => (
              <NavButton key={item.id} item={item} selected={activeView === item.id} onClick={() => navigate(item.id)} />
            ))}
          </div>
          <div className="mt-7 border-t border-white/10 pt-5">
            <PipelineMini analysis={analysis} isAnalyzing={isAnalyzing} />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-white/10 bg-[#090a0a]/82 backdrop-blur-2xl">
            <div className="px-4 py-4 lg:px-7">
              <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
                <div className="min-w-0">
                  <div className="mb-3 flex items-center gap-2">
                    <BrandMark />
                    <span className="text-sm font-semibold text-white">BioSeqMind-AI</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.22em] text-[#9bb2aa]">
                    <span>Bioinformatics Command Surface</span>
                    <span className="h-px w-8 bg-[#68f0cf]/50" />
                    <span>{analysis ? formatDate(analysis.created_at) : "Live Input"}</span>
                  </div>
                  <h1 className="mt-2 max-w-5xl text-2xl font-semibold leading-tight tracking-normal text-white md:text-4xl">
                    核酸序列智能识别与证据融合工作台
                  </h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill icon={Server} label="API" value="Ready" tone="green" />
                  <StatusPill icon={Cpu} label="Mode" value={analysisMode === "fast_nn" ? "Fast NN" : "End-to-end"} tone="amber" />
                  <Button
                    className="energy-button h-10 rounded-[8px] bg-[#68f0cf] px-4 text-[#07100d] shadow-[0_0_0_1px_rgba(104,240,207,.25),0_18px_50px_rgba(104,240,207,.16)] hover:bg-[#8ff8dd]"
                    disabled={isAnalyzing}
                    onClick={() => {
                      if (activeView === "upload") {
                        void handleAnalyze();
                      } else {
                        navigate("upload");
                      }
                    }}
                    type="button"
                  >
                    {isAnalyzing ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Play data-icon="inline-start" />}
                    {activeView === "upload" ? "启动分析" : "进入控制台"}
                  </Button>
                </div>
              </div>

              <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const selected = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      className={`flex h-10 shrink-0 items-center gap-2 rounded-[8px] border px-4 text-sm transition ${
                        selected
                          ? "border-[#e7d8b1]/45 bg-[#e7d8b1]/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.08)]"
                          : "border-white/10 bg-white/[0.035] text-[#a7b8b0] hover:border-white/20 hover:text-white"
                      }`}
                      onClick={() => navigate(item.id)}
                      type="button"
                    >
                      <Icon />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </header>

          <div className="px-4 py-5 lg:px-7">
            {error ? (
              <Alert className="mb-5 rounded-[8px] border-[#ff6f91]/35 bg-[#40131d]/80 text-[#ffdce5] shadow-none">
                <AlertTriangle />
                <AlertTitle>分析失败</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <MetricsStrip metrics={metrics} />

            <div className="mt-5">
              {activeView === "upload" ? (
                <UploadView
                  analysis={analysis}
                  analysisMode={analysisMode}
                  deepseekPrecheck={deepseekPrecheck}
                  file={file}
                  fileRef={fileRef}
                  inputLength={normalizedInputLength}
                  isAnalyzing={isAnalyzing}
                  sequenceRef={sequenceRef}
                  sequenceText={sequenceText}
                  topHit={topHit}
                  onAnalyze={handleAnalyze}
                  onAnalysisMode={setAnalysisMode}
                  onDeepseekPrecheck={setDeepseekPrecheck}
                  onFile={handleFile}
                  onSample={() => {
                    setFile(null);
                    setSequenceText(sampleSequence);
                    setError("");
                  }}
                  onSequenceText={handleSequenceText}
                />
              ) : null}
              {activeView === "dashboard" ? (
                <DashboardView analysis={analysis} dashboard={dashboard} onNavigate={navigate} onRefresh={refreshDashboard} />
              ) : null}
              {activeView === "progress" ? <ProgressView analysis={analysis} isAnalyzing={isAnalyzing} /> : null}
              {activeView === "overview" ? <OverviewView analysis={analysis} onNavigate={navigate} /> : null}
              {activeView === "charts" ? <ChartsView analysis={analysis} /> : null}
              {activeView === "report" ? (
                <ReportView
                  analysis={analysis}
                  chat={chat}
                  isAsking={isAsking}
                  question={question}
                  onAsk={handleQuestion}
                  onQuestion={setQuestion}
                />
              ) : null}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 py-5 text-xs text-[#77857f]">
              <span>BioSeqMind-AI / geNomad / NCBI / DeepSeek</span>
              <span>真实依赖不可用时返回错误，不生成演示结果</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function UploadView({
  analysis,
  analysisMode,
  deepseekPrecheck,
  file,
  fileRef,
  inputLength,
  isAnalyzing,
  sequenceRef,
  sequenceText,
  topHit,
  onAnalyze,
  onAnalysisMode,
  onDeepseekPrecheck,
  onFile,
  onSample,
  onSequenceText,
}: {
  analysis: AnalysisResult | null;
  analysisMode: AnalysisMode;
  deepseekPrecheck: boolean;
  file: File | null;
  fileRef: RefObject<HTMLInputElement | null>;
  inputLength: number;
  isAnalyzing: boolean;
  sequenceRef: RefObject<HTMLTextAreaElement | null>;
  sequenceText: string;
  topHit: AnalysisResult["blast_hits"][number] | null;
  onAnalyze: (event: FormEvent<HTMLFormElement>) => void;
  onAnalysisMode: (mode: AnalysisMode) => void;
  onDeepseekPrecheck: (enabled: boolean) => void;
  onFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onSample: () => void;
  onSequenceText: (value: string) => void;
}) {
  const inputState = inferInputState(sequenceText, file);

  return (
    <form className="grid gap-5 2xl:grid-cols-[minmax(0,1.18fr)_minmax(360px,.82fr)]" onSubmit={onAnalyze}>
      <Panel className="min-h-[650px]">
        <PanelHeader
          eyebrow="Sequence Input"
          icon={Dna}
          title="序列装载舱"
          action={
            <Button className="energy-button h-9 rounded-[8px] bg-[#68f0cf] text-[#07100d] hover:bg-[#8ff8dd]" disabled={isAnalyzing} type="submit">
              {isAnalyzing ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Play data-icon="inline-start" />}
              启动
            </Button>
          }
        />

        <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
          <div className="relative min-h-[460px] overflow-hidden rounded-[8px] border border-white/10 bg-[#050606]">
            <div className="flex h-10 items-center justify-between border-b border-white/10 bg-white/[0.035] px-3">
              <div className="flex items-center gap-2 text-xs text-[#94a39b]">
                <span className="size-2 rounded-full bg-[#68f0cf]" />
                <span>FASTA / DNA / RNA</span>
              </div>
              <span className="font-mono text-xs text-[#788982]">{inputLength.toLocaleString()} nt</span>
            </div>
            <Textarea
              className="min-h-[420px] resize-none rounded-none border-0 bg-transparent px-4 py-4 font-mono text-[13px] leading-6 text-[#dcebe5] outline-none placeholder:text-[#52605b] focus-visible:ring-0"
              ref={sequenceRef}
              value={sequenceText}
              onChange={(event) => onSequenceText(event.target.value)}
              placeholder="粘贴 FASTA 或原始 DNA/RNA 序列"
            />
            <div className="pointer-events-none absolute inset-y-10 left-0 w-8 border-r border-white/[0.04] bg-[linear-gradient(180deg,rgba(104,240,207,.04),transparent)]" />
            <div className="cinema-scanline" />
          </div>

          <div className="grid gap-3">
            <Input ref={fileRef} accept=".fa,.fasta,.fna,.txt" className="hidden" onChange={onFile} type="file" />
            <ControlButton icon={FileText} label="选择 FASTA" meta={file?.name ?? "本地文件"} onClick={() => fileRef.current?.click()} />
            <ControlButton icon={Sparkles} label="载入样例" meta="快速校验界面" onClick={onSample} />
            <div className="rounded-[8px] border border-white/10 bg-white/[0.035] p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">DeepSeek 预检</div>
                  <div className="mt-1 text-xs text-[#8fa099]">{deepseekPrecheck ? "开启" : "关闭"}</div>
                </div>
                <button
                  aria-label="切换 DeepSeek 输入预检"
                  className={`h-6 w-11 rounded-full p-1 transition ${deepseekPrecheck ? "bg-[#86b7ff]" : "bg-white/15"}`}
                  onClick={() => onDeepseekPrecheck(!deepseekPrecheck)}
                  type="button"
                >
                  <span className={`block size-4 rounded-full bg-[#050606] transition ${deepseekPrecheck ? "translate-x-5" : ""}`} />
                </button>
              </div>
            </div>
            <ModePicker analysisMode={analysisMode} onAnalysisMode={onAnalysisMode} />
          </div>
        </div>
      </Panel>

      <div className="grid gap-5">
        <Panel>
          <PanelHeader eyebrow="Quality Gate" icon={ShieldCheck} title="输入质控" />
          <div className="rounded-[8px] border border-white/10 bg-[#060706] p-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-[#77857f]">Readiness</div>
                <div className="mt-2 text-4xl font-semibold text-white">{inputLength ? "Ready" : "Idle"}</div>
              </div>
              <div className="text-right font-mono text-sm text-[#e7d8b1]">{inputLength.toLocaleString()} nt</div>
            </div>
            <div className="mt-5 space-y-3">
              <ReadinessRow label="FASTA header" value={inputState.hasHeader ? "detected" : "not detected"} active={inputState.hasHeader} />
              <ReadinessRow label="inferred type" value={inputState.kind} active={inputLength > 0 || Boolean(file)} />
              <ReadinessRow label="input source" value={file ? "file" : "text"} active={Boolean(file) || sequenceText.length > 0} />
            </div>
          </div>
          <div className="mt-4 h-[132px] overflow-hidden rounded-[8px] border border-white/10 bg-[#050606] p-4">
            <SequenceSparkline text={sequenceText} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Evidence Preview" icon={Network} title="证据预览" />
          <div className="space-y-3">
            <EvidenceLine label="geNomad" value={analysis?.genomad.label ?? "等待分析"} score={analysis ? analysis.genomad.confidence * 100 : 0} />
            <EvidenceLine label="BLAST Top Hit" value={topHit?.organism ?? "等待命中"} score={topHit?.identity ?? 0} />
            <EvidenceLine label="Fusion" value={analysis?.fusion.candidate_source ?? "等待融合"} score={analysis?.fusion.confidence_score ?? 0} />
          </div>
        </Panel>
      </div>
    </form>
  );
}

function DashboardView({
  analysis,
  dashboard,
  onNavigate,
  onRefresh,
}: {
  analysis: AnalysisResult | null;
  dashboard: DashboardStats | null;
  onNavigate: (view: ViewId) => void;
  onRefresh: () => void;
}) {
  return (
    <section className="grid gap-5 2xl:grid-cols-[1.05fr_.95fr]">
      <Panel>
        <PanelHeader
          eyebrow="Mission Control"
          icon={Microscope}
          title="运行看板"
          action={
            <Button className="h-9 rounded-[8px]" onClick={onRefresh} type="button" variant="outline">
              <RotateCw data-icon="inline-start" />
              刷新
            </Button>
          }
        />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {pipelineBlueprint.slice(1).map((item, index) => {
            const Icon = item.icon;
            const done = Boolean(analysis?.timeline.find((step) => step.key === item.key));
            return (
              <div key={item.key} className="rounded-[8px] border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-[#73827c]">0{index + 1}</span>
                  <Icon className={done ? "text-[#68f0cf]" : "text-[#52605b]"} />
                </div>
                <div className="mt-5 text-sm font-medium text-white">{item.label}</div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel>
        <PanelHeader eyebrow="Recent Runs" icon={Clock3} title="最近任务" />
        <div className="space-y-3">
          {dashboard?.recent.length ? (
            dashboard.recent.map((item) => (
              <button
                key={item.id}
                className="group flex w-full items-center justify-between gap-3 rounded-[8px] border border-white/10 bg-white/[0.035] p-3 text-left transition hover:border-[#68f0cf]/35 hover:bg-[#68f0cf]/[0.06]"
                onClick={() => onNavigate("overview")}
                type="button"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">{item.sequence_name}</div>
                  <div className="mt-1 truncate text-xs text-[#87968f]">{item.candidate_source}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="border-[#ffd166]/35 bg-[#ffd166]/10 text-[#ffe2a3]" variant="outline">
                    {Math.round(item.confidence_score)}
                  </Badge>
                  <ChevronRight className="text-[#73827c] transition group-hover:text-[#68f0cf]" />
                </div>
              </button>
            ))
          ) : (
            <EmptyState icon={Search} text="暂无历史任务" />
          )}
        </div>
      </Panel>
    </section>
  );
}

function ProgressView({ analysis, isAnalyzing }: { analysis: AnalysisResult | null; isAnalyzing: boolean }) {
  const stepMap = new Map((analysis?.timeline ?? []).map((step) => [step.key, step]));

  return (
    <Panel>
      <PanelHeader eyebrow="Execution Graph" icon={Workflow} title="任务链路" />
      <div className="grid gap-3 lg:grid-cols-7">
        {pipelineBlueprint.map((item, index) => {
          const step = stepMap.get(item.key);
          return (
            <PipelineNode
              key={item.key}
              active={isAnalyzing && !analysis && index <= 2}
              index={index}
              item={item}
              step={step}
            />
          );
        })}
      </div>
      <div className="mt-5 overflow-hidden rounded-[8px] border border-white/10">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead>阶段</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>耗时</TableHead>
              <TableHead>细节</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(analysis?.timeline.length ? analysis.timeline : []).map((step) => (
              <TableRow key={`${step.key}-${step.elapsed_ms}`} className="border-white/10">
                <TableCell className="font-medium text-white">{step.label}</TableCell>
                <TableCell>
                  <Badge className="border-[#68f0cf]/35 bg-[#68f0cf]/10 text-[#dffff4]" variant="outline">
                    {step.status}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-[#ffd166]">{step.elapsed_ms} ms</TableCell>
                <TableCell className="text-[#9eb0a8]">{step.detail}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!analysis ? <div className="p-6"><EmptyState icon={Workflow} text="等待一次完整分析" /></div> : null}
      </div>
    </Panel>
  );
}

function OverviewView({ analysis, onNavigate }: { analysis: AnalysisResult | null; onNavigate: (view: ViewId) => void }) {
  if (!analysis) return <EmptyState icon={Gauge} text="还没有分析结果" />;
  const topHit = analysis.blast_hits[0];

  return (
    <section className="grid gap-5 2xl:grid-cols-[.92fr_1.08fr]">
      <Panel>
        <PanelHeader
          eyebrow="Result Synopsis"
          icon={Gauge}
          title="证据总览"
          action={<RiskBadge risk={analysis.fusion.risk_level} />}
        />
        <div className="grid grid-cols-2 gap-3">
          <DataTile label="序列类型" value={analysis.sequence.sequence_type} accent="blue" />
          <DataTile label="序列长度" value={`${analysis.sequence.length.toLocaleString()} nt`} accent="green" />
          <DataTile label="GC 含量" value={`${analysis.sequence.gc_content}%`} accent="amber" />
          <DataTile label="可信度" value={`${analysis.fusion.confidence_score}/100`} accent="rose" />
        </div>
        <div className="mt-4 rounded-[8px] border border-white/10 bg-[#050606] p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-[#77857f]">Candidate Source</div>
          <div className="mt-2 text-xl font-semibold text-white">{analysis.fusion.candidate_source}</div>
          <div className="mt-3 space-y-2 text-sm leading-6 text-[#9eb0a8]">
            {analysis.fusion.reasoning.map((item, index) => (
              <p key={index}>{item}</p>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button className="energy-button rounded-[8px] bg-[#68f0cf] text-[#07100d] hover:bg-[#8ff8dd]" onClick={() => onNavigate("charts")}>
            <BarChart3 data-icon="inline-start" />
            图谱分析
          </Button>
          <Button className="rounded-[8px]" onClick={() => onNavigate("report")} variant="outline">
            <Bot data-icon="inline-start" />
            AI 报告
          </Button>
        </div>
      </Panel>

      <Panel>
        <PanelHeader eyebrow="NCBI Evidence" icon={Database} title="BLAST 命中表" />
        <div className="mb-4 rounded-[8px] border border-white/10 bg-white/[0.035] p-4">
          <div className="text-sm text-[#9eb0a8]">Top Hit</div>
          <div className="mt-1 truncate text-lg font-semibold text-white">
            {topHit ? `${topHit.accession} / ${topHit.organism}` : "暂无命中"}
          </div>
          {topHit ? <div className="mt-2 text-sm text-[#77857f]">identity {topHit.identity}% / coverage {topHit.coverage}%</div> : null}
        </div>
        <div className="overflow-hidden rounded-[8px] border border-white/10">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead>Rank</TableHead>
                <TableHead>Accession</TableHead>
                <TableHead>Organism</TableHead>
                <TableHead>Identity</TableHead>
                <TableHead>E-value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analysis.blast_hits.map((hit) => (
                <TableRow key={`${hit.rank}-${hit.accession}`} className="border-white/10">
                  <TableCell>{hit.rank}</TableCell>
                  <TableCell className="font-mono text-[#68f0cf]">{hit.accession}</TableCell>
                  <TableCell className="max-w-[320px] truncate">{hit.organism}</TableCell>
                  <TableCell>{hit.identity}%</TableCell>
                  <TableCell>{formatEvalue(hit.evalue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!analysis.blast_hits.length ? <div className="p-6"><EmptyState icon={Database} text="NCBI 未返回命中" /></div> : null}
        </div>
      </Panel>
    </section>
  );
}

function ChartsView({ analysis }: { analysis: AnalysisResult | null }) {
  return (
    <section className="grid gap-5 xl:grid-cols-3">
      <Panel>
        <PanelHeader eyebrow="Base Composition" icon={Dna} title="碱基组成" />
        <BaseCompositionChart analysis={analysis} />
      </Panel>
      <Panel>
        <PanelHeader eyebrow="BLAST Ranking" icon={Database} title="命中排名" />
        <BlastRankingChart analysis={analysis} />
      </Panel>
      <Panel>
        <PanelHeader eyebrow="Confidence" icon={Gauge} title="融合可信度" />
        <ConfidenceGauge analysis={analysis} />
      </Panel>
    </section>
  );
}

function ReportView({
  analysis,
  chat,
  isAsking,
  question,
  onAsk,
  onQuestion,
}: {
  analysis: AnalysisResult | null;
  chat: Array<{ role: "user" | "assistant"; content: string; meta?: string }>;
  isAsking: boolean;
  question: string;
  onAsk: () => void;
  onQuestion: (value: string) => void;
}) {
  if (!analysis) return <EmptyState icon={Bot} text="还没有 AI 报告" />;

  return (
    <section className="grid gap-5 2xl:grid-cols-[1.08fr_.92fr]">
      <Panel>
        <PanelHeader
          eyebrow={`${analysis.report.source} / ${analysis.report.model}`}
          icon={FileText}
          title="AI 报告"
          action={
            <a
              className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-[#e8f6f1] transition hover:bg-white/[0.08]"
              href={reportDownloadUrl(analysis.id)}
            >
              <Download data-icon="inline-start" />
              Markdown
            </a>
          }
        />
        <MarkdownPreview markdown={analysis.report.markdown} />
      </Panel>

      <Panel>
        <PanelHeader eyebrow="Context Chat" icon={MessageSquare} title="证据追问" />
        <div className="flex h-[650px] flex-col gap-3">
          <div className="min-h-0 flex-1 overflow-y-auto rounded-[8px] border border-white/10 bg-[#050606] p-3">
            <div className="flex flex-col gap-3">
              {chat.map((item, index) => (
                <ChatBubble key={`${item.role}-${index}`} item={item} />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              className="h-10 rounded-[8px] border-white/10 bg-white/[0.04]"
              value={question}
              onChange={(event) => onQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onAsk();
              }}
              placeholder="追问本次分析证据"
            />
            <Button className="energy-button h-10 rounded-[8px] bg-[#68f0cf] text-[#07100d] hover:bg-[#8ff8dd]" disabled={isAsking} onClick={onAsk}>
              {isAsking ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Bot data-icon="inline-start" />}
              发送
            </Button>
          </div>
        </div>
      </Panel>
    </section>
  );
}

function MetricsStrip({
  metrics,
}: {
  metrics: Array<{ label: string; value: string | number; suffix: string; icon: typeof Activity; tone: string }>;
}) {
  return (
    <section className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <div key={metric.label} className="min-h-[108px] rounded-[8px] border border-white/10 bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.05)]">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em] text-[#798982]">{metric.label}</span>
              <Icon className={metric.tone} />
            </div>
            <div className="mt-5 flex items-end gap-2">
              <span className="font-mono text-3xl font-semibold text-white">{metric.value}</span>
              <span className="pb-1 text-xs text-[#8c9c95]">{metric.suffix}</span>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`holo-panel interactive-panel rounded-[8px] border border-white/10 bg-[#0e100e]/88 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_24px_80px_rgba(0,0,0,.28)] backdrop-blur-xl ${className}`}>
      {children}
    </section>
  );
}

function PanelHeader({
  action,
  eyebrow,
  icon: Icon,
  title,
}: {
  action?: ReactNode;
  eyebrow: string;
  icon: typeof Dna;
  title: string;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-[8px] border border-white/10 bg-white/[0.045] text-[#68f0cf]">
          <Icon />
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.22em] text-[#7e8f87]">{eyebrow}</div>
          <h2 className="mt-1 text-lg font-semibold leading-tight text-white">{title}</h2>
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function BrandLockup() {
  return (
    <div className="flex items-center gap-3">
      <BrandMark />
      <div>
        <div className="text-base font-semibold text-white">BioSeqMind-AI</div>
        <div className="text-xs uppercase tracking-[0.18em] text-[#7f928a]">Sequence Intelligence</div>
      </div>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="relative grid size-11 place-items-center rounded-[8px] border border-[#68f0cf]/30 bg-[#68f0cf]/10 text-[#68f0cf] shadow-[0_0_40px_rgba(104,240,207,.12)]">
      <Dna className="size-5" />
      <span className="absolute -right-1 -top-1 size-2 rounded-full bg-[#ffd166]" />
    </div>
  );
}

function NavButton({
  item,
  onClick,
  selected,
}: {
  item: (typeof navItems)[number];
  onClick: () => void;
  selected: boolean;
}) {
  const Icon = item.icon;
  return (
    <button
      className={`group flex w-full items-center gap-3 rounded-[8px] border px-3 py-3 text-left transition ${
        selected
          ? "border-[#68f0cf]/45 bg-[#68f0cf]/12 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.06)]"
          : "border-transparent text-[#8d9d95] hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
      }`}
      onClick={onClick}
      type="button"
    >
      <div className={`grid size-8 place-items-center rounded-[7px] ${selected ? "bg-[#68f0cf]/15 text-[#68f0cf]" : "bg-white/[0.04] text-[#73827c]"}`}>
        <Icon />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{item.label}</div>
        <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-[#66756f]">{item.eyebrow}</div>
      </div>
      <ChevronRight className={`transition ${selected ? "text-[#68f0cf]" : "text-transparent group-hover:text-[#73827c]"}`} />
    </button>
  );
}

function PipelineMini({ analysis, isAnalyzing }: { analysis: AnalysisResult | null; isAnalyzing: boolean }) {
  const done = new Set((analysis?.timeline ?? []).map((step) => step.key));
  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[#77857f]">
        <span>Pipeline</span>
        {isAnalyzing ? <Loader2 className="animate-spin text-[#68f0cf]" /> : <BadgeCheck className="text-[#68f0cf]" />}
      </div>
      <div className="space-y-2">
        {pipelineBlueprint.slice(1).map((step) => {
          const complete = done.has(step.key);
          return (
            <div key={step.key} className="flex items-center gap-2 text-xs">
              <span className={`size-1.5 rounded-full ${complete ? "bg-[#68f0cf]" : "bg-white/20"}`} />
              <span className={complete ? "text-[#dffff4]" : "text-[#7d8d86]"}>{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusPill({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: typeof Server;
  label: string;
  tone: "green" | "amber";
  value: string;
}) {
  const color = tone === "green" ? "text-[#68f0cf] border-[#68f0cf]/25 bg-[#68f0cf]/10" : "text-[#ffd166] border-[#ffd166]/25 bg-[#ffd166]/10";
  return (
    <div className={`flex h-10 items-center gap-2 rounded-[8px] border px-3 ${color}`}>
      <Icon />
      <span className="text-xs text-[#8fa099]">{label}</span>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  );
}

function ControlButton({ icon: Icon, label, meta, onClick }: { icon: typeof FileText; label: string; meta: string; onClick: () => void }) {
  return (
    <button
      className="flex min-h-[70px] items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.035] p-3 text-left transition hover:border-[#68f0cf]/35 hover:bg-[#68f0cf]/[0.06]"
      onClick={onClick}
      type="button"
    >
      <div className="grid size-9 place-items-center rounded-[8px] bg-white/[0.06] text-[#68f0cf]">
        <Icon />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="mt-1 truncate text-xs text-[#86978f]">{meta}</div>
      </div>
    </button>
  );
}

function ModePicker({ analysisMode, onAnalysisMode }: { analysisMode: AnalysisMode; onAnalysisMode: (mode: AnalysisMode) => void }) {
  const items: Array<{ mode: AnalysisMode; label: string; icon: typeof Zap; meta: string }> = [
    { mode: "fast_nn", label: "快速模式", icon: Zap, meta: "Fast NN" },
    { mode: "end_to_end", label: "全量模式", icon: Server, meta: "End-to-end" },
  ];
  return (
    <div className="grid gap-2">
      {items.map((item) => {
        const Icon = item.icon;
        const selected = analysisMode === item.mode;
        return (
          <button
            key={item.mode}
            className={`flex min-h-[62px] items-center gap-3 rounded-[8px] border p-3 text-left transition ${
              selected ? "border-[#ffd166]/45 bg-[#ffd166]/10 text-white" : "border-white/10 bg-white/[0.035] text-[#a9b9b1] hover:bg-white/[0.06]"
            }`}
            onClick={() => onAnalysisMode(item.mode)}
            type="button"
          >
            <Icon className={selected ? "text-[#ffd166]" : "text-[#73827c]"} />
            <span>
              <span className="block text-sm font-medium">{item.label}</span>
              <span className="mt-1 block text-xs text-[#7d8d86]">{item.meta}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function DataTile({ accent, label, value }: { accent: "green" | "amber" | "blue" | "rose"; label: string; value: string | number }) {
  const color = {
    green: "text-[#68f0cf]",
    amber: "text-[#ffd166]",
    blue: "text-[#86b7ff]",
    rose: "text-[#ff8fb3]",
  }[accent];
  return (
    <div className="min-h-[86px] rounded-[8px] border border-white/10 bg-white/[0.035] p-3">
      <div className="text-xs text-[#7f9189]">{label}</div>
      <div className={`mt-3 truncate text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function ReadinessRow({ active, label, value }: { active: boolean; label: string; value: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-t border-white/10 pt-3">
      <div>
        <div className="text-xs uppercase tracking-[0.16em] text-[#77857f]">{label}</div>
        <div className="mt-1 text-sm font-medium text-white">{value}</div>
      </div>
      <div className={`h-1.5 w-24 overflow-hidden rounded-full ${active ? "bg-[#e7d8b1]/18" : "bg-white/10"}`}>
        <div className={`h-full rounded-full transition-all duration-700 ${active ? "w-full bg-[#e7d8b1]" : "w-1/5 bg-white/20"}`} />
      </div>
    </div>
  );
}

function EvidenceLine({ label, score, value }: { label: string; score: number; value: string }) {
  const normalized = Math.max(0, Math.min(100, score));
  return (
    <div className="rounded-[8px] border border-white/10 bg-white/[0.035] p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-white">{label}</span>
        <span className="font-mono text-xs text-[#ffd166]">{Math.round(normalized)}%</span>
      </div>
      <div className="mt-2 truncate text-xs text-[#8d9d95]">{value}</div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-[#68f0cf] transition-[width] duration-700" style={{ width: `${normalized}%` }} />
      </div>
    </div>
  );
}

function PipelineNode({
  active,
  index,
  item,
  step,
}: {
  active: boolean;
  index: number;
  item: (typeof pipelineBlueprint)[number];
  step?: PipelineStep;
}) {
  const Icon = item.icon;
  const complete = Boolean(step);
  return (
    <div className={`relative min-h-[164px] rounded-[8px] border p-3 ${active ? "running-node" : ""} ${complete ? "border-[#68f0cf]/35 bg-[#68f0cf]/[0.07]" : "border-white/10 bg-white/[0.035]"}`}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-[#71827b]">{String(index + 1).padStart(2, "0")}</span>
        {active ? <Loader2 className="animate-spin text-[#ffd166]" /> : complete ? <CheckCircle2 className="text-[#68f0cf]" /> : <Icon className="text-[#596861]" />}
      </div>
      <div className="mt-8 text-sm font-semibold text-white">{item.label}</div>
      <div className="mt-2 min-h-[34px] text-xs leading-5 text-[#8c9c95]">{step?.detail ?? "pending"}</div>
      <div className="mt-3 font-mono text-xs text-[#ffd166]">{step ? `${step.elapsed_ms} ms` : "00 ms"}</div>
    </div>
  );
}

function ChatBubble({ item }: { item: { role: "user" | "assistant"; content: string; meta?: string } }) {
  const isUser = item.role === "user";
  return (
    <div className={`rounded-[8px] border p-3 text-sm leading-6 ${isUser ? "ml-8 border-[#86b7ff]/30 bg-[#86b7ff]/10 text-[#eef5ff]" : "mr-8 border-[#68f0cf]/24 bg-[#68f0cf]/[0.06] text-[#dcebe5]"}`}>
      <div className="mb-2 flex items-center gap-2 text-xs text-[#82938b]">
        {isUser ? <MessageSquare /> : <Bot />}
        {isUser ? "用户" : item.meta}
      </div>
      {isUser ? <p className="whitespace-pre-wrap">{item.content}</p> : <MarkdownPreview compact markdown={item.content} />}
    </div>
  );
}

function RiskBadge({ risk }: { risk: "Low" | "Medium" | "High" }) {
  const className =
    risk === "High"
      ? "border-[#ff8fb3]/35 bg-[#ff8fb3]/10 text-[#ffdce8]"
      : risk === "Medium"
        ? "border-[#ffd166]/35 bg-[#ffd166]/10 text-[#ffe2a3]"
        : "border-[#68f0cf]/35 bg-[#68f0cf]/10 text-[#dffff4]";
  return (
    <Badge className={className} variant="outline">
      {risk} risk
    </Badge>
  );
}

function SequenceSparkline({ text }: { text: string }) {
  const clean = text.replace(/>.*$/gm, "").replace(/\s/g, "").toUpperCase().slice(0, 96);
  const bases = clean || "ATGCGTACGTTAGCTAGCTAGGCTTACGATCGATCGGATCCGATCGTACGATCG";
  const heights: Record<string, number> = { A: 34, T: 52, G: 72, C: 44, U: 64, N: 24 };
  return (
    <div className="flex h-full items-end gap-[3px]">
      {bases.split("").map((base, index) => (
        <span
          key={`${base}-${index}`}
          className="seq-bar flex-1 rounded-full bg-[#d9cda8]"
          style={{
            height: `${heights[base] ?? 20}%`,
            opacity: 0.16 + ((index % 7) * 0.055),
            animationDelay: `${index * 18}ms`,
          }}
          title={base}
        />
      ))}
    </div>
  );
}

function DnaBackdrop() {
  return (
    <div className="helix-field absolute right-[-120px] top-24 hidden h-[620px] w-[520px] opacity-35 lg:block">
      {Array.from({ length: 18 }).map((_, index) => (
        <div
          key={index}
          className="helix-strand absolute left-1/2 top-0 h-[520px] w-px origin-bottom bg-[linear-gradient(180deg,transparent,#68f0cf,transparent)]"
          style={{ transform: `rotate(${index * 10}deg) translateX(${Math.sin(index) * 16}px)` }}
        />
      ))}
      <div className="absolute inset-y-0 left-1/2 w-px bg-white/10" />
    </div>
  );
}

function EmptyState({ icon: Icon = Search, text }: { icon?: typeof Search; text: string }) {
  return (
    <div className="grid min-h-[180px] place-items-center rounded-[8px] border border-dashed border-white/15 bg-white/[0.025] p-8 text-center">
      <div>
        <div className="mx-auto grid size-10 place-items-center rounded-[8px] border border-white/10 bg-white/[0.04] text-[#77857f]">
          <Icon />
        </div>
        <div className="mt-3 text-sm text-[#9aaba3]">{text}</div>
      </div>
    </div>
  );
}

function MarkdownPreview({ compact = false, markdown }: { compact?: boolean; markdown: string }) {
  const source = markdown
    .trim()
    .replace(/^```(?:markdown|md)?\s*/i, "")
    .replace(/```\s*$/i, "");
  const lines = source.split("\n");
  const nodes: ReactNode[] = [];
  let listItems: string[] = [];
  let tableLines: string[] = [];

  function flushList(key: string) {
    if (!listItems.length) return;
    nodes.push(
      <ul key={key} className="mb-3 space-y-1 pl-5 text-[#c7d8d0]">
        {listItems.map((item, index) => (
          <li key={`${key}-${index}`} className="list-disc">
            {renderInline(item)}
          </li>
        ))}
      </ul>,
    );
    listItems = [];
  }

  function flushTable(key: string) {
    if (!tableLines.length) return;
    nodes.push(renderMarkdownTable(tableLines, key));
    tableLines = [];
  }

  lines.forEach((rawLine, index) => {
    const line = rawLine.trimEnd();
    if (line.includes("|") && !/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(line)) {
      tableLines.push(line);
      return;
    }
    flushTable(`table-${index}`);

    if (/^\s*[-*]\s+/.test(line)) {
      listItems.push(line.replace(/^\s*[-*]\s+/, ""));
      return;
    }
    flushList(`list-${index}`);

    if (line.startsWith("### ")) {
      nodes.push(
        <h4 key={index} className="mb-2 mt-4 text-sm font-semibold text-[#68f0cf]">
          {renderInline(line.slice(4))}
        </h4>,
      );
      return;
    }
    if (line.startsWith("## ")) {
      nodes.push(
        <h3 key={index} className="mb-2 mt-5 text-base font-semibold text-[#68f0cf]">
          {renderInline(line.slice(3))}
        </h3>,
      );
      return;
    }
    if (line.startsWith("# ")) {
      nodes.push(
        <h2 key={index} className="mb-4 text-xl font-semibold text-white">
          {renderInline(line.slice(2))}
        </h2>,
      );
      return;
    }
    if (line.startsWith("> ")) {
      nodes.push(
        <blockquote key={index} className="mb-3 rounded-[8px] border-l-2 border-[#68f0cf]/50 bg-[#68f0cf]/[0.06] px-3 py-2 text-[#c7d8d0]">
          {renderInline(line.slice(2))}
        </blockquote>,
      );
      return;
    }
    nodes.push(line.trim() ? <p key={index} className="mb-2">{renderInline(line)}</p> : <div key={index} className="h-2" />);
  });
  flushTable("table-end");
  flushList("list-end");

  return (
    <article
      className={`overflow-y-auto rounded-[8px] border border-white/10 bg-[#050606] text-sm leading-7 text-[#c7d8d0] ${
        compact ? "max-h-none border-0 bg-transparent p-0" : "max-h-[650px] p-5"
      }`}
    >
      {nodes}
    </article>
  );
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index} className="rounded bg-white/10 px-1 py-0.5 font-mono text-xs text-[#68f0cf]">{part.slice(1, -1)}</code>;
    }
    return <span key={index}>{part}</span>;
  });
}

function renderMarkdownTable(rows: string[], key: string) {
  const cleanedRows = rows.filter((row) => !/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(row));
  const cells = cleanedRows.map((row) =>
    row
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => cell.trim()),
  );
  if (cells.length < 2) return null;

  const [header, ...body] = cells;
  return (
    <div key={key} className="mb-4 overflow-hidden rounded-[8px] border border-white/10">
      <table className="w-full text-left text-xs">
        <thead className="bg-white/[0.06] text-white">
          <tr>
            {header.map((cell, index) => <th key={index} className="px-3 py-2 font-medium">{renderInline(cell)}</th>)}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-white/10">
              {row.map((cell, cellIndex) => <td key={cellIndex} className="px-3 py-2 text-[#c7d8d0]">{renderInline(cell)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function inferInputState(text: string, file: File | null) {
  const clean = text.replace(/>.*$/gm, "").replace(/\s/g, "").toUpperCase();
  const hasHeader = text.trim().startsWith(">");
  const hasU = clean.includes("U");
  const hasT = clean.includes("T");
  const kind = hasU && !hasT ? "RNA" : hasT && !hasU ? "DNA" : clean ? "Mixed" : file ? "FASTA" : "Idle";
  return { hasHeader, kind };
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatEvalue(value: number) {
  if (value === 0) return "0";
  if (!Number.isFinite(value)) return String(value);
  return value.toExponential(1);
}
