import { layoutResume } from "../layoutParse";
import type { ResumeTemplateProps } from "../types";
import { MinimalEntries, MinimalSkills } from "./entries";
import {
  ContactLine,
  getNameFontSize,
  hasSkills,
  hexToRgba,
  ResumeSheet,
  Section,
  SummaryPlain,
} from "./shared";

export default function MinimalTemplate({
  parsed,
  resumeTitle,
  targetJobTitle,
  layoutOptions,
}: ResumeTemplateProps) {
  const layout = layoutResume(parsed, resumeTitle);
  const primaryColor = layoutOptions?.themeColor || "#1f2937";
  const density = layoutOptions?.density;

  return (
    <ResumeSheet
      className="resume-minimal"
      layoutOptions={layoutOptions}
      style={{
        padding: density === "compact" ? "38px 46px" : "48px 56px",
        color: "#1e293b",
      }}
    >
      <style>{`
        .resume-minimal h2 {
          display: flex;
          align-items: baseline;
          gap: 10px;
          font-size: 12.5px;
          font-weight: 700;
          letter-spacing: 0.14em;
          color: ${primaryColor};
          margin: 0 0 12px;
          padding: 0 0 6px;
          border-bottom: 1px solid ${hexToRgba(primaryColor, 0.18)};
        }
        .resume-minimal h2 .section-title-sub {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.18em;
          color: #94a3b8;
        }
      `}</style>

      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "28px",
          flexWrap: "wrap",
          marginBottom: density === "compact" ? "20px" : "28px",
          paddingBottom: "18px",
          borderBottom: `2px solid ${primaryColor}`,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              fontSize: getNameFontSize(layoutOptions?.fontSize, "minimal"),
              fontWeight: 800,
              color: "#0f172a",
              margin: 0,
              letterSpacing: "0.04em",
              lineHeight: 1.1,
            }}
          >
            {layout.name}
          </h1>
          {targetJobTitle && (
            <p
              style={{
                margin: "8px 0 0",
                fontSize: "13px",
                color: primaryColor,
                fontWeight: 600,
                letterSpacing: "0.08em",
              }}
            >
              {targetJobTitle}
            </p>
          )}
        </div>
        <div style={{ maxWidth: "58%", textAlign: "right" }}>
          <ContactLine
            pieces={layout.contactShort}
            align="right"
            color="#475569"
            iconColor={primaryColor}
          />
        </div>
      </header>

      {layout.summary && (
        <Section title="个人简介" subtitle="SUMMARY">
          <div style={{ display: "grid", gridTemplateColumns: "118px 1fr", columnGap: "18px" }}>
            <div style={{ fontSize: "0.84em", color: "#64748b", fontWeight: 500 }}>核心定位</div>
            <SummaryPlain text={layout.summary} color="#334155" accent={primaryColor} />
          </div>
        </Section>
      )}
      {layout.experience.length > 0 && (
        <Section title="工作经历" subtitle="EXPERIENCE">
          <MinimalEntries entries={layout.experience} accent={primaryColor} density={density} />
        </Section>
      )}
      {layout.projects.length > 0 && (
        <Section title="项目经历" subtitle="PROJECTS">
          <MinimalEntries entries={layout.projects} accent={primaryColor} density={density} />
        </Section>
      )}
      {layout.education.length > 0 && (
        <Section title="教育背景" subtitle="EDUCATION">
          <MinimalEntries entries={layout.education} accent={primaryColor} density={density} />
        </Section>
      )}
      {hasSkills(layout) && (
        <Section title="专业技能" subtitle="SKILLS">
          <MinimalSkills layout={layout} accent={primaryColor} />
        </Section>
      )}
    </ResumeSheet>
  );
}
