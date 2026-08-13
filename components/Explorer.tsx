"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Voice, PackedCatalog } from "@/lib/data";
import { unpack } from "@/lib/data";
import { languageName } from "@/lib/lang";
import { FAMILIES, GEMINI_MODELS, familyLabel } from "@/lib/families";

interface ExplorerProps {
  /** Preloaded subset (language pages). When absent the full catalog loads on the client. */
  voices?: Voice[];
  /** Hide the language filter and group headers, e.g. on a single language page. */
  lockLanguage?: string;
}

interface CoreProps extends ExplorerProps {
  /** Serialized search params from the router; undefined when no URL sync is wanted. */
  paramsKey?: string;
}

type Active = {
  id: string;
  /** Gemini sub-model the playback was started with, "" for the default. */
  model: string;
  status: "loading" | "generating" | "playing" | "error";
  note?: string;
} | null;

const DEFAULT_GMODEL = GEMINI_MODELS[0].id;

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

// Home page: reactive to router navigations (family tiles set query params).
// useSearchParams client-renders up to the nearest Suspense boundary on
// prerendered routes, so only this wrapper pays that cost.
export default function Explorer(props: ExplorerProps) {
  const searchParams = useSearchParams();
  return <ExplorerCore {...props} paramsKey={searchParams.toString()} />;
}

// Language pages: no URL sync, rows stay in the prerendered HTML.
export function ExplorerList(props: ExplorerProps) {
  return <ExplorerCore {...props} />;
}

function ExplorerCore({ voices, lockLanguage, paramsKey }: CoreProps) {
  const [all, setAll] = useState<Voice[] | null>(voices ?? null);
  const [q, setQ] = useState("");
  const [family, setFamily] = useState("");
  const [lang, setLang] = useState("");
  const [gender, setGender] = useState("");
  const [gmodel, setGmodel] = useState(DEFAULT_GMODEL);
  const [active, setActive] = useState<Active>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const errTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against stale media events after switching voices or stopping.
  const playGen = useRef(0);
  // Signed URLs expire upstream after 24 hours; cached ones are dropped
  // after 18 so a long-lived tab cannot replay a dead link.
  const urlCache = useRef(new Map<string, { url: string; t: number }>());
  // The write effect must not run before the URL has been applied once.
  const urlApplied = useRef(false);

  // Full catalog loads as a separate chunk so page HTML stays small.
  useEffect(() => {
    if (voices) return;
    let live = true;
    import("@/data/voices.packed.json").then((m) => {
      if (live) setAll(unpack(m.default as unknown as PackedCatalog));
    });
    return () => {
      live = false;
    };
  }, [voices]);

  // Apply ?family= etc. whenever the router navigates, so family tiles work
  // both on a fresh load and on same-page client transitions. Re-runs when
  // the catalog arrives so the language code can be validated against it.
  useEffect(() => {
    if (lockLanguage || paramsKey === undefined) return;
    const p = new URLSearchParams(paramsKey);
    const f = p.get("family") ?? "";
    const l = p.get("language") ?? "";
    const g = p.get("gender") ?? "";
    const m = p.get("gmodel") ?? "";
    const s = p.get("q") ?? "";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFamily(FAMILIES.some((x) => x.key === f) ? f : "");
    setLang(!all || all.some((v) => v.lang === l) ? l : "");
    setGender(["female", "male", "neutral"].includes(g) ? g : "");
    setGmodel(GEMINI_MODELS.some((x) => x.id === m) ? m : DEFAULT_GMODEL);
    setQ(s);
    urlApplied.current = true;
  }, [paramsKey, lockLanguage, all]);

  // Keep the URL shareable without triggering navigation. replaceState does
  // not feed back into useSearchParams, so this cannot loop.
  useEffect(() => {
    if (lockLanguage || !urlApplied.current) return;
    const p = new URLSearchParams();
    if (family) p.set("family", family);
    if (lang) p.set("language", lang);
    if (gender) p.set("gender", gender);
    if (gmodel !== DEFAULT_GMODEL) p.set("gmodel", gmodel);
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
    };
  }, []);

  const langOrder = useMemo(() => {
    if (!all) return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const v of all) counts.set(v.lang, (counts.get(v.lang) ?? 0) + 1);
    return counts;
  }, [all]);

  const languageOptions = useMemo(() => {
    if (!all || lockLanguage) return [];
    return [...langOrder.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([code]) => ({ code, name: languageName(code) }));
  }, [all, langOrder, lockLanguage]);

  const filtered = useMemo(() => {
    if (!all) return [];
    const needle = q.trim().toLowerCase();
    return all.filter((v) => {
      if (family && v.family !== family) return false;
      if (lang && v.lang !== lang) return false;
      if (gender && v.gender !== gender) return false;
      if (needle) {
        const hay = `${v.name} ${v.family} ${familyLabel(v.family)} ${v.lang} ${languageName(v.lang)}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [all, q, family, lang, gender]);

  const groups = useMemo(() => {
    const familyRank = new Map(FAMILIES.map((f, i) => [f.key, i]));
    const byFamily = (a: Voice, b: Voice) =>
      (familyRank.get(a.family) ?? 99) - (familyRank.get(b.family) ?? 99) || a.name.localeCompare(b.name);
    if (lockLanguage) return [{ code: lockLanguage, items: [...filtered].sort(byFamily) }];
    const map = new Map<string, Voice[]>();
    for (const v of filtered) {
      const list = map.get(v.lang);
      if (list) list.push(v);
      else map.set(v.lang, [v]);
    }
    return [...map.entries()]
      .sort((a, b) => (langOrder.get(b[0]) ?? 0) - (langOrder.get(a[0]) ?? 0) || a[0].localeCompare(b[0]))
      .map(([code, items]) => ({ code, items: items.sort(byFamily) }));
  }, [filtered, lockLanguage, langOrder]);

  // Gemini voices carry one sample per sub-model, everything else has one.
  const sampleCount = useMemo(() => {
    const gemini = filtered.reduce((n, v) => n + (v.family === "Gemini" ? 1 : 0), 0);
    return filtered.length + gemini * (GEMINI_MODELS.length - 1);
  }, [filtered]);

  const showGemini = useMemo(
    () => (voices ? voices.some((v) => v.family === "Gemini") : true),
    [voices],
  );

  const hasFilters = q !== "" || family !== "" || lang !== "" || gender !== "" || gmodel !== DEFAULT_GMODEL;

  function stop() {
    playGen.current++;
    if (retryTimer.current) clearTimeout(retryTimer.current);
    audioRef.current?.pause();
    setActive(null);
  }

  function play(v: Voice) {
    const model = v.family === "Gemini" && gmodel !== DEFAULT_GMODEL ? gmodel : "";
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

    const fail = (note: string) => {
      if (!current()) return;
      setActive({ id: v.id, model, status: "error", note });
      errTimer.current = setTimeout(() => {
        setActive((cur) => (cur?.id === v.id && cur.status === "error" ? null : cur));
      }, 3000);
    };

    const start = (url: string) => {
      if (!current()) return;
      a.onplaying = () => {
        if (current()) setActive({ id: v.id, model, status: "playing" });
      };
      a.onended = () => {
        if (current()) setActive((cur) => (cur?.id === v.id ? null : cur));
      };
      a.onerror = () => {
        if (!current()) return;
        // A URL that failed to load should not be replayed from cache.
        urlCache.current.delete(cacheKey);
        fail("sample unavailable");
      };
      a.src = url;
      a.play().catch(() => {
        // A rejection for the live generation is real, usually an autoplay
        // block because the lookup left the click gesture. The repeat tap
        // plays synchronously from the cached URL. Stale rejections come
        // from row switches and are ignored.
        if (current()) fail("tap play again");
      });
    };

    const known = urlCache.current.get(cacheKey);
    if (known && Date.now() - known.t < 18 * 60 * 60 * 1000) {
      start(known.url);
      return;
    }

    const lookup = (attempt: number) => {
      fetch(`/api/sample?id=${encodeURIComponent(v.id)}${model ? `&model=${encodeURIComponent(model)}` : ""}`)
        .then(async (res) => {
          if (!current()) return;
          if (res.status === 202) {
            // First listen for this voice: the sample is being generated.
            if (attempt >= 3) {
              fail("still preparing, try again shortly");
              return;
            }
            const body = (await res.json().catch(() => null)) as { retry_after?: number } | null;
            if (!current()) return;
            setActive({ id: v.id, model, status: "generating" });
            const wait = Math.min(Number(body?.retry_after) || 4, 12) * 1000;
            retryTimer.current = setTimeout(() => {
              if (current()) lookup(attempt + 1);
            }, wait);
            return;
          }
          if (!res.ok) {
            fail(res.status === 503 ? "busy, try again in a minute" : "sample unavailable");
            return;
          }
          const body = (await res.json().catch(() => null)) as { url?: string } | null;
          if (!body?.url) {
            fail("sample unavailable");
            return;
          }
          urlCache.current.set(cacheKey, { url: body.url, t: Date.now() });
          start(body.url);
        })
        .catch(() => {
          if (current()) fail("sample unavailable");
        });
    };
    lookup(0);
  }

  const fmt = (n: number) => n.toLocaleString("en-US");

  const fieldCount = 3 + (lockLanguage ? 0 : 1) + (showGemini ? 1 : 0);
  const toolbarClass = fieldCount === 5 ? "toolbar" : fieldCount === 4 ? "toolbar toolbar-4" : "toolbar toolbar-3";

  return (
    <div>
      <div className={toolbarClass}>
        <div className="field">
          <input
            className="search-input"
            type="search"
            placeholder="Search by name, language or model"
            aria-label="Search voices"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="f-family">
            FAMILY
          </label>
          <select id="f-family" className="select" value={family} onChange={(e) => setFamily(e.target.value)}>
            <option value="">All</option>
            {FAMILIES.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
          <span className="field-caret">▼</span>
        </div>
        {!lockLanguage && (
          <div className="field">
            <label className="field-label" htmlFor="f-lang">
              LANGUAGE
            </label>
            <select id="f-lang" className="select" value={lang} onChange={(e) => setLang(e.target.value)}>
              <option value="">All</option>
              {languageOptions.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
            <span className="field-caret">▼</span>
          </div>
        )}
        <div className="field">
          <label className="field-label" htmlFor="f-gender">
            GENDER
          </label>
          <select id="f-gender" className="select" value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="">Any</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="neutral">Neutral</option>
          </select>
          <span className="field-caret">▼</span>
        </div>
        {showGemini && (
          <div className="field">
            <label className="field-label" htmlFor="f-gmodel">
              GEMINI
            </label>
            <select
              id="f-gmodel"
              className="select"
              value={gmodel}
              disabled={family !== "" && family !== "Gemini"}
              title="Gemini voices have a sample per sub-model. This picks which one plays."
              onChange={(e) => setGmodel(e.target.value)}
            >
              {GEMINI_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <span className="field-caret">▼</span>
          </div>
        )}
      </div>

      <div className="results-line">
        <span className="results-count" role="status">
          {all ? `${fmt(filtered.length)} voices · ${fmt(sampleCount)} samples` : "Loading catalog"}
        </span>
        {hasFilters && (
          <button
            type="button"
            className="clear-btn"
            onClick={() => (setQ(""), setFamily(""), setLang(""), setGender(""), setGmodel(DEFAULT_GMODEL))}
          >
            Clear filters
          </button>
        )}
      </div>

      {all && filtered.length === 0 && (
        <div className="empty">No voices match. Try a shorter search or clear a filter.</div>
      )}

      {groups.map((g) => (
        <section className="lang-group" key={g.code}>
          {!lockLanguage && (
            <div className="lang-head">
              <a className="lang-name" href={`/voices/${g.code}`}>
                {languageName(g.code)}
              </a>
              <span className="lang-code">{g.code}</span>
              <span className="lang-count">{fmt(g.items.length)} voices</span>
            </div>
          )}
          {g.items.map((v) => {
            const isActive = active?.id === v.id;
            return (
              <div className="vrow" key={v.id}>
                <button
                  type="button"
                  className={`play${isActive && active.status !== "error" ? " play-on" : ""}`}
                  aria-label={`Play sample for ${v.name}, ${languageName(v.lang)}`}
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
                <span className="vname">{v.name}</span>
                <span className={`tag ${v.tier === "ultra" ? "tag-purple" : "tag-blue"}`}>
                  {familyLabel(v.family).toUpperCase()}
                </span>
                {v.styles.length > 0 && <span className="vstyles">{v.styles.join(" · ")}</span>}
                <span className="vmeta">
                  {isActive && active.status === "error" && (
                    <span className="vnote" role="status">
                      {active.note ?? "sample unavailable"}
                    </span>
                  )}
                  {isActive && active.status === "generating" && (
                    <span className="vnote" role="status">
                      preparing sample
                    </span>
                  )}
                  <span className="vgender">{v.gender === "unknown" ? "" : v.gender}</span>
                </span>
              </div>
            );
          })}
        </section>
      ))}

      {!lockLanguage && all && filtered.length > 0 && (
        <p className="list-note">
          Languages are ordered by catalog size. Gemini voices carry one sample per sub-model, so the
          GEMINI control picks which take you hear.
        </p>
      )}
    </div>
  );
}
