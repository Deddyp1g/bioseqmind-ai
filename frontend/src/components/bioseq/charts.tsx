"use client";

import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";

import type { AnalysisResult } from "@/lib/types";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const textColor = "#dbe8e8";
const mutedColor = "#78909a";
const gridColor = "rgba(148, 163, 184, 0.14)";

export function BaseCompositionChart({ analysis }: { analysis: AnalysisResult | null }) {
  if (!analysis) return <ChartEmptyState text="暂无真实分析数据" />;
  const ratios = analysis.sequence.base_ratios;
  const option: EChartsOption = {
    color: ["#2dd4bf", "#60a5fa", "#fbbf24", "#34d399", "#fb7185", "#94a3b8"],
    tooltip: { trigger: "axis" },
    grid: { left: 32, right: 12, top: 24, bottom: 28 },
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
        barWidth: 18,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
      },
    ],
  };
  return <ReactECharts option={option} style={{ height: 245, width: "100%" }} />;
}

export function BlastRankingChart({ analysis }: { analysis: AnalysisResult | null }) {
  const hits = analysis?.blast_hits ?? [];
  if (!analysis) return <ChartEmptyState text="暂无真实分析数据" />;
  if (!hits.length) return <ChartEmptyState text="NCBI BLAST 未返回命中" />;
  const labels = hits.map((hit) => hit.accession);
  const values = hits.map((hit) => hit.identity);
  const option: EChartsOption = {
    color: ["#38bdf8"],
    tooltip: { trigger: "axis" },
    grid: { left: 82, right: 18, top: 24, bottom: 28 },
    xAxis: {
      type: "value",
      max: 100,
      axisLabel: { color: mutedColor, formatter: "{value}%" },
      splitLine: { lineStyle: { color: gridColor } },
    },
    yAxis: {
      type: "category",
      data: labels.reverse(),
      axisLine: { lineStyle: { color: gridColor } },
      axisLabel: { color: textColor },
    },
    series: [
      {
        type: "bar",
        data: values.reverse(),
        barWidth: 14,
        itemStyle: { borderRadius: [0, 4, 4, 0] },
      },
    ],
  };
  return <ReactECharts option={option} style={{ height: 245, width: "100%" }} />;
}

export function ConfidenceGauge({ analysis }: { analysis: AnalysisResult | null }) {
  if (!analysis) return <ChartEmptyState text="暂无真实分析数据" />;
  const score = analysis.fusion.confidence_score;
  const option: EChartsOption = {
    series: [
      {
        type: "gauge",
        startAngle: 205,
        endAngle: -25,
        min: 0,
        max: 100,
        progress: { show: true, width: 12, itemStyle: { color: "#2dd4bf" } },
        axisLine: { lineStyle: { width: 12, color: [[1, "rgba(148, 163, 184, 0.16)"]] } },
        axisTick: { show: false },
        splitLine: { distance: -18, length: 8, lineStyle: { color: "rgba(219, 232, 232, .35)" } },
        axisLabel: { color: mutedColor, distance: 18, fontSize: 10 },
        pointer: { width: 4, itemStyle: { color: "#fbbf24" } },
        anchor: { show: true, size: 8, itemStyle: { color: "#fbbf24" } },
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
  return <ReactECharts option={option} style={{ height: 245, width: "100%" }} />;
}

function ChartEmptyState({ text }: { text: string }) {
  return (
    <div className="grid h-[245px] place-items-center rounded-lg border border-dashed border-white/15 bg-black/15 text-sm text-slate-500">
      {text}
    </div>
  );
}
