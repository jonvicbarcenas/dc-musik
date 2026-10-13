import { ConfigurationError, loadEnv } from '../src/config/env.js';
import { authorizeSpotify } from '../src/lib/music/SpotifyAuthorization.js';
import { saveOAuthEnv } from '../src/lib/utils/EnvFile.js';
import { MusicError } from '../src/lib/utils/errors.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') {
    console.log(
      'npm run spotify:auth   Authorize playlist reading through a local Spotify sign-in.',
    );
    console.log(
      'First register http://127.0.0.1:8888/callback in your Spotify app Settings (or use SPOTIFY_REDIRECT_URI).',
    );
    console.log(
      'Sign in as the owner/collaborator of the public playlist. Refresh tokens are saved privately.',
    );
    return;
  }
  if (args.length)
    throw new MusicError(
      'INVALID_INPUT',
      'Use npm run spotify:auth or npm run spotify:auth -- --help.',
    );
  const env = loadEnv();
  console.log(
    `Register this exact Redirect URI in your Spotify app Settings: ${env.SPOTIFY_REDIRECT_URI}`,
  );
  console.log('Sign in with a Spotify account that owns or collaborates on the public playlist.');
  await authorizeSpotify(
    env,
    (url) => console.log(`Open this Spotify sign-in link:\n${url}`),
    async (refreshToken) => {
      await saveOAuthEnv({ SPOTIFY_ENABLED: 'true', SPOTIFY_REFRESH_TOKEN: refreshToken });
    },
  );
  console.log('Spotify authorization saved privately in .env. No token values were printed.');
  console.log('Restart npm run dev, then retry /play with your public Spotify playlist link.');
}
try {
  await main();
} catch (error) {
  console.error(
    error instanceof ConfigurationError || error instanceof MusicError
      ? error.message
      : 'Spotify setup failed. Check the local configuration and try again.',
  );
  process.exitCode = 1;
}
