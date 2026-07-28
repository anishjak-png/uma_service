import type { TemplateVariables } from "./types";

export function renderTemplate(
  body: string,
  variables: TemplateVariables
): string {
  return body.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (key in variables) {
      return variables[key as keyof TemplateVariables] ?? "";
    }
    return match;
  });
}
