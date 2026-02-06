export const appLanguages = ["sr", "en"] as const;

export type AppLanguage = (typeof appLanguages)[number];

export function normalizeLanguage(value: string | null | undefined): AppLanguage {
  return value === "en" ? "en" : "sr";
}
