"use client";

import type { ChangeEvent, FormEvent, ReactNode, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import * as THREE from "three";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  BrainCircuit,
  Check,
  Clock3,
  Database,
  Dna,
  Download,
  FileText,
  Gauge,
  Layers3,
  Loader2,
  MessageSquare,
  Microscope,
  Network,
  Play,
  RefreshCw,
  Server,
  Sparkles,
  TerminalSquare,
  Upload,
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
import {
  askAnalysis,
  createAnalysis,
  fetchDashboard,
  reportDownloadUrl,
  type AnalysisMode,
} from "@/lib/api";
import type { AnalysisResult, ChatResponse, DashboardStats } from "@/lib/types";
import { BaseCompositionChart, BlastRankingChart, ConfidenceGauge } from "./charts";

type AtlasView = "evidence" | "charts" | "report" | "ops";

const sampleSequenceUrl = "/samples/sequence.fasta";

const atlasViews: Array<{ id: AtlasView; label: string; icon: LucideIcon }> = [
  { id: "evidence", label: "Evidence", icon: Network },
  { id: "charts", label: "Charts", icon: BarChart3 },
  { id: "report", label: "Report", icon: Bot },
  { id: "ops", label: "Ops", icon: Activity },
];

const pipelineBlueprint: Array<{ key: string; label: string; tag: string; icon: LucideIcon }> = [
  { key: "input_precheck", label: "输入预检", tag: "00", icon: Sparkles },
  { key: "sequence", label: "序列质控", tag: "01", icon: Dna },
  { key: "genomad", label: "geNomad", tag: "02", icon: Microscope },
  { key: "ncbi", label: "NCBI BLAST", tag: "03", icon: Database },
  { key: "fusion", label: "证据融合", tag: "04", icon: Layers3 },
  { key: "deepseek", label: "AI 解释", tag: "05", icon: BrainCircuit },
  { key: "report", label: "报告生成", tag: "06", icon: FileText },
];

export function BioSeqMindWorkbench() {
  const [enteredLab, setEnteredLab] = useState(false);
  const [atlasView, setAtlasView] = useState<AtlasView>("evidence");
  const [sequenceText, setSequenceText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("fast_nn");
  const [deepseekPrecheck, setDeepseekPrecheck] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("本次 geNomad 和 BLAST 的证据是否一致？");
  const [chat, setChat] = useState<Array<{ role: "user" | "assistant"; content: string; meta?: string }>>([]);
  const [isAsking, setIsAsking] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const sequenceRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    void refreshDashboard();
  }, []);

  const signal = useMemo(() => inspectSequence(sequenceText), [sequenceText]);
  const topHit = analysis?.blast_hits[0] ?? null;
  const composition = analysis?.sequence.base_ratios ?? signal.ratios;
  const runState = isAnalyzing ? "Sequencing" : analysis ? "Resolved" : signal.length ? "Armed" : "Standby";
  const atlasInHero = isAnalyzing || Boolean(analysis);

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
      setError("请先输入 DNA/RNA 序列，或上传 FASTA 文件。");
      return;
    }
    setIsAnalyzing(true);
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
      setAtlasView("evidence");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "分析失败");
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

  async function handleSampleSequence() {
    setFile(null);
    setError("");
    try {
      const response = await fetch(sampleSequenceUrl, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setSequenceText(await response.text());
    } catch {
      setError("样例 FASTA 文件读取失败，请检查 public/samples/sequence.fasta。");
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

  if (!enteredLab) {
    return <LandingPortal onEnter={() => setEnteredLab(true)} />;
  }

  return (
    <div className="cinema-shell min-h-screen bg-[#050706] text-[#edf8f2]">
      <CinematicBackdrop />
      <main className="cinema-page">
        <section className="cinema-hero">
          <TopConstellation
            analysisMode={analysisMode}
            isAnalyzing={isAnalyzing}
            onAnalyze={() => void handleAnalyze()}
            onMode={setAnalysisMode}
          />

          <form className="sequence-vessel" onSubmit={handleAnalyze}>
            <SequenceCapsule
              deepseekPrecheck={deepseekPrecheck}
              file={file}
              fileRef={fileRef}
              isAnalyzing={isAnalyzing}
              sequenceRef={sequenceRef}
              sequenceText={sequenceText}
              signal={signal}
              onDeepseekPrecheck={setDeepseekPrecheck}
              onFile={handleFile}
              onSample={() => void handleSampleSequence()}
              onSequenceText={(value) => {
                setSequenceText(value);
                if (error) setError("");
              }}
            />
          </form>

          {atlasInHero ? (
            <HeroAtlas
              active={atlasView}
              analysis={analysis}
              chat={chat}
              dashboard={dashboard}
              isAsking={isAsking}
              question={question}
              onActive={setAtlasView}
              onAsk={handleQuestion}
              onQuestion={setQuestion}
              onRefreshDashboard={refreshDashboard}
            />
          ) : (
            <HelixSpectacle
              analysis={analysis}
              composition={composition}
              isAnalyzing={isAnalyzing}
              runState={runState}
              signal={signal}
            />
          )}

          <EvidenceLens analysis={analysis} dashboard={dashboard} signal={signal} topHit={topHit} />

          <PipelineOrbit analysis={analysis} isAnalyzing={isAnalyzing} />
        </section>

        {error ? (
          <Alert className="mt-4 rounded-[8px] border-[#ff6b6b]/35 bg-[#2a1014]/90 text-[#ffe1e5] shadow-none">
            <AlertTriangle />
            <AlertTitle>分析失败</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {!atlasInHero ? (
          <section className="atlas-section">
            <AtlasNavigator active={atlasView} onActive={setAtlasView} />
            <AtlasCanvas
              active={atlasView}
              analysis={analysis}
              chat={chat}
              dashboard={dashboard}
              isAsking={isAsking}
              question={question}
              onAsk={handleQuestion}
              onQuestion={setQuestion}
              onRefreshDashboard={refreshDashboard}
            />
          </section>
        ) : null}
      </main>
    </div>
  );
}

function LandingPortal({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="landing-shell min-h-screen bg-[#050706] text-[#edf8f2]">
      <CinematicBackdrop />
      <header className="landing-nav">
        <div className="brand-constellation">
          <span className="brand-sigil">
            <Dna />
          </span>
          <div>
            <h1>BioSeqMind</h1>
            <p>Helix Observatory</p>
          </div>
        </div>
        <div className="landing-status">
          <span>geNomad</span>
          <span>NCBI</span>
          <span>DeepSeek</span>
        </div>
      </header>

      <main className="landing-stage">
        <section className="landing-copy">
          <p>AI BIOSEQUENCE INTELLIGENCE</p>
          <h2>
            <span>BioSeqMind</span>
            <span>分子证据引擎</span>
          </h2>
          <span>将 FASTA、geNomad、NCBI BLAST 与 AI 报告压缩成一条可追溯的分子证据链。</span>
          <button className="landing-enter" onClick={onEnter} type="button">
            <Play />
            进入分析舱
          </button>
        </section>

        <section className="landing-organism" aria-label="BioSeqMind helix visual">
          <BioCinemaCanvas active />
        </section>

        <aside className="landing-proof">
          <div>
            <small>01</small>
            <strong>Molecular Intake</strong>
            <span>序列清洗、长度、GC 含量与输入有效性</span>
          </div>
          <div>
            <small>02</small>
            <strong>Evidence Fusion</strong>
            <span>geNomad、BLAST 与候选来源融合评分</span>
          </div>
          <div>
            <small>03</small>
            <strong>AI Report</strong>
            <span>可下载 Markdown 报告与上下文追问</span>
          </div>
        </aside>
      </main>
    </div>
  );
}

function CinematicBackdrop() {
  return (
    <div className="cinema-backdrop" aria-hidden="true">
      <div className="cinema-grid" />
      <div className="cinema-noise" />
    </div>
  );
}

function TopConstellation({
  analysisMode,
  isAnalyzing,
  onAnalyze,
  onMode,
}: {
  analysisMode: AnalysisMode;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  onMode: (mode: AnalysisMode) => void;
}) {
  return (
    <header className="top-constellation">
      <div className="brand-constellation">
        <span className="brand-sigil">
          <Dna />
        </span>
        <div>
          <h1>BioSeqMind</h1>
          <p>Helix Observatory</p>
        </div>
      </div>
      <div className="mode-constellation" aria-label="analysis mode">
        <button className={analysisMode === "fast_nn" ? "is-active" : ""} onClick={() => onMode("fast_nn")} type="button">
          <Zap />
          Fast
        </button>
        <button className={analysisMode === "end_to_end" ? "is-active" : ""} onClick={() => onMode("end_to_end")} type="button">
          <Server />
          Full
        </button>
      </div>
      <Button className="cinema-launch" disabled={isAnalyzing} onClick={onAnalyze} type="button">
        {isAnalyzing ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Play data-icon="inline-start" />}
        Run analysis
      </Button>
    </header>
  );
}

function SequenceCapsule({
  deepseekPrecheck,
  file,
  fileRef,
  isAnalyzing,
  sequenceRef,
  sequenceText,
  signal,
  onDeepseekPrecheck,
  onFile,
  onSample,
  onSequenceText,
}: {
  deepseekPrecheck: boolean;
  file: File | null;
  fileRef: RefObject<HTMLInputElement | null>;
  isAnalyzing: boolean;
  sequenceRef: RefObject<HTMLTextAreaElement | null>;
  sequenceText: string;
  signal: SequenceSignal;
  onDeepseekPrecheck: (enabled: boolean) => void;
  onFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onSample: () => void;
  onSequenceText: (value: string) => void;
}) {
  return (
    <>
      <div className="vessel-heading">
        <span>
          <TerminalSquare />
        </span>
        <div>
          <p>Sequence Vessel</p>
          <h2>输入序列</h2>
        </div>
      </div>

      <div className="sequence-slate">
        <div className="slate-meta">
          <span>{signal.hasHeader ? "FASTA header detected" : "Raw sequence"}</span>
          <strong>{signal.length.toLocaleString()} nt</strong>
        </div>
        <Textarea
          className="sequence-textarea"
          placeholder="Paste FASTA / DNA / RNA sequence"
          ref={sequenceRef}
          value={sequenceText}
          onChange={(event) => onSequenceText(event.target.value)}
        />
      </div>

      <Input ref={fileRef} accept=".fa,.fasta,.fna,.txt" className="hidden" onChange={onFile} type="file" />
      <div className="vessel-actions">
        <button onClick={() => fileRef.current?.click()} type="button">
          <Upload />
          <span>
            <strong>FASTA</strong>
            <small>{file?.name ?? "Upload"}</small>
          </span>
        </button>
        <button onClick={onSample} type="button">
          <Sparkles />
          <span>
            <strong>Sample</strong>
            <small>Load demo</small>
          </span>
        </button>
      </div>

      <div className="precheck-line">
        <div>
          <strong>DeepSeek precheck</strong>
          <span>{deepseekPrecheck ? "Enabled" : "Disabled"}</span>
        </div>
        <button
          aria-label="切换 DeepSeek 输入预检"
          className={deepseekPrecheck ? "is-on" : ""}
          onClick={() => onDeepseekPrecheck(!deepseekPrecheck)}
          type="button"
        >
          <span />
        </button>
      </div>

      <button className="vessel-run" disabled={isAnalyzing} type="submit">
        {isAnalyzing ? <Loader2 className="animate-spin" /> : <Play />}
        {isAnalyzing ? "Sequencing" : "Start analysis"}
      </button>
    </>
  );
}

function HelixSpectacle({
  analysis,
  composition,
  isAnalyzing,
  runState,
  signal,
}: {
  analysis: AnalysisResult | null;
  composition: Record<"A" | "T" | "G" | "C" | "U" | "N", number>;
  isAnalyzing: boolean;
  runState: string;
  signal: SequenceSignal;
}) {
  return (
    <section className="helix-spectacle">
      <BioCinemaCanvas active={isAnalyzing} />
      <div className="spectacle-copy">
        <p>AI Sequence Intelligence</p>
        <h2>{runState}</h2>
        <span>{analysis?.fusion.candidate_source ?? "输入序列后，Helix Core 会把质控、识别、BLAST 和 AI 解释汇聚成一条证据流。"}</span>
      </div>
      <div className="spectacle-readouts">
        <MicroReadout label="Length" value={`${analysis?.sequence.length ?? signal.length} nt`} />
        <MicroReadout label="GC" value={`${analysis?.sequence.gc_content ?? signal.gc}%`} />
        <MicroReadout label="Type" value={analysis?.sequence.sequence_type ?? signal.kind} />
        <MicroReadout label="Risk" value={analysis?.fusion.risk_level ?? "Pending"} />
      </div>
      <CompositionWave composition={composition} />
    </section>
  );
}

function BioCinemaCanvas({ active }: { active?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x03060b, 0.022);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0.08, 11);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const group = new THREE.Group();
    scene.add(group);

    const createNoiseTexture = () => {
      const textureCanvas = document.createElement("canvas");
      textureCanvas.width = 96;
      textureCanvas.height = 96;
      const context = textureCanvas.getContext("2d");
      if (context) {
        const image = context.createImageData(textureCanvas.width, textureCanvas.height);
        for (let index = 0; index < image.data.length; index += 4) {
          const value = 106 + Math.random() * 92;
          image.data[index] = value;
          image.data[index + 1] = value;
          image.data[index + 2] = value;
          image.data[index + 3] = 255;
        }
        context.putImageData(image, 0, 0);
      }
      const texture = new THREE.CanvasTexture(textureCanvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(2.6, 2.6);
      return texture;
    };

    const createGlowTexture = () => {
      const textureCanvas = document.createElement("canvas");
      textureCanvas.width = 256;
      textureCanvas.height = 256;
      const context = textureCanvas.getContext("2d");
      if (context) {
        const glow = context.createRadialGradient(128, 128, 0, 128, 128, 128);
        glow.addColorStop(0, "rgba(88, 194, 255, 0.52)");
        glow.addColorStop(0.38, "rgba(42, 126, 210, 0.22)");
        glow.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = glow;
        context.fillRect(0, 0, 256, 256);
      }
      return new THREE.CanvasTexture(textureCanvas);
    };

    const beadBumpMap = createNoiseTexture();
    const glowTexture = createGlowTexture();
    const microscopeGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        blending: THREE.AdditiveBlending,
        color: 0x78d7ff,
        depthWrite: false,
        map: glowTexture,
        opacity: 0.45,
        transparent: true,
      }),
    );
    microscopeGlow.position.set(0, -0.1, -2.6);
    microscopeGlow.scale.set(5.7, 7.5, 1);
    scene.add(microscopeGlow);

    const backboneMaterialA = new THREE.MeshPhysicalMaterial({
      bumpMap: beadBumpMap,
      bumpScale: 0.014,
      clearcoat: 0.72,
      clearcoatRoughness: 0.3,
      color: 0x74dff2,
      emissive: 0x093345,
      emissiveIntensity: 0.42,
      metalness: 0.04,
      roughness: 0.43,
    });
    const backboneMaterialB = new THREE.MeshPhysicalMaterial({
      bumpMap: beadBumpMap,
      bumpScale: 0.012,
      clearcoat: 0.7,
      clearcoatRoughness: 0.32,
      color: 0xc1799f,
      emissive: 0x311120,
      emissiveIntensity: 0.34,
      metalness: 0.04,
      roughness: 0.46,
    });
    const ghostBackboneMaterial = new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: 0x7fe7ff,
      depthWrite: false,
      opacity: 0.08,
      transparent: true,
    });
    const rungMaterial = new THREE.MeshStandardMaterial({
      color: 0xdaecf8,
      emissive: 0x07131b,
      metalness: 0.12,
      opacity: 0.62,
      roughness: 0.3,
      transparent: true,
    });
    const hydrogenMaterial = new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: 0xe8f3ff,
      depthWrite: false,
      opacity: 0.36,
      transparent: true,
    });
    const phosphateMaterial = new THREE.MeshStandardMaterial({
      color: 0xeaf6ff,
      emissive: 0x102032,
      metalness: 0.18,
      roughness: 0.28,
    });
    const sugarMaterial = new THREE.MeshStandardMaterial({
      color: 0xa9c2d9,
      emissive: 0x0a1521,
      metalness: 0.12,
      roughness: 0.32,
    });
    const baseMaterials = [
      new THREE.MeshStandardMaterial({ color: 0x58d5ee, emissive: 0x073749, emissiveIntensity: 0.35, metalness: 0.05, roughness: 0.34 }),
      new THREE.MeshStandardMaterial({ color: 0xffb64b, emissive: 0x4b2307, emissiveIntensity: 0.38, metalness: 0.08, roughness: 0.3 }),
      new THREE.MeshStandardMaterial({ color: 0xb083ff, emissive: 0x20103f, emissiveIntensity: 0.34, metalness: 0.05, roughness: 0.34 }),
      new THREE.MeshStandardMaterial({ color: 0xf07aa9, emissive: 0x3d1026, emissiveIntensity: 0.32, metalness: 0.06, roughness: 0.35 }),
    ];
    const baseBridgeMaterials = [
      new THREE.MeshPhysicalMaterial({ color: 0x57dfff, emissive: 0x083345, emissiveIntensity: 0.42, metalness: 0.1, roughness: 0.2, clearcoat: 0.78, clearcoatRoughness: 0.18 }),
      new THREE.MeshPhysicalMaterial({ color: 0xffb347, emissive: 0x4f2307, emissiveIntensity: 0.45, metalness: 0.1, roughness: 0.22, clearcoat: 0.74, clearcoatRoughness: 0.2 }),
      new THREE.MeshPhysicalMaterial({ color: 0xb48cff, emissive: 0x211048, emissiveIntensity: 0.4, metalness: 0.08, roughness: 0.22, clearcoat: 0.72, clearcoatRoughness: 0.2 }),
      new THREE.MeshPhysicalMaterial({ color: 0xf075a4, emissive: 0x3a1024, emissiveIntensity: 0.34, metalness: 0.08, roughness: 0.24, clearcoat: 0.7, clearcoatRoughness: 0.22 }),
    ];

    const makeStrand = (phase: number) => {
      const points: THREE.Vector3[] = [];
      for (let index = 0; index < 360; index++) {
        const t = index / 359;
        const angle = t * Math.PI * 6.65 + phase;
        const radius = 0.9 + Math.cos(t * Math.PI * 3.2) * 0.028;
        const axisX = Math.sin((t - 0.08) * Math.PI * 1.55) * 0.16;
        const axisZ = Math.cos(t * Math.PI * 1.2) * 0.08;
        points.push(new THREE.Vector3(axisX + Math.cos(angle) * radius, (t - 0.5) * 7.45, axisZ + Math.sin(angle) * radius * 0.66));
      }
      return points;
    };

    const strandA = makeStrand(0);
    const strandB = makeStrand(Math.PI);
    const curveA = new THREE.CatmullRomCurve3(strandA);
    const curveB = new THREE.CatmullRomCurve3(strandB);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curveA, 360, 0.018, 18, false), rungMaterial));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curveB, 360, 0.018, 18, false), rungMaterial));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curveA, 360, 0.072, 18, false), ghostBackboneMaterial));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curveB, 360, 0.058, 18, false), ghostBackboneMaterial));

    const beadGeometry = new THREE.SphereGeometry(0.096, 32, 24);
    const rearBeadGeometry = new THREE.SphereGeometry(0.081, 28, 22);
    const atomGeometry = new THREE.SphereGeometry(0.034, 18, 16);
    const baseRingGeometry = new THREE.TorusGeometry(0.054, 0.006, 6, 8);
    const smallRingGeometry = new THREE.TorusGeometry(0.038, 0.005, 5, 7);
    const phosphateGeometry = new THREE.IcosahedronGeometry(0.037, 1);
    const sugarGeometry = new THREE.TorusGeometry(0.058, 0.006, 6, 20);
    const cylinderBetween = (
      start: THREE.Vector3,
      end: THREE.Vector3,
      radius: number,
      material: THREE.Material,
      segments = 14,
    ) => {
      const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      const direction = new THREE.Vector3().subVectors(end, start);
      const length = direction.length();
      const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), material);
      cylinder.position.copy(midpoint);
      cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
      group.add(cylinder);
      return cylinder;
    };
    const pointBetween = (start: THREE.Vector3, end: THREE.Vector3, amount: number) => start.clone().lerp(end, amount);
    const addBaseRing = (position: THREE.Vector3, direction: THREE.Vector3, material: THREE.Material, purine: boolean, spin: number) => {
      const ring = new THREE.Mesh(purine ? baseRingGeometry : smallRingGeometry, material);
      ring.position.copy(position);
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
      ring.rotateZ(spin);
      group.add(ring);
    };

    for (let index = 2; index < strandA.length; index += 7) {
      const beadA = new THREE.Mesh(beadGeometry, backboneMaterialA);
      beadA.position.copy(strandA[index]);
      const beadB = new THREE.Mesh(rearBeadGeometry, backboneMaterialB);
      beadB.position.copy(strandB[index]);
      group.add(beadA, beadB);
    }

    for (let index = 18; index < strandA.length - 18; index += 10) {
      const a = strandA[index];
      const b = strandB[index];
      const pairDirection = new THREE.Vector3().subVectors(b, a).normalize();
      const baseIndex = Math.floor(index / 10);
      const baseMaterialA = baseMaterials[baseIndex % baseMaterials.length];
      const baseMaterialB = baseMaterials[(baseIndex + 1) % baseMaterials.length];
      const bridgeMaterial = baseBridgeMaterials[baseIndex % baseBridgeMaterials.length];
      cylinderBetween(pointBetween(a, b, 0.12), pointBetween(a, b, 0.88), 0.018, bridgeMaterial, 18);
      cylinderBetween(pointBetween(a, b, 0.14), pointBetween(a, b, 0.86), 0.006, hydrogenMaterial, 10);
      cylinderBetween(a, pointBetween(a, b, 0.1), 0.012, rungMaterial, 12);
      cylinderBetween(b, pointBetween(a, b, 0.9), 0.012, rungMaterial, 12);
      if (baseIndex % 2 === 0) {
        addBaseRing(pointBetween(a, b, 0.28), pairDirection, baseMaterialA, true, index * 0.03);
        addBaseRing(pointBetween(a, b, 0.72), pairDirection, baseMaterialB, false, index * -0.04);
      }
      [0.1, 0.22, 0.39, 0.61, 0.78, 0.9].forEach((amount, atomIndex) => {
        const atom = new THREE.Mesh(atomGeometry, atomIndex < 3 ? baseMaterialA : baseMaterialB);
        atom.position.copy(pointBetween(a, b, amount));
        group.add(atom);
      });
    }

    for (let index = 0; index < strandA.length; index += 12) {
      const phosphateA = new THREE.Mesh(phosphateGeometry, phosphateMaterial);
      phosphateA.position.copy(strandA[index]);
      const phosphateB = new THREE.Mesh(phosphateGeometry, phosphateMaterial);
      phosphateB.position.copy(strandB[index]);
      const sugarA = new THREE.Mesh(sugarGeometry, sugarMaterial);
      sugarA.position.copy(strandA[Math.min(index + 4, strandA.length - 1)]);
      sugarA.rotation.set(index * 0.07, index * 0.11, Math.PI / 2);
      const sugarB = new THREE.Mesh(sugarGeometry, sugarMaterial);
      sugarB.position.copy(strandB[Math.min(index + 4, strandB.length - 1)]);
      sugarB.rotation.set(index * 0.07, index * 0.11 + Math.PI, Math.PI / 2);
      group.add(phosphateA, phosphateB, sugarA, sugarB);
    }

    const ringMaterial = new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: 0xb7d7ff,
      depthWrite: false,
      opacity: 0.025,
      transparent: true,
    });
    const rings = [
      new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.004, 8, 160), ringMaterial),
      new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.004, 8, 160), ringMaterial),
      new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.004, 8, 160), ringMaterial),
    ];
    rings[0].rotation.x = Math.PI / 2.35;
    rings[1].rotation.x = Math.PI / 2.8;
    rings[1].rotation.y = Math.PI / 5;
    rings[2].rotation.x = Math.PI / 2;
    rings[2].rotation.z = Math.PI / 7;
    rings.forEach((ring) => group.add(ring));

    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(220 * 3);
    for (let index = 0; index < 220; index++) {
      const radius = 2.4 + ((index * 37) % 110) / 40;
      const theta = index * 1.618;
      const phi = Math.acos(2 * ((index % 97) / 97) - 1);
      positions[index * 3] = Math.sin(phi) * Math.cos(theta) * radius;
      positions[index * 3 + 1] = Math.sin(phi) * Math.sin(theta) * radius * 0.72;
      positions[index * 3 + 2] = Math.cos(phi) * radius;
    }
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({
        blending: THREE.AdditiveBlending,
        color: 0xcfe3ff,
        depthWrite: false,
        opacity: 0.16,
        size: 0.012,
        transparent: true,
      }),
    );
    group.add(particles);

    group.rotation.x = -0.08;
    group.rotation.y = -0.24;
    group.rotation.z = -0.16;
    group.scale.setScalar(0.88);

    const keyLight = new THREE.PointLight(0xf6fbff, 15, 13);
    keyLight.position.set(3.2, 4.8, 5.2);
    scene.add(keyLight);
    const fillLight = new THREE.PointLight(0x4fd9ff, 5.4, 12);
    fillLight.position.set(-4.2, -2.4, 3.8);
    scene.add(fillLight);
    const rimLight = new THREE.PointLight(0xffbad1, 3.5, 10);
    rimLight.position.set(-2.8, 3.2, -3.4);
    scene.add(rimLight);
    const amberLight = new THREE.PointLight(0xffb347, 2.2, 8);
    amberLight.position.set(1.8, -1.6, 3.6);
    scene.add(amberLight);
    scene.add(new THREE.AmbientLight(0xa9c4ec, 0.7));

    const pointer = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    const lens = { x: 0.58, y: 0.48 };
    const lensTarget = { x: 0.58, y: 0.48 };
    let pointerInside = false;
    let nextWanderAt = 4200 + Math.random() * 1800;
    let wanderEase = 0.028;
    let nextWaveAt = 1800 + Math.random() * 2200;
    let waveUntil = 0;
    const setLensPosition = () => {
      host.style.setProperty("--lens-x", `${(lens.x * 100).toFixed(2)}%`);
      host.style.setProperty("--lens-y", `${(lens.y * 100).toFixed(2)}%`);
    };
    const resize = () => {
      const rect = host.getBoundingClientRect();
      renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
      camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height);
      camera.updateProjectionMatrix();
    };
    const onPointerMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      const normalizedX = (event.clientX - rect.left) / Math.max(1, rect.width);
      const normalizedY = (event.clientY - rect.top) / Math.max(1, rect.height);
      pointerInside = true;
      pointer.x = (normalizedX - 0.5) * 2;
      pointer.y = (normalizedY - 0.5) * 2;
      lensTarget.x = Math.min(0.84, Math.max(0.16, normalizedX));
      lensTarget.y = Math.min(0.84, Math.max(0.16, normalizedY));
    };
    const onPointerEnter = () => {
      pointerInside = true;
    };
    const onPointerLeave = () => {
      pointerInside = false;
      pointer.x = 0;
      pointer.y = 0;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    host.addEventListener("pointerenter", onPointerEnter);
    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerleave", onPointerLeave);
    resize();
    setLensPosition();

    let frame = 0;
    let animationId = 0;
    const animate = () => {
      const now = performance.now();
      frame += 0.01;
      if (!pointerInside && now > nextWanderAt) {
        lensTarget.x = 0.48 + Math.random() * 0.2;
        lensTarget.y = 0.34 + Math.random() * 0.34;
        wanderEase = Math.random() > 0.54 ? 0.018 + Math.random() * 0.02 : 0.08 + Math.random() * 0.08;
        nextWanderAt = now + 420 + Math.random() * 2600;
      }
      if (now > nextWaveAt) {
        waveUntil = now + 420 + Math.random() * 520;
        nextWaveAt = now + 4200 + Math.random() * 6200;
      }
      host.classList.toggle("is-wavering", now < waveUntil);
      const lensEase = pointerInside ? 0.2 : wanderEase;
      lens.x += (lensTarget.x - lens.x) * lensEase;
      lens.y += (lensTarget.y - lens.y) * lensEase;
      setLensPosition();
      target.x += (pointer.x - target.x) * 0.055;
      target.y += (pointer.y - target.y) * 0.055;
      group.rotation.y += active ? 0.0028 : 0.0014;
      group.rotation.x += (-0.08 - target.y * 0.24 - group.rotation.x) * 0.035;
      group.rotation.z += (-0.16 + target.x * 0.2 - group.rotation.z) * 0.035;
      camera.position.x += (target.x * 0.28 - camera.position.x) * 0.03;
      camera.position.y += (0.12 - target.y * 0.18 - camera.position.y) * 0.03;
      camera.lookAt(0, 0, 0);
      rings[0].rotation.z += 0.0025;
      rings[1].rotation.z -= 0.0018;
      particles.rotation.y -= 0.0015;
      particles.rotation.x = Math.sin(frame) * 0.04;
      renderer.render(scene, camera);
      animationId = window.requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(animationId);
      host.classList.remove("is-wavering");
      host.removeEventListener("pointerenter", onPointerEnter);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);
      observer.disconnect();
      scene.traverse((object) => {
        if ("geometry" in object && object.geometry instanceof THREE.BufferGeometry) {
          object.geometry.dispose();
        }
        if ("material" in object) {
          const material = object.material as THREE.Material | THREE.Material[];
          if (Array.isArray(material)) {
            material.forEach((item) => item.dispose());
          } else {
            material.dispose();
          }
        }
      });
      beadBumpMap.dispose();
      glowTexture.dispose();
      renderer.dispose();
    };
  }, [active]);

  return (
    <div className="bio-observation-field">
      <canvas className="bio-cinema-canvas" ref={canvasRef} />
      <span className="microscope-lens" />
      <span className="microscope-wave" />
    </div>
  );
}

function EvidenceLens({
  analysis,
  dashboard,
  signal,
  topHit,
}: {
  analysis: AnalysisResult | null;
  dashboard: DashboardStats | null;
  signal: SequenceSignal;
  topHit: AnalysisResult["blast_hits"][number] | null;
}) {
  return (
    <aside className="evidence-lens">
      <div className="lens-title">
        <span>Evidence Lens</span>
        <Gauge />
      </div>
      <LensMetric label="Total runs" value={dashboard?.total_analyses ?? 0} suffix="runs" />
      <LensMetric label="Average confidence" value={Math.round(dashboard?.average_confidence ?? analysis?.fusion.confidence_score ?? 0)} suffix="%" />
      <LensMetric label="Input length" value={analysis?.sequence.length ?? signal.length} suffix="nt" />
      <EvidenceMeter label="geNomad" score={analysis ? analysis.genomad.confidence * 100 : 0} value={analysis?.genomad.label ?? "Waiting"} />
      <EvidenceMeter label="BLAST" score={topHit?.identity ?? 0} value={topHit?.organism ?? "Waiting"} />
      <EvidenceMeter label="Fusion" score={analysis?.fusion.confidence_score ?? 0} value={analysis?.fusion.candidate_source ?? "Waiting"} />
    </aside>
  );
}

function PipelineOrbit({ analysis, isAnalyzing }: { analysis: AnalysisResult | null; isAnalyzing: boolean }) {
  const stepMap = new Map((analysis?.timeline ?? []).map((step) => [step.key, step]));
  return (
    <nav className="pipeline-orbit" aria-label="analysis pipeline">
      {pipelineBlueprint.map((item, index) => {
        const step = stepMap.get(item.key);
        const status = step?.status ?? (isAnalyzing && index < 4 ? "running" : "pending");
        const Icon = item.icon;
        return (
          <div key={item.key} className={`orbit-step orbit-${status}`}>
            <span>{item.tag}</span>
            <Icon />
            <strong>{item.label}</strong>
            <small>{step?.detail ?? (status === "running" ? "Live" : "Ready")}</small>
          </div>
        );
      })}
    </nav>
  );
}

function HeroAtlas({
  active,
  analysis,
  chat,
  dashboard,
  isAsking,
  question,
  onActive,
  onAsk,
  onQuestion,
  onRefreshDashboard,
}: {
  active: AtlasView;
  analysis: AnalysisResult | null;
  chat: Array<{ role: "user" | "assistant"; content: string; meta?: string }>;
  dashboard: DashboardStats | null;
  isAsking: boolean;
  question: string;
  onActive: (view: AtlasView) => void;
  onAsk: () => void;
  onQuestion: (value: string) => void;
  onRefreshDashboard: () => void;
}) {
  return (
    <section className="hero-atlas">
      <AtlasNavigator active={active} onActive={onActive} />
      <AtlasCanvas
        active={active}
        analysis={analysis}
        chat={chat}
        dashboard={dashboard}
        isAsking={isAsking}
        question={question}
        onAsk={onAsk}
        onQuestion={onQuestion}
        onRefreshDashboard={onRefreshDashboard}
      />
    </section>
  );
}

function AtlasNavigator({ active, onActive }: { active: AtlasView; onActive: (view: AtlasView) => void }) {
  return (
    <div className="atlas-navigator">
      <div>
        <p>Analysis Atlas</p>
        <h2>证据、图谱、报告和运行记录</h2>
      </div>
      <div className="atlas-tabs">
        {atlasViews.map((view) => {
          const Icon = view.icon;
          return (
            <button key={view.id} className={active === view.id ? "is-active" : ""} onClick={() => onActive(view.id)} type="button">
              <Icon />
              {view.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AtlasCanvas({
  active,
  analysis,
  chat,
  dashboard,
  isAsking,
  question,
  onAsk,
  onQuestion,
  onRefreshDashboard,
}: {
  active: AtlasView;
  analysis: AnalysisResult | null;
  chat: Array<{ role: "user" | "assistant"; content: string; meta?: string }>;
  dashboard: DashboardStats | null;
  isAsking: boolean;
  question: string;
  onAsk: () => void;
  onQuestion: (value: string) => void;
  onRefreshDashboard: () => void;
}) {
  return (
    <div className="atlas-canvas">
      {active === "evidence" ? <EvidenceAtlas analysis={analysis} /> : null}
      {active === "charts" ? <ChartsAtlas analysis={analysis} /> : null}
      {active === "report" ? (
        <ReportAtlas
          analysis={analysis}
          chat={chat}
          isAsking={isAsking}
          question={question}
          onAsk={onAsk}
          onQuestion={onQuestion}
        />
      ) : null}
      {active === "ops" ? <OpsAtlas dashboard={dashboard} onRefreshDashboard={onRefreshDashboard} /> : null}
    </div>
  );
}

function EvidenceAtlas({ analysis }: { analysis: AnalysisResult | null }) {
  if (!analysis) return <EmptyState icon={Network} title="证据链等待分析" text="启动一次真实分析后，这里会展示 geNomad、BLAST、融合评分和推理依据。" />;
  const topHit = analysis.blast_hits[0];
  return (
    <div className="atlas-grid">
      <section className="atlas-panel">
        <PanelHeading icon={Network} eyebrow="Fusion" title={analysis.fusion.candidate_source} />
        <p className="panel-copy">可信度 {analysis.fusion.confidence_score}/100，需要验证：{analysis.fusion.requires_validation ? "是" : "否"}</p>
        <div className="reason-list">
          {analysis.fusion.reasoning.map((item, index) => (
            <div key={index}>
              <Check />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="atlas-panel">
        <PanelHeading icon={Database} eyebrow="NCBI" title="BLAST 命中表" />
        <div className="mt-4 overflow-hidden rounded-[8px] border border-white/10">
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
                  <TableCell className="font-mono text-[#b7d7ff]">{hit.accession}</TableCell>
                  <TableCell className="max-w-[320px] truncate">{hit.organism}</TableCell>
                  <TableCell>{hit.identity}%</TableCell>
                  <TableCell>{formatEvalue(hit.evalue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {topHit ? <p className="panel-copy">Top hit: {topHit.accession} / {topHit.organism}</p> : null}
      </section>
    </div>
  );
}

function ChartsAtlas({ analysis }: { analysis: AnalysisResult | null }) {
  return (
    <div className="chart-atlas">
      <section className="atlas-panel">
        <PanelHeading icon={Dna} eyebrow="Composition" title="碱基组成" />
        <BaseCompositionChart analysis={analysis} />
      </section>
      <section className="atlas-panel">
        <PanelHeading icon={Database} eyebrow="Ranking" title="BLAST 排名" />
        <BlastRankingChart analysis={analysis} />
      </section>
      <section className="atlas-panel">
        <PanelHeading icon={Gauge} eyebrow="Confidence" title="融合可信度" />
        <ConfidenceGauge analysis={analysis} />
      </section>
    </div>
  );
}

function ReportAtlas({
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
  if (!analysis) return <EmptyState icon={Bot} title="AI 报告等待生成" text="完成分析后会出现结构化报告、下载入口和证据追问。" />;
  return (
    <div className="report-atlas">
      <section className="atlas-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <PanelHeading icon={FileText} eyebrow={`${analysis.report.source} / ${analysis.report.model}`} title="AI 报告" />
          <a className="download-link" href={reportDownloadUrl(analysis.id)}>
            <Download />
            Markdown
          </a>
        </div>
        <div className="report-markdown">
          <MarkdownDocument content={analysis.report.markdown} />
        </div>
      </section>
      <section className="atlas-panel">
        <PanelHeading icon={MessageSquare} eyebrow="Context" title="证据追问" />
        <div className="chat-scroll">
          {chat.map((item, index) => (
            <ChatBubble key={`${item.role}-${index}`} item={item} />
          ))}
        </div>
        <div className="chat-compose">
          <Input
            className="h-10 rounded-[8px] border-white/10 bg-white/[0.045]"
            placeholder="追问本次分析证据"
            value={question}
            onChange={(event) => onQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onAsk();
            }}
          />
          <Button className="rounded-[8px] bg-[#e8f3ff] text-[#050812] hover:bg-[#f4f8ff]" disabled={isAsking} onClick={onAsk}>
            {isAsking ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Bot data-icon="inline-start" />}
            发送
          </Button>
        </div>
      </section>
    </div>
  );
}

function OpsAtlas({ dashboard, onRefreshDashboard }: { dashboard: DashboardStats | null; onRefreshDashboard: () => void }) {
  return (
    <section className="atlas-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PanelHeading icon={Activity} eyebrow="Operations" title="运行记录" />
        <Button className="rounded-[8px]" onClick={onRefreshDashboard} type="button" variant="outline">
          <RefreshCw data-icon="inline-start" />
          刷新
        </Button>
      </div>
      <div className="recent-grid">
        {dashboard?.recent.length ? (
          dashboard.recent.map((item) => (
            <div key={item.id} className="recent-run">
              <div>
                <strong>{item.sequence_name}</strong>
                <span>{item.candidate_source}</span>
              </div>
              <Badge className="border-[#9ed8ff]/35 bg-[#9ed8ff]/10 text-[#dff2ff]" variant="outline">
                {Math.round(item.confidence_score)}
              </Badge>
            </div>
          ))
        ) : (
          <EmptyState icon={Clock3} title="暂无历史任务" text="完成分析后会在这里记录最近任务。" compact />
        )}
      </div>
    </section>
  );
}

function PanelHeading({ eyebrow, icon: Icon, title }: { eyebrow: string; icon: LucideIcon; title: string }) {
  return (
    <div className="panel-heading">
      <span>
        <Icon />
      </span>
      <div>
        <p>{eyebrow}</p>
        <h3>{title}</h3>
      </div>
    </div>
  );
}

function LensMetric({ label, suffix, value }: { label: string; suffix: string; value: string | number }) {
  return (
    <div className="lens-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{suffix}</small>
    </div>
  );
}

function EvidenceMeter({ label, score, value }: { label: string; score: number; value: string }) {
  const normalized = Math.max(0, Math.min(100, score));
  return (
    <div className="lens-meter">
      <div>
        <span>{label}</span>
        <strong>{Math.round(normalized)}%</strong>
      </div>
      <p>{value}</p>
      <i>
        <b style={{ width: `${normalized}%` }} />
      </i>
    </div>
  );
}

function CompositionWave({ composition }: { composition: Record<"A" | "T" | "G" | "C" | "U" | "N", number> }) {
  const bases: Array<keyof typeof composition> = ["A", "T", "G", "C", "U", "N"];
  return (
    <div className="composition-wave">
      {bases.map((base) => (
        <div key={base}>
          <span style={{ height: `${Math.max(10, composition[base] || 0)}%` }} />
          <small>{base}</small>
        </div>
      ))}
    </div>
  );
}

function MicroReadout({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="micro-readout">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyState({
  compact = false,
  icon: Icon,
  text,
  title,
}: {
  compact?: boolean;
  icon: LucideIcon;
  text: string;
  title: string;
}) {
  return (
    <div className={compact ? "empty-state compact" : "empty-state"}>
      <Icon />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function ChatBubble({ item }: { item: { role: "user" | "assistant"; content: string; meta?: string } }) {
  const user = item.role === "user";
  return (
    <div className={user ? "chat-bubble user" : "chat-bubble"}>
      <div className="chat-bubble-header">
        <span>{user ? "You" : "BioSeqMind AI"}</span>
        {item.meta ? <small>{item.meta}</small> : null}
      </div>
      <MarkdownDocument compact content={item.content} />
    </div>
  );
}

function MarkdownDocument({ compact = false, content }: { compact?: boolean; content: string }) {
  return <div className={compact ? "markdown-render compact" : "markdown-render"}>{renderMarkdownBlocks(content)}</div>;
}

function renderMarkdownBlocks(content: string): ReactNode[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      index += index < lines.length ? 1 : 0;
      blocks.push(
        <pre className="markdown-code" key={`code-${index}`}>
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (heading) {
      const level = heading[1].length;
      const HeadingTag = `h${Math.min(level + 1, 5)}` as "h2" | "h3" | "h4" | "h5";
      blocks.push(<HeadingTag key={`heading-${index}`}>{renderInlineMarkdown(heading[2], `heading-${index}`)}</HeadingTag>);
      index += 1;
      continue;
    }

    if (isMarkdownTableStart(lines, index)) {
      const header = splitMarkdownTableRow(lines[index]);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(splitMarkdownTableRow(lines[index]));
        index += 1;
      }
      blocks.push(
        <div className="markdown-table-wrap" key={`table-${index}`}>
          <table>
            <thead>
              <tr>
                {header.map((cell, cellIndex) => (
                  <th key={`head-${cellIndex}`}>{renderInlineMarkdown(cell, `head-${index}-${cellIndex}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`cell-${rowIndex}-${cellIndex}`}>{renderInlineMarkdown(cell, `cell-${index}-${rowIndex}-${cellIndex}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ul key={`ul-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={`li-${itemIndex}`}>{renderInlineMarkdown(item, `ul-${index}-${itemIndex}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ol key={`ol-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={`oli-${itemIndex}`}>{renderInlineMarkdown(item, `ol-${index}-${itemIndex}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quotes: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quotes.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push(<blockquote key={`quote-${index}`}>{renderInlineMarkdown(quotes.join(" "), `quote-${index}`)}</blockquote>);
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].trim().startsWith("```") &&
      !/^(#{1,4})\s+/.test(lines[index].trim()) &&
      !/^[-*]\s+/.test(lines[index].trim()) &&
      !/^\d+\.\s+/.test(lines[index].trim()) &&
      !/^>\s?/.test(lines[index].trim()) &&
      !isMarkdownTableStart(lines, index)
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(<p key={`p-${index}`}>{renderInlineMarkdown(paragraph.join(" "), `p-${index}`)}</p>);
  }

  return blocks;
}

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }
    const token = match[0];
    const key = `${keyPrefix}-${match.index}`;
    if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      const href = link?.[2] ?? "#";
      const safeHref = /^(https?:|mailto:)/i.test(href) ? href : "#";
      nodes.push(
        <a href={safeHref} key={key} rel="noreferrer" target="_blank">
          {link?.[1] ?? token}
        </a>,
      );
    }
    cursor = match.index + token.length;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }
  return nodes;
}

function isMarkdownTableStart(lines: string[], index: number): boolean {
  return Boolean(
    lines[index]?.includes("|") &&
      lines[index + 1] &&
      /^(\s*\|)?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1].trim()),
  );
}

function splitMarkdownTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

type SequenceSignal = {
  gc: number;
  hasHeader: boolean;
  kind: "DNA" | "RNA" | "Mixed" | "Unknown";
  length: number;
  ratios: Record<"A" | "T" | "G" | "C" | "U" | "N", number>;
};

function inspectSequence(text: string): SequenceSignal {
  const hasHeader = /^>/m.test(text);
  const raw = text
    .replace(/^>.*$/gm, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
  const length = raw.length;
  const counts = {
    A: countBase(raw, "A"),
    T: countBase(raw, "T"),
    G: countBase(raw, "G"),
    C: countBase(raw, "C"),
    U: countBase(raw, "U"),
    N: countBase(raw, "N"),
  };
  const ratios = {
    A: ratio(counts.A, length),
    T: ratio(counts.T, length),
    G: ratio(counts.G, length),
    C: ratio(counts.C, length),
    U: ratio(counts.U, length),
    N: ratio(counts.N, length),
  };
  const kind = !length ? "Unknown" : counts.U > 0 && counts.T === 0 ? "RNA" : counts.T > 0 && counts.U === 0 ? "DNA" : "Mixed";
  return {
    gc: ratio(counts.G + counts.C, length),
    hasHeader,
    kind,
    length,
    ratios,
  };
}

function countBase(sequence: string, base: string): number {
  return sequence.split(base).length - 1;
}

function ratio(count: number, total: number): number {
  return total ? Math.round((count / total) * 100) : 0;
}

function formatEvalue(value: number): string {
  if (value === 0) return "0";
  if (value < 0.001) return value.toExponential(2);
  return value.toString();
}
