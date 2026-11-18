import React, { useEffect, useState } from "react";
import { A4_HEIGHT_PX, A4_WIDTH_PX } from "../types";
import { ResumeTemplate } from "../templates";
import type { LayoutOptions, TemplateId } from "../types";
import type { ParsedResume } from "../../../api/client";

interface ResumePreviewAreaProps {
  previewMode?: "original" | "template";
  setPreviewMode?: (mode: "original" | "template") => void;
  hasStoredFile?: boolean;
  resumeId?: number;
  originalFileName?: string | null;
  fileMimeType?: string | null;
  previewScale: number;
  setPreviewScale: (scale: number) => void;
  parsed: ParsedResume;
  resumeTitle: string;
  targetJobTitle?: string | null;
  selectedTemplate: TemplateId;
  layoutOptions: LayoutOptions;
  previewRef: React.RefObject<HTMLDivElement | null>;
  sheetRef: React.RefObject<HTMLDivElement | null>;
}

export default function ResumePreviewArea({
  previewScale,
  setPreviewScale,
  parsed,
  resumeTitle,
  targetJobTitle,
  selectedTemplate,
  layoutOptions,
  previewRef,
  sheetRef,
}: ResumePreviewAreaProps) {
  const [sheetHeight, setSheetHeight] = useState<number>(A4_HEIGHT_PX);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => setSheetHeight(el.offsetHeight || A4_HEIGHT_PX);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [sheetRef]);

  const pageCount = Math.max(1, Math.ceil(sheetHeight / A4_HEIGHT_PX));
  const scaledWidth = A4_WIDTH_PX * previewScale;

  return (
    <>
      {/* 缩放控制 */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 mb-3">
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 font-semibold text-slate-700">
            A4 预览
          </span>
          <span>约 {pageCount} 页 · 导出效果与预览一致</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-ink-muted">缩放</span>
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 text-xs shadow-sm">
            {([0.6, 0.7, 0.85, 1.0] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setPreviewScale(s)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  previewScale === s
                    ? "bg-cyan-700 text-white"
                    : "text-ink-muted hover:text-ink hover:bg-slate-50"
                }`}
              >
                {Math.round(s * 100)}%
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className="overflow-auto rounded-2xl border border-slate-200 bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.18)_1px,transparent_0)] [background-size:18px_18px] bg-slate-100/70 p-6 md:p-8 flex justify-center shadow-inner"
        style={{ maxHeight: "72vh" }}
      >
        <div
          ref={previewRef}
          style={{
            width: scaledWidth,
            height: sheetHeight * previewScale,
            position: "relative",
            flexShrink: 0,
            boxShadow: "0 18px 45px rgba(15, 23, 42, 0.18), 0 4px 12px rgba(15, 23, 42, 0.08)",
            borderRadius: "2px",
            transition: "width 0.2s ease, height 0.2s ease",
          }}
        >
          <div
            ref={sheetRef}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: A4_WIDTH_PX,
              minHeight: A4_HEIGHT_PX,
              transform: `scale(${previewScale})`,
              transformOrigin: "top left",
            }}
          >
            <ResumeTemplate
              templateId={selectedTemplate}
              parsed={parsed}
              resumeTitle={resumeTitle}
              targetJobTitle={targetJobTitle}
              layoutOptions={layoutOptions}
            />
          </div>
        </div>
      </div>
    </>
  );
}
