"use client";

import { useTranslations } from "next-intl";
import { familyLabel, modelLabel } from "@/lib/families";

/** Which control the reader changed. The Explorer owns the state and the
 *  analytics; these fields only report. */
export type FilterKind = "family" | "language" | "gender" | "model";

interface FilterFieldsProps {
  /** Prefix for the control ids. The toolbar and the mobile filter panel
   *  both mount these fields, and ids must stay unique in one document. */
  idPrefix: string;
  /** Provider key; the family label uses the provider's own word. */
  provider: string;
  values: { family: string; lang: string; gender: string; gmodel: string };
  familyOptions: string[];
  languageOptions: Array<{ code: string; name: string }>;
  /** Set on language pages: there the language is the route, not a field. */
  lockLanguage?: string;
  /** The family with several sub-models, when this page shows any of them. */
  model: { show: boolean; family: string; ids: string[] };
  onChange: (kind: FilterKind, value: string) => void;
}

/** The Explorer's select fields, without the search box: family, language,
 *  gender and the sub-model picker. Rendered in the desktop toolbar and,
 *  at mobile widths, inside the filter panel. */
export default function FilterFields({
  idPrefix,
  provider,
  values,
  familyOptions,
  languageOptions,
  lockLanguage,
  model,
  onChange,
}: FilterFieldsProps) {
  const t = useTranslations();
  return (
    <>
      <div className="field">
        <label className="field-label" htmlFor={`${idPrefix}-family`}>
          {t(`providers.${provider}.familyWord`, { count: 1 })}
        </label>
        <select
          id={`${idPrefix}-family`}
          className="select"
          value={values.family}
          onChange={(e) => onChange("family", e.target.value)}
        >
          <option value="">{t("explorer.all")}</option>
          {familyOptions.map((key) => (
            <option key={key} value={key}>
              {familyLabel(provider, key)}
            </option>
          ))}
        </select>
        <span className="field-caret" aria-hidden="true">▼</span>
      </div>
      {!lockLanguage && (
        <div className="field">
          <label className="field-label" htmlFor={`${idPrefix}-lang`}>
            {t("explorer.language")}
          </label>
          <select
            id={`${idPrefix}-lang`}
            className="select"
            value={values.lang}
            onChange={(e) => onChange("language", e.target.value)}
          >
            <option value="">{t("explorer.all")}</option>
            {languageOptions.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
          <span className="field-caret" aria-hidden="true">▼</span>
        </div>
      )}
      <div className="field">
        <label className="field-label" htmlFor={`${idPrefix}-gender`}>
          {t("explorer.gender")}
        </label>
        <select
          id={`${idPrefix}-gender`}
          className="select"
          value={values.gender}
          onChange={(e) => onChange("gender", e.target.value)}
        >
          <option value="">{t("explorer.any")}</option>
          <option value="female">{t("explorer.female")}</option>
          <option value="male">{t("explorer.male")}</option>
          <option value="neutral">{t("explorer.neutral")}</option>
        </select>
        <span className="field-caret" aria-hidden="true">▼</span>
      </div>
      {model.show && (
        <div className="field">
          <label className="field-label" htmlFor={`${idPrefix}-gmodel`}>
            {familyLabel(provider, model.family)}
          </label>
          <select
            id={`${idPrefix}-gmodel`}
            className="select"
            value={values.gmodel || model.ids[0]}
            disabled={values.family !== "" && values.family !== model.family}
            title={t("explorer.modelPickTitle", { family: familyLabel(provider, model.family) })}
            onChange={(e) => onChange("model", e.target.value)}
          >
            {/* Explicit LTR isolation (LRI) around the rendered option text
                only; first-strong would also work for these Latin labels,
                but a label opening with digits makes the explicit direction
                the safer pin.
                A label like "2.5 Flash" opens with digits, so an RTL select
                reorders it to "Flash 2.5" in the closed control; the
                isolate pins it. An option cannot carry a dir attribute
                reliably across engines, hence the characters. It is applied
                here and never inside modelLabel, which also feeds the
                search index and the mobile row's model text. */}
            {model.ids.map((m) => (
              <option key={m} value={m}>
                {`\u2066${modelLabel(m)}\u2069`}
              </option>
            ))}
          </select>
          <span className="field-caret" aria-hidden="true">▼</span>
        </div>
      )}
    </>
  );
}
