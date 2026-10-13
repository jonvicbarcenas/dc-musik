import { MusicError } from './errors.js';

export function formatTime(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(Number.isFinite(milliseconds) ? milliseconds / 1000 : 0));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours > 0
    ? `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
    : `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Seconds, mm:ss, hh:mm:ss, or ordered 1h2m3s; rejects negatives and ambiguous input. */
export function parseTime(input: string): number {
  const value = input.trim().toLowerCase();
  let seconds: number;
  if (/^\d+(?:\.\d{1,3})?$/.test(value)) seconds = Number(value);
  else if (/^\d+:\d{2}(?::\d{2})?$/.test(value)) {
    const parts = value.split(':').map(Number);
    if (parts.slice(1).some((part) => part >= 60)) throw invalidTime();
    seconds = parts.reduce((total, part) => total * 60 + part, 0);
  } else {
    const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d{1,3})?)s)?$/.exec(value);
    if (!match || !match.slice(1).some(Boolean)) throw invalidTime();
    seconds = Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
  }
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 86_400) throw invalidTime();
  return Math.round(seconds * 1000);
}

function invalidTime(): MusicError {
  return new MusicError('INVALID_INPUT', 'Use seconds, mm:ss, hh:mm:ss, or a time such as 1m30s.');
}
