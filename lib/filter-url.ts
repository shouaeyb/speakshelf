// The two-way binding between the provider page's query string and the
// Explorer's filter state, in one place because it is a state machine and
// splitting it across two effects in a component is what broke it.
//
// The rule the whole module exists to enforce: the URL and the state are
// never allowed to drive each other. One string, `synced`, records the
// query both sides currently agree on. A reader arriving from the URL is
// adopted only when the URL differs from it; a write happens only when the
// state differs from it. Anything equal to it is our own echo (Next mirrors
// an external replaceState back into useSearchParams) and is ignored.
//
// The bug this replaces: the state started empty and the URL was applied in
// an effect, so the writer, running later in the SAME commit but still
// closed over the first render's empty values, published an empty query
// over a real one. Next echoed the emptied URL back, the applier adopted
// it, the writer republished, and on a slow client the two chased each
// other for tens of seconds, painting the entire catalog in place of the
// filtered list. The fix is to read the URL during the first render, not
// after it.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Voice } from "@/lib/data";

export interface FilterState {
  q: string;
  family: string;
  lang: string;
  gender: string;
  gmodel: string;
}

// Frozen because it is exported and handed straight to setState by clear():
// nothing may treat it as a scratch object.
export const EMPTY_FILTERS: FilterState = Object.freeze({
  q: "",
  family: "",
  lang: "",
  gender: "",
  gmodel: "",
});

const GENDERS = ["female", "male", "neutral"];

interface Options {
  /** Serialized search params from the router; undefined means no URL sync. */
  paramsKey?: string;
  /** Route-locked language (language pages): no URL sync at all. */
  lockLanguage?: string;
  /** Sub-model ids for the multi-model family, first entry is the API default. */
  subModels: string[];
  /** The provider catalog once it has loaded, for validating family and language. */
  all: Voice[] | null;
}

/** Read a query string into a complete snapshot. Pure, and safe to call
 *  during render: it touches no browser API and no catalog. Gender and
 *  sub-model are validated here because their vocabularies are known
 *  without data; family and language cannot be, so they pass through and
 *  are cleared later if the catalog disowns them. */
export function parseFilters(paramsKey: string | undefined, subModels: string[]): FilterState {
  if (paramsKey === undefined) return EMPTY_FILTERS;
  const p = new URLSearchParams(paramsKey);
  const gender = p.get("gender") ?? "";
  const gmodel = p.get("gmodel") ?? "";
  return {
    q: p.get("q") ?? "",
    family: p.get("family") ?? "",
    lang: p.get("language") ?? "",
    gender: GENDERS.includes(gender) ? gender : "",
    // The first sub-model is what the API serves without being asked, so it
    // is stored as no choice and never reaches the URL.
    gmodel: subModels.includes(gmodel) && gmodel !== subModels[0] ? gmodel : "",
  };
}

/** The canonical query string for a snapshot. Field order is fixed, so the
 *  same filters always produce the same string and a comparison against the
 *  live URL means what it looks like it means. */
export function serializeFilters(f: FilterState): string {
  const p = new URLSearchParams();
  if (f.family) p.set("family", f.family);
  if (f.lang) p.set("language", f.lang);
  if (f.gender) p.set("gender", f.gender);
  if (f.gmodel) p.set("gmodel", f.gmodel);
  if (f.q) p.set("q", f.q);
  return p.toString();
}

/** Drop a family or language the catalog does not have. Kept as a
 *  derivation rather than a correcting effect. The raw snapshot does still
 *  hold whatever the URL said, but a rejected value is never EXPOSED as an
 *  effective filter and is never written back to the address, so there is
 *  no second render in which the wrong list is the truth and no second
 *  chance for the writer to publish it. Returns the input untouched when
 *  there is nothing to clear, so the identity is stable and the writer does
 *  not re-run on every keystroke. */
export function clampToCatalog(f: FilterState, known: KnownValues | null): FilterState {
  if (!known) return f;
  const family = f.family && !known.families.has(f.family) ? "" : f.family;
  const lang = f.lang && !known.langs.has(f.lang) ? "" : f.lang;
  return family === f.family && lang === f.lang ? f : { ...f, family, lang };
}

interface KnownValues {
  families: Set<string>;
  langs: Set<string>;
}

/** Replace the query without navigating, keeping the hash. Returns false
 *  when the address bar already reads that way, which is most of the time:
 *  a write nobody needs still echoes back through useSearchParams and is
 *  one more chance for the two sides to disagree. */
function writeQuery(qs: string): boolean {
  const { pathname, search, hash } = window.location;
  const next = qs ? `?${qs}${hash}` : pathname + hash;
  const nextFull = qs ? `${pathname}?${qs}${hash}` : pathname + hash;
  if (nextFull === pathname + search + hash) return false;
  window.history.replaceState(null, "", next);
  return true;
}

export function useFilterUrl({ paramsKey, lockLanguage, subModels, all }: Options) {
  // The URL is read during the first render, once. Committing five empty
  // fields and correcting them afterwards is the whole bug.
  const [seed] = useState(() => {
    const f = parseFilters(paramsKey, subModels);
    return { filters: f, query: serializeFilters(f) };
  });
  // The one query string both sides currently agree on.
  const synced = useRef(seed.query);
  // Set when a router navigation has been adopted but its state has not
  // been committed yet. The writer runs again in that same commit, still
  // holding the outgoing values, and without this it would push them back
  // over the URL the reader just navigated to. Safe because the writer's
  // dependencies are a superset of this effect's: every run of the adopter
  // is followed by a run of the writer in the same commit, so the flag is
  // always consumed and can never strand the writer.
  const adopting = useRef(false);
  const [raw, setState] = useState<FilterState>(seed.filters);

  // One pass over the catalog, not one per keystroke.
  const known = useMemo<KnownValues | null>(
    () => (all ? { families: new Set(all.map((v) => v.family)), langs: new Set(all.map((v) => v.lang)) } : null),
    [all],
  );
  const filters = useMemo(() => clampToCatalog(raw, known), [raw, known]);

  const syncs = !lockLanguage && paramsKey !== undefined;

  // URL to state. Only a query we did not put there is adopted; our own
  // echo compares equal and stops here.
  useEffect(() => {
    if (!syncs) return;
    if (paramsKey === synced.current) return;
    const next = parseFilters(paramsKey, subModels);
    const canonical = serializeFilters(next);
    synced.current = canonical;
    adopting.current = true;
    setState(next);
    // A hand-typed or stale URL can carry junk (an unknown gender, the
    // default sub-model, a reordered query). Correcting it here rather
    // than waiting for the writer keeps the address bar honest without a
    // second pass, and the echo of this write is already accounted for.
    if (canonical !== paramsKey) writeQuery(canonical);
  }, [syncs, paramsKey, subModels]);

  // State to URL. Shareable without navigating, and it never scrolls: only
  // a GlideLink click records a glide intent.
  useEffect(() => {
    if (!syncs) return;
    if (adopting.current) {
      adopting.current = false;
      return;
    }
    const qs = serializeFilters(filters);
    if (qs === synced.current) return;
    synced.current = qs;
    writeQuery(qs);
  }, [syncs, filters, paramsKey, subModels]);

  const patch = useCallback((next: Partial<FilterState>) => {
    setState((cur) => ({ ...cur, ...next }));
  }, []);

  const clear = useCallback(() => setState(EMPTY_FILTERS), []);

  return { filters, patch, clear };
}
