export const appLanguages = ["sr"] as const;

export type AppLanguage = (typeof appLanguages)[number];

export function normalizeLanguage(value: string | null | undefined): AppLanguage {
  void value;
  return "sr";
}
