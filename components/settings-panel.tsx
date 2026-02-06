"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SectionLoader } from "@/components/ui/section-loader";
import { type AppLanguage } from "@/lib/i18n";

type ThemePreference = "system" | "light" | "dark";
type LanguagePreference = "sr" | "en";
type DensityPreference = "compact" | "comfortable";

type UserPreferences = {
  id: string;
  userId: string;
  theme: ThemePreference;
  language: LanguagePreference;
  layoutDensity: DensityPreference;
  timezone: string;
};

type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
};

type ApiResponse<T> = {
  data?: T;
  error?: { message?: string };
};

type SettingsPanelProps = {
  language: AppLanguage;
  onLanguageChange?: (language: AppLanguage) => void;
};

const settingsCopy = {
  sr: {
    profileTitle: "Profil korisnika",
    profileDescription: "Izmena licnih podataka i pregled statusa naloga.",
    name: "Ime",
    email: "E-mail",
    role: "Uloga",
    status: "Status",
    active: "Aktivan",
    inactive: "Neaktivan",
    saveProfile: "Sacuvaj profil",
    appearanceTitle: "Izgled i preferencije",
    appearanceDescription: "Tema, jezik, gustina prikaza i vremenska zona.",
    theme: "Tema",
    language: "Jezik",
    density: "Gustina prikaza",
    timezone: "Vremenska zona",
    savePreferences: "Sacuvaj podesavanja",
    loadingProfile: "Ucitavanje profila...",
    loadingPreferences: "Ucitavanje podesavanja...",
    requiredProfile: "Ime i e-mail su obavezni.",
    profileSaved: "Profil je uspesno azuriran.",
    preferencesSaved: "Podesavanja su uspesno sacuvana.",
    loadError: "Greska pri ucitavanju podesavanja",
    saveError: "Greska pri cuvanju podesavanja",
    profileSaveError: "Neuspesno cuvanje profila",
    preferencesSaveError: "Neuspesno cuvanje podesavanja",
  },
  en: {
    profileTitle: "User Profile",
    profileDescription: "Update personal data and review account status.",
    name: "Name",
    email: "Email",
    role: "Role",
    status: "Status",
    active: "Active",
    inactive: "Inactive",
    saveProfile: "Save profile",
    appearanceTitle: "Appearance and preferences",
    appearanceDescription: "Theme, language, density, and timezone.",
    theme: "Theme",
    language: "Language",
    density: "Layout density",
    timezone: "Timezone",
    savePreferences: "Save preferences",
    loadingProfile: "Loading profile...",
    loadingPreferences: "Loading preferences...",
    requiredProfile: "Name and e-mail are required.",
    profileSaved: "Profile updated successfully.",
    preferencesSaved: "Preferences saved successfully.",
    loadError: "Failed to load settings",
    saveError: "Failed to save settings",
    profileSaveError: "Failed to save profile",
    preferencesSaveError: "Failed to save preferences",
  },
} as const;

function applyAppearance(preferences: UserPreferences | null) {
  if (!preferences || typeof document === "undefined") return;

  const root = document.documentElement;
  const theme =
    preferences.theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : preferences.theme;

  root.classList.toggle("dark", theme === "dark");
  root.lang = preferences.language;
  document.body.dataset.density = preferences.layoutDensity;
}

export function SettingsPanel({ language, onLanguageChange }: SettingsPanelProps) {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const copy = useMemo(() => settingsCopy[language], [language]);

  useEffect(() => {
    void (async () => {
      try {
        const [prefResponse, profileResponse] = await Promise.all([
          fetch("/api/preferences"),
          fetch("/api/profile"),
        ]);

        const prefPayload = (await prefResponse.json()) as ApiResponse<UserPreferences>;
        const profilePayload = (await profileResponse.json()) as ApiResponse<UserProfile>;

        if (!prefResponse.ok || !prefPayload.data) {
          throw new Error(prefPayload.error?.message ?? settingsCopy.sr.loadError);
        }
        if (!profileResponse.ok || !profilePayload.data) {
          throw new Error(profilePayload.error?.message ?? settingsCopy.sr.loadError);
        }

        setPreferences(prefPayload.data);
        setProfile(profilePayload.data);
        onLanguageChange?.(prefPayload.data.language);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : settingsCopy.sr.loadError);
      }
    })();
  }, [onLanguageChange]);

  useEffect(() => {
    applyAppearance(preferences);
  }, [preferences]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    if (!profile.name.trim() || !profile.email.trim()) {
      toast.error(copy.requiredProfile);
      return;
    }

    setIsSaving("profile");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name.trim(),
          email: profile.email.trim(),
        }),
      });
      const payload = (await response.json()) as ApiResponse<UserProfile>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? copy.profileSaveError);
      }
      setProfile(payload.data);
      toast.success(copy.profileSaved);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.saveError);
    } finally {
      setIsSaving(null);
    }
  }

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preferences) return;
    setIsSaving("preferences");
    try {
      const response = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: preferences.theme,
          language: preferences.language,
          layoutDensity: preferences.layoutDensity,
          timezone: preferences.timezone,
        }),
      });
      const payload = (await response.json()) as ApiResponse<UserPreferences>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? copy.preferencesSaveError);
      }
      setPreferences(payload.data);
      onLanguageChange?.(payload.data.language);
      toast.success(copy.preferencesSaved);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.saveError);
    } finally {
      setIsSaving(null);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
      <Card className="notion-surface animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
        <CardHeader>
          <CardTitle>{copy.profileTitle}</CardTitle>
          <CardDescription>{copy.profileDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {profile ? (
            <form onSubmit={saveProfile} className="space-y-3">
              <label className="text-xs">
                <span className="mb-1 block text-muted-foreground">{copy.name}</span>
                <Input
                  value={profile.name}
                  onChange={(event) =>
                    setProfile((current) => (current ? { ...current, name: event.target.value } : current))
                  }
                />
              </label>
              <label className="text-xs">
                <span className="mb-1 block text-muted-foreground">{copy.email}</span>
                <Input
                  type="email"
                  value={profile.email}
                  onChange={(event) =>
                    setProfile((current) => (current ? { ...current, email: event.target.value } : current))
                  }
                />
              </label>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>
                  {copy.role}: {profile.role}
                </span>
                <span>
                  {copy.status}: {profile.isActive ? copy.active : copy.inactive}
                </span>
              </div>
              <Button type="submit" disabled={isSaving === "profile"}>
                {copy.saveProfile}
              </Button>
            </form>
          ) : (
            <SectionLoader label={copy.loadingProfile} />
          )}
        </CardContent>
      </Card>

      <Card className="notion-surface animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
        <CardHeader>
          <CardTitle>{copy.appearanceTitle}</CardTitle>
          <CardDescription>{copy.appearanceDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {preferences ? (
            <form onSubmit={savePreferences} className="space-y-3">
              <label className="text-xs">
                <span className="mb-1 block text-muted-foreground">{copy.theme}</span>
                <select
                  className="h-7 w-full rounded-md border bg-background px-2 text-xs"
                  value={preferences.theme}
                  onChange={(event) =>
                    setPreferences((current) =>
                      current ? { ...current, theme: event.target.value as ThemePreference } : current,
                    )
                  }
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
              <label className="text-xs">
                <span className="mb-1 block text-muted-foreground">{copy.language}</span>
                <select
                  className="h-7 w-full rounded-md border bg-background px-2 text-xs"
                  value={preferences.language}
                  onChange={(event) => {
                    const next = event.target.value as LanguagePreference;
                    setPreferences((current) => (current ? { ...current, language: next } : current));
                    onLanguageChange?.(next);
                  }}
                >
                  <option value="sr">Srpski</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label className="text-xs">
                <span className="mb-1 block text-muted-foreground">{copy.density}</span>
                <select
                  className="h-7 w-full rounded-md border bg-background px-2 text-xs"
                  value={preferences.layoutDensity}
                  onChange={(event) =>
                    setPreferences((current) =>
                      current ? { ...current, layoutDensity: event.target.value as DensityPreference } : current,
                    )
                  }
                >
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                </select>
              </label>
              <label className="text-xs">
                <span className="mb-1 block text-muted-foreground">{copy.timezone}</span>
                <Input
                  value={preferences.timezone}
                  onChange={(event) =>
                    setPreferences((current) => (current ? { ...current, timezone: event.target.value } : current))
                  }
                />
              </label>
              <Button type="submit" disabled={isSaving === "preferences"}>
                {copy.savePreferences}
              </Button>
            </form>
          ) : (
            <SectionLoader label={copy.loadingPreferences} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
