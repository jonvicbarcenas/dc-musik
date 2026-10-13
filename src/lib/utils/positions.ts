import { MusicError } from './errors.js';

export function parsePositions(input: string, maximum: number): number[] {
  const selected = new Set<number>();
  for (const part of input.trim().split(/[ ,]+/)) {
    const match = /^(\d+)(?:-(\d+))?$/.exec(part);
    if (!match) throw new MusicError('INVALID_INPUT', 'Use positions such as 2, 4, or 5-8.');
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start < 1 || end < start || end > maximum || !Number.isSafeInteger(end))
      throw new MusicError('INVALID_INPUT', 'That queue range does not exist.');
    for (let position = start; position <= end; position++) selected.add(position);
  }
  return [...selected].sort((a, b) => a - b);
}
