import { layoutResume } from "../layoutParse";
import type { ResumeTemplateProps } from "../types";
import { GridEntries, GridSkills } from "./entries";
import {
  ContactGrid,
  getNameFontSize,
  hasSkills,
  hexToRgba,
  ResumeSheet,
  SummaryBlock,
} from "./shared";
import type { CSSProperties, ReactNode } from "react";

function GridHeading({
  index,
  title,
  sub,
  color,
}: {
  index: string;
  title: string;
  sub: string;
  color: string;
}) {
  return (
    <h2
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: "13px",
        fontWeight: 700,
        letterSpacing: "0.08em",
        color: "#0f172a",
        margin: "0 0 11px",
        padding: "0 0 6px",
        borderBottom: `2px solid ${hexToRgba(color, 0.2)}`,
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
        <span
          style={{
            fontSize: "10px",
            fontWeight: 800,
            color: "#ffffff",
            backgroundColor: color,
            padding: "1px 6px",
            borderRadius: "4px",
          }}
        >
          {index}
        </span>
        <span>{title}</span>
      </span>
      <span style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.14em", color: hexToRgba(color, 0.5) }}>
        {sub}
      </span>
    </h2>
  );
}

function GridSection({
  index,
  title,
  sub,
  color,
  children,
  style,
}: {
  index: string;
  title: string;
  sub: string;
  color: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section style={style}>
      <GridHeading index={index} title={title} sub={sub} color={color} />
      {children}
    </section>
  );
}

export default function GridTemplate({
  parsed,
  resumeTitle,
  targetJobTitle,
  layoutOptions,
}: ResumeTemplateProps) {
  const layout = layoutResume(parsed, resumeTitle);
  const primaryColor = layoutOptions?.themeColor || "#1f2937";
  const density = layoutOptions?.density;
  const showSkills = hasSkills(layout);
  const hasEduAndSkills = layout.education.length > 0 && showSkills;

  return (
    <ResumeSheet
      className="resume-grid"
      layoutOptions={layoutOptions}
      style={{ padding: density === "compact" ? "34px 40px" : "42px 48px" }}
    >
      {/* 顶部高管模块化名片头 */}
      <header
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.2fr",
          gap: "24px",
          alignItems: "center",
          marginBottom: "20px",
          padding: "16px 20px",
          borderRadius: "10px",
          backgroundColor: hexToRgba(primaryColor, 0.04),
          borderTop: `4px solid ${primaryColor}`,
          borderRight: `1px solid ${hexToRgba(primaryColor, 0.12)}`,
          borderBottom: `1px solid ${hexToRgba(primaryColor, 0.12)}`,
          borderLeft: `1px solid ${hexToRgba(primaryColor, 0.12)}`,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              fontSize: getNameFontSize(layoutOptions?.fontSize, "classic"),
              fontWeight: 800,
              margin: 0,
              color: "#0f172a",
              letterSpacing: "0.06em",
              lineHeight: 1.15,
            }}
          >
            {layout.name}
          </h1>
          {targetJobTitle && (
            <p
              style={{
                fontSize: "12.5px",
                color: primaryColor,
                fontWeight: 700,
                margin: "6px 0 0",
                letterSpacing: "0.06em",
              }}
            >
              目标岗位：{targetJobTitle}
            </p>
          )}
        </div>
        <div style={{ fontSize: "0.88em" }}>
          <ContactGrid pieces={layout.contactShort} color="#334155" labelColor={primaryColor} columns={1} />
        </div>
      </header>

      {layout.summary && (
        <GridSection index="01" title="核心优势" sub="EXECUTIVE SUMMARY" color={primaryColor}>
          <SummaryBlock text={layout.summary} accent={primaryColor} />
        </GridSection>
      )}

      {/* 教育背景与专业技能并排矩阵（避免传统左右分栏左长右空问题） */}
      {hasEduAndSkills ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "0.95fr 1.05fr",
            gap: "20px",
            marginBottom: density === "compact" ? "14px" : "18px",
          }}
        >
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "8px",
              border: `1px solid ${hexToRgba(primaryColor, 0.14)}`,
              backgroundColor: "#ffffff",
            }}
          >
            <GridHeading index="02" title="教育背景" sub="EDUCATION" color={primaryColor} />
            <GridEntries entries={layout.education} accent={primaryColor} density={density} />
          </div>
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "8px",
              border: `1px solid ${hexToRgba(primaryColor, 0.14)}`,
              backgroundColor: "#ffffff",
            }}
          >
            <GridHeading index="03" title="专业技能" sub="SKILLS" color={primaryColor} />
            <GridSkills layout={layout} accent={primaryColor} />
          </div>
        </div>
      ) : (
        <>
          {layout.education.length > 0 && (
            <GridSection index="02" title="教育背景" sub="EDUCATION" color={primaryColor}>
              <GridEntries entries={layout.education} accent={primaryColor} density={density} />
            </GridSection>
          )}
          {showSkills && (
            <GridSection index="03" title="专业技能" sub="SKILLS" color={primaryColor}>
              <GridSkills layout={layout} accent={primaryColor} />
            </GridSection>
          )}
        </>
      )}

      {/* 通栏展示核心工作经历与项目经历，保证充足横向阅读空间 */}
      {layout.experience.length > 0 && (
        <GridSection index="04" title="工作经历" sub="WORK EXPERIENCE" color={primaryColor}>
          <GridEntries entries={layout.experience} accent={primaryColor} density={density} />
        </GridSection>
      )}

      {layout.projects.length > 0 && (
        <GridSection index="05" title="项目经历" sub="PROJECT EXPERIENCE" color={primaryColor}>
          <GridEntries entries={layout.projects} accent={primaryColor} density={density} />
        </GridSection>
      )}
    </ResumeSheet>
  );
}
