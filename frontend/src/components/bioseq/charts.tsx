"use client";

import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";

import type { AnalysisResult } from "@/lib/types";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const paper = "#edf7f2";
const muted = "#8ea49a";
const ice = "#dceaff";
const cobalt = "#7aa7ff";
const violet = "#b9a5ff";
const rose = "#c38aa6";
const red = "#ff6b6b";
const grid = "rgba(237, 247, 242, 0.1)";

const tooltip = {
  backgroundColor: "rgba(5, 9, 8, 0.96)",
  borderColor: "rgba(183, 215, 255, 0.22)",
  borderWidth: 1,
  padding: 12,
  textStyle: {
    color: paper,
    fontFamily: "var(--font-ui-sans)",
  },
};

export function BaseCompositionChart({ analysis }: { analysis: AnalysisResult | null }) {
  if (!analysis) return <ChartEmptyState text="等待序列分析数据" />;
  const ratios = analysis.sequence.base_ratios;
  const bases = ["A", "T", "G", "C", "U", "N"] as const;
  const option: EChartsOption = {
    color: [ice, cobalt, violet, rose, red, "#a8b8c6"],
    tooltip: { ...tooltip, trigger: "axis" },
    grid: { left: 38, right: 16, top: 28, bottom: 34 },
    xAxis: {
      type: "category",
      data: [...bases],
      axisLine: { lineStyle: { color: grid } },
      axisTick: { show: false },
      axisLabel: { color: muted, fontFamily: "var(--font-geist-mono)" },
    },
    yAxis: {
      type: "value",
      max: 100,
      axisLabel: { color: muted, formatter: "{value}%" },
      splitLine: { lineStyle: { color: grid, type: "dashed" } },
    },
    series: [
      {
        type: "bar",
        data: bases.map((base) => ratios[base]),
        barWidth: 18,
        itemStyle: {
          borderRadius: [8, 8, 2, 2],
          shadowBlur: 18,
          shadowColor: "rgba(126, 166, 255, 0.18)",
        },
      },
    ],
  };
  return <ReactECharts option={option} style={{ height: 280, width: "100%" }} />;
}

export function BlastRankingChart({ analysis }: { analysis: AnalysisResult | null }) {
  const hits = analysis?.blast_hits ?? [];
  if (!analysis) return <ChartEmptyState text="等待 BLAST 返回" />;
  if (!hits.length) return <ChartEmptyState text="本次没有 BLAST 命中" />;
  const orderedHits = [...hits].reverse();
  const option: EChartsOption = {
    color: [cobalt],
    tooltip: { ...tooltip, trigger: "axis" },
    grid: { left: 92, right: 22, top: 28, bottom: 34 },
    xAxis: {
      type: "value",
      max: 100,
      axisLabel: { color: muted, formatter: "{value}%" },
      splitLine: { lineStyle: { color: grid, type: "dashed" } },
    },
    yAxis: {
      type: "category",
      data: orderedHits.map((hit) => hit.accession),
      axisLine: { lineStyle: { color: grid } },
      axisTick: { show: false },
      axisLabel: { color: paper, fontFamily: "var(--font-geist-mono)", width: 78, overflow: "truncate" },
    },
    series: [
      {
        type: "bar",
        data: orderedHits.map((hit) => ({
          value: hit.identity,
          itemStyle: {
            color: hit.identity >= 90 ? ice : hit.identity >= 70 ? violet : cobalt,
          },
        })),
        barWidth: 12,
        itemStyle: { borderRadius: [0, 8, 8, 0] },
      },
    ],
  };
  return <ReactECharts option={option} style={{ height: 280, width: "100%" }} />;
}

export function ConfidenceGauge({ analysis }: { analysis: AnalysisResult | null }) {
  if (!analysis) return <ChartEmptyState text="等待融合评分" />;
  const score = analysis.fusion.confidence_score;
  const option: EChartsOption = {
    series: [
      {
        type: "gauge",
        startAngle: 212,
        endAngle: -32,
        min: 0,
        max: 100,
        center: ["50%", "55%"],
        radius: "92%",
        progress: {
          show: true,
          width: 12,
          roundCap: true,
          itemStyle: {
            color: score >= 75 ? ice : score >= 45 ? violet : red,
          },
        },
        axisLine: {
          roundCap: true,
          lineStyle: { width: 12, color: [[1, "rgba(237,247,242,.12)"]] },
        },
        axisTick: { show: false },
        splitLine: { distance: -18, length: 8, lineStyle: { color: "rgba(237,247,242,.32)" } },
        axisLabel: { color: muted, distance: 16, fontSize: 10 },
        pointer: { width: 4, itemStyle: { color: ice } },
        anchor: { show: true, size: 9, itemStyle: { color: ice } },
        detail: {
          valueAnimation: true,
          formatter: "{value}",
          color: paper,
          fontSize: 38,
          fontWeight: 700,
          fontFamily: "var(--font-geist-mono)",
          offsetCenter: [0, "58%"],
        },
        data: [{ value: score }],
      },
    ],
  };
  return <ReactECharts option={option} style={{ height: 280, width: "100%" }} />;
}

function ChartEmptyState({ text }: { text: string }) {
  return (
    <div className="grid h-[280px] place-items-center rounded-[8px] border border-dashed border-white/15 bg-white/[0.025] text-sm text-[#8ea49a]">
      {text}
    </div>
  );
}
