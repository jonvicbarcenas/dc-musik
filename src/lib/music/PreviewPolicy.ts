/** Clip hints are checked before a provider URL can be hidden behind the media cache. */
export function isPreviewRequest(title: string, uri: string | null): boolean {
  if (/(?:^|[\W_])(?:preview|sample clip|30[ -]second clip)(?:[\W_]|$)/i.test(title)) return true;
  try {
    const host = uri ? new URL(uri).hostname.toLowerCase() : '';
    return /^(?:p\.scdn\.co|audio-ssl\.itunes\.apple\.com|cdns-preview[^.]*\.dzcdn\.net)$/.test(
      host,
    );
  } catch {
    return false;
  }
}
