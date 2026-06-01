"use client";

import type { ChangeEvent, FormEvent, ReactNode, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  CheckCircle2,
  Database,
  Dna,
  Download,
  FileText,
  FlaskConical,
  Gauge,
  Home,
  Loader2,
  MessageSquare,
  Play,
  Upload,
  Workflow,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { askAnalysis, createAnalysis, fetchDashboard, reportDownloadUrl } from "@/lib/api";
import type { AnalysisResult, ChatResponse, DashboardStats } from "@/lib/types";
import { BaseCompositionChart, BlastRankingChart, ConfidenceGauge } from "./charts";

type ViewId = "dashboard" | "upload" | "progress" | "overview" | "charts" | "report";

const navItems: Array<{ id: ViewId; label: string; icon: typeof Home }> = [
  { id: "dashboard", label: "首页 Dashboard", icon: Home },
  { id: "upload", label: "序列上传", icon: Upload },
  { id: "progress", label: "分析进度", icon: Workflow },
  { id: "overview", label: "结果总览", icon: Gauge },
  { id: "charts", label: "可视化分析", icon: BarChart3 },
  { id: "report", label: "AI报告问答", icon: Bot },
];

const workflow = ["序列检查", "geNomad 识别", "NCBI 查询", "结果融合", "DeepSeek 分析", "报告生成"];

export function BioSeqMindWorkbench() {
  const [activeView, setActiveView] = useState<ViewId>("dashboard");
  const [sequenceText, setSequenceText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("geNomad 和 BLAST 的证据是否一致？");
  const [chat, setChat] = useState<Array<{ role: "user" | "assistant"; content: string; meta?: string }>>([]);
  const [isAsking, setIsAsking] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchDashboard()
      .then(setDashboard)
      .catch(() => setDashboard({ total_analyses: 0, average_confidence: 0, recent: [] }));
  }, []);

  const metrics = useMemo(
    () => [
      {
        label: "累计任务",
        value: dashboard?.total_analyses ?? 0,
        suffix: "次",
        icon: Activity,
      },
      {
        label: "平均可信度",
        value: dashboard?.average_confidence ?? analysis?.fusion.confidence_score ?? 0,
        suffix: "%",
        icon: Gauge,
      },
      {
        label: "当前序列",
        value: analysis?.sequence.length ?? 0,
        suffix: "nt",
        icon: Dna,
      },
      {
        label: "BLAST 命中",
        value: analysis?.blast_hits.length ?? 0,
        suffix: "条",
        icon: Database,
      },
    ],
    [analysis, dashboard],
  );

  async function handleAnalyze(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError("");
    setIsAnalyzing(true);
    setActiveView("progress");
    try {
      const result = await createAnalysis(sequenceText, file);
      setAnalysis(result);
      setChat([
        {
          role: "assistant",
          content: result.report.markdown,
          meta: `${result.report.source} / ${result.report.model}`,
        },
      ]);
      setDashboard(await fetchDashboard());
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
    if (selected) {
      selected.text().then(setSequenceText).catch(() => setError("FASTA 文件读取失败"));
    }
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

  return (
    <div className="min-h-screen bg-[#070b0d] text-slate-100">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_12%,rgba(45,212,191,0.12),transparent_34%),linear-gradient(135deg,rgba(8,13,15,1),rgba(12,18,22,1)_48%,rgba(9,14,16,1))]" />
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-[#0a1013]/92 px-5 py-5 backdrop-blur-xl lg:block">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg border border-teal-300/30 bg-teal-300/10 text-teal-200">
              <Dna />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">BioSeqMind-AI</div>
              <div className="text-xs text-slate-400">核酸序列智能识别</div>
            </div>
          </div>
          <nav className="mt-8 flex flex-col gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const selected = activeView === item.id;
              return (
                <button
                  key={item.id}
                  className={`flex h-10 items-center gap-3 rounded-lg px-3 text-left text-sm transition ${
                    selected
                      ? "bg-teal-300/12 text-teal-100 ring-1 ring-teal-300/25"
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                  }`}
                  onClick={() => setActiveView(item.id)}
                  type="button"
                >
                  <Icon />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm text-slate-200">
              <FlaskConical />
              运行接口
            </div>
            <div className="mt-3 flex flex-col gap-2 text-xs text-slate-400">
              <div className="flex justify-between"><span>前端</span><span className="text-teal-200">5174</span></div>
              <div className="flex justify-between"><span>后端</span><span className="text-sky-200">8008</span></div>
              <div className="flex justify-between"><span>5173</span><span className="text-amber-200">不占用</span></div>
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-white/10 bg-[#070b0d]/85 px-4 py-4 backdrop-blur-xl md:px-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-normal text-white md:text-3xl">
                  BioSeqMind-AI 核酸序列智能识别分析系统
                </h1>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
                  geNomad 深度学习识别、NCBI BLAST/E-utilities 真实数据库证据与 DeepSeek 智能体解释融合。
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-teal-300/30 bg-teal-300/10 text-teal-100" variant="outline">
                  API Ready
                </Badge>
                <Button className="rounded-lg bg-teal-300 text-slate-950 hover:bg-teal-200" onClick={() => setActiveView("upload")}>
                  <Upload data-icon="inline-start" />
                  快速上传
                </Button>
              </div>
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-5 px-4 py-5 md:px-8">
            {error ? (
              <Alert className="rounded-lg border-rose-300/30 bg-rose-500/10 text-rose-100">
                <AlertTriangle />
                <AlertTitle>分析失败</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => {
                const Icon = metric.icon;
                return (
                  <Card key={metric.label} className="rounded-lg border-white/10 bg-white/[0.045] shadow-none">
                    <CardHeader>
                      <CardTitle className="text-sm text-slate-300">{metric.label}</CardTitle>
                      <CardAction>
                        <div className="grid size-8 place-items-center rounded-md bg-white/5 text-teal-200">
                          <Icon />
                        </div>
                      </CardAction>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-semibold text-white">
                        {metric.value}
                        <span className="ml-1 text-sm font-medium text-slate-400">{metric.suffix}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </section>

            {activeView === "dashboard" ? (
              <DashboardView analysis={analysis} dashboard={dashboard} onAnalyze={() => handleAnalyze()} onNavigate={setActiveView} />
            ) : null}
            {activeView === "upload" ? (
              <UploadView
                file={file}
                fileRef={fileRef}
                isAnalyzing={isAnalyzing}
                sequenceText={sequenceText}
                onAnalyze={handleAnalyze}
                onFile={handleFile}
                onSequenceText={setSequenceText}
              />
            ) : null}
            {activeView === "progress" ? <ProgressView analysis={analysis} isAnalyzing={isAnalyzing} /> : null}
            {activeView === "overview" ? <OverviewView analysis={analysis} onNavigate={setActiveView} /> : null}
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
        </main>
      </div>
    </div>
  );
}

function DashboardView({
  analysis,
  dashboard,
  onAnalyze,
  onNavigate,
}: {
  analysis: AnalysisResult | null;
  dashboard: DashboardStats | null;
  onAnalyze: () => void;
  onNavigate: (view: ViewId) => void;
}) {
  return (
    <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      <Card className="rounded-lg border-white/10 bg-[#0d1518] shadow-none">
        <CardHeader>
          <CardTitle className="text-lg text-white">智能分析工作流</CardTitle>
          <CardDescription>上传序列后自动串联模型识别、数据库查询、融合评分与 AI 报告。</CardDescription>
          <CardAction>
            <Button className="rounded-lg bg-teal-300 text-slate-950 hover:bg-teal-200" onClick={onAnalyze}>
              <Play data-icon="inline-start" />
              启动智能分析
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {workflow.map((label, index) => (
              <div key={label} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">0{index + 1}</span>
                  <CheckCircle2 className={analysis ? "text-teal-200" : "text-slate-600"} />
                </div>
                <div className="mt-4 text-sm font-medium text-slate-100">{label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-lg border-white/10 bg-[#0d1518] shadow-none">
        <CardHeader>
          <CardTitle className="text-lg text-white">最近分析</CardTitle>
          <CardDescription>SQLite 中保存的最近任务。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {(dashboard?.recent.length ? dashboard.recent : []).map((item) => (
              <button
                key={item.id}
                className="rounded-lg border border-white/10 bg-white/[0.035] p-3 text-left transition hover:bg-white/[0.06]"
                onClick={() => onNavigate("overview")}
                type="button"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-medium text-slate-100">{item.sequence_name}</span>
                  <Badge className="border-teal-300/30 bg-teal-300/10 text-teal-100" variant="outline">
                    {item.confidence_score}
                  </Badge>
                </div>
                <div className="mt-2 truncate text-xs text-slate-500">{item.candidate_source}</div>
              </button>
            ))}
            {!dashboard?.recent.length ? <EmptyState text="暂无历史任务，请上传真实 FASTA 或 DNA/RNA 序列。" /> : null}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function UploadView({
  file,
  fileRef,
  isAnalyzing,
  sequenceText,
  onAnalyze,
  onFile,
  onSequenceText,
}: {
  file: File | null;
  fileRef: RefObject<HTMLInputElement | null>;
  isAnalyzing: boolean;
  sequenceText: string;
  onAnalyze: (event: FormEvent<HTMLFormElement>) => void;
  onFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onSequenceText: (value: string) => void;
}) {
  return (
    <form className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]" onSubmit={onAnalyze}>
      <Card className="rounded-lg border-white/10 bg-[#0d1518] shadow-none">
        <CardHeader>
          <CardTitle className="text-lg text-white">序列上传</CardTitle>
          <CardDescription>支持粘贴 DNA/RNA 序列或上传 FASTA 文件。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <Textarea
              className="min-h-80 rounded-lg border-white/10 bg-black/25 font-mono text-sm leading-6 text-slate-100 placeholder:text-slate-600"
              value={sequenceText}
              onChange={(event) => onSequenceText(event.target.value)}
              placeholder="粘贴真实 FASTA 或原始 DNA/RNA 序列"
            />
            <div className="flex flex-wrap gap-2">
              <Input ref={fileRef} accept=".fa,.fasta,.fna,.txt" className="hidden" onChange={onFile} type="file" />
              <Button className="rounded-lg" onClick={() => fileRef.current?.click()} type="button" variant="outline">
                <FileText data-icon="inline-start" />
                选择 FASTA
              </Button>
              <Button className="rounded-lg bg-teal-300 text-slate-950 hover:bg-teal-200" disabled={isAnalyzing} type="submit">
                {isAnalyzing ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Play data-icon="inline-start" />}
                启动智能分析
              </Button>
            </div>
            {file ? <p className="text-sm text-slate-400">已选择：{file.name}</p> : null}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-lg border-white/10 bg-[#0d1518] shadow-none">
        <CardHeader>
          <CardTitle className="text-lg text-white">输入质控预览</CardTitle>
          <CardDescription>提交后后端会重新进行严格 FASTA 解析和非法字符检查。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["字符数", sequenceText.replace(/\s/g, "").length],
              ["FASTA 标头", sequenceText.trim().startsWith(">") ? "已检测" : "无"],
              ["疑似 RNA", /U/i.test(sequenceText) && !/T/i.test(sequenceText) ? "是" : "否"],
              ["输入来源", file ? "文件" : "文本"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                <div className="text-xs text-slate-500">{label}</div>
                <div className="mt-2 text-xl font-semibold text-white">{value}</div>
              </div>
            ))}
          </div>
          <Alert className="mt-5 rounded-lg border-amber-300/30 bg-amber-400/10 text-amber-100">
            <AlertTriangle />
            <AlertTitle>科研解释边界</AlertTitle>
            <AlertDescription>
              系统只输出真实依赖返回的数据；geNomad、NCBI 或 DeepSeek 不可用时会直接报错，不会生成演示结果。
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </form>
  );
}

function ProgressView({ analysis, isAnalyzing }: { analysis: AnalysisResult | null; isAnalyzing: boolean }) {
  return (
    <Card className="rounded-lg border-white/10 bg-[#0d1518] shadow-none">
      <CardHeader>
        <CardTitle className="text-lg text-white">分析进度</CardTitle>
        <CardDescription>序列检查 → geNomad 识别 → NCBI 查询 → 结果融合 → DeepSeek 分析 → 报告生成</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {workflow.map((label, index) => {
            const step = analysis?.timeline.find((item) => item.label === label);
            const done = Boolean(step) || Boolean(analysis);
            return (
              <div key={label} className="flex items-center gap-4 rounded-lg border border-white/10 bg-white/[0.035] p-4">
                <div className={`grid size-9 place-items-center rounded-md ${done ? "bg-teal-300/12 text-teal-100" : "bg-white/5 text-slate-500"}`}>
                  {isAnalyzing && !done && index === 0 ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-100">{label}</div>
                  <div className="mt-1 text-xs text-slate-500">{step?.detail ?? "等待执行"}</div>
                </div>
                <span className="text-xs tabular-nums text-slate-500">{step ? `${step.elapsed_ms} ms` : "pending"}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewView({ analysis, onNavigate }: { analysis: AnalysisResult | null; onNavigate: (view: ViewId) => void }) {
  if (!analysis) return <EmptyState text="还没有分析结果，请先上传序列。" />;
  const topHit = analysis.blast_hits[0];
  return (
    <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
      <Card className="rounded-lg border-white/10 bg-[#0d1518] shadow-none">
        <CardHeader>
          <CardTitle className="text-lg text-white">结果总览</CardTitle>
          <CardDescription>{analysis.sequence.name}</CardDescription>
          <CardAction>
            <RiskBadge risk={analysis.fusion.risk_level} />
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <MetricBox label="序列类型" value={analysis.sequence.sequence_type} />
              <MetricBox label="GC 含量" value={`${analysis.sequence.gc_content}%`} />
              <MetricBox label="geNomad" value={analysis.genomad.label} />
              <MetricBox label="可信度" value={`${analysis.fusion.confidence_score}/100`} />
            </div>
            <Separator />
            <div>
              <div className="mb-2 text-sm font-medium text-slate-200">BLAST Top Hit</div>
              <p className="text-sm leading-6 text-slate-400">
                {topHit ? `${topHit.accession} / ${topHit.organism}，identity ${topHit.identity}%` : "暂无命中"}
              </p>
            </div>
            <Button className="rounded-lg bg-teal-300 text-slate-950 hover:bg-teal-200" onClick={() => onNavigate("charts")}>
              <BarChart3 data-icon="inline-start" />
              查看可视化分析
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-lg border-white/10 bg-[#0d1518] shadow-none">
        <CardHeader>
          <CardTitle className="text-lg text-white">Top 5 命中表</CardTitle>
          <CardDescription>accession、物种、相似度、覆盖度与 E-value。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border border-white/10">
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
                  <TableRow key={hit.accession} className="border-white/10">
                    <TableCell>{hit.rank}</TableCell>
                    <TableCell className="font-mono text-teal-100">{hit.accession}</TableCell>
                    <TableCell>{hit.organism}</TableCell>
                    <TableCell>{hit.identity}%</TableCell>
                    <TableCell>{hit.evalue.toExponential(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function ChartsView({ analysis }: { analysis: AnalysisResult | null }) {
  return (
    <section className="grid gap-5 xl:grid-cols-3">
      <ChartPanel title="碱基组成" description="A/T/G/C/U/N 占比">
        <BaseCompositionChart analysis={analysis} />
      </ChartPanel>
      <ChartPanel title="BLAST 命中排名" description="Top Hit identity 对比">
        <BlastRankingChart analysis={analysis} />
      </ChartPanel>
      <ChartPanel title="综合可信度" description="融合 geNomad、BLAST 与质控">
        <ConfidenceGauge analysis={analysis} />
      </ChartPanel>
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
  if (!analysis) return <EmptyState text="还没有 AI 报告，请先完成一次分析。" />;
  return (
    <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <Card className="rounded-lg border-white/10 bg-[#0d1518] shadow-none">
        <CardHeader>
          <CardTitle className="text-lg text-white">AI 报告</CardTitle>
          <CardDescription>{analysis.report.source} / {analysis.report.model}</CardDescription>
          <CardAction>
            <a
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/[0.08]"
              href={reportDownloadUrl(analysis.id)}
            >
              <Download data-icon="inline-start" />
              Markdown
            </a>
          </CardAction>
        </CardHeader>
        <CardContent>
          <MarkdownPreview markdown={analysis.report.markdown} />
        </CardContent>
      </Card>
      <Card className="rounded-lg border-white/10 bg-[#0d1518] shadow-none">
        <CardHeader>
          <CardTitle className="text-lg text-white">继续追问</CardTitle>
          <CardDescription>围绕本次 geNomad、BLAST 与融合结果对话。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[520px] flex-col gap-3">
            <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="flex flex-col gap-3">
                {chat.map((item, index) => (
                  <div
                    key={`${item.role}-${index}`}
                    className={`rounded-lg border p-3 text-sm leading-6 ${
                      item.role === "user"
                        ? "ml-8 border-sky-300/25 bg-sky-300/10 text-sky-50"
                        : "mr-8 border-teal-300/20 bg-teal-300/8 text-slate-200"
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
                      {item.role === "user" ? <MessageSquare /> : <Bot />}
                      {item.role === "user" ? "用户" : item.meta}
                    </div>
                    <p className="whitespace-pre-wrap">{item.content}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Input
                className="rounded-lg border-white/10 bg-black/25"
                value={question}
                onChange={(event) => onQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onAsk();
                }}
                placeholder="继续追问分析依据..."
              />
              <Button className="rounded-lg bg-teal-300 text-slate-950 hover:bg-teal-200" disabled={isAsking} onClick={onAsk}>
                {isAsking ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Bot data-icon="inline-start" />}
                发送
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function MetricBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-2 truncate text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function ChartPanel({ children, description, title }: { children: ReactNode; description: string; title: string }) {
  return (
    <Card className="rounded-lg border-white/10 bg-[#0d1518] shadow-none">
      <CardHeader>
        <CardTitle className="text-lg text-white">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function RiskBadge({ risk }: { risk: "Low" | "Medium" | "High" }) {
  const className =
    risk === "High"
      ? "border-rose-300/30 bg-rose-400/10 text-rose-100"
      : risk === "Medium"
        ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
        : "border-teal-300/30 bg-teal-300/10 text-teal-100";
  return (
    <Badge className={className} variant="outline">
      {risk}
    </Badge>
  );
}

function MarkdownPreview({ markdown }: { markdown: string }) {
  return (
    <article className="max-h-[620px] overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-5 text-sm leading-7 text-slate-300">
      {markdown.split("\n").map((line, index) => {
        if (line.startsWith("# ")) {
          return <h2 key={index} className="mb-4 text-xl font-semibold text-white">{line.replace("# ", "")}</h2>;
        }
        if (line.startsWith("## ")) {
          return <h3 key={index} className="mb-2 mt-5 text-base font-semibold text-teal-100">{line.replace("## ", "")}</h3>;
        }
        if (line.startsWith("- ")) {
          return <p key={index} className="pl-3 text-slate-300">{line}</p>;
        }
        return line.trim() ? <p key={index} className="mb-2">{line}</p> : <div key={index} className="h-2" />;
      })}
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.025] p-8 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}
