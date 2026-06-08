"use client";

import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";

import type { AnalysisResult } from "@/lib/types";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const textColor = "#e8f6f1";
const mutedColor = "#82938b";
const gridColor = "rgba(255, 255, 255, 0.11)";
const tooltip = {
  backgroundColor: "#0e100e",
  borderColor: "rgba(255,255,255,.14)",
  textStyle: { color: textColor },
};

export function BaseCompositionChart({ analysis }: { analysis: AnalysisResult | null }) {
  if (!analysis) return <ChartEmptyState text="Waiting for analysis data" />;
  const ratios = analysis.sequence.base_ratios;
  const option: EChartsOption = {
    color: ["#68f0cf", "#86b7ff", "#ffd166", "#52d681", "#ff8fb3", "#7d8d86"],
    tooltip: { ...tooltip, trigger: "axis" },
    grid: { left: 34, right: 14, top: 28, bottom: 30 },
    xAxis: {
      type: "category",
      data: ["A", "T", "G", "C", "U", "N"],
      axisLine: { lineStyle: { color: gridColor } },
      axisLabel: { color: mutedColor },
    },
    yAxis: {
      type: "value",
      max: 100,
      axisLabel: { color: mutedColor, formatter: "{value}%" },
      splitLine: { lineStyle: { color: gridColor } },
    },
    series: [
      {
        type: "bar",
        data: ["A", "T", "G", "C", "U", "N"].map((base) => ratios[base as keyof typeof ratios]),
        barWidth: 16,
        itemStyle: { borderRadius: [6, 6, 0, 0] },
      },
    ],
  };
  return <ReactECharts option={option} style={{ height: 260, width: "100%" }} />;
}

export function BlastRankingChart({ analysis }: { analysis: AnalysisResult | null }) {
  const hits = analysis?.blast_hits ?? [];
  if (!analysis) return <ChartEmptyState text="Waiting for analysis data" />;
  if (!hits.length) return <ChartEmptyState text="No BLAST hits yet" />;
  const orderedHits = [...hits].reverse();
  const option: EChartsOption = {
    color: ["#86b7ff"],
    tooltip: { ...tooltip, trigger: "axis" },
    grid: { left: 86, right: 18, top: 28, bottom: 30 },
    xAxis: {
      type: "value",
      max: 100,
      axisLabel: { color: mutedColor, formatter: "{value}%" },
      splitLine: { lineStyle: { color: gridColor } },
    },
    yAxis: {
      type: "category",
      data: orderedHits.map((hit) => hit.accession),
      axisLine: { lineStyle: { color: gridColor } },
      axisLabel: { color: textColor },
    },
    series: [
      {
        type: "bar",
        data: orderedHits.map((hit) => hit.identity),
        barWidth: 12,
        itemStyle: { borderRadius: [0, 6, 6, 0] },
      },
    ],
  };
  return <ReactECharts option={option} style={{ height: 260, width: "100%" }} />;
}

export function ConfidenceGauge({ analysis }: { analysis: AnalysisResult | null }) {
  if (!analysis) return <ChartEmptyState text="Waiting for analysis data" />;
  const score = analysis.fusion.confidence_score;
  const option: EChartsOption = {
    series: [
      {
        type: "gauge",
        startAngle: 205,
        endAngle: -25,
        min: 0,
        max: 100,
        progress: { show: true, width: 12, itemStyle: { color: "#68f0cf" } },
        axisLine: { lineStyle: { width: 12, color: [[1, "rgba(255,255,255,.14)"]] } },
        axisTick: { show: false },
        splitLine: { distance: -18, length: 8, lineStyle: { color: "rgba(232,246,241,.35)" } },
        axisLabel: { color: mutedColor, distance: 18, fontSize: 10 },
        pointer: { width: 4, itemStyle: { color: "#ffd166" } },
        anchor: { show: true, size: 8, itemStyle: { color: "#ffd166" } },
        detail: {
          valueAnimation: true,
          formatter: "{value}",
          color: textColor,
          fontSize: 34,
          fontWeight: 700,
          offsetCenter: [0, "58%"],
        },
        data: [{ value: score }],
      },
    ],
  };
  return <ReactECharts option={option} style={{ height: 260, width: "100%" }} />;
}

function ChartEmptyState({ text }: { text: string }) {
  return (
    <div className="grid h-[260px] place-items-center rounded-[8px] border border-dashed border-white/15 bg-white/[0.025] text-sm text-[#82938b]">
      {text}
    </div>
  );
}
