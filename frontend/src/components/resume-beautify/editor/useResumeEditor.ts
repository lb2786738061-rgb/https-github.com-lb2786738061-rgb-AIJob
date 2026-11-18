import {useEffect, useRef, useState} from "react";
import type {
  BeautifyResumeResult,
  EnhanceResumeResult,
  ParsedResume,
  TokenUsage,
} from "../../../api/client";
import {COLOR_THEMES} from "../types";
import type {DensityOption, FontSizeOption, LayoutOptions, TemplateId} from "../types";

type EditorTab = "beautify" | "enhance";
type PreviewMode = "original" | "template";
type DiffSection = "experience" | "summary" | "skills";

export type BeautifyMeta = {
  source: "llm" | "rule_based";
  tokenUsage: TokenUsage | null;
  improvements: string[];
};

const EMPTY_SECTIONS: ParsedResume["sections"] = {
  contact: "",
  summary: "",
  education: [],
  experience: [],
  skills: [],
  projects: [],
};

function normalizeSections(sections?: ParsedResume["sections"] | null): ParsedResume["sections"] {
  const source = sections ?? EMPTY_SECTIONS;
  return {
    contact: typeof source.contact === "string" ? source.contact : "",
    summary: typeof source.summary === "string" ? source.summary : "",
    education: Array.isArray(source.education) ? source.education.map(String).filter(Boolean) : [],
    experience: Array.isArray(source.experience) ? source.experience.map(String).filter(Boolean) : [],
    skills: Array.isArray(source.skills) ? source.skills.map(String).filter(Boolean) : [],
    projects: Array.isArray(source.projects) ? source.projects.map(String).filter(Boolean) : [],
  };
}

function normalizeParsed(parsed?: ParsedResume | null): ParsedResume {
  if (!parsed) {
    return {rawText: "", sections: {...EMPTY_SECTIONS}};
  }
  return {
    rawText: parsed.rawText || "",
    sections: normalizeSections(parsed.sections),
    ...(parsed.layout ? {layout: parsed.layout} : {}),
  };
}

export function useResumeEditor(initialParsed: ParsedResume) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  const [draft, setDraft] = useState<ParsedResume>(() => normalizeParsed(initialParsed));
  const [activeTab, setActiveTab] = useState<EditorTab>("beautify");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("template");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>("classic");
  const [selectedThemeColor, setSelectedThemeColor] = useState(COLOR_THEMES[0].primary);
  const [selectedFontSize, setSelectedFontSize] = useState<FontSizeOption>("normal");
  const [selectedDensity, setSelectedDensity] = useState<DensityOption>("normal");
  const [previewScale, setPreviewScale] = useState(0.7);
  const [exporting, setExporting] = useState(false);
  const [beautifying, setBeautifying] = useState(false);
  const [beautifyMeta, setBeautifyMeta] = useState<BeautifyMeta | null>(null);
  const [enhancing, setEnhancing] = useState(false);
  const [enhanceResult, setEnhanceResult] = useState<EnhanceResumeResult | null>(null);
  const [selectedDiffSection, setSelectedDiffSection] = useState<DiffSection>("experience");
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    setDraft(normalizeParsed(initialParsed));
    setBeautifyMeta(null);
    setEnhanceResult(null);
  }, [initialParsed]);

  const layoutOptions: LayoutOptions = {
    themeColor: selectedThemeColor,
    fontSize: selectedFontSize,
    density: selectedDensity,
  };

  const updateSection = <K extends keyof ParsedResume["sections"]>(
    key: K,
    value: ParsedResume["sections"][K],
  ) => {
    setDraft((current) => ({
      ...current,
      sections: normalizeSections({...current.sections, [key]: value}),
    }));
  };

  const updateListItem = (
    key: "experience" | "skills" | "education" | "projects",
    index: number,
    value: string,
  ) => {
    setDraft((current) => {
      const items = [...(current.sections[key] ?? [])];
      if (index < 0 || index >= items.length) return current;
      items[index] = value;
      return {
        ...current,
        sections: { ...current.sections, [key]: items },
      };
    });
  };

  const addListItem = (key: "experience" | "skills" | "education" | "projects") => {
    setDraft((current) => {
      const items = current.sections[key] ?? [];
      return {
        ...current,
        sections: { ...current.sections, [key]: [...items, ""] },
      };
    });
  };

  const removeListItem = (
    key: "experience" | "skills" | "education" | "projects",
    index: number,
  ) => {
    setDraft((current) => {
      const items = current.sections[key] ?? [];
      return {
        ...current,
        sections: {
          ...current.sections,
          [key]: items.filter((_, itemIndex) => itemIndex !== index),
        },
      };
    });
  };

  const moveListItem = (
    key: "experience" | "skills" | "education" | "projects",
    index: number,
    direction: -1 | 1,
  ) => {
    setDraft((current) => {
      const items = current.sections[key] ?? [];
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= items.length) return current;
      const nextItems = [...items];
      const [item] = nextItems.splice(index, 1);
      nextItems.splice(nextIndex, 0, item);
      return {
        ...current,
        sections: { ...current.sections, [key]: nextItems },
      };
    });
  };

  const resetDraft = () => setDraft(normalizeParsed(initialParsed));

  const applyBeautifyResult = (result: BeautifyResumeResult) => {
    setDraft(normalizeParsed(result.parsed));
    setBeautifyMeta({
      source: result.source,
      tokenUsage: result.tokenUsage,
      improvements: result.improvements,
    });
    setPreviewMode("template");
    setActiveTab("beautify");
  };

  const applyEnhanceResult = () => {
    if (!enhanceResult) return;
    setDraft((current) => ({
      ...current,
      sections: normalizeSections({
        ...current.sections,
        ...normalizeSections({
          contact: typeof enhanceResult.enhancedSections.contact === "string" ? enhanceResult.enhancedSections.contact : current.sections.contact,
          summary: typeof enhanceResult.enhancedSections.summary === "string" ? enhanceResult.enhancedSections.summary : current.sections.summary,
          education: enhanceResult.enhancedSections.education,
          experience: enhanceResult.enhancedSections.experience,
          skills: enhanceResult.enhancedSections.skills,
          projects: enhanceResult.enhancedSections.projects,
        }),
      }),
    }));
    setEnhanceResult(null);
    setActiveTab("beautify");
  };

  return {
    draft,
    refs: {previewRef, sheetRef},
    tabs: {activeTab, setActiveTab, previewMode, setPreviewMode},
    layout: {
      selectedTemplate,
      setSelectedTemplate,
      selectedThemeColor,
      setSelectedThemeColor,
      selectedFontSize,
      setSelectedFontSize,
      selectedDensity,
      setSelectedDensity,
      previewScale,
      setPreviewScale,
      layoutOptions,
    },
    ai: {
      beautifying,
      setBeautifying,
      beautifyMeta,
      setBeautifyMeta,
      enhancing,
      setEnhancing,
      enhanceResult,
      setEnhanceResult,
      selectedDiffSection,
      setSelectedDiffSection,
      applying,
      setApplying,
    },
    actions: {
      setDraft,
      updateSection,
      updateListItem,
      addListItem,
      removeListItem,
      moveListItem,
      resetDraft,
      applyBeautifyResult,
      applyEnhanceResult,
    },
    exportState: {exporting, setExporting},
  };
}
