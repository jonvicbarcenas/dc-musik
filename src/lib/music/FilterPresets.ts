import { audioFiltersSchema } from '../db/models.js';
import type { AudioFilters } from '../db/models.js';
import { MusicError } from '../utils/errors.js';

export const equalizerPresets = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bass: [0.3, 0.25, 0.2, 0.1, 0.05, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  pop: [0.05, 0.1, 0.1, 0, -0.05, -0.05, 0, 0.05, 0.1, 0.15, 0.15, 0.1, 0.05, 0.05, 0],
  rock: [0.2, 0.15, 0.1, 0, -0.05, -0.05, 0, 0.05, 0.1, 0.15, 0.2, 0.2, 0.15, 0.1, 0.05],
  vocal: [-0.1, -0.1, -0.05, 0, 0.1, 0.15, 0.2, 0.2, 0.15, 0.1, 0.05, 0, -0.05, -0.1, -0.1],
} as const;
export type FilterPreset =
  | 'bassboost'
  | 'nightcore'
  | 'vaporwave'
  | '8d'
  | 'karaoke'
  | 'tremolo'
  | 'vibrato'
  | 'rotation'
  | 'lowpass';

export function applyFilterPreset(
  current: AudioFilters,
  name: FilterPreset,
  enabled = true,
): AudioFilters {
  const next = structuredClone(current);
  switch (name) {
    case 'bassboost':
      if (enabled) next.equalizer = equalizer('bass');
      else delete next.equalizer;
      break;
    case 'nightcore':
      if (enabled) next.timescale = { speed: 1.15, pitch: 1.2, rate: 1 };
      else delete next.timescale;
      break;
    case 'vaporwave':
      if (enabled) next.timescale = { speed: 0.85, pitch: 0.9, rate: 1 };
      else delete next.timescale;
      break;
    case '8d':
    case 'rotation':
      if (enabled) next.rotation = { rotationHz: 0.2 };
      else delete next.rotation;
      break;
    case 'karaoke':
      if (enabled) next.karaoke = { level: 1, monoLevel: 1, filterBand: 220, filterWidth: 100 };
      else delete next.karaoke;
      break;
    case 'tremolo':
      if (enabled) next.tremolo = { frequency: 4, depth: 0.5 };
      else delete next.tremolo;
      break;
    case 'vibrato':
      if (enabled) next.vibrato = { frequency: 4, depth: 0.5 };
      else delete next.vibrato;
      break;
    case 'lowpass':
      if (enabled) next.lowPass = { smoothing: 20 };
      else delete next.lowPass;
      break;
  }
  return validateFilters(next);
}
export function equalizer(
  name: keyof typeof equalizerPresets,
): NonNullable<AudioFilters['equalizer']> {
  return equalizerPresets[name].map((gain, band) => ({ band, gain }));
}
export function setTimescale(
  current: AudioFilters,
  parameter: 'speed' | 'pitch' | 'rate',
  value: number,
): AudioFilters {
  return validateFilters({
    ...current,
    timescale: { speed: 1, pitch: 1, rate: 1, ...current.timescale, [parameter]: value },
  });
}
export function validateFilters(value: unknown): AudioFilters {
  const result = audioFiltersSchema.safeParse(value);
  if (
    !result.success ||
    (result.data.equalizer &&
      new Set(result.data.equalizer.map((band) => band.band)).size !== result.data.equalizer.length)
  )
    throw new MusicError(
      'INVALID_INPUT',
      'Invalid filter values. Speed, pitch, and rate must be between 0.25 and 4.',
    );
  return result.data;
}
