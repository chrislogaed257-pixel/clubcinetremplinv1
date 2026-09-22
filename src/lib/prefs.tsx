import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "fr" | "en";
export type Theme = "dark" | "light";

// Dictionnaire FR -> EN. En français on renvoie la chaîne telle quelle.
const EN: Record<string, string> = {
  // Navigation
  "Tableau de bord": "Dashboard",
  "Mes tâches": "My tasks",
  Rapports: "Reports",
  "Mes congés": "My leave",
  Équipes: "Teams",
  Organigramme: "Org chart",
  "Liens & documents": "Links & documents",
  Discussions: "Discussions",
  Messagerie: "Messages",
  "Idées & projets": "Ideas & projects",
  Comptabilité: "Accounting",
  "Mot de passe oublié": "Forgot password",
  "Analyse de travail": "Work analysis",
  Contrats: "Contracts",
  "Feuille de service": "Call sheet",
  Festivals: "Festivals",
  "Festivals & résidences": "Festivals & residencies",
  Vote: "Vote",
  "Vote collectif": "Collective vote",
  Casting: "Casting",
  "Mentors externes": "External mentors",
  "Espace mentor": "Mentor area",
  "Mon espace bailleur": "Funder area",
  Modifications: "Settings",
  Membres: "Members",
  Déconnexion: "Sign out",
  "Fiche profil": "Profile",
  // Réglages
  Langue: "Language",
  Français: "French",
  Anglais: "English",
  "Mode clair": "Light mode",
  "Mode sombre": "Dark mode",
  "Langue changée en anglais.": "Language switched to English.",
  "Langue changée en français.": "Language switched to French.",
};

type Prefs = {
  lang: Lang;
  theme: Theme;
  setLang: (l: Lang) => void;
  setTheme: (t: Theme) => void;
  t: (fr: string) => string;
};

const Ctx = createContext<Prefs | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr");
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const l = localStorage.getItem("cct.lang") as Lang | null;
    const th = localStorage.getItem("cct.theme") as Theme | null;
    if (l === "en" || l === "fr") setLangState(l);
    if (th === "light" || th === "dark") setThemeState(th);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    document.documentElement.setAttribute("lang", lang);
  }, [theme, lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("cct.lang", l);
  }, []);
  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem("cct.theme", t);
  }, []);

  const t = useCallback(
    (fr: string) => {
      if (lang !== "en") return fr;
      const m = /^([^\p{L}]*)(.*)$/u.exec(fr);
      const prefix = m?.[1] ?? "";
      const rest = m?.[2] ?? fr;
      return prefix + (EN[rest] ?? rest);
    },
    [lang],
  );

  return <Ctx.Provider value={{ lang, theme, setLang, setTheme, t }}>{children}</Ctx.Provider>;
}

export function usePrefs(): Prefs {
  const ctx = useContext(Ctx);
  if (ctx) return ctx;
  return {
    lang: "fr",
    theme: "dark",
    setLang: () => {},
    setTheme: () => {},
    t: (fr: string) => fr,
  };
}
