import { layoutResume } from "../layoutParse";
import type { ResumeTemplateProps } from "../types";
import { A4_HEIGHT_PX, RESUME_FONT } from "../types";
import { ModernEntries, ModernSideSkills } from "./entries";
import {
  ContactStack,
  darkenHex,
  getNameFontSize,
  hasSkills,
  hexToRgba,
  ResumeSheet,
  SummaryBlock,
} from "./shared";

export default function ModernTemplate({
  parsed,
  resumeTitle,
  targetJobTitle,
  layoutOptions,
}: ResumeTemplateProps) {
  const layout = layoutResume(parsed, resumeTitle);
  const primaryColor = layoutOptions?.themeColor || "#1e3a8a";
  const darkColor = darkenHex(primaryColor, 0.28);
  const density = layoutOptions?.density;
  const showSkills = hasSkills(layout);
  const sidePad = density === "compact" ? "32px 22px" : "42px 26px";
  const mainPad = density === "compact" ? "32px 32px 32px 28px" : "42px 38px 42px 32px";
  const monogram = (layout.name || "简").trim().slice(0, 1);

  return (
    <ResumeSheet
      className="resume-modern"
      layoutOptions={layoutOptions}
      style={{
        padding: 0,
        display: "flex",
        alignItems: "stretch",
        minHeight: A4_HEIGHT_PX,
        color: "#1e293b",
      }}
    >
      <style>{`
        .resume-modern main h2 {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13.5px;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: 0.06em;
          margin: 0 0 11px;
          padding: 0 0 6px;
          border-bottom: 2px solid ${hexToRgba(primaryColor, 0.18)};
        }
        .resume-modern main h2::before {
          content: "";
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 2px;
          background-color: ${primaryColor};
          flex-shrink: 0;
        }
      `}</style>

      <aside
        style={{
          width: "248px",
          background: `linear-gradient(165deg, ${primaryColor} 0%, ${darkColor} 100%)`,
          color: "#ffffff",
          padding: sidePad,
          flexShrink: 0,
          boxSizing: "border-box",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* 装饰光晕 */}
        <div
          style={{
            position: "absolute",
            top: "-40px",
            right: "-40px",
            width: "140px",
            height: "140px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 70%)",
            pointerEvents: "none",
          }}
        />

        {/* 首字名片徽章 + 姓名 */}
        <div style={{ marginBottom: "24px", position: "relative" }}>
          <div
            style={{
              width: "46px",
              height: "46px",
              borderRadius: "12px",
              backgroundColor: "rgba(255,255,255,0.16)",
              border: "1px solid rgba(255,255,255,0.28)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              fontWeight: 800,
              color: "#ffffff",
              marginBottom: "14px",
            }}
          >
            {monogram}
          </div>
          <h1
            style={{
              fontFamily: RESUME_FONT,
              fontSize: getNameFontSize(layoutOptions?.fontSize, "modern"),
              fontWeight: 800,
              margin: "0 0 8px",
              lineHeight: 1.25,
              letterSpacing: "0.06em",
            }}
          >
            {layout.name}
          </h1>
          {targetJobTitle && (
            <span
              style={{
                display: "inline-block",
                padding: "3px 10px",
                borderRadius: "6px",
                backgroundColor: "rgba(255,255,255,0.16)",
                fontSize: "11.5px",
                fontWeight: 600,
                letterSpacing: "0.04em",
              }}
            >
              {targetJobTitle}
            </span>
          )}
        </div>

        {layout.contactShort.length > 0 && (
          <div
            style={{
              marginBottom: "24px",
              paddingTop: "18px",
              borderTop: "1px solid rgba(255,255,255,0.16)",
            }}
          >
            <p
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.14em",
                margin: "0 0 12px",
                color: "rgba(255,255,255,0.75)",
              }}
            >
              联系方式 · CONTACT
            </p>
            <ContactStack pieces={layout.contactShort} color="rgba(255,255,255,0.94)" iconColor="#ffffff" />
          </div>
        )}

        {layout.education.length > 0 && (
          <div
            style={{
              marginBottom: showSkills ? "24px" : 0,
              paddingTop: "18px",
              borderTop: "1px solid rgba(255,255,255,0.16)",
            }}
          >
            <p
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.14em",
                margin: "0 0 12px",
                color: "rgba(255,255,255,0.75)",
              }}
            >
              教育背景 · EDUCATION
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {layout.education.map((edu, i) => (
                <div key={i} style={{ fontSize: "11.5px", lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 700, color: "#ffffff" }}>{edu.title}</div>
                  {edu.subtitle && (
                    <div style={{ color: "rgba(255,255,255,0.85)", marginTop: "2px" }}>{edu.subtitle}</div>
                  )}
                  {edu.date && (
                    <div style={{ color: "rgba(255,255,255,0.68)", fontSize: "10.5px", marginTop: "2px" }}>
                      {edu.date}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {showSkills && (
          <div
            style={{
              paddingTop: "18px",
              borderTop: "1px solid rgba(255,255,255,0.16)",
            }}
          >
            <p
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.14em",
                margin: "0 0 12px",
                color: "rgba(255,255,255,0.75)",
              }}
            >
              专业技能 · SKILLS
            </p>
            <ModernSideSkills layout={layout} />
          </div>
        )}
      </aside>

      <main style={{ flex: 1, padding: mainPad, minWidth: 0, backgroundColor: "#ffffff" }}>
        {layout.summary && (
          <section>
            <h2>个人优势</h2>
            <SummaryBlock text={layout.summary} accent={primaryColor} />
          </section>
        )}
        {layout.experience.length > 0 && (
          <section>
            <h2>工作经历</h2>
            <ModernEntries entries={layout.experience} accent={primaryColor} density={density} />
          </section>
        )}
        {layout.projects.length > 0 && (
          <section>
            <h2>项目经历</h2>
            <ModernEntries entries={layout.projects} accent={primaryColor} density={density} />
          </section>
        )}
        {layout.education.length > 0 && layout.education.some((e) => e.bullets.length > 0) && (
          <section>
            <h2>教育详情</h2>
            <ModernEntries entries={layout.education} accent={primaryColor} density={density} />
          </section>
        )}
      </main>
    </ResumeSheet>
  );
}
