import type { StoredTrack } from '../db/models.js';
import type { RawTrack } from './types.js';
import { isPreview, normalizeIsrc, normalizeSource } from './TrackCodec.js';

export interface MirrorScore {
  candidate: RawTrack;
  score: number;
  exactIsrc: boolean;
  durationDifferenceMs: number;
}
const variants = [
  /\blive\b/i,
  /\bremix\b/i,
  /\bcover\b/i,
  /\bsped[ -]?up\b/i,
  /\bslowed\b/i,
  /\bnightcore\b/i,
  /\bkaraoke\b/i,
  /\binstrumental\b/i,
  /\b(?:8d|bass[ -]?boosted)\b/i,
  /\b(?:reverb|acoustic)\b/i,
];

export function normalizeMusicText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\b(?:official|audio|video|lyrics?|visuali[sz]er|hd|hq|topic|vevo)\b/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
export function textSimilarity(first: string, second: string): number {
  const a = new Set(normalizeMusicText(first).split(' ').filter(Boolean));
  const b = new Set(normalizeMusicText(second).split(' ').filter(Boolean));
  if (!a.size || !b.size) return 0;
  const overlap = [...a].filter((word) => b.has(word)).length;
  return (2 * overlap) / (a.size + b.size);
}

export class MirrorMatcher {
  score(original: StoredTrack, candidate: RawTrack): MirrorScore | null {
    let source: string;
    try {
      source = normalizeSource(candidate.source);
    } catch {
      return null;
    }
    if (
      !['youtube', 'soundcloud'].includes(source) ||
      isPreview(candidate) ||
      candidate.isStream ||
      original.isStream ||
      !candidate.encoded ||
      candidate.durationMs <= 0 ||
      original.durationMs <= 0
    )
      return null;
    const difference = Math.abs(candidate.durationMs - original.durationMs);
    if (!Number.isFinite(difference) || difference > 10_000) return null;
    if (
      variants.some(
        (pattern) =>
          (pattern.test(candidate.title) ||
            (pattern.test(candidate.artist) && !pattern.test(original.artist))) &&
          !pattern.test(original.title),
      )
    )
      return null;
    const exactIsrc = Boolean(original.isrc && normalizeIsrc(candidate.isrc) === original.isrc);
    const title = textSimilarity(original.title, candidate.title);
    const artist = Math.max(
      textSimilarity(original.artist, candidate.artist),
      textSimilarity(original.artist, candidate.title),
    );
    // A shared duration alone is never enough to make a match.
    if (!exactIsrc && (title < 0.5 || artist < 0.4)) return null;
    let score = title * 45 + artist * 30 + (1 - difference / 10_000) * 10;
    if (exactIsrc) score += 100;
    if (/\btopic\b|vevo$/i.test(candidate.artist)) score += 12;
    if (/\bofficial (?:audio|video)\b/i.test(candidate.title)) score += 7;
    if (source === 'youtube') score += 3;
    return { candidate, score, exactIsrc, durationDifferenceMs: difference };
  }
  rank(original: StoredTrack, candidates: readonly RawTrack[]): MirrorScore[] {
    return candidates
      .map((candidate) => this.score(original, candidate))
      .filter((score): score is MirrorScore => score !== null)
      .sort((a, b) => b.score - a.score || a.durationDifferenceMs - b.durationDifferenceMs);
  }
}
