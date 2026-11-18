import type { ParsedResume, StructuredResumeEntry, StructuredResumeLayout } from "../../api/client";

export interface ContactPiece {
  text: string;
  long: boolean;
}

export interface ParsedContact {
  name: string;
  /** Remaining contact fragments in original wording, name line excluded. */
  pieces: ContactPiece[];
  nameFromContact: boolean;
  skippedHeaders: string[];
  /** Original labeled name field, e.g. 姓名：李冰 */
  nameSource: string | null;
}

export interface LayoutEntry {
  /** Original header line (or standalone line). */
  header: string;
  /** Primary title after the date is lifted to the right. */
  title: string;
  /** Remaining header parts (role, major, degree), original wording. */
  subtitle: string | null;
  date: string | null;
  bullets: string[];
  /** Sub-level indicator (true if identified as a nested project) */
  isSubLevel?: boolean;
}

export interface SkillGroup {
  label?: string;
  items: string[];
}

export interface ParsedSkills {
  mode: "tags" | "lines";
  /** Flattened original fragments for content-preservation checks. */
  items: string[];
  groups: SkillGroup[];
}

export type ResumeShape = "career" | "profile" | "contactHeavy" | "sparse";

export interface ResumeLayout {
  name: string;
  nameFromContact: boolean;
  nameSource: string | null;
  contactSkipped: string[];
  contactPieces: ContactPiece[];
  contactShort: ContactPiece[];
  contactLong: ContactPiece[];
  summary?: string;
  experience: LayoutEntry[];
  projects: LayoutEntry[];
  education: LayoutEntry[];
  skills: ParsedSkills;
  extraSkills: ParsedSkills;
  experienceSkipped: string[];
  projectSkipped: string[];
  educationSkipped: string[];
  shape: ResumeShape;
}

const DATE_TOKEN = String.raw`\d{4}(?:[./\-年]\d{1,2}(?:[./\-月]\d{1,2}日?)?)?月?`;
const DATE_END = String.raw`(?:${DATE_TOKEN}|至今|现在|present|今)`;
const DATE_RANGE_RE = new RegExp(
  `(${DATE_TOKEN})\\s*[-–—~～至到]+\\s*(${DATE_END})`,
  "i",
);

const SECTION_HEADERS = new Set([
  "个人信息",
  "个人资料",
  "基本信息",
  "联系方式",
  "联系信息",
  "个人简历",
  "求职简历",
  "简历",
  "contact",
  "profile",
  "contacts",
]);

const FIELD_LABELS = [
  "姓名",
  "名字",
  "性别",
  "年龄",
  "出生",
  "生日",
  "电话",
  "手机",
  "座机",
  "邮箱",
  "邮件",
  "电子邮箱",
  "微信",
  "住址",
  "地址",
  "现居",
  "所在地",
  "籍贯",
  "民族",
  "政治面貌",
  "求职意向",
  "意向岗位",
  "工作年限",
  "专长",
  "特长",
];

const LABEL_SPLIT_RE = new RegExp(`(?=(?:${FIELD_LABELS.join("|")})\\s*[:：])`);
const NAME_FIELD_RE = /^(?:姓名|名字)\s*[:：]\s*(.+)$/;
const LONG_PIECE = 40;

const SKILL_SUBHEADS = ["熟悉的技能", "专业技能", "核心技能", "技能", "skills"];
const PROJECT_SUBHEADS = ["项目经验", "项目经历", "项目", "projects"];
const EDUCATION_SUBHEADS = ["教育背景", "教育经历", "教育", "education"];
const EXPERIENCE_SUBHEADS = [
  "工作经历",
  "工作履历",
  "实习经历",
  "工作",
  "experience",
];

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Peel leftover in-content headings. Short labels only match a whole item. */
export function peelListedHeaders(
  items: string[],
  headers: string[],
): { skipped: string[]; rest: string[] } {
  const sorted = [...headers].sort((a, b) => b.length - a.length);
  const skipped: string[] = [];
  const rest: string[] = [];

  for (const raw of items) {
    let text = raw.trim();
    if (!text) continue;

    for (let i = 0; i < 6 && text; i += 1) {
      const hit = sorted.find((header) => {
        const exact = new RegExp(
          `^${escapeRegExp(header)}(?:\\s*[:：])?$`,
          "i",
        );
        if (exact.test(text)) return true;
        if (header.length < 4) return false;
        return new RegExp(
          `^${escapeRegExp(header)}(?:\\s*[:：])?(?:\\s+|$)`,
          "i",
        ).test(text);
      });
      if (!hit) break;
      skipped.push(hit);
      text = text
        .replace(new RegExp(`^${escapeRegExp(hit)}(?:\\s*[:：])?\\s*`, "i"), "")
        .trim();
    }

    if (text) rest.push(text);
  }

  return { skipped, rest };
}

function isSectionHeader(text: string): boolean {
  const trimmed = text.trim().replace(/[:：]$/, "");
  return (
    SECTION_HEADERS.has(trimmed) || SECTION_HEADERS.has(trimmed.toLowerCase())
  );
}

function peelLeadingHeaders(text: string): { skipped: string[]; rest: string } {
  const headers = [...SECTION_HEADERS].sort((a, b) => b.length - a.length);
  const skipped: string[] = [];
  let rest = text.trim();
  for (let i = 0; i < 8 && rest; i += 1) {
    const hit = headers.find((header) =>
      new RegExp(`^${header}(?:\\s*[:：])?(?:\\s+|$)`, "i").test(rest),
    );
    if (!hit) break;
    skipped.push(hit);
    rest = rest
      .replace(new RegExp(`^${hit}(?:\\s*[:：])?\\s*`, "i"), "")
      .trim();
  }
  return { skipped, rest };
}

function splitContactFragments(text: string): string[] {
  return text
    .split(/[|｜]/)
    .flatMap((part) => part.split(LABEL_SPLIT_RE))
    .map((part) => part.trim())
    .filter(Boolean);
}

function classifyContactPiece(
  piece: string,
): "email" | "phone" | "name" | "extra" {
  if (NAME_FIELD_RE.test(piece)) return "name";
  if (/@/.test(piece) || /邮箱|email/i.test(piece)) return "email";
  if (
    /电话|手机|mobile|tel|phone/i.test(piece) ||
    /1[3-9]\d{9}/.test(piece.replace(/\D/g, ""))
  ) {
    return "phone";
  }
  return "extra";
}

function orderContactPieces(pieces: ContactPiece[]): ContactPiece[] {
  const name: ContactPiece[] = [];
  const phone: ContactPiece[] = [];
  const email: ContactPiece[] = [];
  const extra: ContactPiece[] = [];
  for (const piece of pieces) {
    const kind = classifyContactPiece(piece.text);
    if (kind === "name") name.push(piece);
    else if (kind === "phone") phone.push(piece);
    else if (kind === "email") email.push(piece);
    else extra.push(piece);
  }
  return [...name, ...phone, ...email, ...extra];
}

function toContactPiece(text: string): ContactPiece {
  return { text, long: text.length > LONG_PIECE };
}

export function parseContact(
  contact: string | undefined,
  resumeTitle: string,
): ParsedContact {
  const lines = (contact ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const skippedHeaders: string[] = [];
  const body: string[] = [];
  for (const line of lines) {
    const peeled = peelLeadingHeaders(line);
    skippedHeaders.push(...peeled.skipped);
    if (!peeled.rest) continue;
    for (const fragment of splitContactFragments(peeled.rest)) {
      if (isSectionHeader(fragment)) {
        skippedHeaders.push(fragment);
        continue;
      }
      const inner = peelLeadingHeaders(fragment);
      skippedHeaders.push(...inner.skipped);
      if (inner.rest) body.push(inner.rest);
    }
  }

  let nameSource: string | null = null;
  let name: string | null = null;
  for (const fragment of body) {
    const labeled = fragment.match(NAME_FIELD_RE);
    if (labeled?.[1] && labeled[1].trim().length <= 30) {
      nameSource = fragment;
      name = labeled[1].trim();
      break;
    }
  }

  if (!name) {
    const first = body[0];
    if (
      first &&
      first.length <= 30 &&
      !first.includes("@") &&
      !/[:：]/.test(first)
    ) {
      name = first;
      nameSource = first;
    }
  }

  const rest = body.filter((fragment) => fragment !== nameSource);
  return {
    name: name ?? resumeTitle,
    pieces: orderContactPieces(rest.map(toContactPiece)),
    nameFromContact: Boolean(name),
    skippedHeaders,
    nameSource,
  };
}

function isHeader(line: string): boolean {
  DATE_RANGE_RE.lastIndex = 0;
  if (DATE_RANGE_RE.test(line)) return true;
  return /[|｜]/.test(line) && line.length <= 80;
}

function splitTitleMeta(
  title: string,
): Pick<LayoutEntry, "title" | "subtitle"> {
  const piped = title
    .split(/\s*[|｜]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (piped.length >= 2) {
    return { title: piped[0], subtitle: piped.slice(1).join(" | ") };
  }
  const spaced = title
    .split(/\s{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (spaced.length >= 2) {
    return { title: spaced[0], subtitle: spaced.slice(1).join(" | ") };
  }
  const parts = title.split(" ").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const orgLike = /(公司|集团|科技|网络|有限|大学|学院|银行|中心|工作室)/;
    const roleLike = /(工程师|经理|主管|专员|实习生|实习|开发|设计|运营|分析|架构师|助理|顾问)$/;
    const degreeLike = /(本科|硕士|博士|研究生|学士)$/;
    if (orgLike.test(parts[0]) && degreeLike.test(parts[parts.length - 1])) {
      return { title: parts[0], subtitle: parts.slice(1).join(" ") };
    }
    const org = parts.slice(0, -1).join(" ");
    const role = parts[parts.length - 1];
    if (orgLike.test(org) && roleLike.test(role)) {
      return { title: org, subtitle: role };
    }
  }
  return { title, subtitle: null };
}

function splitHeader(header: string): {
  header: string;
  title: string;
  subtitle: string | null;
  date: string | null;
} {
  DATE_RANGE_RE.lastIndex = 0;
  let date: string | null = null;
  let match: RegExpExecArray | null = null;
  let lastMatch: RegExpExecArray | null = null;
  while ((match = DATE_RANGE_RE.exec(header)) !== null) {
    lastMatch = match;
  }
  let rest = header;
  if (lastMatch) {
    date = lastMatch[1].trim();
    rest =
      header.slice(0, lastMatch.index) +
      header.slice(lastMatch.index + lastMatch[0].length);
  }
  rest = rest.replace(/^[|｜\s]+|[|｜\s]+$/g, "");
  rest = rest
    .replace(/\s*[|｜]\s*/g, " | ")
    .replace(/\s+/g, " ")
    .trim();
  const meta = splitTitleMeta(rest || header);
  return { header, date, ...meta };
}
const ACTION_PREFIX_RE =
  /^(?:[-•*]\s*)?(负责|参与|完成|使用|实现|主导|协助|优化|设计|开发了|搭建|推动|跟进|支持|编写|维护)/;



function looksLikeTitle(line: string): boolean {
  if (isHeader(line)) return true;
  if (line.length > 40) return false;
  if (/[。！？]/.test(line)) return false;
  if (ACTION_PREFIX_RE.test(line)) return false;
  return true;
}

function looksLikeBullet(line: string, current: LayoutEntry | null): boolean {
  if (!current || isHeader(line)) return false;
  if (/[。！？]/.test(line)) return true;
  if (ACTION_PREFIX_RE.test(line)) return true;
  if (line.length > 40) return true;
  return false;
}

/** Recover a job header that the backend parser glued onto the previous bullet. */
function splitEmbeddedHeader(
  line: string,
): { before: string; header: string } | null {
  DATE_RANGE_RE.lastIndex = 0;
  const match = DATE_RANGE_RE.exec(line);
  if (!match || match.index < 2) return null;
  const after = line.slice(match.index).trim();
  const before = line.slice(0, match.index).trim();
  if (!before || !/[|｜]/.test(after) || after.length > 80) return null;
  return { before, header: after };
}

function isProjectLike(title: string): boolean {
  return /项目|系统|平台|小程序|APP/i.test(title) || /^[【\[<《]/.test(title);
}

function isCompanyLike(title: string): boolean {
  return /公司|集团|科技|网络|有限|厂|银行|中心|部/i.test(title);
}

const NUMBERED_PREFIX_RE = /^(?:\d+[.、)\]）]|[（(][一二三四五六七八九十\d]+[)）]|[-•*·▪◦])\s*/;
const PROJECT_CHUNK_RE = /(?=项目(?:名称|名|[一二三四五六七八九十]+|\d+)\s*[:：])/;
const PROJECT_LABEL_RE = /^项目(?:名称|名|[一二三四五六七八九十]+|\d+)\s*[:：.、]\s*(.+)$/;
const BRACKET_HEADING_RE = /^[【\[《<](.+?)[】\]》>](.*)$/;
const DUTY_SPLIT_RE =
  /(?:(?<=\s)|(?<=[\u4e00-\u9fff。；;，,：:]))(?=(?:负责|参与|完成|使用|实现|主导|协助|优化|设计|开发了|搭建|推动|跟进|支持|编写|维护)(?!人))/;

function splitNameAndDuty(text: string): { name: string; date: string | null; duties: string[] } {
  DATE_RANGE_RE.lastIndex = 0;
  let date: string | null = null;
  let lastMatch: RegExpExecArray | null = null;
  let match: RegExpExecArray | null = null;
  const scanner = new RegExp(DATE_RANGE_RE.source, DATE_RANGE_RE.flags);
  while ((match = scanner.exec(text)) !== null) {
    lastMatch = match;
  }
  let rest = text;
  if (lastMatch) {
    date = lastMatch[0].trim();
    rest = `${text.slice(0, lastMatch.index)}${text.slice(lastMatch.index + lastMatch[0].length)}`.trim();
  }
  rest = rest.replace(/^[|｜\s]+|[|｜\s]+$/g, "").trim();
  const parts = rest.split(DUTY_SPLIT_RE).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { name: parts[0].replace(/[ ，,;；|｜]+$/, ""), date, duties: parts.slice(1) };
  }
  const sentences = rest.split(/(?<=[。！？])/).map((part) => part.trim()).filter(Boolean);
  if (sentences.length >= 2 && sentences[0].length <= 40 && !ACTION_PREFIX_RE.test(sentences[0])) {
    return { name: sentences[0].replace(/[ ，,;；|｜]+$/, ""), date, duties: sentences.slice(1) };
  }
  return { name: rest, date, duties: [] };
}

function parseProjectHeading(line: string): LayoutEntry | null {
  const raw = line.trim();
  if (!raw) return null;
  const stripped = raw.replace(NUMBERED_PREFIX_RE, "").trim();
  if (!stripped) return null;

  const labeled = stripped.match(PROJECT_LABEL_RE);
  if (labeled?.[1]) {
    const parsed = splitNameAndDuty(labeled[1].trim());
    if (parsed.name) {
      return {
        header: raw,
        title: parsed.name,
        subtitle: null,
        date: parsed.date,
        bullets: parsed.duties,
        isSubLevel: true,
      };
    }
  }

  const bracket = stripped.match(BRACKET_HEADING_RE);
  if (bracket?.[1]) {
    const inner = bracket[1].trim();
    const tail = (bracket[2] || "").trim();
    if (inner && !ACTION_PREFIX_RE.test(inner) && inner.length <= 40) {
      const parsed = splitNameAndDuty(tail ? `${inner} ${tail}` : inner);
      return {
        header: raw,
        title: parsed.name || inner,
        subtitle: null,
        date: parsed.date,
        bullets: parsed.duties,
        isSubLevel: true,
      };
    }
  }

  if (ACTION_PREFIX_RE.test(stripped)) return null;
  if (/[。！？]$/.test(stripped) && stripped.length > 24) return null;
  if (isCompanyLike(stripped)) return null;
  if (stripped.length <= 40 && isProjectLike(stripped)) {
    const parsed = splitNameAndDuty(stripped);
    if (parsed.name && parsed.name.length <= 40 && !ACTION_PREFIX_RE.test(parsed.name)) {
      return {
        header: raw,
        title: parsed.name,
        subtitle: null,
        date: parsed.date,
        bullets: parsed.duties,
        isSubLevel: true,
      };
    }
  }
  return null;
}

function expandProjectChunks(texts: string[]): string[] {
  const expanded: string[] = [];
  for (const text of texts) {
    const parts = text.split(PROJECT_CHUNK_RE).map((part) => part.trim()).filter(Boolean);
    expanded.push(...(parts.length > 0 ? parts : [text]));
  }
  return expanded;
}

export function splitCompanyProjects(entry: LayoutEntry): LayoutEntry[] {
  if (entry.isSubLevel) return [entry];
  const fragments = expandProjectChunks(entry.bullets);
  if (fragments.length === 0) return [entry];

  const companyBullets: string[] = [];
  const children: LayoutEntry[] = [];
  let current: LayoutEntry | null = null;
  for (const fragment of fragments) {
    const heading = parseProjectHeading(fragment);
    if (heading) {
      current = heading;
      children.push(current);
      continue;
    }
    if (current) current.bullets.push(fragment);
    else companyBullets.push(fragment);
  }
  if (children.length === 0) return [entry];
  return [{ ...entry, bullets: companyBullets, isSubLevel: false }, ...children];
}

function expandExperienceEntries(entries: LayoutEntry[]): LayoutEntry[] {
  return entries.flatMap((entry) => splitCompanyProjects(entry));
}

export function groupEntries(
  items: string[],
  context: "experience" | "projects" | "education" = "experience",
): LayoutEntry[] {
  const expanded: string[] = [];
  for (const item of items) {
    const lines = item
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    for (const line of lines) {
      const embedded = splitEmbeddedHeader(line);
      if (embedded) {
        expanded.push(embedded.before);
        expanded.push(embedded.header);
      } else {
        expanded.push(line);
      }
    }
  }

  const entries: LayoutEntry[] = [];
  let current: LayoutEntry | null = null;
  for (const line of expanded) {
    if (isHeader(line)) {
      current = { ...splitHeader(line), bullets: [] };
      entries.push(current);
    } else if (looksLikeBullet(line, current)) {
      current!.bullets.push(line);
    } else if (current && !looksLikeTitle(line)) {
      current.bullets.push(line);
    } else {
      current = splitProseOrTitle(line);
      entries.push(current);
    }
  }

  // 二次遍历：启发式标记混合在“工作经历”中的二级项目
  if (context === "experience") {
    let topLevelFound = false;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (i === 0) {
        topLevelFound = true; // 第一个总是顶级（公司）
        entry.isSubLevel = false;
      } else {
        const title = entry.title || "";
        // 如果它没有日期，或者有明确的项目字眼且没有公司字眼，并且之前已经找到过公司，那么降级为子项目
        if (
          topLevelFound &&
          (!entry.date || (isProjectLike(title) && !isCompanyLike(title)))
        ) {
          entry.isSubLevel = true;
        } else {
          entry.isSubLevel = false;
          topLevelFound = true;
        }
      }
    }
    return expandExperienceEntries(entries);
  }

  return entries;
}

function splitProseOrTitle(line: string): LayoutEntry {
  if (line.length > 40 && /[。！？]/.test(line)) {
    const sentences = line
      .split(/(?<=[。！？])/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (sentences.length >= 2) {
      return {
        header: line,
        title: sentences[0],
        subtitle: null,
        date: null,
        bullets: sentences.slice(1),
      };
    }
  }
  return { header: line, date: null, bullets: [], ...splitTitleMeta(line) };
}

function splitMidCategory(token: string): string[] {
  const parts = token
    .split(/(?<=[)）])\s*(?=[^\s、，,]{2,12}[:：])/)
    .flatMap((part) => part.split(/\n+(?=[^\s、，,\n]{2,12}[:：])/))
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [token];
}

function expandSkillLine(line: string): string[] {
  const clauses = line
    .split(/\n+/)
    .flatMap((part) => part.split(/[；;]/))
    .map((part) => part.trim())
    .filter(Boolean);
  const tokens: string[] = [];

  for (const clause of clauses) {
    const category = clause.match(/^(.{1,12}[:：])([\s\S]+)$/);
    if (category && /[、，,]/.test(category[2])) {
      const rest = category[2]
        .split(/[、，,]/)
        .map((part) => part.trim())
        .filter(Boolean);
      tokens.push(`${category[1]}${rest[0]}`);
      tokens.push(...rest.slice(1).flatMap(splitMidCategory));
      continue;
    }
    if (/[、，,]/.test(clause)) {
      tokens.push(
        ...clause
          .split(/[、，,]/)
          .flatMap(splitMidCategory)
          .map((part) => part.trim())
          .filter(Boolean),
      );
      continue;
    }
    tokens.push(...splitMidCategory(clause));
  }

  return tokens;
}

function groupSkillTokens(tokens: string[]): SkillGroup[] {
  const groups: SkillGroup[] = [];
  let current: SkillGroup = { items: [] };

  const flush = () => {
    if (current.label || current.items.length > 0) {
      groups.push(current);
    }
    current = { items: [] };
  };

  for (const token of tokens) {
    const labeled = token.match(/^(.{1,12}?)[:：](.+)$/);
    if (labeled) {
      flush();
      const item = labeled[2].trim();
      current = { label: labeled[1].trim(), items: item ? [item] : [] };
      continue;
    }
    current.items.push(token);
  }
  flush();
  return groups;
}

export function parseSkills(items: string[]): ParsedSkills {
  const cleaned = items.map((item) => item.trim()).filter(Boolean);
  if (cleaned.length === 0) return { mode: "lines", items: [], groups: [] };

  const { skipped, rest } = peelListedHeaders(cleaned, SKILL_SUBHEADS);
  const expanded = rest.flatMap(expandSkillLine);
  const groups = groupSkillTokens(expanded);
  return {
    mode: expanded.length >= 2 ? "tags" : "lines",
    items: [...skipped, ...expanded],
    groups,
  };
}

export function normalizeContent(text: string): string {
  return text
    .replace(/[,，、;；|｜·•]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function collectDisplayedText(
  parts: Array<string | null | undefined>,
): string {
  return normalizeContent(
    parts.filter((part): part is string => Boolean(part)).join(" "),
  );
}

function tokenKey(text: string): string {
  return normalizeContent(text).split(" ").filter(Boolean).sort().join("\0");
}

export function sameContent(
  original: string | string[] | undefined,
  displayed: Array<string | null | undefined>,
): boolean {
  const source = Array.isArray(original)
    ? original.join(" ")
    : (original ?? "");
  return tokenKey(source) === tokenKey(collectDisplayedText(displayed));
}

function entryDisplayParts(entries: LayoutEntry[]): Array<string | null> {
  return entries.flatMap((entry) => {
    const extras = entry.bullets.filter(
      (bullet) => !entry.header.includes(bullet),
    );
    return [entry.header, ...extras];
  });
}

export function contactCheckParts(contact: ParsedContact): string[] {
  const parts = [...contact.skippedHeaders];
  if (contact.nameSource) parts.push(contact.nameSource);
  parts.push(...contact.pieces.map((piece) => piece.text));
  return parts;
}

export function layoutPreservesContent(
  parsed: ParsedResume,
  layout: ResumeLayout,
): boolean {
  const contactDisplayed = [
    ...layout.contactSkipped,
    layout.nameSource,
    ...layout.contactPieces.map((piece) => piece.text),
  ];

  return (
    sameContent(parsed.sections.contact, contactDisplayed) &&
    sameContent(parsed.sections.summary, [layout.summary]) &&
    sameContent(parsed.sections.experience, [
      ...layout.experienceSkipped,
      ...entryDisplayParts(layout.experience),
    ]) &&
    sameContent(parsed.sections.projects, [
      ...layout.projectSkipped,
      ...entryDisplayParts(layout.projects),
    ]) &&
    sameContent(parsed.sections.education, [
      ...layout.educationSkipped,
      ...entryDisplayParts(layout.education),
    ]) &&
    sameContent(parsed.sections.skills, layout.skills.items)
  );
}

function filledSectionCount(layout: Omit<ResumeLayout, "shape">): number {
  let count = 0;
  if (layout.summary) count += 1;
  if (layout.experience.length > 0) count += 1;
  if (layout.projects.length > 0) count += 1;
  if (layout.education.length > 0) count += 1;
  if (layout.skills.items.length > 0 || layout.extraSkills.items.length > 0)
    count += 1;
  if (layout.contactShort.length > 0 || layout.contactLong.length > 0)
    count += 1;
  return count;
}

export function detectShape(layout: Omit<ResumeLayout, "shape">): ResumeShape {
  const hasCareer = layout.experience.length > 0 || layout.projects.length > 0;
  const filled = filledSectionCount(layout);
  const shortCount = layout.contactShort.length;
  const hasLong =
    layout.contactLong.length > 0 || layout.extraSkills.items.length > 0;

  if (!hasCareer && filled <= 2) return "sparse";
  if (!hasCareer) return "profile";
  if (shortCount >= 5 || (hasLong && shortCount >= 3)) return "contactHeavy";
  return "career";
}

export function usesSidebar(layout: ResumeLayout): boolean {
  return (
    layout.shape === "career" &&
    layout.contactLong.length === 0 &&
    layout.extraSkills.items.length === 0 &&
    layout.contactShort.length > 0 &&
    layout.contactShort.length < 5
  );
}

export function usesContactGrid(layout: ResumeLayout): boolean {
  return layout.shape === "profile" || layout.shape === "contactHeavy";
}

export function skillsInSidebar(layout: ResumeLayout): boolean {
  if (!usesSidebar(layout) || layout.extraSkills.items.length > 0) return false;
  if (layout.skills.items.length === 0) return false;
  if (layout.skills.groups.some((group) => group.label)) return false;
  return layout.skills.items.every((item) => item.length <= 20);
}

function structuredEntryToLayout(entry: StructuredResumeEntry): LayoutEntry {
  const org = (entry.org || "").trim();
  const role = (entry.role || "").trim();
  const date = entry.date?.trim() || null;
  const bullets = (entry.bullets || []).map((item) => item.trim()).filter(Boolean);
  const title = org || role;
  const subtitle = org && role ? role : null;
  return {
    header: [org, role, date].filter(Boolean).join(" | "),
    title,
    subtitle,
    date,
    bullets,
    isSubLevel: Boolean(entry.isSubLevel),
  };
}

function skillsFromStructured(layout: StructuredResumeLayout): ParsedSkills {
  const groups: SkillGroup[] = (layout.skills?.groups || []).map((group) => ({
    label: group.label?.trim() || undefined,
    items: (group.items || []).map((item) => item.trim()).filter(Boolean),
  })).filter((group) => group.label || group.items.length > 0);

  const items = groups.flatMap((group) =>
    group.label ? [`${group.label}：${group.items.join("、")}`] : group.items,
  );

  return {
    mode: items.length >= 2 ? "tags" : "lines",
    items,
    groups,
  };
}

function layoutFromStructured(
  structured: StructuredResumeLayout,
  resumeTitle: string,
): ResumeLayout {
  const contactPieces = (structured.contact || [])
    .map((piece) => piece.text.trim())
    .filter(Boolean)
    .map(toContactPiece);
  const name = structured.name?.trim() || resumeTitle;
  const skills = skillsFromStructured(structured);
  const base: Omit<ResumeLayout, "shape"> = {
    name,
    nameFromContact: Boolean(structured.name?.trim()),
    nameSource: structured.name?.trim() || null,
    contactSkipped: [],
    contactPieces,
    contactShort: contactPieces.filter((piece) => !piece.long),
    contactLong: contactPieces.filter((piece) => piece.long),
    summary: structured.summary?.trim() || undefined,
    experience: expandExperienceEntries(
      (structured.experience || [])
        .map(structuredEntryToLayout)
        .filter((entry) => entry.title || entry.bullets.length),
    ),
    projects: (structured.projects || []).map(structuredEntryToLayout).filter((entry) => entry.title || entry.bullets.length),
    education: (structured.education || []).map(structuredEntryToLayout).filter((entry) => entry.title || entry.bullets.length),
    skills,
    extraSkills: { mode: "lines", items: [], groups: [] },
    experienceSkipped: [],
    projectSkipped: [],
    educationSkipped: [],
  };
  return {
    ...base,
    shape: detectShape(base),
  };
}

export function layoutResume(
  parsed: ParsedResume,
  resumeTitle: string,
): ResumeLayout {
  if (parsed.layout) {
    return layoutFromStructured(parsed.layout, resumeTitle);
  }

  const contact = parseContact(parsed.sections.contact, resumeTitle);
  const peeledExperience = peelListedHeaders(
    parsed.sections.experience ?? [],
    EXPERIENCE_SUBHEADS,
  );
  const peeledProjects = peelListedHeaders(
    parsed.sections.projects ?? [],
    PROJECT_SUBHEADS,
  );
  const peeledEducation = peelListedHeaders(
    parsed.sections.education ?? [],
    EDUCATION_SUBHEADS,
  );
  const base: Omit<ResumeLayout, "shape"> = {
    name: contact.name,
    nameFromContact: contact.nameFromContact,
    nameSource: contact.nameSource,
    contactSkipped: contact.skippedHeaders,
    contactPieces: contact.pieces,
    contactShort: contact.pieces.filter((piece) => !piece.long),
    contactLong: contact.pieces.filter((piece) => piece.long),
    summary: parsed.sections.summary?.trim() || undefined,
    experience: groupEntries(peeledExperience.rest, "experience"),
    projects: groupEntries(peeledProjects.rest, "projects"),
    education: groupEntries(peeledEducation.rest, "education"),
    skills: parseSkills(parsed.sections.skills ?? []),
    extraSkills: parseSkills(
      contact.pieces
        .filter((piece) => piece.long)
        .map((piece) => piece.text)
        .filter(
          (text) =>
            !(parsed.sections.skills ?? []).some(
              (skill) => skill.includes(text) || text.includes(skill),
            ),
        ),
    ),
    experienceSkipped: peeledExperience.skipped,
    projectSkipped: peeledProjects.skipped,
    educationSkipped: peeledEducation.skipped,
  };
  const layout: ResumeLayout = {
    ...base,
    shape: detectShape(base),
  };

  if (import.meta.env?.DEV && !layoutPreservesContent(parsed, layout)) {
    console.warn(
      "[resume-layout] displayed text diverged from parsed sections",
    );
  }

  return layout;
}
