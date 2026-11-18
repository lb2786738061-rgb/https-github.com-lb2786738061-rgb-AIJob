import { layoutResume } from "../layoutParse";
import type { LayoutEntry } from "../layoutParse";
import type { ResumeTemplateProps } from "../types";
import type { DensityOption } from "../types";
import {
  ContactLine,
  darkenHex,
  getNameFontSize,
  getSectionSpacing,
  hasSkills,
  hexToRgba,
  renderRichBullet,
  ResumeSheet,
  SummaryBlock,
} from "./shared";
import { TimelineSkills } from "./entries";

function TimelineEntryList({
  entries,
  accent,
  density,
}: {
  entries: LayoutEntry[];
  accent: string;
  density?: DensityOption;
}) {
  if (entries.length === 0) return null;
  const { entryGap } = getSectionSpacing(density);

  return (
    <div>
      {entries.map((entry, i) => {
        const isSubLevel = Boolean(entry.isSubLevel);
        return (
          <div
            key={`${entry.header}-${i}`}
            className="resume-entry"
            style={{
              display: "grid",
              gridTemplateColumns: "108px 20px 1fr",
              columnGap: "6px",
              marginBottom: i === entries.length - 1 ? 0 : isSubLevel ? "8px" : entryGap,
              marginTop: isSubLevel ? "6px" : 0,
            }}
          >
            <div
              style={{
                fontSize: "11px",
                color: isSubLevel ? "#64748b" : accent,
                fontWeight: isSubLevel ? 500 : 600,
                lineHeight: 1.45,
                paddingTop: "2px",
                textAlign: "right",
                paddingRight: "6px",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {entry.date || (isSubLevel ? "子项目" : "")}
            </div>
            <div style={{ position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  left: "9px",
                  top: "8px",
                  bottom: i === entries.length - 1 ? "6px" : `-${parseInt(entryGap, 10) + 6}px`,
                  width: "1.5px",
                  backgroundColor: hexToRgba(accent, 0.22),
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: isSubLevel ? "6px" : "4px",
                  top: "5px",
                  width: isSubLevel ? "7px" : "11px",
                  height: isSubLevel ? "7px" : "11px",
                  borderRadius: "50%",
                  backgroundColor: isSubLevel ? hexToRgba(accent, 0.45) : "#ffffff",
                  border: isSubLevel ? "none" : `2.5px solid ${accent}`,
                  boxShadow: isSubLevel ? "none" : `0 0 0 3px ${hexToRgba(accent, 0.12)}`,
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div
              style={
                isSubLevel
                  ? {
                      padding: "7px 11px",
                      backgroundColor: hexToRgba(accent, 0.035),
                      borderRadius: "6px",
                      border: `1px solid ${hexToRgba(accent, 0.12)}`,
                    }
                  : { paddingBottom: "2px" }
              }
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                {isSubLevel && (
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      color: accent,
                      backgroundColor: hexToRgba(accent, 0.12),
                      padding: "1px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    项目
                  </span>
                )}
                <span
                  style={{
                    fontWeight: 700,
                    color: "#0f172a",
                    fontSize: isSubLevel ? "0.96em" : "1.04em",
                  }}
                >
                  {entry.title}
                </span>
                {entry.subtitle && (
                  <span
                    style={{
                      color: accent,
                      fontSize: "0.88em",
                      fontWeight: 600,
                      backgroundColor: hexToRgba(accent, 0.08),
                      padding: "1px 8px",
                      borderRadius: "4px",
                    }}
                  >
                    {entry.subtitle}
                  </span>
                )}
              </div>
              {entry.bullets.length > 0 && (
                <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none" }}>
                  {entry.bullets.map((item, j) => (
                    <li
                      key={j}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "7px",
                        color: "#334155",
                        lineHeight: 1.62,
                        marginBottom: j === entry.bullets.length - 1 ? 0 : "4px",
                      }}
                    >
                      <span
                        style={{
                          width: "4px",
                          height: "4px",
                          borderRadius: "50%",
                          backgroundColor: hexToRgba(accent, 0.6),
                          marginTop: "0.6em",
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ flex: 1, minWidth: 0 }}>{renderRichBullet(item, accent)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TimelineHeading({ title, sub, accent }: { title: string; sub: string; accent: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        margin: "0 0 12px",
      }}
    >
      <span
        style={{
          width: "10px",
          height: "10px",
          borderRadius: "50%",
          backgroundColor: accent,
          boxShadow: `0 0 0 3px ${hexToRgba(accent, 0.16)}`,
          flexShrink: 0,
        }}
      />
      <h2
        style={{
          fontSize: "13.5px",
          fontWeight: 700,
          letterSpacing: "0.08em",
          color: "#0f172a",
          margin: 0,
          padding: 0,
        }}
      >
        {title}
      </h2>
      <span
        style={{
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.16em",
          color: hexToRgba(accent, 0.55),
        }}
      >
        {sub}
      </span>
      <div
        style={{
          flex: 1,
          height: "1px",
          background: `linear-gradient(90deg, ${hexToRgba(accent, 0.28)} 0%, transparent 100%)`,
        }}
      />
    </div>
  );
}

export default function TimelineTemplate({
  parsed,
  resumeTitle,
  targetJobTitle,
  layoutOptions,
}: ResumeTemplateProps) {
  const layout = layoutResume(parsed, resumeTitle);
  const primaryColor = layoutOptions?.themeColor || "#1e3a8a";
  const darkColor = darkenHex(primaryColor, 0.22);
  const density = layoutOptions?.density;

  return (
    <ResumeSheet className="resume-timeline" layoutOptions={layoutOptions}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "20px",
          marginBottom: density === "compact" ? "18px" : "24px",
          padding: "18px 22px",
          borderRadius: "12px",
          background: `linear-gradient(135deg, ${hexToRgba(primaryColor, 0.08)} 0%, ${hexToRgba(darkColor, 0.02)} 100%)`,
          borderLeft: `5px solid ${primaryColor}`,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "8px" }}>
            <h1
              style={{
                fontSize: getNameFontSize(layoutOptions?.fontSize, "classic"),
                fontWeight: 800,
                color: "#0f172a",
                margin: 0,
                letterSpacing: "0.06em",
                lineHeight: 1.15,
              }}
            >
              {layout.name}
            </h1>
            {targetJobTitle && (
              <span
                style={{
                  padding: "2px 10px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  color: "#ffffff",
                  backgroundColor: primaryColor,
                  fontWeight: 600,
                }}
              >
                {targetJobTitle}
              </span>
            )}
          </div>
          <ContactLine
            pieces={layout.contactShort}
            align="left"
            color="#334155"
            iconColor={primaryColor}
            separator="·"
          />
        </div>
      </header>

      {layout.summary && (
        <section>
          <TimelineHeading title="个人优势" sub="SUMMARY" accent={primaryColor} />
          <SummaryBlock text={layout.summary} accent={primaryColor} />
        </section>
      )}

      {layout.experience.length > 0 && (
        <section>
          <TimelineHeading title="工作经历" sub="WORK EXPERIENCE" accent={primaryColor} />
          <TimelineEntryList entries={layout.experience} accent={primaryColor} density={density} />
        </section>
      )}

      {layout.projects.length > 0 && (
        <section>
          <TimelineHeading title="项目经历" sub="PROJECTS" accent={primaryColor} />
          <TimelineEntryList entries={layout.projects} accent={primaryColor} density={density} />
        </section>
      )}

      {layout.education.length > 0 && (
        <section>
          <TimelineHeading title="教育背景" sub="EDUCATION" accent={primaryColor} />
          <TimelineEntryList entries={layout.education} accent={primaryColor} density={density} />
        </section>
      )}

      {hasSkills(layout) && (
        <section>
          <TimelineHeading title="专业技能" sub="SKILLS" accent={primaryColor} />
          <TimelineSkills layout={layout} accent={primaryColor} />
        </section>
      )}
    </ResumeSheet>
  );
}
