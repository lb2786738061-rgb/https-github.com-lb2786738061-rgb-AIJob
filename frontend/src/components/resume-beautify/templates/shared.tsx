import type { CSSProperties, ReactNode } from "react";
import type { ContactPiece, LayoutEntry, ParsedSkills, ResumeLayout, SkillGroup } from "../layoutParse";
import {
  A4_HEIGHT_PX,
  A4_WIDTH_PX,
  RESUME_DISPLAY_FONT,
  RESUME_FONT,
  type DensityOption,
  type FontSizeOption,
  type LayoutOptions,
} from "../types";

export function Section({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <section className={className}>
      <h2>
        <span className="section-title-text">{title}</span>
        {subtitle && <span className="section-title-sub">{subtitle}</span>}
      </h2>
      {children}
    </section>
  );
}

export function displayName(resumeTitle: string, contact?: string): string {
  const firstLine = contact?.split("\n")[0]?.trim();
  if (firstLine && firstLine.length <= 30 && !firstLine.includes("@")) {
    return firstLine;
  }
  return resumeTitle;
}

export function getBaseFontSize(size?: FontSizeOption): string {
  if (size === "small") return "11.5px";
  if (size === "large") return "13.8px";
  return "12.5px";
}

export function getSectionSpacing(density?: DensityOption): {
  marginBottom: string;
  lineHeight: number;
  entryGap: string;
} {
  if (density === "compact") return { marginBottom: "14px", lineHeight: 1.48, entryGap: "9px" };
  if (density === "relaxed") return { marginBottom: "24px", lineHeight: 1.72, entryGap: "15px" };
  return { marginBottom: "18px", lineHeight: 1.6, entryGap: "12px" };
}

export function getPagePadding(density?: DensityOption): string {
  if (density === "compact") return "34px 42px";
  if (density === "relaxed") return "50px 56px";
  return "40px 48px";
}

export function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return hex;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function darkenHex(hex: string, ratio = 0.22): string {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return hex;
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const r = clamp(parseInt(raw.slice(0, 2), 16) * (1 - ratio));
  const g = clamp(parseInt(raw.slice(2, 4), 16) * (1 - ratio));
  const b = clamp(parseInt(raw.slice(4, 6), 16) * (1 - ratio));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function getNameFontSize(size?: FontSizeOption, variant: "classic" | "modern" | "minimal" = "classic"): string {
  const scale = {
    classic: { small: "23px", normal: "26px", large: "30px" },
    modern: { small: "20px", normal: "23px", large: "26px" },
    minimal: { small: "25px", normal: "29px", large: "33px" },
  }[variant];
  return scale[size ?? "normal"];
}

const LEADING_BULLET_RE = /^(?:[-•*·▪◦►▸]+|\d+[.、)\]）]|[（(]\d+[)）])\s*/;
const BULLET_LABEL_RE = /^([\u4e00-\u9fa5A-Za-z0-9]{2,8})\s*[:：]\s*(.+)$/;
const METRIC_SPLIT_RE = /(\d+(?:\.\d+)?\s*(?:%|％|万\+?|[wW]\+?|[kK]\+?|倍|ms|s|秒|小时|天|人|篇|项|个|次|亿|TB|GB|QPS|TPS))/g;

export function cleanBulletText(text: string): string {
  return (text || "").replace(LEADING_BULLET_RE, "").trim();
}

export function renderRichBullet(text: string, accent = "#1e3a8a"): ReactNode {
  const cleaned = cleanBulletText(text);
  if (!cleaned) return null;

  const renderMetrics = (segment: string) => {
    const parts = segment.split(METRIC_SPLIT_RE);
    if (parts.length === 1) return segment;
    return parts.map((part, idx) =>
      idx % 2 === 1 ? (
        <strong
          key={idx}
          style={{
            fontWeight: 600,
            color: "#0f172a",
            backgroundColor: hexToRgba(accent, 0.08),
            padding: "0 3px",
            borderRadius: "3px",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {part}
        </strong>
      ) : (
        part
      )
    );
  };

  const labeled = cleaned.match(BULLET_LABEL_RE);
  if (labeled && labeled[1] && labeled[2]) {
    return (
      <>
        <strong style={{ fontWeight: 600, color: "#0f172a" }}>{labeled[1]}：</strong>
        {renderMetrics(labeled[2])}
      </>
    );
  }

  return renderMetrics(cleaned);
}

export function ResumeSheet({
  className,
  layoutOptions,
  children,
  style,
}: {
  className: string;
  layoutOptions?: LayoutOptions;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const fontSize = getBaseFontSize(layoutOptions?.fontSize);
  const { lineHeight, marginBottom } = getSectionSpacing(layoutOptions?.density);
  const padding = style?.padding ?? getPagePadding(layoutOptions?.density);

  return (
    <div
      className={`resume-page ${className}`}
      style={{
        width: A4_WIDTH_PX,
        minHeight: A4_HEIGHT_PX,
        fontFamily: RESUME_FONT,
        padding,
        boxSizing: "border-box",
        backgroundColor: "#ffffff",
        color: "#1e293b",
        fontSize,
        lineHeight,
        position: "relative",
        WebkitFontSmoothing: "antialiased",
        ...style,
      }}
    >
      <style>{`
        .${className} section {
          margin-bottom: ${marginBottom};
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .${className} section:last-child {
          margin-bottom: 0;
        }
        .${className} .resume-entry {
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .${className} p {
          margin: 0;
        }
      `}</style>
      {children}
    </div>
  );
}

function contactTexts(pieces: Array<string | ContactPiece>): string[] {
  return pieces.map((piece) => (typeof piece === "string" ? piece : piece.text)).filter(Boolean);
}

function getContactIcon(text: string, color: string): ReactNode {
  const lower = text.toLowerCase();
  const svgProps = {
    width: 12,
    height: 12,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    style: { flexShrink: 0, opacity: 0.8 },
  };

  if (/@|邮箱|邮件|email|mail/.test(lower)) {
    return (
      <svg {...svgProps}>
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>
    );
  }
  if (/电话|手机|tel|phone|1[3-9]\d{9}/.test(lower)) {
    return (
      <svg {...svgProps}>
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    );
  }
  if (/地址|住址|现居|城市|所在地|籍贯|北京|上海|广州|深圳|杭州|成都|武汉|南京|苏州/.test(lower)) {
    return (
      <svg {...svgProps}>
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    );
  }
  if (/github|gitlab|http|blog|网站|主页|作品/.test(lower)) {
    return (
      <svg {...svgProps}>
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    );
  }
  if (/微信|wechat|wx/.test(lower)) {
    return (
      <svg {...svgProps}>
        <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      </svg>
    );
  }
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="8" r="5" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </svg>
  );
}

export function ContactLine({
  pieces,
  align = "center",
  color = "#475569",
  iconColor,
  separator,
  showIcons = true,
}: {
  pieces: Array<string | ContactPiece>;
  align?: "center" | "left" | "right";
  color?: string;
  iconColor?: string;
  separator?: string;
  showIcons?: boolean;
}) {
  const texts = contactTexts(pieces);
  if (texts.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent:
          align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center",
        columnGap: separator ? "10px" : "16px",
        rowGap: "6px",
        color,
        fontSize: "0.9em",
        lineHeight: 1.6,
      }}
    >
      {texts.map((piece, i) => (
        <span
          key={`${piece}-${i}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            wordBreak: "break-word",
          }}
        >
          {showIcons && getContactIcon(piece, iconColor ?? color)}
          <span>{piece}</span>
          {separator && i < texts.length - 1 && (
            <span style={{ marginLeft: "6px", opacity: 0.35 }}>{separator}</span>
          )}
        </span>
      ))}
    </div>
  );
}

export function ContactGrid({
  pieces,
  color = "#334155",
  labelColor,
  columns = 2,
}: {
  pieces: Array<string | ContactPiece>;
  color?: string;
  labelColor?: string;
  columns?: number;
}) {
  const texts = contactTexts(pieces);
  if (texts.length === 0) return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: columns > 1 ? `repeat(${columns}, minmax(0, 1fr))` : "1fr",
        columnGap: "24px",
        rowGap: "8px",
      }}
    >
      {texts.map((piece, i) => {
        const labeled = piece.match(/^(.{1,8}?)\s*[:：]\s*(.+)$/);
        const label = labeled?.[1];
        const value = labeled?.[2] ?? piece;
        return (
          <div
            key={`${piece}-${i}`}
            style={{
              minWidth: 0,
              lineHeight: 1.65,
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {getContactIcon(piece, labelColor ?? color)}
            <div style={{ minWidth: 0 }}>
              {label ? (
                <>
                  <span style={{ color: labelColor ?? color, opacity: 0.65, marginRight: "0.3em" }}>
                    {label}：
                  </span>
                  <span style={{ color, wordBreak: "break-word", fontWeight: 500 }}>{value}</span>
                </>
              ) : (
                <span style={{ color, wordBreak: "break-word", fontWeight: 500 }}>{piece}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ContactStack({
  pieces,
  color = "#ffffff",
  iconColor,
}: {
  pieces: Array<string | ContactPiece>;
  color?: string;
  iconColor?: string;
}) {
  const texts = contactTexts(pieces);
  if (texts.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
      {texts.map((piece, i) => (
        <div
          key={`${piece}-${i}`}
          style={{
            margin: 0,
            color,
            fontSize: "11.5px",
            lineHeight: 1.55,
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            display: "flex",
            alignItems: "flex-start",
            gap: "7px",
          }}
        >
          <span style={{ marginTop: "2.5px", flexShrink: 0 }}>
            {getContactIcon(piece, iconColor ?? color)}
          </span>
          <span>{piece}</span>
        </div>
      ))}
    </div>
  );
}

type BulletStyle = "dot" | "bar" | "plain";

export function SummaryBlock({
  text,
  accent,
  color = "#334155",
}: {
  text: string;
  accent?: string;
  color?: string;
}) {
  const accentColor = accent ?? "#1e3a8a";
  return (
    <div
      style={{
        whiteSpace: "pre-line",
        color,
        lineHeight: 1.72,
        padding: "10px 14px",
        borderLeft: `3px solid ${accentColor}`,
        backgroundColor: hexToRgba(accentColor, 0.04),
        borderRadius: "0 8px 8px 0",
        margin: 0,
        textAlign: "justify",
      }}
    >
      {renderRichBullet(text, accentColor)}
    </div>
  );
}

export function SummaryPlain({
  text,
  color = "#334155",
  accent = "#1e3a8a",
}: {
  text: string;
  color?: string;
  accent?: string;
}) {
  return (
    <p
      style={{
        margin: 0,
        color,
        lineHeight: 1.72,
        textAlign: "justify",
        whiteSpace: "pre-line",
      }}
    >
      {renderRichBullet(text, accent)}
    </p>
  );
}

export function EntryList({
  entries,
  accent,
  bulletStyle = "dot",
  titleColor,
  dateColor,
  density,
  showDivider = true,
}: {
  entries: LayoutEntry[];
  accent?: string;
  bulletStyle?: BulletStyle;
  titleColor?: string;
  dateColor?: string;
  density?: DensityOption;
  showDivider?: boolean;
}) {
  if (entries.length === 0) return null;
  const { entryGap } = getSectionSpacing(density);
  const last = entries.length - 1;

  const primary = accent ?? "#1e3a8a";
  const ink = titleColor ?? "#0f172a";
  const mutedDate = dateColor ?? "#64748b";

  return (
    <div>
      {entries.map((entry, i) => {
        const isTitle = Boolean(entry.date || entry.subtitle || entry.bullets.length > 0);
        const isSubLevel = Boolean(entry.isSubLevel);
        const nextIsSub = i < last && Boolean(entries[i + 1]?.isSubLevel);
        const showRule = showDivider && isTitle && !isSubLevel && !nextIsSub && i !== last;

        return (
          <div
            key={`${entry.header}-${i}`}
            className="resume-entry"
            style={{
              marginBottom: i === last ? 0 : isSubLevel ? "8px" : entryGap,
              paddingBottom: showRule ? "10px" : 0,
              borderBottom: showRule ? `1px solid ${hexToRgba(primary, 0.1)}` : "none",
              ...(isSubLevel
                ? {
                    marginTop: "6px",
                    marginLeft: "4px",
                    padding: "8px 12px",
                    backgroundColor: hexToRgba(primary, 0.035),
                    borderLeft: `2.5px solid ${hexToRgba(primary, 0.55)}`,
                    borderRadius: "0 6px 6px 0",
                  }
                : {}),
            }}
          >
            {isTitle ? (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: "12px",
                    flexWrap: "wrap",
                    marginBottom: entry.bullets.length > 0 ? "5px" : 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "8px",
                      minWidth: 0,
                    }}
                  >
                    {isSubLevel && (
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          color: primary,
                          backgroundColor: hexToRgba(primary, 0.12),
                          padding: "1px 6px",
                          borderRadius: "4px",
                          letterSpacing: "0.04em",
                          flexShrink: 0,
                        }}
                      >
                        项目
                      </span>
                    )}
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: isSubLevel ? "0.98em" : "1.05em",
                        color: ink,
                      }}
                    >
                      {entry.title}
                    </span>
                    {entry.subtitle && (
                      <span
                        style={{
                          color: primary,
                          fontSize: "0.9em",
                          fontWeight: 600,
                          backgroundColor: isSubLevel ? "transparent" : hexToRgba(primary, 0.08),
                          padding: isSubLevel ? 0 : "1px 8px",
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
                        flexShrink: 0,
                        color: mutedDate,
                        fontSize: "0.86em",
                        whiteSpace: "nowrap",
                        fontWeight: 500,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {entry.date}
                    </div>
                  )}
                </div>
                {entry.bullets.length > 0 && (
                  <EntryBullets items={entry.bullets} accent={primary} bulletStyle={bulletStyle} />
                )}
              </>
            ) : (
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  alignItems: "flex-start",
                }}
              >
                <span
                  style={{
                    width: "5px",
                    height: "5px",
                    borderRadius: "50%",
                    backgroundColor: hexToRgba(primary, 0.55),
                    marginTop: "0.58em",
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1, minWidth: 0, color: "#334155", lineHeight: 1.65 }}>
                  {renderRichBullet(entry.title, primary)}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EntryBullets({
  items,
  accent,
  bulletStyle,
}: {
  items: string[];
  accent?: string;
  bulletStyle: BulletStyle;
}) {
  const primary = accent ?? "#1e3a8a";

  if (bulletStyle === "plain") {
    return (
      <div style={{ marginTop: "3px" }}>
        {items.map((item, i) => (
          <p key={i} style={{ margin: i === 0 ? 0 : "4px 0 0", lineHeight: 1.65, color: "#334155" }}>
            {renderRichBullet(item, primary)}
          </p>
        ))}
      </div>
    );
  }

  if (bulletStyle === "bar") {
    return (
      <ul
        style={{
          margin: "4px 0 0",
          padding: 0,
          listStyle: "none",
        }}
      >
        {items.map((item, i) => (
          <li
            key={i}
            style={{
              marginBottom: i === items.length - 1 ? 0 : "5px",
              paddingLeft: "10px",
              borderLeft: `2px solid ${hexToRgba(primary, 0.28)}`,
              lineHeight: 1.65,
              color: "#334155",
            }}
          >
            {renderRichBullet(item, primary)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul
      style={{
        margin: "4px 0 0",
        padding: 0,
        listStyle: "none",
      }}
    >
      {items.map((item, i) => (
        <li
          key={i}
          style={{
            display: "flex",
            gap: "8px",
            marginBottom: i === items.length - 1 ? 0 : "4px",
            alignItems: "flex-start",
            lineHeight: 1.65,
            color: "#334155",
          }}
        >
          <span
            style={{
              width: "5px",
              height: "5px",
              borderRadius: "50%",
              backgroundColor: hexToRgba(primary, 0.65),
              marginTop: "0.58em",
              flexShrink: 0,
            }}
          />
          <span style={{ flex: 1, minWidth: 0 }}>{renderRichBullet(item, primary)}</span>
        </li>
      ))}
    </ul>
  );
}

const LONG_SKILL = 28;

function skillGroups(skills: ParsedSkills): SkillGroup[] {
  if (skills.groups.length > 0) return skills.groups;
  return [{ items: skills.items }];
}

function SkillChip({
  text,
  accent,
  chipForeground,
  chipBackground,
}: {
  text: string;
  accent: string;
  chipForeground?: string;
  chipBackground?: string;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 11px",
        borderRadius: "6px",
        border: `1px solid ${hexToRgba(accent, 0.18)}`,
        backgroundColor: chipBackground ?? hexToRgba(accent, 0.06),
        color: chipForeground ?? "#1e293b",
        fontSize: "0.88em",
        fontWeight: 500,
        lineHeight: 1.5,
        whiteSpace: text.length > LONG_SKILL ? "normal" : "nowrap",
        wordBreak: "break-word",
      }}
    >
      {text}
    </span>
  );
}

function SkillLine({
  text,
  accent,
  color,
}: {
  text: string;
  accent: string;
  color: string;
}) {
  return (
    <p
      style={{
        margin: 0,
        paddingLeft: "10px",
        borderLeft: `2px solid ${hexToRgba(accent, 0.25)}`,
        color,
        lineHeight: 1.65,
        wordBreak: "break-word",
      }}
    >
      {renderRichBullet(text, accent)}
    </p>
  );
}

export function SkillRow({
  skills,
  variant = "chips",
  accent = "#1e3a8a",
  chipForeground,
  chipBackground,
}: {
  skills: ParsedSkills;
  variant?: "chips" | "dots" | "list";
  accent?: string;
  chipForeground?: string;
  chipBackground?: string;
}) {
  if (skills.items.length === 0) return null;
  const groups = skillGroups(skills);
  const ink = chipForeground ?? "#334155";

  if (variant === "dots") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {groups.map((group, gi) => (
          <p
            key={`${group.label ?? "skills"}-${gi}`}
            style={{
              margin: 0,
              color: ink,
              lineHeight: 1.75,
              wordBreak: "break-word",
            }}
          >
            {group.label && (
              <strong style={{ color: "#0f172a", marginRight: "0.45em" }}>{group.label}：</strong>
            )}
            {group.items.map((item, i) => (
              <span key={`${item}-${i}`}>
                {i > 0 && <span style={{ margin: "0 0.45em", opacity: 0.45 }}>·</span>}
                {item}
              </span>
            ))}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {groups.map((group, gi) => {
        const longOnly = group.items.every((item) => item.length > LONG_SKILL);
        const useLines = variant === "list" || (skills.mode === "lines" && longOnly) || longOnly;
        return (
          <div
            key={`${group.label ?? "skills"}-${gi}`}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            {group.label && (
              <span
                style={{
                  flexShrink: 0,
                  color: chipForeground ?? accent,
                  fontSize: "0.88em",
                  fontWeight: 700,
                  paddingTop: useLines ? "1px" : "4px",
                  minWidth: "4.8em",
                }}
              >
                {group.label}：
              </span>
            )}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexWrap: "wrap",
                gap: useLines ? "6px" : "7px",
                flexDirection: useLines ? "column" : "row",
              }}
            >
              {group.items.map((item, i) =>
                useLines || item.length > LONG_SKILL ? (
                  <SkillLine key={`${item}-${i}`} text={item} accent={accent} color={ink} />
                ) : (
                  <SkillChip
                    key={`${item}-${i}`}
                    text={item}
                    accent={accent}
                    chipForeground={chipForeground}
                    chipBackground={chipBackground}
                  />
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CombinedSkills({
  layout,
  accent,
  variant = "chips",
  chipForeground,
  chipBackground,
  excludeSectionSkills = false,
}: {
  layout: ResumeLayout;
  accent?: string;
  variant?: "chips" | "dots" | "list";
  chipForeground?: string;
  chipBackground?: string;
  excludeSectionSkills?: boolean;
}) {
  const blocks = [excludeSectionSkills ? null : layout.skills, layout.extraSkills].filter(
    (block): block is ParsedSkills => Boolean(block && block.items.length > 0)
  );
  if (blocks.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {blocks.map((block, i) => (
        <SkillRow
          key={i}
          skills={block}
          variant={variant}
          accent={accent}
          chipForeground={chipForeground}
          chipBackground={chipBackground}
        />
      ))}
    </div>
  );
}

export function hasSkills(layout: ResumeLayout): boolean {
  return layout.skills.items.length > 0 || layout.extraSkills.items.length > 0;
}

export { RESUME_DISPLAY_FONT, RESUME_FONT };
