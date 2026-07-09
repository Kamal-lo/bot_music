import { SlashCommandBuilder } from 'discord.js';
import play from 'play-dl';
import https from 'https';
import { MusicQueue } from '../structures/MusicQueue.js';

// ─── Spotify helpers (bypasses play-dl's broken Spotify auth) ────────────────

/** Fetches a Spotify Client-Credentials access token. Caches it for its lifetime. */
let _spotifyToken = null;
let _spotifyTokenExpiry = 0;

async function getSpotifyToken() {
  if (_spotifyToken && Date.now() < _spotifyTokenExpiry) return _spotifyToken;

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const body = 'grant_type=client_credentials';
  const authHeader = 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const data = await httpsPost('https://accounts.spotify.com/api/token', body, {
    'Authorization': authHeader,
    'Content-Type': 'application/x-www-form-urlencoded',
  });

  if (!data || data.error) return null;

  _spotifyToken = data.access_token;
  _spotifyTokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // Refresh 60s early
  return _spotifyToken;
}

/** Simple HTTPS GET/POST helper that returns parsed JSON */
function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = { hostname: u.hostname, path: u.pathname + u.search, method: 'GET', headers };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch { resolve(null); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function httpsPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch { resolve(null); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Extracts the Spotify ID and type from an open.spotify.com URL.
 * @param {string} url
 * @returns {{ type: 'track'|'album'|'playlist', id: string } | null}
 */
function parseSpotifyUrl(url) {
  const match = url.match(/open\.spotify\.com\/(track|album|playlist)\/([A-Za-z0-9]+)/);
  if (!match) return null;
  return { type: match[1], id: match[2] };
}

/**
 * Fetches track info from the Spotify Web API.
 * @returns {{ title: string, artist: string, thumbnail: string, durationInSec: number } | null}
 */
async function fetchSpotifyTrack(trackId) {
  const token = await getSpotifyToken();
  if (!token) return null;

  const data = await httpsGet(`https://api.spotify.com/v1/tracks/${trackId}`, {
    'Authorization': `Bearer ${token}`
  });

  if (!data || data.error) return null;

  return {
    title: data.name,
    artist: (data.artists || []).map(a => a.name).join(', '),
    thumbnail: data.album?.images?.[0]?.url || '',
    durationInSec: Math.floor((data.duration_ms || 0) / 1000),
  };
}

/**
 * Fetches all tracks from a Spotify album.
 */
async function fetchSpotifyAlbum(albumId) {
  const token = await getSpotifyToken();
  if (!token) return null;

  const albumData = await httpsGet(`https://api.spotify.com/v1/albums/${albumId}`, {
    'Authorization': `Bearer ${token}`
  });

  if (!albumData || albumData.error) return null;

  const tracks = (albumData.tracks?.items || []).map(t => ({
    title: t.name,
    artist: (t.artists || []).map(a => a.name).join(', '),
    thumbnail: albumData.images?.[0]?.url || '',
    durationInSec: Math.floor((t.duration_ms || 0) / 1000),
  }));

  return { name: albumData.name, tracks };
}

/**
 * Fetches all tracks from a Spotify playlist.
 */
async function fetchSpotifyPlaylist(playlistId) {
  const token = await getSpotifyToken();
  if (!token) return null;

  const playlistData = await httpsGet(`https://api.spotify.com/v1/playlists/${playlistId}`, {
    'Authorization': `Bearer ${token}`
  });

  if (!playlistData || playlistData.error) return null;

  const tracks = (playlistData.tracks?.items || [])
    .filter(item => item.track && item.track.type === 'track')
    .map(item => ({
      title: item.track.name,
      artist: (item.track.artists || []).map(a => a.name).join(', '),
      thumbnail: item.track.album?.images?.[0]?.url || '',
      durationInSec: Math.floor((item.track.duration_ms || 0) / 1000),
    }));

  return { name: playlistData.name, tracks };
}

// ─── Command ─────────────────────────────────────────────────────────────────

export default {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Plays a song from YouTube or Spotify, or searches YouTube')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('The YouTube/Spotify URL, or YouTube search term')
        .setRequired(true)
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {import('../structures/Client.js').MusicClient} client
   */
  async execute(interaction, client) {
    await interaction.deferReply();

    const memberVoiceChannel = interaction.member.voice.channel;
    if (!memberVoiceChannel) {
      return interaction.editReply('❌ You must be in a voice channel to use this command!');
    }

    const botVoiceChannel = interaction.guild.members.me.voice.channel;
    if (botVoiceChannel && botVoiceChannel.id !== memberVoiceChannel.id) {
      return interaction.editReply('❌ You must be in the same voice channel as the bot to use this command!');
    }

    const query = interaction.options.getString('query');
    let queue = client.queues.get(interaction.guildId);

    // If no queue exists, create a new one
    if (!queue) {
      queue = new MusicQueue(client, interaction.channel, memberVoiceChannel);
      client.queues.set(interaction.guildId, queue);
    }

    try {
      // ── Detect Spotify URL ────────────────────────────────────────────────
      const spotifyInfo = parseSpotifyUrl(query);
      if (spotifyInfo) {
        if (spotifyInfo.type === 'track') {
          const track = await fetchSpotifyTrack(spotifyInfo.id);
          if (!track) {
            return interaction.editReply('❌ Could not retrieve Spotify track info. Please check your Spotify credentials or try a YouTube search instead.');
          }

          queue.enqueue({
            title: track.title,
            url: query, // stored for reference; YouTube search done at play-time
            duration: secondsToDuration(track.durationInSec),
            thumbnail: track.thumbnail,
            source: 'spotify',
            artist: track.artist,
            requestedBy: interaction.user.id
          });

          return interaction.editReply(`✅ Added Spotify track **${track.title}** by **${track.artist}** to the queue!`);
        }

        if (spotifyInfo.type === 'album') {
          const album = await fetchSpotifyAlbum(spotifyInfo.id);
          if (!album) {
            return interaction.editReply('❌ Could not retrieve Spotify album info. Please check your Spotify credentials.');
          }

          for (const track of album.tracks) {
            queue.enqueue({
              title: track.title,
              url: `https://open.spotify.com/track/`, // placeholder; search at play-time
              duration: secondsToDuration(track.durationInSec),
              thumbnail: track.thumbnail,
              source: 'spotify',
              artist: track.artist,
              requestedBy: interaction.user.id
            });
          }

          return interaction.editReply(`✅ Added Spotify album **${album.name}** (${album.tracks.length} tracks) to the queue!`);
        }

        if (spotifyInfo.type === 'playlist') {
          const playlist = await fetchSpotifyPlaylist(spotifyInfo.id);
          if (!playlist) {
            return interaction.editReply('❌ Could not retrieve Spotify playlist info. Please check your Spotify credentials.');
          }

          for (const track of playlist.tracks) {
            queue.enqueue({
              title: track.title,
              url: `https://open.spotify.com/track/`,
              duration: secondsToDuration(track.durationInSec),
              thumbnail: track.thumbnail,
              source: 'spotify',
              artist: track.artist,
              requestedBy: interaction.user.id
            });
          }

          return interaction.editReply(`✅ Added Spotify playlist **${playlist.name}** (${playlist.tracks.length} tracks) to the queue!`);
        }
      }

      // ── YouTube ────────────────────────────────────────────────────────────
      const ytValidation = await play.yt_validate(query);

      // YouTube Playlist
      if (ytValidation === 'playlist') {
        const playlist = await play.playlist_info(query, { incomplete: true });
        const videos = await playlist.all_videos();

        for (const video of videos) {
          queue.enqueue({
            title: video.title,
            url: video.url,
            duration: video.durationRaw || '00:00',
            thumbnail: video.thumbnails[0]?.url || '',
            source: 'youtube',
            artist: video.channel?.name || '',
            requestedBy: interaction.user.id
          });
        }

        return interaction.editReply(`✅ Added playlist **${playlist.title}** (${videos.length} tracks) to the queue!`);
      }

      // YouTube Video (URL)
      if (ytValidation === 'video') {
        const videoInfo = await play.video_info(query);
        const video = videoInfo.video_details;

        const song = {
          title: video.title,
          url: video.url,
          duration: video.durationRaw || '00:00',
          thumbnail: video.thumbnails[0]?.url || '',
          source: 'youtube',
          artist: video.channel?.name || '',
          requestedBy: interaction.user.id
        };

        queue.enqueue(song);
        return interaction.editReply(`✅ Added **${song.title}** to the queue!`);
      }

      // YouTube Text Search
      const searchResults = await play.search(query, {
        limit: 1,
        source: { youtube: 'video' }
      });

      if (searchResults.length === 0) {
        return interaction.editReply(`❌ No search results found for: \`${query}\``);
      }

      const video = searchResults[0];
      const song = {
        title: video.title,
        url: video.url,
        duration: video.durationRaw || '00:00',
        thumbnail: video.thumbnails[0]?.url || '',
        source: 'youtube',
        artist: video.channel?.name || '',
        requestedBy: interaction.user.id
      };

      queue.enqueue(song);
      return interaction.editReply(`✅ Added **${song.title}** to the queue!`);

    } catch (error) {
      console.error('[PLAY COMMAND ERROR]', error);
      return interaction.editReply(`❌ An error occurred: ${error.message}`);
    }
  }
};

/**
 * Format seconds to MM:SS or HH:MM:SS
 * @param {number} sec
 * @returns {string}
 */
function secondsToDuration(sec) {
  if (!sec || isNaN(sec)) return '00:00';
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;

  const formattedMins = mins < 10 && hrs > 0 ? `0${mins}` : mins;
  const formattedSecs = secs < 10 ? `0${secs}` : secs;

  return hrs > 0
    ? `${hrs}:${formattedMins}:${formattedSecs}`
    : `${formattedMins}:${formattedSecs}`;
}
