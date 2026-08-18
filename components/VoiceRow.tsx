"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import { familyLabel } from "@/lib/families";
import type { Voice } from "@/lib/data";

export type PlayStatus = "loading" | "generating" | "playing" | "error";

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

interface VoiceRowProps {
  voice: Voice;
  provider: string;
  /** Localized language name, for the play button's label. */
  languageLabel: string;
  /** Label of the sub-model this row would play, empty unless the row
   *  belongs to the family that has several. It is Explorer state, not
   *  voice data, and only the mobile layout shows it. */
  modelText: string;
  /** This row's playback state, null while another row (or none) plays. */
  state: { status: PlayStatus; note?: string } | null;
  /** Takes the voice, so the list can hand every row one shared function
   *  instead of minting a closure per row on every render. */
  onPlay: (voice: Voice) => void;
}

/** One voice: play button, name, and the metadata. Desktop keeps it on a
 *  single line; at mobile widths CSS wraps it into two, with the play
 *  button's touch target spanning both. */
function VoiceRowBase({
  voice,
  provider,
  languageLabel,
  modelText,
  state,
  onPlay,
}: VoiceRowProps) {
  const t = useTranslations();
  // A note is transient: it takes the metadata line while it shows, and
  // the metadata comes back when it clears.
  const noted = state !== null && (state.status === "error" || state.status === "generating");
  return (
    <div className={`vrow${noted ? " vrow-note" : ""}`}>
      <button
        type="button"
        className={`play${state !== null && state.status !== "error" ? " play-on" : ""}`}
        aria-label={t("explorer.playAria", { name: voice.name, language: languageLabel })}
        aria-pressed={state !== null && state.status === "playing"}
        onClick={() => onPlay(voice)}
      >
        {state === null || state.status === "error" ? (
          <PlayGlyph />
        ) : state.status === "playing" ? (
          <StopGlyph />
        ) : (
          <span className="spin" aria-hidden="true"></span>
        )}
      </button>
      <span className="vname"><bdi>{voice.name}</bdi></span>
      <span className={`tag ${voice.tier === "ultra" ? "tag-purple" : "tag-blue"}`}>
        {familyLabel(provider, voice.family).toUpperCase()}
      </span>
      {modelText && <span className="vmodel"><bdi>{modelText}</bdi></span>}
      {voice.traits.age && (
        <span className="tag tag-gray tag-age">
          {voice.traits.age === "child" ? t("explorer.traits.child") : voice.traits.age.toUpperCase()}
        </span>
      )}
      {voice.styles.length > 0 && (
        // One isolate per term, separators outside them. Joining the terms
        // into a single string lets one bidi run swallow the whole list, so
        // a term in another script could drag its neighbours out of place;
        // isolated terms each keep their own direction and the middle dots
        // stay with the line's direction, which is what a list separator
        // should do.
        <span className="vstyles">
          {voice.styles.flatMap((style, i) =>
            i === 0
              ? [<bdi key={`${i}-${style}`}>{style}</bdi>]
              : [" · ", <bdi key={`${i}-${style}`}>{style}</bdi>],
          )}
        </span>
      )}
      <span className="vmeta">
        {state !== null && state.status === "error" && (
          <span className="vnote" role="status">
            {t(`explorer.${state.note ?? "noteUnavailable"}`)}
          </span>
        )}
        {state !== null && state.status === "generating" && (
          <span className="vnote" role="status">
            {t("explorer.noteGenerating")}
          </span>
        )}
        <span className="vgender">
          {voice.gender === "unknown" ? "" : t(`explorer.genderWords.${voice.gender}`)}
        </span>
      </span>
    </div>
  );
}

/** The list holds thousands of rows on a big provider, and every playback
 *  state change re-renders the component that owns them all. Without this
 *  comparator React would reconcile every row to change one; with it, only
 *  the row whose state actually moved does any work. The state object is
 *  built fresh by the parent on each render, so it is compared by value.
 *  Voices are immutable catalog data, so identity is enough for the rest. */
export default memo(VoiceRowBase, (prev, next) => {
  if (prev.voice !== next.voice) return false;
  if (prev.provider !== next.provider) return false;
  if (prev.languageLabel !== next.languageLabel) return false;
  if (prev.modelText !== next.modelText) return false;
  if (prev.onPlay !== next.onPlay) return false;
  if (prev.state === next.state) return true;
  if (prev.state === null || next.state === null) return false;
  return prev.state.status === next.state.status && prev.state.note === next.state.note;
});
