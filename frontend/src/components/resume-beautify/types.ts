import type { ParsedResume } from "../../api/client";

export type TemplateId = "classic" | "modern" | "minimal" | "timeline" | "grid";

export type FontSizeOption = "small" | "normal" | "large";
export type DensityOption = "compact" | "normal" | "relaxed";

export interface ColorTheme {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  lightBg: string;
}

export const COLOR_THEMES: ColorTheme[] = [
  { id: "navy", name: "商务深蓝", primary: "#1e3a8a", secondary: "#2563eb", lightBg: "#eff6ff" },
  { id: "emerald", name: "雅致墨绿", primary: "#065f46", secondary: "#059669", lightBg: "#ecfdf5" },
  { id: "slate", name: "高端冷灰", primary: "#1f2937", secondary: "#4b5563", lightBg: "#f3f4f6" },
  { id: "burgundy", name: "尊贵酒红", primary: "#881337", secondary: "#be123c", lightBg: "#fff1f2" },
  { id: "violet", name: "睿智紫罗兰", primary: "#581c87", secondary: "#7c3aed", lightBg: "#faf5ff" },
  { id: "amber", name: "暖调琥珀", primary: "#92400e", secondary: "#d97706", lightBg: "#fffbeb" },
  { id: "cyan", name: "科技青蓝", primary: "#0e7490", secondary: "#06b6d4", lightBg: "#ecfeff" },
  { id: "rose", name: "玫瑰金棕", primary: "#9f1239", secondary: "#f43f5e", lightBg: "#fff1f2" },
];

export interface LayoutOptions {
  themeColor: string;
  fontSize: FontSizeOption;
  density: DensityOption;
}

export interface ResumeTemplateProps {
  parsed: ParsedResume;
  resumeTitle: string;
  targetJobTitle?: string | null;
  layoutOptions?: LayoutOptions;
}

export interface TemplateMeta {
  id: TemplateId;
  name: string;
  description: string;
}

export const TEMPLATE_OPTIONS: TemplateMeta[] = [
  { id: "classic", name: "稳重商务", description: "经典居中头部与清晰分栏层级，适合多数岗位投递" },
  { id: "modern", name: "现代精英", description: "侧栏信息+主栏经历，突出核心能力与项目成果" },
  { id: "minimal", name: "极简专业", description: "高留白与强层级，适合产品/设计/咨询等强调表达力岗位" },
  { id: "timeline", name: "成长时间轴", description: "以时间脉络呈现经历与项目，适合履历连贯的候选人" },
  { id: "grid", name: "结构模块", description: "模块化双栏信息组织，适合信息量较多的技术/复合背景简历" },
];

/** 96DPI 下标准 A4 纸张像素尺寸 */
export const A4_WIDTH_PX = 794;
export const A4_HEIGHT_PX = 1123;

export const RESUME_FONT =
  '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans SC", "Source Han Sans SC", sans-serif';

export const RESUME_DISPLAY_FONT =
  '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans SC", sans-serif';
