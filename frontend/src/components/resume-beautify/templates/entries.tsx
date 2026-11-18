import type { LayoutEntry, ResumeLayout, SkillGroup } from "../layoutParse";
import { type DensityOption } from "../types";
import { getSectionSpacing, hasSkills, hexToRgba, renderRichBullet } from "./shared";

function groupsFromLayout(layout: ResumeLayout): SkillGroup[] {
  const blocks = [layout.skills, layout.extraSkills].filter((block) => block.items.length > 0);
  const groups: SkillGroup[] = [];
  for (const block of blocks) {
    if (block.groups.length > 0) groups.push(...block.groups);
    else groups.push({ items: block.items });
  }
  return groups;
}

function SubProjectBadge({ accent }: { accent: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: "10px",
        fontWeight: 700,
        color: accent,
        backgroundColor: hexToRgba(accent, 0.12),
        padding: "1px 6px",
        borderRadius: "4px",
        letterSpacing: "0.04em",
        flexShrink: 0,
      }}
    >
      项目
    </span>
  );
}

function ClassicEntries({
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
        const isSub = Boolean(entry.isSubLevel);
        const nextIsSub = i < entries.length - 1 && Boolean(entries[i + 1]?.isSubLevel);
        return (
          <div
            key={`${entry.header}-${i}`}
            className="resume-entry"
            style={{
              marginBottom: i === entries.length - 1 ? 0 : isSub ? "8px" : entryGap,
              marginTop: isSub ? "6px" : 0,
              paddingBottom: !isSub && !nextIsSub && i !== entries.length - 1 ? "10px" : 0,
              borderBottom:
                !isSub && !nextIsSub && i !== entries.length - 1
                  ? `1px dashed ${hexToRgba(accent, 0.14)}`
                  : "none",
              ...(isSub
                ? {
                    padding: "8px 12px",
                    backgroundColor: hexToRgba(accent, 0.035),
                    borderLeft: `2.5px solid ${hexToRgba(accent, 0.55)}`,
                    borderRadius: "0 6px 6px 0",
                  }
                : {}),
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", minWidth: 0 }}>
                {isSub && <SubProjectBadge accent={accent} />}
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: isSub ? "0.97em" : "1.05em",
                    color: "#0f172a",
                  }}
                >
                  {entry.title}
                </span>
                {entry.subtitle && (
                  <span
                    style={{
                      color: accent,
                      fontSize: "0.9em",
                      fontWeight: 600,
                      backgroundColor: isSub ? "transparent" : hexToRgba(accent, 0.08),
                      padding: isSub ? 0 : "1px 8px",
                      borderRadius: "4px",
                    }}
                  >
                    {entry.subtitle}
                  </span>
                )}
              </div>
              {entry.date && (
                <span
                  style={{
                    fontSize: "0.86em",
                    color: "#64748b",
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {entry.date}
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
                      gap: "8px",
                      marginBottom: j === entry.bullets.length - 1 ? 0 : "4px",
                      color: "#334155",
                      lineHeight: 1.62,
                    }}
                  >
                    <span
                      style={{
                        width: "5px",
                        height: "5px",
                        borderRadius: "50%",
                        backgroundColor: hexToRgba(accent, 0.65),
                        marginTop: "0.58em",
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ flex: 1, minWidth: 0 }}>{renderRichBullet(item, accent)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ModernEntries({
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
        const isSub = Boolean(entry.isSubLevel);
        const nextIsSub = i < entries.length - 1 && Boolean(entries[i + 1]?.isSubLevel);
        return (
          <div
            key={`${entry.header}-${i}`}
            className="resume-entry"
            style={{
              marginBottom: i === entries.length - 1 ? 0 : isSub ? "8px" : entryGap,
              marginTop: isSub ? "6px" : 0,
              paddingBottom: !isSub && !nextIsSub && i !== entries.length - 1 ? "10px" : 0,
              borderBottom:
                !isSub && !nextIsSub && i !== entries.length - 1
                  ? `1px solid ${hexToRgba(accent, 0.1)}`
                  : "none",
              ...(isSub
                ? {
                    padding: "8px 12px",
                    backgroundColor: hexToRgba(accent, 0.04),
                    borderLeft: `2.5px solid ${accent}`,
                    borderRadius: "0 6px 6px 0",
                  }
                : {}),
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "baseline", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap", minWidth: 0 }}>
                {isSub && <SubProjectBadge accent={accent} />}
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: isSub ? "0.96em" : "1.04em",
                    color: "#0f172a",
                  }}
                >
                  {entry.title}
                </span>
                {entry.subtitle && (
                  <span
                    style={{
                      fontSize: "0.88em",
                      color: accent,
                      fontWeight: 600,
                      backgroundColor: hexToRgba(accent, 0.08),
                      padding: "1px 7px",
                      borderRadius: "4px",
                    }}
                  >
                    {entry.subtitle}
                  </span>
                )}
              </div>
              {entry.date && (
                <div
                  style={{
                    fontSize: "0.84em",
                    color: accent,
                    whiteSpace: "nowrap",
                    fontWeight: 600,
                    backgroundColor: hexToRgba(accent, 0.06),
                    padding: "1px 7px",
                    borderRadius: "999px",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {entry.date}
                </div>
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
                      marginBottom: j === entry.bullets.length - 1 ? 0 : "4px",
                      color: "#334155",
                      lineHeight: 1.6,
                    }}
                  >
                    <span
                      style={{
                        width: "4px",
                        height: "4px",
                        borderRadius: "50%",
                        backgroundColor: accent,
                        marginTop: "0.62em",
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ flex: 1, minWidth: 0 }}>{renderRichBullet(item, accent)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MinimalEntries({
  entries,
  accent = "#1f2937",
  density,
}: {
  entries: LayoutEntry[];
  accent?: string;
  density?: DensityOption;
}) {
  if (entries.length === 0) return null;
  const { entryGap } = getSectionSpacing(density);

  return (
    <div>
      {entries.map((entry, i) => {
        const isSub = Boolean(entry.isSubLevel);
        return (
          <div
            key={`${entry.header}-${i}`}
            className="resume-entry"
            style={{
              display: "grid",
              gridTemplateColumns: "118px 1fr",
              columnGap: "18px",
              marginBottom: i === entries.length - 1 ? 0 : isSub ? "8px" : entryGap,
              marginTop: isSub ? "6px" : 0,
            }}
          >
            <div
              style={{
                fontSize: "0.84em",
                color: "#64748b",
                lineHeight: 1.5,
                paddingTop: "2px",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {entry.date ? (
                <div style={{ fontWeight: 500, color: "#475569" }}>{entry.date}</div>
              ) : isSub ? (
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 600,
                    color: accent,
                    backgroundColor: hexToRgba(accent, 0.08),
                    padding: "1px 6px",
                    borderRadius: "4px",
                  }}
                >
                  核心项目
                </span>
              ) : null}
              {entry.subtitle && !isSub && (
                <div style={{ fontSize: "0.92em", color: accent, fontWeight: 600, marginTop: "2px" }}>
                  {entry.subtitle}
                </div>
              )}
            </div>
            <div
              style={
                isSub
                  ? {
                      paddingLeft: "10px",
                      borderLeft: `2px solid ${hexToRgba(accent, 0.35)}`,
                    }
                  : undefined
              }
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flexWrap: "wrap",
                  fontWeight: isSub ? 600 : 700,
                  fontSize: isSub ? "0.96em" : "1.03em",
                  color: "#0f172a",
                }}
              >
                {isSub && entry.date && <SubProjectBadge accent={accent} />}
                <span>{entry.title}</span>
                {isSub && entry.subtitle && (
                  <span style={{ fontSize: "0.88em", color: accent, fontWeight: 500 }}>
                    · {entry.subtitle}
                  </span>
                )}
              </div>
              {entry.bullets.length > 0 && (
                <ul style={{ margin: "5px 0 0", padding: 0, listStyle: "none" }}>
                  {entry.bullets.map((item, j) => (
                    <li
                      key={j}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "7px",
                        marginBottom: j === entry.bullets.length - 1 ? 0 : "4px",
                        color: "#334155",
                        lineHeight: 1.62,
                      }}
                    >
                      <span style={{ color: hexToRgba(accent, 0.55), fontSize: "0.85em", lineHeight: 1.7 }}>
                        •
                      </span>
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

function GridEntries({
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
        const isSub = Boolean(entry.isSubLevel);
        const companyIndex = entries.slice(0, i + 1).filter((item) => !item.isSubLevel).length;
        const nextIsSub = i < entries.length - 1 && Boolean(entries[i + 1]?.isSubLevel);
        return (
          <div
            key={`${entry.header}-${i}`}
            className="resume-entry"
            style={{
              marginBottom: i === entries.length - 1 ? 0 : isSub ? "8px" : entryGap,
              paddingBottom: i === entries.length - 1 || isSub || nextIsSub ? 0 : "10px",
              borderBottom:
                i === entries.length - 1 || isSub || nextIsSub
                  ? "none"
                  : `1px solid ${hexToRgba(accent, 0.12)}`,
              ...(isSub
                ? {
                    marginTop: "6px",
                    marginLeft: "24px",
                    padding: "8px 12px",
                    backgroundColor: hexToRgba(accent, 0.035),
                    borderLeft: `2.5px solid ${hexToRgba(accent, 0.6)}`,
                    borderRadius: "0 6px 6px 0",
                  }
                : {}),
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", minWidth: 0 }}>
                {isSub ? (
                  <SubProjectBadge accent={accent} />
                ) : (
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "#ffffff",
                      backgroundColor: accent,
                      padding: "1px 5px",
                      borderRadius: "4px",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {String(companyIndex).padStart(2, "0")}
                  </span>
                )}
                <span style={{ fontWeight: 700, fontSize: isSub ? "0.96em" : "1.04em", color: "#0f172a" }}>
                  {entry.title}
                </span>
                {entry.subtitle && (
                  <span style={{ fontSize: "0.88em", color: accent, fontWeight: 600 }}>
                    | {entry.subtitle}
                  </span>
                )}
              </div>
              {entry.date && (
                <span
                  style={{
                    fontSize: "0.85em",
                    color: "#64748b",
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {entry.date}
                </span>
              )}
            </div>
            {entry.bullets.length > 0 && (
              <ul style={{ margin: isSub ? "5px 0 0" : "6px 0 0 26px", padding: 0, listStyle: "none" }}>
                {entry.bullets.map((item, j) => (
                  <li
                    key={j}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "7px",
                      color: "#334155",
                      lineHeight: 1.6,
                      marginBottom: j === entry.bullets.length - 1 ? 0 : "4px",
                    }}
                  >
                    <span
                      style={{
                        width: "5px",
                        height: "5px",
                        borderRadius: "50%",
                        backgroundColor: hexToRgba(accent, 0.6),
                        marginTop: "0.58em",
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ flex: 1, minWidth: 0 }}>{renderRichBullet(item, accent)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ClassicSkills({ layout, accent = "#1e3a8a" }: { layout: ResumeLayout; accent?: string }) {
  if (!hasSkills(layout)) return null;
  const groups = groupsFromLayout(layout);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
      {groups.map((group, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "8px",
            lineHeight: 1.68,
            color: "#334155",
          }}
        >
          {group.label ? (
            <span
              style={{
                flexShrink: 0,
                fontWeight: 700,
                color: accent,
                fontSize: "0.92em",
                backgroundColor: hexToRgba(accent, 0.08),
                padding: "1px 8px",
                borderRadius: "4px",
              }}
            >
              {group.label}
            </span>
          ) : (
            <span
              style={{
                width: "5px",
                height: "5px",
                borderRadius: "50%",
                backgroundColor: hexToRgba(accent, 0.65),
                flexShrink: 0,
                transform: "translateY(-2px)",
              }}
            />
          )}
          <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
            {group.items.map((item, j) =>
              item.length <= 22 && group.items.length > 1 ? (
                <span
                  key={j}
                  style={{
                    display: "inline-block",
                    padding: "2px 9px",
                    borderRadius: "5px",
                    backgroundColor: "#f8fafc",
                    border: `1px solid ${hexToRgba(accent, 0.16)}`,
                    color: "#1e293b",
                    fontSize: "0.9em",
                    fontWeight: 500,
                  }}
                >
                  {item}
                </span>
              ) : (
                <span key={j} style={{ color: "#334155" }}>
                  {renderRichBullet(item, accent)}
                </span>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ModernSideSkills({ layout }: { layout: ResumeLayout }) {
  if (!hasSkills(layout)) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {groupsFromLayout(layout).map((group, i) => (
        <div key={i}>
          {group.label && (
            <div
              style={{
                fontSize: "10.5px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: "rgba(255,255,255,0.85)",
                marginBottom: "6px",
              }}
            >
              {group.label}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {group.items.map((item, idx) =>
              item.length <= 18 ? (
                <span
                  key={`${item}-${idx}`}
                  style={{
                    display: "inline-block",
                    padding: "3px 9px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(255,255,255,0.14)",
                    border: "1px solid rgba(255,255,255,0.22)",
                    color: "#ffffff",
                    fontSize: "11px",
                    lineHeight: 1.4,
                    fontWeight: 500,
                  }}
                >
                  {item}
                </span>
              ) : (
                <p
                  key={`${item}-${idx}`}
                  style={{
                    margin: "0 0 4px",
                    lineHeight: 1.5,
                    fontSize: "11.5px",
                    color: "rgba(255,255,255,0.92)",
                    width: "100%",
                  }}
                >
                  • {item}
                </p>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function MinimalSkills({ layout, accent = "#1f2937" }: { layout: ResumeLayout; accent?: string }) {
  if (!hasSkills(layout)) return null;
  const groups = groupsFromLayout(layout);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {groups.map((group, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: group.label ? "118px 1fr" : "1fr",
            columnGap: "18px",
            alignItems: "baseline",
          }}
        >
          {group.label && (
            <div style={{ fontSize: "0.88em", fontWeight: 600, color: accent }}>
              {group.label}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {group.items.map((item, j) =>
              item.length <= 24 ? (
                <span
                  key={j}
                  style={{
                    padding: "2px 9px",
                    borderRadius: "4px",
                    backgroundColor: hexToRgba(accent, 0.05),
                    color: "#1e293b",
                    fontSize: "0.9em",
                  }}
                >
                  {item}
                </span>
              ) : (
                <span key={j} style={{ color: "#334155", lineHeight: 1.65 }}>
                  {renderRichBullet(item, accent)}
                </span>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineSkills({ layout, accent }: { layout: ResumeLayout; accent: string }) {
  if (!hasSkills(layout)) return null;
  const groups = groupsFromLayout(layout);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: groups.length > 1 ? "repeat(2, minmax(0, 1fr))" : "1fr",
        gap: "10px 16px",
      }}
    >
      {groups.map((group, i) => (
        <div
          key={i}
          style={{
            padding: "9px 12px",
            borderRadius: "8px",
            backgroundColor: hexToRgba(accent, 0.035),
            border: `1px solid ${hexToRgba(accent, 0.12)}`,
          }}
        >
          {group.label && (
            <div
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: accent,
                marginBottom: "5px",
              }}
            >
              {group.label}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
            {group.items.map((item, j) => (
              <span
                key={j}
                style={{
                  fontSize: "0.9em",
                  color: "#334155",
                  backgroundColor: "#ffffff",
                  padding: "1px 7px",
                  borderRadius: "4px",
                  border: `1px solid ${hexToRgba(accent, 0.12)}`,
                }}
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function GridSkills({ layout, accent }: { layout: ResumeLayout; accent: string }) {
  if (!hasSkills(layout)) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {groupsFromLayout(layout).map((group, i) => (
        <div
          key={i}
          style={{
            border: `1px solid ${hexToRgba(accent, 0.14)}`,
            backgroundColor: hexToRgba(accent, 0.025),
            borderRadius: "6px",
            padding: "7px 10px",
          }}
        >
          {group.label && (
            <div style={{ fontSize: "10.5px", fontWeight: 700, color: accent, marginBottom: "4px" }}>
              {group.label}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
            {group.items.map((item, j) => (
              <span
                key={j}
                style={{
                  color: "#1e293b",
                  lineHeight: 1.5,
                  fontSize: "0.88em",
                  backgroundColor: "#ffffff",
                  padding: "1px 7px",
                  borderRadius: "4px",
                  border: `1px solid ${hexToRgba(accent, 0.12)}`,
                }}
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export {
  ClassicEntries,
  ClassicSkills,
  GridEntries,
  GridSkills,
  MinimalEntries,
  MinimalSkills,
  ModernEntries,
  ModernSideSkills,
  TimelineSkills,
};
