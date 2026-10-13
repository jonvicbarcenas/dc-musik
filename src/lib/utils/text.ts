export function cleanText(value: string, maximum = 300): string {
  return (
    [...value]
      .filter((character) => {
        const point = character.codePointAt(0) ?? 0;
        return point >= 32 && point !== 127;
      })
      .join('')
      .trim()
      .slice(0, maximum) || 'Unknown'
  );
}
export function safeWebUrl(value: string | null | undefined): string | null {
  try {
    if (!value || value.length > 4096) return null;
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
