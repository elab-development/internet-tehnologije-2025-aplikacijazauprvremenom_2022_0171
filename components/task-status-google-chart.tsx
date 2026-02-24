"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SectionLoader } from "@/components/ui/section-loader";
import { cn } from "@/lib/utils";

type TaskStatusCounts = {
  not_started: number;
  in_progress: number;
  done: number;
};

type GoogleChartsNamespace = {
  charts: {
    load: (version: "current", options: { packages: string[] }) => void;
    setOnLoadCallback: (callback: () => void) => void;
  };
  visualization: {
    arrayToDataTable: (rows: Array<Array<string | number>>) => unknown;
    PieChart: new (element: Element) => {
      draw: (data: unknown, options: Record<string, unknown>) => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleChartsNamespace;
  }
}

type Props = {
  counts: TaskStatusCounts;
  isLoading: boolean;
};

let googleChartsLoaderPromise: Promise<void> | null = null;

function loadGoogleCharts() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.google?.charts && window.google?.visualization) {
    return Promise.resolve();
  }

  if (googleChartsLoaderPromise) {
    return googleChartsLoaderPromise;
  }

  googleChartsLoaderPromise = new Promise<void>((resolve, reject) => {
    const scriptId = "google-charts-loader";
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;

    const bootstrapCharts = () => {
      if (!window.google?.charts) {
        reject(new Error("Google Charts loader nije dostupan."));
        return;
      }

      window.google.charts.load("current", { packages: ["corechart"] });
      window.google.charts.setOnLoadCallback(() => resolve());
    };

    if (existingScript) {
      if (window.google?.charts) {
        bootstrapCharts();
        return;
      }

      existingScript.addEventListener("load", bootstrapCharts, { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Neuspesno ucitavanje Google Charts loader-a.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://www.gstatic.com/charts/loader.js";
    script.async = true;
    script.addEventListener("load", bootstrapCharts, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Neuspesno ucitavanje Google Charts loader-a.")),
      { once: true },
    );
    document.head.appendChild(script);
  }).catch((error) => {
    googleChartsLoaderPromise = null;
    throw error;
  });

  return googleChartsLoaderPromise;
}

export function TaskStatusGoogleChart({ counts, isLoading }: Props) {
  const chartWrapperRef = useRef<HTMLDivElement | null>(null);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [isChartReady, setIsChartReady] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);

  const total = counts.not_started + counts.in_progress + counts.done;
  const chartRows = useMemo(
    () => [
      ["Status", "Broj taskova"],
      ["Nije zapoceto", counts.not_started],
      ["U toku", counts.in_progress],
      ["Uradjeno", counts.done],
    ] as Array<Array<string | number>>,
    [counts.done, counts.in_progress, counts.not_started],
  );

  useEffect(() => {
    let cancelled = false;
    let removeResizeListener: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let animationFrameId: number | null = null;

    if (isLoading || total === 0) {
      return () => {
        if (removeResizeListener) removeResizeListener();
        if (resizeObserver) resizeObserver.disconnect();
        if (animationFrameId !== null) window.cancelAnimationFrame(animationFrameId);
      };
    }

    void loadGoogleCharts()
      .then(() => {
        if (cancelled) return;
        const googleCharts = window.google;
        if (!googleCharts?.visualization || !chartContainerRef.current) {
          setIsChartReady(false);
          setChartError("Google Charts nije spreman za prikaz.");
          return;
        }

        setChartError(null);

        const drawChart = () => {
          if (!chartContainerRef.current || !chartWrapperRef.current) return;
          const containerWidth = Math.floor(chartWrapperRef.current.clientWidth);
          const containerHeight = Math.floor(chartWrapperRef.current.clientHeight);
          if (containerWidth <= 0 || containerHeight <= 0) return;

          const data = googleCharts.visualization.arrayToDataTable(chartRows);
          const darkMode = document.documentElement.classList.contains("dark");
          const chart = new googleCharts.visualization.PieChart(chartContainerRef.current);

          chart.draw(data, {
            width: containerWidth,
            height: containerHeight,
            backgroundColor: "transparent",
            colors: ["#ef4444", "#f59e0b", "#22c55e"],
            pieHole: 0.5,
            legend: {
              position: "bottom",
              textStyle: {
                color: darkMode ? "#e5e7eb" : "#334155",
                fontSize: 12,
              },
            },
            chartArea: {
              left: 16,
              top: 16,
              width: "92%",
              height: "76%",
            },
            tooltip: { text: "value" },
            pieSliceTextStyle: {
              color: darkMode ? "#f8fafc" : "#111827",
            },
          });
        };

        const scheduleDraw = () => {
          if (animationFrameId !== null) {
            window.cancelAnimationFrame(animationFrameId);
          }

          animationFrameId = window.requestAnimationFrame(() => {
            drawChart();
          });
        };

        scheduleDraw();
        setIsChartReady(true);

        if (typeof ResizeObserver !== "undefined" && chartWrapperRef.current) {
          resizeObserver = new ResizeObserver(() => {
            scheduleDraw();
          });
          resizeObserver.observe(chartWrapperRef.current);
        }

        const onResize = () => scheduleDraw();
        window.addEventListener("resize", onResize);
        removeResizeListener = () => window.removeEventListener("resize", onResize);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setChartError(error instanceof Error ? error.message : "Neuspesno ucitavanje grafikona.");
        setIsChartReady(false);
      });

    return () => {
      cancelled = true;
      if (removeResizeListener) removeResizeListener();
      if (resizeObserver) resizeObserver.disconnect();
      if (animationFrameId !== null) window.cancelAnimationFrame(animationFrameId);
    };
  }, [chartRows, isLoading, total]);

  if (isLoading) {
    return <SectionLoader label="Ucitavanje statistike taskova..." />;
  }

  if (chartError) {
    return (
      <p className="rounded-md border border-dashed bg-background/65 p-3 text-xs text-muted-foreground">
        {chartError}
      </p>
    );
  }

  if (total === 0) {
    return (
      <p className="rounded-md border border-dashed bg-background/65 p-3 text-xs text-muted-foreground">
        Trenutno nema taskova za prikaz statusa.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-red-700 dark:text-red-200">
          Nije zapoceto: {counts.not_started}
        </span>
        <span className="rounded-md border border-yellow-500/35 bg-yellow-500/10 px-2 py-1 text-yellow-700 dark:text-yellow-200">
          U toku: {counts.in_progress}
        </span>
        <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-200">
          Uradjeno: {counts.done}
        </span>
      </div>

      <div ref={chartWrapperRef} className="relative min-h-[280px] w-full min-w-0 overflow-hidden">
        <div
          ref={chartContainerRef}
          className={cn("h-[280px] w-full min-w-0 max-w-full overflow-hidden", !isChartReady && "opacity-0")}
          aria-label="Grafik statusa taskova"
        />
        {!isChartReady ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <SectionLoader label="Priprema Google grafikona..." />
          </div>
        ) : null}
      </div>
    </div>
  );
}
