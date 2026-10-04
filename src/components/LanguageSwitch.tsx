import type { Language } from "../i18n/language";

export function LanguageSwitch({ language, onChange }: { language: Language; onChange: (language: Language) => void }) {
  return (
    <div className="languageSwitch" aria-label="Language">
      {(["de", "tr", "en"] as const).map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={language === code}
          onClick={() => onChange(code)}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
