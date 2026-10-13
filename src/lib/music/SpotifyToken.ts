/** Validate OAuth response credentials without including their values in diagnostics. */
export const spotifyTokenValid = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9._~+/=-]{16,4096}$/.test(value);
