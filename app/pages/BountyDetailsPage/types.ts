export type DetailTab = "brief" | "instructions" | "contributions" | "submit" | "details";

export function splitBrief(description: string) {
  return description
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}
