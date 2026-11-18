import type { ReactNode } from "react";
import type { ParsedResume } from "../../api/client";
import { layoutResume } from "./layoutParse";
import {
  CombinedSkills,
  ContactGrid,
  EntryList,
  hasSkills,
  SummaryBlock,
} from "./templates/shared";

function EmptyHint() {
  return <p className="mt-1 text-ink-faint">（未识别）</p>;
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export default function StructuredResumeView({
  parsed,
  resumeTitle,
}: {
  parsed: ParsedResume;
  resumeTitle: string;
}) {
  const layout = layoutResume(parsed, resumeTitle);
  const accent = "#1e3a8a";
  const contactPieces = [
    ...(layout.nameSource ? [layout.nameSource] : []),
    ...layout.contactShort,
  ];

  return (
    <div className="space-y-5 text-sm text-ink">
      <Block label="联系方式">
        {contactPieces.length > 0 ? (
          <ContactGrid pieces={contactPieces} columns={2} />
        ) : (
          <EmptyHint />
        )}
      </Block>

      <Block label="个人简介">
        {layout.summary ? <SummaryBlock text={layout.summary} accent={accent} /> : <EmptyHint />}
      </Block>

      <Block label="工作经历">
        {layout.experience.length > 0 ? (
          <EntryList entries={layout.experience} accent={accent} />
        ) : (
          <EmptyHint />
        )}
      </Block>

      <Block label="专业技能">
        {hasSkills(layout) ? <CombinedSkills layout={layout} accent={accent} /> : <EmptyHint />}
      </Block>

      <Block label="教育背景">
        {layout.education.length > 0 ? (
          <EntryList entries={layout.education} accent={accent} />
        ) : (
          <EmptyHint />
        )}
      </Block>

      <Block label="项目经历">
        {layout.projects.length > 0 ? (
          <EntryList entries={layout.projects} accent={accent} />
        ) : (
          <EmptyHint />
        )}
      </Block>
    </div>
  );
}
