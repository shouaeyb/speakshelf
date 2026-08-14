"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Voice, PackedCatalog, PackedProvider } from "@/lib/data";
import { unpack } from "@/lib/data";
import { languageName } from "@/lib/lang";
import { PROVIDER_FAMILIES, familyLabel, familyMeta, familyRank, modelLabel } from "@/lib/families";
import { getProvider } from "@/lib/providers";
import { EVENTS, track } from "@/lib/analytics";
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

type Active = {
  id: string;
  /** Sub-model the playback was started with, "" for the default. */
  model: string;
  status: "loading" | "generating" | "playing" | "error";
  note?: string;
} | null;

// Module level so both caches survive route changes within the session.
// Safari re-downloads media URLs even when they are fresh, so after the
// first successful play the audio bytes are kept as a blob; replays then
// come from memory in every engine. Signed URLs expire upstream after 24
// hours; cached ones are dropped after 18 so a long-lived tab cannot
// replay a dead link. Keys are full voice ids, so providers never collide.
const URL_TTL_MS = 18 * 60 * 60 * 1000;
const BLOB_MAX = 24;
const urlCache = new Map<string, { url: string; t: number }>();
const blobCache = new Map<string, string>();

function warmBlob(key: string, url: string) {
  if (blobCache.has(key)) return;
  fetch(url)
    .then((res) => (res.ok ? res.blob() : null))
    .then((blob) => {
      if (!blob || blobCache.has(key)) return;
      while (blobCache.size >= BLOB_MAX) {
        const oldest = blobCache.entries().next().value;
        if (!oldest) break;
        URL.revokeObjectURL(oldest[1]);
        blobCache.delete(oldest[0]);
      }
      blobCache.set(key, URL.createObjectURL(blob));
    })
    .catch(() => {});
}

const PlayGlyph = () => (
  <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true">
    <polygon className="glyph" points="0,0 10,6 0,12" />
  </svg>
);

const StopGlyph = () => (
  <span className="eq" aria-hidden="true">
    <span></span>
    <span></span>
    <span></span>
  </span>
);

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
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [family, setFamily] = useState("");
  const [lang, setLang] = useState("");
  const [gender, setGender] = useState("");
  // "" means the API default, which is the first listed sub-model.
  const [gmodel, setGmodel] = useState("");
  const [active, setActive] = useState<Active>(null);
  // The family quirk toast: shown once per session, on the first play of
  // a voice from a noted family, because the top-of-list note is off
  // screen once the reader has scrolled into a long list.
  const [toast, setToast] = useState<{ text: string; pos: "top" | "bottom" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors the family filter for callbacks that fire long after their
  // click render (cold generations); see maybeToast.
  const familyRef = useRef(family);
  useEffect(() => {
    familyRef.current = family;
  }, [family]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const errTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against stale media events after switching voices or stopping.
  const playGen = useRef(0);
  // The write effect must not run before the URL has been applied once.
  const urlApplied = useRef(false);

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

  // Apply ?family= etc. whenever the router navigates, so family tiles work
  // both on a fresh load and on same-page client transitions. Re-runs when
  // the catalog arrives so family and language can be validated against it.
  // A field the reader has already touched since the last apply is left
  // alone, so typing during the catalog load is not wiped.
  const applied = useRef<{ f: string; l: string; g: string; m: string; s: string } | null>(null);
  useEffect(() => {
    if (lockLanguage || paramsKey === undefined) return;
    const p = new URLSearchParams(paramsKey);
    const f = p.get("family") ?? "";
    const l = p.get("language") ?? "";
    const g = p.get("gender") ?? "";
    const m = p.get("gmodel") ?? "";
    const want = {
      f: f && (!all || all.some((v) => v.family === f)) ? f : "",
      l: !all || all.some((v) => v.lang === l) ? l : "",
      g: ["female", "male", "neutral"].includes(g) ? g : "",
      m: subModels.includes(m) && m !== subModels[0] ? m : "",
      s: p.get("q") ?? "",
    };
    const prev = applied.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFamily((cur) => (!prev || cur === prev.f ? want.f : cur));
    setLang((cur) => (!prev || cur === prev.l ? want.l : cur));
    setGender((cur) => (!prev || cur === prev.g ? want.g : cur));
    setGmodel((cur) => (!prev || cur === prev.m ? want.m : cur));
    setQ((cur) => (!prev || cur === prev.s ? want.s : cur));
    applied.current = want;
    urlApplied.current = true;
  }, [paramsKey, lockLanguage, all, subModels]);

  // Keep the URL shareable without triggering navigation. Next mirrors
  // external replaceState into useSearchParams (its patched history dispatches
  // a restore action), so this write does echo back into the apply effect;
  // it cannot loop because the echoed URL carries the values already applied.
  // It also never scrolls: only GlideLink clicks record a glide intent.
  useEffect(() => {
    if (lockLanguage || !urlApplied.current) return;
    const p = new URLSearchParams();
    if (family) p.set("family", family);
    if (lang) p.set("language", lang);
    if (gender) p.set("gender", gender);
    if (gmodel) p.set("gmodel", gmodel);
    if (q) p.set("q", q);
    const qs = p.toString();
    const url = qs ? `?${qs}${window.location.hash}` : window.location.pathname + window.location.hash;
    window.history.replaceState(null, "", url);
  }, [q, family, lang, gender, gmodel, lockLanguage]);

  useEffect(() => {
    return () => {
      // The generation bump makes any in-flight lookup a no-op, so no
      // retry chain can fire after unmount.
      playGen.current++;
      audioRef.current?.pause();
      if (errTimer.current) clearTimeout(errTimer.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function maybeToast(fam: string) {
    // The permanent inline note is already on screen when this family is
    // the active filter; a toast on top of it would say the same twice.
    // Read the filter through a ref: playback can start half a minute
    // after the click on a cold render, and it is the filter at play
    // time that decides what is visible.
    if (familyRef.current === fam) return;
    const note = familyMeta(provider, fam)?.hasNote ? t(`families.${provider}.${fam}.note`) : "";
    if (!note) return;
    const key = `ss-note-${provider}-${fam}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      return;
    }
    // Mobile places the toast opposite the playing row so it never covers
    // what was just tapped; desktop ignores pos and stays Carbon top-right
    // (the media query wins). While the consent bar holds the bottom edge,
    // the toast takes the top slot: the bottom is simply occupied.
    const consentUp = !!document.querySelector(".consent");
    const row = document.querySelector(".play-on")?.getBoundingClientRect();
    const pos = consentUp || (row && row.top > window.innerHeight / 2) ? "top" : "bottom";
    setToast({ text: note, pos });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 15000);
  }

  // Alphabetical by the reader's locale, tie-broken by code for
  // determinism; the search field is the fast path, the order is the
  // predictable one.
  const languageOptions = useMemo(() => {
    if (!all || lockLanguage) return [];
    const collator = new Intl.Collator(locale);
    const codes = new Set<string>();
    for (const v of all) codes.add(v.lang);
    return [...codes]
      .map((code) => ({ code, name: languageName(code, locale) }))
      .sort((a, b) => collator.compare(a.name, b.name) || a.code.localeCompare(b.code));
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

  const emptyDoc: SearchDoc = { words: [], text: "" };
  const filtered = useMemo(() => {
    if (!all) return [];
    const tokens = tokenize(q);
    return all.filter((v) => {
      if (family && v.family !== family) return false;
      if (lang && v.lang !== lang) return false;
      if (gender && v.gender !== gender) return false;
      if (tokens.length > 0 && !matchesTokens(searchDocs.get(v.id) ?? emptyDoc, tokens)) return false;
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

  function stop() {
    playGen.current++;
    if (retryTimer.current) clearTimeout(retryTimer.current);
    audioRef.current?.pause();
    setActive(null);
  }

  function play(v: Voice) {
    const model = v.family === multiFamily ? gmodel : "";
    const cacheKey = model ? `${v.id}|${model}` : v.id;
    if (active?.id === v.id && active.model === model && active.status !== "error") {
      stop();
      return;
    }
    if (!audioRef.current) audioRef.current = new Audio();
    const a = audioRef.current;
    a.pause();
    if (errTimer.current) clearTimeout(errTimer.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    const gen = ++playGen.current;
    const current = () => playGen.current === gen;
    setActive({ id: v.id, model, status: "loading" });

    // Which cache tier served this playback; reported once on first audio
    // progress so replays and cold plays can be told apart in analytics.
    let source: "memory" | "cached" | "network" = "network";
    let reported = false;
    // One failure per playback attempt: a dead media load can surface as
    // both an element error event and a play() rejection.
    let failedOnce = false;

    const fail = (note: string) => {
      if (!current() || failedOnce) return;
      failedOnce = true;
      track(EVENTS.SAMPLE_FAILED, {
        provider,
        locale,
        voice_id: v.id,
        model: model || undefined,
        reason: note,
      });
      setActive({ id: v.id, model, status: "error", note });
      errTimer.current = setTimeout(() => {
        setActive((cur) => (cur?.id === v.id && cur.status === "error" ? null : cur));
      }, 3000);
    };

    const markPlaying = () => {
      if (!current()) return;
      if (!reported) {
        reported = true;
        track(EVENTS.SAMPLE_PLAYED, {
          provider,
          locale,
          voice_id: v.id,
          family: v.family,
          language: v.lang,
          model: model || undefined,
          source,
        });
        maybeToast(v.family);
      }
      setActive({ id: v.id, model, status: "playing" });
    };

    function start(url: string, fromBlob: boolean) {
      if (!current()) return;
      a.onplaying = markPlaying;
      // Safari does not reliably fire onplaying for cached replays; any
      // playback progress at all means audio is running.
      a.ontimeupdate = () => {
        if (a.currentTime > 0) {
          a.ontimeupdate = null;
          markPlaying();
        }
      };
      a.onended = () => {
        if (current()) setActive((cur) => (cur?.id === v.id ? null : cur));
      };
      a.onerror = () => {
        if (!current()) return;
        if (fromBlob) {
          // A dead object URL falls back to the network path once.
          const stale = blobCache.get(cacheKey);
          if (stale) URL.revokeObjectURL(stale);
          blobCache.delete(cacheKey);
          resolve();
          return;
        }
        // A URL that failed to load should not be replayed from cache.
        urlCache.delete(cacheKey);
        fail("noteUnavailable");
      };
      a.src = url;
      a.play()
        .then(() => {
          // First streamed play warms the blob cache in the background,
          // so every replay is served from memory.
          if (!fromBlob) warmBlob(cacheKey, url);
        })
        .catch(() => {
          // A rejection for the live generation is real, usually an
          // autoplay block because the lookup left the click gesture. The
          // repeat tap plays synchronously from the cache. Stale
          // rejections come from row switches and are ignored.
          if (current()) fail("noteTapAgain");
        });
    }

    function resolve() {
      const known = urlCache.get(cacheKey);
      if (known && Date.now() - known.t < URL_TTL_MS) {
        source = "cached";
        start(known.url, false);
        return;
      }
      source = "network";
      lookup(0);
    }

    // First listen renders the sample upstream, and the slow engines
    // (Polly generative and long-form, Gemini sub-models) can take well
    // over half a minute. Patience is a time budget, not a retry count,
    // and a chain that saw 202 never ends in "unavailable": the contract
    // says the sample is coming, so a blip mid-generation stays a blip.
    const CHAIN_BUDGET_MS = 90_000;
    const chainStart = Date.now();
    const withinBudget = () => Date.now() - chainStart <= CHAIN_BUDGET_MS;
    let sawGenerating = false;
    let blips = 0;

    function retryLater(seconds: number, attempt: number) {
      setActive({ id: v.id, model, status: "generating" });
      const wait = Math.min(Math.max(seconds, 4), 15) * 1000;
      retryTimer.current = setTimeout(() => {
        if (current()) lookup(attempt + 1);
      }, wait);
    }

    function lookup(attempt: number) {
      // The budget is a wall-clock hard stop, checked at dispatch so a
      // wait scheduled near the edge cannot slip past it.
      if (!withinBudget()) {
        fail(sawGenerating ? "notePreparing" : "noteUnavailable");
        return;
      }
      fetch(`/api/sample?id=${encodeURIComponent(v.id)}${model ? `&model=${encodeURIComponent(model)}` : ""}`, {
        // A hung request must not strand the spinner; a timeout lands in
        // the catch below as a blip.
        signal: AbortSignal.timeout(15_000),
      })
        .then(async (res) => {
          if (!current()) return;
          if (res.status === 202) {
            sawGenerating = true;
            const body = (await res.json().catch(() => null)) as { retry_after?: number } | null;
            if (!current()) return;
            track(EVENTS.SAMPLE_GENERATING, { provider, locale, voice_id: v.id, attempt });
            retryLater(Number(body?.retry_after) || 4, attempt);
            return;
          }
          if (res.status === 503 || res.status === 429) {
            fail("noteBusy");
            return;
          }
          if (!res.ok) {
            // 404 can precede the generation trigger registering, and 5xx
            // can be the upstream straining mid-render; both are "not yet",
            // not "never", while the budget lasts.
            if (withinBudget() && blips < 3) {
              blips++;
              retryLater(5, attempt);
              return;
            }
            fail(sawGenerating ? "notePreparing" : "noteUnavailable");
            return;
          }
          const body = (await res.json().catch(() => null)) as { url?: string } | null;
          if (!body?.url) {
            fail("noteUnavailable");
            return;
          }
          urlCache.set(cacheKey, { url: body.url, t: Date.now() });
          start(body.url, false);
        })
        .catch(() => {
          if (!current()) return;
          if (withinBudget() && blips < 3) {
            blips++;
            retryLater(6, attempt);
            return;
          }
          fail(sawGenerating ? "notePreparing" : "noteUnavailable");
        });
    }

    const blobbed = blobCache.get(cacheKey);
    if (blobbed) {
      // Re-insert so eviction hits the least recently played entry.
      blobCache.delete(cacheKey);
      blobCache.set(cacheKey, blobbed);
      source = "memory";
      start(blobbed, true);
      return;
    }
    resolve();
  }


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
            onChange={(e) => setQ(e.target.value)}
          />
          {q !== "" && (
            <button
              type="button"
              className="search-clear"
              aria-label={t("explorer.clearSearch")}
              onClick={() => {
                setQ("");
                searchRef.current?.focus();
              }}
            >
              ✕
            </button>
          )}
        </div>
        <div className="field">
          <label className="field-label" htmlFor="f-family">
            {t(`providers.${provider}.familyWord`, { count: 1 })}
          </label>
          <select
            id="f-family"
            className="select"
            value={family}
            onChange={(e) => {
              setFamily(e.target.value);
              track(EVENTS.FILTER_CHANGED, { provider, locale, kind: "family", value: e.target.value || "all" });
            }}
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
            <label className="field-label" htmlFor="f-lang">
              {t("explorer.language")}
            </label>
            <select
              id="f-lang"
              className="select"
              value={lang}
              onChange={(e) => {
                setLang(e.target.value);
                track(EVENTS.FILTER_CHANGED, { provider, locale, kind: "language", value: e.target.value || "all" });
              }}
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
          <label className="field-label" htmlFor="f-gender">
            {t("explorer.gender")}
          </label>
          <select
            id="f-gender"
            className="select"
            value={gender}
            onChange={(e) => {
              setGender(e.target.value);
              track(EVENTS.FILTER_CHANGED, { provider, locale, kind: "gender", value: e.target.value || "any" });
            }}
          >
            <option value="">{t("explorer.any")}</option>
            <option value="female">{t("explorer.female")}</option>
            <option value="male">{t("explorer.male")}</option>
            <option value="neutral">{t("explorer.neutral")}</option>
          </select>
          <span className="field-caret" aria-hidden="true">▼</span>
        </div>
        {showModelPick && (
          <div className="field">
            <label className="field-label" htmlFor="f-gmodel">
              {familyLabel(provider, multiFamily)}
            </label>
            <select
              id="f-gmodel"
              className="select"
              value={gmodel || subModels[0]}
              disabled={family !== "" && family !== multiFamily}
              title={t("explorer.modelPickTitle", { family: familyLabel(provider, multiFamily) })}
              onChange={(e) => {
                setGmodel(e.target.value === subModels[0] ? "" : e.target.value);
                track(EVENTS.FILTER_CHANGED, { provider, locale, kind: "model", value: e.target.value });
              }}
            >
              {subModels.map((m) => (
                <option key={m} value={m}>
                  {modelLabel(m)}
                </option>
              ))}
            </select>
            <span className="field-caret" aria-hidden="true">▼</span>
          </div>
        )}
      </div>

      <div className="results-line">
        <span className="results-count" role="status">
          {all ? t("explorer.results", { voices: shownVoices, samples: sampleCount }) : t("explorer.loading")}
        </span>
        {hasFilters && (
          <button
            type="button"
            className="clear-btn"
            onClick={() => {
              setQ("");
              setFamily("");
              setLang("");
              setGender("");
              setGmodel("");
              track(EVENTS.FILTER_CHANGED, { provider, locale, kind: "clear", value: "all" });
            }}
          >
            {t("explorer.clear")}
          </button>
        )}
      </div>

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
          {g.items.map((v) => {
            const isActive = active?.id === v.id;
            return (
              <div className="vrow" key={v.id}>
                <button
                  type="button"
                  className={`play${isActive && active.status !== "error" ? " play-on" : ""}`}
                  aria-label={t("explorer.playAria", { name: v.name, language: languageName(v.lang, locale) })}
                  aria-pressed={isActive && active.status === "playing"}
                  onClick={() => play(v)}
                >
                  {!isActive || active.status === "error" ? (
                    <PlayGlyph />
                  ) : active.status === "playing" ? (
                    <StopGlyph />
                  ) : (
                    <span className="spin" aria-hidden="true"></span>
                  )}
                </button>
                <span className="vname"><bdi>{v.name}</bdi></span>
                <span className={`tag ${v.tier === "ultra" ? "tag-purple" : "tag-blue"}`}>
                  {familyLabel(provider, v.family).toUpperCase()}
                </span>
                {v.traits.age && (
                  <span className="tag tag-gray tag-age">
                    {v.traits.age === "child" ? t("explorer.traits.child") : v.traits.age.toUpperCase()}
                  </span>
                )}
                {v.styles.length > 0 && <span className="vstyles">{v.styles.join(" · ")}</span>}
                <span className="vmeta">
                  {isActive && active.status === "error" && (
                    <span className="vnote" role="status">
                      {t(`explorer.${active.note ?? "noteUnavailable"}`)}
                    </span>
                  )}
                  {isActive && active.status === "generating" && (
                    <span className="vnote" role="status">
                      {t("explorer.noteGenerating")}
                    </span>
                  )}
                  <span className="vgender">
                    {v.gender === "unknown" ? "" : t(`explorer.genderWords.${v.gender}`)}
                  </span>
                </span>
              </div>
            );
          })}
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
