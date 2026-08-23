"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Voice, PackedCatalog, PackedProvider } from "@/lib/data";
import { unpack } from "@/lib/data";
import { useFilterUrl } from "@/lib/filter-url";
import { languageName } from "@/lib/lang";
import { PROVIDER_FAMILIES, familyLabel, familyMeta, familyRank, modelLabel } from "@/lib/families";
import FilterFields, { type FilterKind } from "@/components/FilterFields";
import FilterPanel from "@/components/FilterPanel";
import VoiceRow from "@/components/VoiceRow";
import { getProvider } from "@/lib/providers";
import { EVENTS, track } from "@/lib/analytics";
import { usePlayback } from "@/lib/playback";
import { buildSearchDoc, matchesTokens, tokenize, type SearchDoc } from "@/lib/search";

interface ExplorerProps {
  /** Provider key; scopes data, links and deep-link params. */
  provider: string;
  /** Preloaded subset (language pages). When absent the provider's catalog loads on the client. */
  voices?: Voice[];
  /** Hide the language filter and group headers, e.g. on a single language page. */
  lockLanguage?: string;
  /** Sub-model ids per family from the server catalog, first entry is the
   *  API default. Google's Gemini is the only family with several today;
   *  the control is generic so a second one just works. */
  models: Record<string, string[]>;
}

interface CoreProps extends ExplorerProps {
  /** Serialized search params from the router; undefined when no URL sync is wanted. */
  paramsKey?: string;
}

// A voice whose search document has not been built yet matches nothing
// rather than crashing the filter. Module level so the memo below needs no
// dependency on it.
const EMPTY_DOC: SearchDoc = { words: [], text: "" };

// Provider home pages: reactive to router navigations (family tiles set
// query params). useSearchParams client-renders up to the nearest Suspense
// boundary on prerendered routes, so only this wrapper pays that cost.
export default function Explorer(props: ExplorerProps) {
  const searchParams = useSearchParams();
  return <ExplorerCore {...props} paramsKey={searchParams.toString()} />;
}

// Language pages: no URL sync, rows stay in the prerendered HTML.
export function ExplorerList(props: ExplorerProps) {
  return <ExplorerCore {...props} />;
}

function ExplorerCore({ provider, voices, lockLanguage, models, paramsKey }: CoreProps) {
  const locale = useLocale();
  const t = useTranslations();
  // The one family with several sub-models, if the provider has any
  // (google's Gemini today). Its voices carry one sample per sub-model.
  const multiFamily = useMemo(
    () => Object.keys(models).find((k) => (models[k]?.length ?? 0) > 1) ?? "",
    [models],
  );
  const subModels = useMemo(() => (multiFamily ? models[multiFamily] : []), [models, multiFamily]);
  const [all, setAll] = useState<Voice[] | null>(voices ?? null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  // The five filter fields and the query string are one state machine, and
  // it lives in `lib/filter-url.ts`: the URL is read during the first
  // render, and neither side is allowed to drive the other afterwards. An
  // empty gmodel means the API default, which is the first listed
  // sub-model. On language pages paramsKey is undefined and nothing here
  // reads or writes the URL at all.
  const { filters, patch, clear } = useFilterUrl({ paramsKey, lockLanguage, subModels, all });
  const { q, family, lang, gender, gmodel } = filters;
  // Mobile only: the select fields live behind a FILTERS button under 721px.
  const [panelOpen, setPanelOpen] = useState(false);
  const filtersBtn = useRef<HTMLButtonElement | null>(null);
  // Sound lives in `lib/playback.ts`: the cache tiers, the startup
  // allowance, the recovery ladder and the family quirk toast. This file
  // owns the catalog, the filters and the list, and learns only which row
  // is doing what.
  const { active, toast, setToast, handlePlay } = usePlayback({
    provider,
    locale,
    t,
    family,
    gmodel,
    multiFamily,
  });

  // The provider's catalog loads after mount so page HTML stays small. The
  // API route serves the server's current view, which refreshes daily; the
  // bundled copy is the offline fallback.
  useEffect(() => {
    if (voices) return;
    let live = true;
    fetch(`/api/catalog/${provider}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .catch(() =>
        import("@/data/voices.packed.json").then(
          (m) => (m.default as unknown as PackedCatalog).providers[provider],
        ),
      )
      .then((packed) => {
        if (live && packed) setAll(unpack(provider, packed as PackedProvider));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [voices, provider]);

  // Alphabetical by the reader's locale, tie-broken by code for
  // determinism; the search field is the fast path, the order is the
  // predictable one. Twins, two codes of this provider that localize to
  // one name (Google runs ar-XA and ar-001 as one register), carry their
  // code in the option so the reader can tell the two apart. The rule is
  // generic: it counts the names this provider actually renders in this
  // locale, so any future pair is covered with no list to maintain. The
  // code rides inside an explicit LTR isolate, so an Arabic option line
  // cannot reorder it.
  const languageOptions = useMemo(() => {
    if (!all || lockLanguage) return [];
    const collator = new Intl.Collator(locale);
    const codes = new Set<string>();
    for (const v of all) codes.add(v.lang);
    const named = [...codes]
      .map((code) => ({ code, name: languageName(code, locale) }))
      .sort((a, b) => collator.compare(a.name, b.name) || a.code.localeCompare(b.code));
    const times = new Map<string, number>();
    for (const o of named) times.set(o.name, (times.get(o.name) ?? 0) + 1);
    return named.map((o) =>
      (times.get(o.name) ?? 0) > 1 ? { code: o.code, name: `${o.name} · \u2066${o.code}\u2069` } : o,
    );
  }, [all, lockLanguage, locale]);

  // Family choices come from the data, so a family this code has never
  // heard of is still filterable; the metadata only provides the order.
  const rank = useMemo(() => familyRank(provider), [provider]);
  const familyOptions = useMemo(() => {
    if (!all) return (PROVIDER_FAMILIES[provider] ?? []).map((f) => f.key);
    const present = new Set(all.map((v) => v.family));
    return [...present].sort(
      (a, b) => (rank.get(a) ?? 99) - (rank.get(b) ?? 99) || a.localeCompare(b),
    );
  }, [all, rank, provider]);

  // One search document per voice, built once per catalog load. Every
  // field and trait is in it, so future characteristics are searchable
  // with no change here. Localized words ride along so a reader can
  // search in their own language ("femenino") or in English ("female").
  const searchDocs = useMemo(() => {
    if (!all) return new Map<string, SearchDoc>();
    const localized = (v: Voice): string[] => {
      const terms: string[] = [];
      if (v.gender !== "unknown") terms.push(t(`explorer.genderWords.${v.gender}`));
      terms.push(t(`tags.${v.tier}`));
      if (v.traits.age === "child") terms.push(t("explorer.traits.child"));
      // Sub-model ids and labels, so "2.5 pro" and "gemini-2.5-pro-tts"
      // both find the family that carries them.
      for (const m of models[v.family] ?? []) terms.push(m, modelLabel(m));
      return terms;
    };
    return new Map(all.map((v) => [v.id, buildSearchDoc(v, provider, locale, localized(v))]));
  }, [all, provider, locale, t, models]);

  const filtered = useMemo(() => {
    if (!all) return [];
    const tokens = tokenize(q);
    return all.filter((v) => {
      if (family && v.family !== family) return false;
      if (lang && v.lang !== lang) return false;
      if (gender && v.gender !== gender) return false;
      if (tokens.length > 0 && !matchesTokens(searchDocs.get(v.id) ?? EMPTY_DOC, tokens)) return false;
      return true;
    });
  }, [all, q, family, lang, gender, searchDocs]);

  const groups = useMemo(() => {
    const byFamily = (a: Voice, b: Voice) =>
      (rank.get(a.family) ?? 99) - (rank.get(b.family) ?? 99) || a.name.localeCompare(b.name);
    if (lockLanguage) return [{ code: lockLanguage, items: [...filtered].sort(byFamily) }];
    const map = new Map<string, Voice[]>();
    for (const v of filtered) {
      const list = map.get(v.lang);
      if (list) list.push(v);
      else map.set(v.lang, [v]);
    }
    const collator = new Intl.Collator(locale);
    return [...map.entries()]
      .sort(
        (a, b) =>
          collator.compare(languageName(a[0], locale), languageName(b[0], locale)) ||
          a[0].localeCompare(b[0]),
      )
      .map(([code, items]) => ({ code, items: items.sort(byFamily) }));
  }, [filtered, lockLanguage, locale, rank]);

  // A voice carries one sample per sub-model of its family, or just one.
  const sampleCount = useMemo(
    () =>
      filtered.reduce((n, v) => n + Math.max((models[v.family]?.length ?? 1) - 1, 0), filtered.length),
    [filtered, models],
  );

  // Voices follow the provider's own accounting (see voiceIdentity in the
  // bless config): polly's per-engine rows are renders of one voice, so
  // the count collapses language+name pairs while every row stays listed.
  const identity = getProvider(provider)?.voiceIdentity ?? "row";
  const shownVoices = useMemo(
    () =>
      identity === "row"
        ? filtered.length
        : new Set(filtered.map((v) => `${v.lang}|${v.name}`)).size,
    [filtered, identity],
  );

  const showModelPick =
    subModels.length > 1 && (voices ? voices.some((v) => v.family === multiFamily) : true);

  const hasFilters = q !== "" || family !== "" || lang !== "" || gender !== "" || gmodel !== "";

  // The badge on the mobile FILTERS button counts the select fields only.
  // hasFilters is not reused: it includes the search query, which stays
  // visible in its own field, and a route-locked language is not a choice.
  const fieldFilters =
    (family !== "" ? 1 : 0) +
    (!lockLanguage && lang !== "" ? 1 : 0) +
    (gender !== "" ? 1 : 0) +
    (gmodel !== "" ? 1 : 0);

  // The sub-model a Gemini row would play right now: the reader's pick, or
  // the API default when they have not picked. Explorer state, not voice
  // data, which is why it is computed here and passed down.
  const effectiveModel = useMemo(
    () => (subModels.length > 1 ? modelLabel(gmodel || subModels[0]) : ""),
    [gmodel, subModels],
  );

  // One place for the select fields' state and their analytics, so the two
  // mounts (toolbar and mobile panel) cannot drift apart.
  const applyFilter = (kind: FilterKind, value: string) => {
    if (kind === "family") {
      patch({ family: value });
      track(EVENTS.FILTER_CHANGED, { provider, locale, kind: "family", value: value || "all" });
    } else if (kind === "language") {
      patch({ lang: value });
      track(EVENTS.FILTER_CHANGED, { provider, locale, kind: "language", value: value || "all" });
    } else if (kind === "gender") {
      patch({ gender: value });
      track(EVENTS.FILTER_CHANGED, { provider, locale, kind: "gender", value: value || "any" });
    } else {
      // "" is the API default, so the first sub-model is stored as no choice.
      patch({ gmodel: value === subModels[0] ? "" : value });
      track(EVENTS.FILTER_CHANGED, { provider, locale, kind: "model", value });
    }
  };

  const clearFilters = () => {
    clear();
    track(EVENTS.FILTER_CHANGED, { provider, locale, kind: "clear", value: "all" });
  };

  // Stable identity: FilterPanel's one effect owns the body scroll lock,
  // and a new function each render would re-run it.
  const closePanel = useCallback(() => setPanelOpen(false), []);

  // Search analytics: one event per settled query, not per keystroke.
  // result_count rides along (read via ref so results do not refire the
  // event) to separate successful searches from zero-result typo
  // candidates, the evidence the deferred fuzzy layer waits for.
  const resultCountRef = useRef(0);
  useEffect(() => {
    resultCountRef.current = shownVoices;
  }, [shownVoices]);
  useEffect(() => {
    const query = q.trim();
    if (!query) return;
    const timer = setTimeout(
      () => track(EVENTS.SEARCH_USED, { provider, locale, query, result_count: resultCountRef.current }),
      800,
    );
    return () => clearTimeout(timer);
  }, [q, provider, locale]);

  // A family's honesty note (Gemini's accent quirk today) stays quiet by
  // design: permanent only while the reader filters to that family, a
  // one-per-session toast otherwise.
  const noteFor = (fam: string | undefined) =>
    fam && familyMeta(provider, fam)?.hasNote ? t(`families.${provider}.${fam}.note`) : "";
  // Permanent note only for an explicit family choice in the dropdown;
  // under "all" the one-per-session toast carries the quirk instead
  // (owner's call, 2026-08-14).
  const familyNote = noteFor(family);

  const fieldCount = 3 + (lockLanguage ? 0 : 1) + (showModelPick ? 1 : 0);
  const toolbarClass = fieldCount === 5 ? "toolbar" : fieldCount === 4 ? "toolbar toolbar-4" : "toolbar toolbar-3";

  return (
    <div>
      <div className={toolbarClass}>
        <div className="field">
          <svg
            className="search-magnifier"
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
          >
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M10.5 10.5 L14 14" stroke="currentColor" strokeWidth="1.4" />
          </svg>
          <input
            ref={searchRef}
            className="search-input"
            type="search"
            dir="auto"
            placeholder={t("explorer.searchPlaceholder")}
            aria-label={t("explorer.searchAria")}
            value={q}
            onChange={(e) => patch({ q: e.target.value })}
          />
          {q !== "" && (
            <button
              type="button"
              className="search-clear"
              aria-label={t("explorer.clearSearch")}
              onClick={() => {
                patch({ q: "" });
                searchRef.current?.focus();
              }}
            >
              ✕
            </button>
          )}
        </div>
        <FilterFields
          idPrefix="f"
          provider={provider}
          values={{ family, lang, gender, gmodel }}
          familyOptions={familyOptions}
          languageOptions={languageOptions}
          lockLanguage={lockLanguage}
          model={{ show: showModelPick, family: multiFamily, ids: subModels }}
          onChange={applyFilter}
        />
      </div>

      <div className="results-line">
        {/* Mobile only (CSS): under 721px the select fields sit in the
            panel this opens, so the toolbar keeps the search box alone. */}
        <button
          type="button"
          className="filters-btn"
          ref={filtersBtn}
          aria-expanded={panelOpen}
          onClick={() => setPanelOpen(true)}
        >
          {t("explorer.filters", { count: fieldFilters })}
        </button>
        <span className="results-count" role="status">
          {all ? t("explorer.results", { voices: shownVoices, samples: sampleCount }) : t("explorer.loading")}
        </span>
        {hasFilters && (
          <button type="button" className="clear-btn" onClick={clearFilters}>
            {t("explorer.clear")}
          </button>
        )}
      </div>

      {panelOpen && (
        <FilterPanel
          onClose={closePanel}
          triggerRef={filtersBtn}
          count={shownVoices}
          showClear={hasFilters}
          onClear={clearFilters}
        >
          <FilterFields
            idPrefix="m"
            provider={provider}
            values={{ family, lang, gender, gmodel }}
            familyOptions={familyOptions}
            languageOptions={languageOptions}
            lockLanguage={lockLanguage}
            model={{ show: showModelPick, family: multiFamily, ids: subModels }}
            onChange={applyFilter}
          />
        </FilterPanel>
      )}

      {familyNote && (
        <p className="family-note" role="note">
          {familyNote}
        </p>
      )}

      {all && filtered.length === 0 && (
        <div className="empty">{t("explorer.empty")}</div>
      )}

      {groups.map((g) => (
        <section className="lang-group" key={g.code}>
          {!lockLanguage && (
            <div className="lang-head">
              <Link className="lang-name" href={`/${provider}/voices/${g.code}`}>
                {languageName(g.code, locale)}
              </Link>
              <span className="lang-code" dir="ltr">{g.code}</span>
              <span className="lang-count">
                {t("explorer.langVoices", {
                  count: identity === "row" ? g.items.length : new Set(g.items.map((v) => v.name)).size,
                })}
              </span>
            </div>
          )}
          {g.items.map((v) => (
            <VoiceRow
              key={v.id}
              voice={v}
              provider={provider}
              languageLabel={languageName(v.lang, locale)}
              modelText={v.family === multiFamily ? effectiveModel : ""}
              state={active?.id === v.id ? { status: active.status, note: active.note } : null}
              onPlay={handlePlay}
            />
          ))}
        </section>
      ))}

      {toast && (
        <div className={`toast${toast.pos === "top" ? " toast-top" : ""}`} role="status">
          <p>{toast.text}</p>
          <button type="button" className="toast-close" aria-label={t("explorer.dismissAria")} onClick={() => setToast(null)}>
            ✕
          </button>
        </div>
      )}

      {!lockLanguage && all && filtered.length > 0 && showModelPick && (
        <p className="list-note">
          {t("explorer.listNoteModels", {
            family: familyLabel(provider, multiFamily),
            familyUpper: familyLabel(provider, multiFamily).toUpperCase(),
          })}
        </p>
      )}
    </div>
  );
}
