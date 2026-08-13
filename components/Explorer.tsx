"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Voice, PackedCatalog } from "@/lib/data";
import { unpack } from "@/lib/data";
import { languageName } from "@/lib/lang";
import { FAMILIES, familyLabel } from "@/lib/families";

interface ExplorerProps {
  /** Preloaded subset (language pages). When absent the full catalog loads on the client. */
  voices?: Voice[];
  /** Hide the language filter and group headers, e.g. on a single language page. */
  lockLanguage?: string;
}

type Active = { id: string; status: "loading" | "playing" | "error" } | null;

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

export default function Explorer({ voices, lockLanguage }: ExplorerProps) {
  const [all, setAll] = useState<Voice[] | null>(voices ?? null);
  const [q, setQ] = useState("");
  const [family, setFamily] = useState("");
  const [lang, setLang] = useState("");
  const [gender, setGender] = useState("");
  const [active, setActive] = useState<Active>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const errTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Pick up ?family= etc. from the URL once, so family tiles can link here.
  // One time read of an external system on mount; the URL cannot be read
  // during server render without making the whole page dynamic.
  useEffect(() => {
    if (lockLanguage) return;
    const p = new URLSearchParams(window.location.search);
    const f = p.get("family");
    const l = p.get("language");
    const g = p.get("gender");
    const s = p.get("q");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (f && FAMILIES.some((x) => x.key === f)) setFamily(f);
    if (l) setLang(l);
    if (g && ["female", "male", "neutral", "unknown"].includes(g)) setGender(g);
    if (s) setQ(s);
  }, [lockLanguage]);

  // Keep the URL shareable without triggering navigation.
  useEffect(() => {
    if (lockLanguage || typeof window === "undefined") return;
    const p = new URLSearchParams();
    if (family) p.set("family", family);
    if (lang) p.set("language", lang);
    if (gender) p.set("gender", gender);
    if (q) p.set("q", q);
    const qs = p.toString();
    const url = qs ? `?${qs}${window.location.hash}` : window.location.pathname + window.location.hash;
    window.history.replaceState(null, "", url);
  }, [q, family, lang, gender, lockLanguage]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (errTimer.current) clearTimeout(errTimer.current);
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

  const sampleCount = useMemo(() => filtered.filter((v) => v.hasSample).length, [filtered]);
  const hasFilters = q !== "" || family !== "" || lang !== "" || gender !== "";

  function stop() {
    audioRef.current?.pause();
    setActive(null);
  }

  function play(v: Voice) {
    if (active?.id === v.id && active.status !== "error") {
      stop();
      return;
    }
    if (!audioRef.current) audioRef.current = new Audio();
    const a = audioRef.current;
    if (errTimer.current) clearTimeout(errTimer.current);
    setActive({ id: v.id, status: "loading" });
    a.onplaying = () => setActive({ id: v.id, status: "playing" });
    a.onended = () => setActive((cur) => (cur?.id === v.id ? null : cur));
    a.onerror = () => {
      setActive({ id: v.id, status: "error" });
      errTimer.current = setTimeout(() => {
        setActive((cur) => (cur?.id === v.id && cur.status === "error" ? null : cur));
      }, 2500);
    };
    a.src = `/api/sample?id=${encodeURIComponent(v.id)}`;
    a.play().catch(() => {
      // play() rejects on abort when the user taps another row quickly; onerror covers real failures
    });
  }

  const fmt = (n: number) => n.toLocaleString("en-US");

  return (
    <div>
      <div className={lockLanguage ? "toolbar toolbar-3" : "toolbar"}>
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
      </div>

      <div className="results-line">
        <span className="results-count" role="status">
          {all ? `${fmt(filtered.length)} voices · ${fmt(sampleCount)} with samples` : "Loading catalog"}
        </span>
        {hasFilters && (
          <button type="button" className="clear-btn" onClick={() => (setQ(""), setFamily(""), setLang(""), setGender(""))}>
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
                {v.hasSample ? (
                  <button
                    type="button"
                    className={`play${isActive && active.status !== "error" ? " play-on" : ""}`}
                    aria-label={`Play sample for ${v.name}, ${languageName(v.lang)}`}
                    aria-pressed={isActive && active.status === "playing"}
                    onClick={() => play(v)}
                  >
                    {!isActive || active.status === "error" ? (
                      <PlayGlyph />
                    ) : active.status === "loading" ? (
                      <span className="spin" aria-hidden="true"></span>
                    ) : (
                      <StopGlyph />
                    )}
                  </button>
                ) : (
                  <span className="no-sample" title="No published sample for this voice">
                    –
                  </span>
                )}
                <span className="vname">{v.name}</span>
                <span className={`tag ${v.tier === "ultra" ? "tag-purple" : "tag-blue"}`}>
                  {familyLabel(v.family).toUpperCase()}
                </span>
                {v.styles.length > 0 && <span className="vstyles">{v.styles.join(" · ")}</span>}
                <span className="vmeta">
                  {isActive && active.status === "error" && <span className="vnote">sample unavailable</span>}
                  <span className="vgender">{v.gender === "unknown" ? "" : v.gender}</span>
                </span>
              </div>
            );
          })}
        </section>
      ))}

      {!lockLanguage && all && filtered.length > 0 && (
        <p className="list-note">
          Languages are ordered by catalog size. Voices without a play button have no published sample yet.
        </p>
      )}
    </div>
  );
}
