import { layoutResume } from "../layoutParse";
import type { ResumeTemplateProps } from "../types";
import { ClassicEntries, ClassicSkills } from "./entries";
import {
  ContactLine,
  darkenHex,
  getNameFontSize,
  hasSkills,
  hexToRgba,
  ResumeSheet,
  Section,
  SummaryBlock,
} from "./shared";

export default function ClassicTemplate({
  parsed,
  resumeTitle,
  targetJobTitle,
  layoutOptions,
}: ResumeTemplateProps) {
  const layout = layoutResume(parsed, resumeTitle);
  const primaryColor = layoutOptions?.themeColor || "#1e3a8a";
  const darkColor = darkenHex(primaryColor, 0.2);
  const density = layoutOptions?.density;

  return (
    <ResumeSheet className="resume-classic" layoutOptions={layoutOptions}>
      {/* 顶部通栏主题色饰条 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "6px",
          background: `linear-gradient(90deg, ${primaryColor} 0%, ${darkColor} 100%)`,
        }}
      />

      <style>{`
        .resume-classic h2 {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 13.5px;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: ${primaryColor};
          margin: 0 0 11px;
          padding: 5px 12px;
          background: linear-gradient(90deg, ${hexToRgba(primaryColor, 0.09)} 0%, ${hexToRgba(primaryColor, 0.01)} 100%);
          border-left: 4px solid ${primaryColor};
          border-radius: 0 6px 6px 0;
        }
        .resume-classic h2 .section-title-sub {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.16em;
          color: ${hexToRgba(primaryColor, 0.48)};
        }
      `}</style>

      <header
        style={{
          textAlign: "center",
          marginBottom: density === "compact" ? "18px" : "24px",
          paddingBottom: density === "compact" ? "14px" : "18px",
          borderBottom: `1.5px solid ${hexToRgba(primaryColor, 0.18)}`,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            flexWrap: "wrap",
            marginBottom: "10px",
          }}
        >
          <h1
            style={{
              fontSize: getNameFontSize(layoutOptions?.fontSize, "classic"),
              fontWeight: 800,
              color: "#0f172a",
              margin: 0,
              letterSpacing: "0.1em",
              lineHeight: 1.2,
            }}
          >
            {layout.name}
          </h1>
          {targetJobTitle && (
            <span
              style={{
                display: "inline-block",
                padding: "3px 12px",
                borderRadius: "999px",
                fontSize: "12px",
                color: primaryColor,
                backgroundColor: hexToRgba(primaryColor, 0.1),
                border: `1px solid ${hexToRgba(primaryColor, 0.22)}`,
                fontWeight: 700,
                letterSpacing: "0.06em",
              }}
            >
              求职意向：{targetJobTitle}
            </span>
          )}
        </div>

        <ContactLine
          pieces={layout.contactShort}
          color="#334155"
          iconColor={primaryColor}
          separator="|"
        />
      </header>

      {layout.summary && (
        <Section title="个人优势" subtitle="PROFILE SUMMARY">
          <SummaryBlock text={layout.summary} accent={primaryColor} />
        </Section>
      )}
      {layout.education.length > 0 && (
        <Section title="教育背景" subtitle="EDUCATION">
          <ClassicEntries entries={layout.education} accent={primaryColor} density={density} />
        </Section>
      )}
      {hasSkills(layout) && (
        <Section title="专业技能" subtitle="PROFESSIONAL SKILLS">
          <ClassicSkills layout={layout} accent={primaryColor} />
        </Section>
      )}
      {layout.experience.length > 0 && (
        <Section title="工作经历" subtitle="WORK EXPERIENCE">
          <ClassicEntries entries={layout.experience} accent={primaryColor} density={density} />
        </Section>
      )}
      {layout.projects.length > 0 && (
        <Section title="项目经历" subtitle="PROJECT EXPERIENCE">
          <ClassicEntries entries={layout.projects} accent={primaryColor} density={density} />
        </Section>
      )}
    </ResumeSheet>
  );
}
