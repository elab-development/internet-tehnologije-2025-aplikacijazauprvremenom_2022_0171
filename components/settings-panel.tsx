"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionLoader } from "@/components/ui/section-loader";

type ThemePreference = "system" | "light" | "dark";
type DensityPreference = "compact" | "comfortable";

type UserPreferences = {
  id: string;
  userId: string;
  theme: ThemePreference;
  language: "sr";
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

const settingsCopy = {
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
  appearanceDescription: "Tema, gustina prikaza i vremenska zona.",
  theme: "Tema",
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
  root.lang = "sr";
  document.body.dataset.density = preferences.layoutDensity;
}

export function SettingsPanel() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const copy = useMemo(() => settingsCopy, []);

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
          throw new Error(prefPayload.error?.message ?? settingsCopy.loadError);
        }
        if (!profileResponse.ok || !profilePayload.data) {
          throw new Error(profilePayload.error?.message ?? settingsCopy.loadError);
        }

        setPreferences(prefPayload.data);
        setProfile(profilePayload.data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : settingsCopy.loadError);
      }
    })();
  }, []);

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
          layoutDensity: preferences.layoutDensity,
          timezone: preferences.timezone,
        }),
      });
      const payload = (await response.json()) as ApiResponse<UserPreferences>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? copy.preferencesSaveError);
      }
      setPreferences(payload.data);
      toast.success(copy.preferencesSaved);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.saveError);
    } finally {
      setIsSaving(null);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
      <Card className="notion-surface animate-in fade-in-0 slide-in-from-bottom-2 duration-300 hover:-translate-y-0.5">
        <CardHeader>
          <CardTitle>{copy.profileTitle}</CardTitle>
          <CardDescription>{copy.profileDescription}</CardDescription>
        </CardHeader>
        <CardContent className="pb-5">
          {profile ? (
            <form onSubmit={saveProfile} className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
              <label className="grid gap-1 text-xs">
                <span className="text-muted-foreground">{copy.name}</span>
                <Input
                  value={profile.name}
                  onChange={(event) =>
                    setProfile((current) => (current ? { ...current, name: event.target.value } : current))
                  }
                />
              </label>
              <label className="grid gap-1 text-xs">
                <span className="text-muted-foreground">{copy.email}</span>
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
              <Button
                type="submit"
                disabled={isSaving === "profile"}
                className="transition-transform duration-200 hover:-translate-y-0.5"
              >
                {copy.saveProfile}
              </Button>
            </form>
          ) : (
            <SectionLoader label={copy.loadingProfile} />
          )}
        </CardContent>
      </Card>

      <Card className="notion-surface animate-in fade-in-0 slide-in-from-bottom-2 duration-500 hover:-translate-y-0.5">
        <CardHeader>
          <CardTitle>{copy.appearanceTitle}</CardTitle>
          <CardDescription>{copy.appearanceDescription}</CardDescription>
        </CardHeader>
        <CardContent className="pb-5">
          {preferences ? (
            <form
              onSubmit={savePreferences}
              className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-500"
            >
              <label className="grid gap-1 text-xs">
                <span className="text-muted-foreground">{copy.theme}</span>
                <Select
                  value={preferences.theme}
                  onValueChange={(value) =>
                    setPreferences((current) =>
                      current ? { ...current, theme: (value as ThemePreference) ?? current.theme } : current,
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="System" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="grid gap-1 text-xs">
                <span className="text-muted-foreground">{copy.density}</span>
                <Select
                  value={preferences.layoutDensity}
                  onValueChange={(value) =>
                    setPreferences((current) =>
                      current
                        ? {
                            ...current,
                            layoutDensity: (value as DensityPreference) ?? current.layoutDensity,
                          }
                        : current,
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Comfortable" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comfortable">Comfortable</SelectItem>
                    <SelectItem value="compact">Compact</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="grid gap-1 text-xs">
                <span className="text-muted-foreground">{copy.timezone}</span>
                <Input
                  value={preferences.timezone}
                  onChange={(event) =>
                    setPreferences((current) => (current ? { ...current, timezone: event.target.value } : current))
                  }
                />
              </label>
              <Button
                type="submit"
                disabled={isSaving === "preferences"}
                className="transition-transform duration-200 hover:-translate-y-0.5"
              >
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
