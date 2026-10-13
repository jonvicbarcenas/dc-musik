import { formatTime } from '../utils/time.js';

export function progressBar(
  positionMs: number,
  durationMs: number,
  isStream = false,
  width = 14,
): string {
  if (isStream) return `🔴 LIVE · ${formatTime(positionMs)}`;
  const length = Math.max(3, Math.min(30, Math.floor(Number.isFinite(width) ? width : 14)));
  const duration = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
  const position = Math.min(duration, Math.max(0, Number.isFinite(positionMs) ? positionMs : 0));
  const marker = duration > 0 ? Math.round((position / duration) * (length - 1)) : 0;
  return `${'▬'.repeat(marker)}🔘${'▬'.repeat(length - marker - 1)} ${formatTime(position)} / ${formatTime(duration)}`;
}
