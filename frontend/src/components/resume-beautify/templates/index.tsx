import type { ComponentType } from "react";
import type { ResumeTemplateProps, TemplateId } from "../types";
import ClassicTemplate from "./ClassicTemplate";
import ModernTemplate from "./ModernTemplate";
import MinimalTemplate from "./MinimalTemplate";
import TimelineTemplate from "./TimelineTemplate";

import GridTemplate from "./GridTemplate";

export const TEMPLATE_COMPONENTS: Record<
  TemplateId,
  ComponentType<ResumeTemplateProps>
> = {
  classic: ClassicTemplate,
  modern: ModernTemplate,
  minimal: MinimalTemplate,
  timeline: TimelineTemplate,
  grid: GridTemplate,
};

export function ResumeTemplate({
  templateId,
  ...props
}: ResumeTemplateProps & { templateId: TemplateId }) {
  const Component = TEMPLATE_COMPONENTS[templateId];
  return <Component {...props} />;
}
