import 'dotenv/config';
import ffmpeg from 'ffmpeg-static';
import play from 'play-dl';
import { MusicClient } from './structures/Client.js';

// Setup FFmpeg static path for audio processing (Crucial for Windows)
process.env.FFMPEG_PATH = ffmpeg;
console.log(`[SYSTEM] FFmpeg path configured to: ${process.env.FFMPEG_PATH}`);

// Initialize client
const client = new MusicClient();

async function startBot() {
  // Validate basic configurations
  if (!process.env.DISCORD_TOKEN) {
    console.error('[CRITICAL] Missing "DISCORD_TOKEN" in the environment variables (.env file).');
    process.exit(1);
  }
  if (!process.env.CLIENT_ID) {
    console.error('[CRITICAL] Missing "CLIENT_ID" in the environment variables (.env file).');
    process.exit(1);
  }

  // Spotify credentials are handled directly in src/commands/play.js
  // via the Spotify Web API (client_credentials flow) — no play-dl token needed.
  if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
    console.log('[SYSTEM] Spotify credentials found. Spotify support is active.');
  } else {
    console.log('[SYSTEM] No Spotify credentials found. Spotify URLs will not work.');
  }

  // Load commands and events
  console.log('[SYSTEM] Loading commands and events...');
  await client.loadCommands();
  await client.loadEvents();

  // Handle unhandled rejections/exceptions to prevent crashing
  process.on('unhandledRejection', error => {
    console.error('[UNHANDLED REJECTION] An error occurred:', error);
  });

  process.on('uncaughtException', error => {
    console.error('[UNCAUGHT EXCEPTION] An error occurred:', error);
  });

  // Login
  console.log('[SYSTEM] Connecting to Discord...');
  await client.login(process.env.DISCORD_TOKEN);
}

startBot();
