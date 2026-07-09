import {
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  StreamType
} from '@discordjs/voice';
import { spawn } from 'child_process';
import play from 'play-dl';

export class MusicQueue {
  /**
   * @param {import('./Client.js').MusicClient} client
   * @param {import('discord.js').TextChannel} textChannel
   * @param {import('discord.js').VoiceChannel} voiceChannel
   */
  constructor(client, textChannel, voiceChannel) {
    this.client = client;
    this.textChannel = textChannel;
    this.voiceChannel = voiceChannel;
    this.guildId = voiceChannel.guild.id;

    this.songs = [];
    this.volume = 0.5; // Default 50%
    this.loopMode = 'none'; // 'none' | 'track' | 'queue'
    this.idleTimeout = null;
    this.audioResource = null;

    // Create voice connection
    this.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: this.guildId,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator
    });

    this.connection.on('debug', message => {
      console.log(`[CONNECTION DEBUG] ${message}`);
    });

    // Create audio player
    this.player = createAudioPlayer();
    this.connection.subscribe(this.player);

    // Setup event listeners
    this.setupPlayerEvents();
    this.setupConnectionEvents();
  }

  setupPlayerEvents() {
    this.player.on('stateChange', (oldState, newState) => {
      console.log(`[PLAYER STATE] ${oldState.status} -> ${newState.status}`);
    });

    this.player.on(AudioPlayerStatus.Idle, () => {
      this.onSongEnd();
    });

    this.player.on('error', error => {
      console.error('[PLAYER ERROR] Error playing song:', error);
      this.textChannel.send(`⚠️ An error occurred while playing the track: **${error.message}**`);
      this.onSongEnd();
    });
  }

  setupConnectionEvents() {
    this.connection.on('stateChange', (oldState, newState) => {
      console.log(`[CONNECTION STATE] ${oldState.status} -> ${newState.status}`);
    });

    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        // Wait to see if connection automatically recovers (e.g. channel switch)
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5000)
        ]);
      } catch (error) {
        // Connection lost permanently
        console.log(`[CONNECTION] Permanently disconnected from guild ${this.guildId}`);
        this.destroy();
      }
    });
  }

  /**
   * Add song to queue and play if nothing is playing
   * @param {Object} song
   * @param {boolean} [top=false] Play next
   */
  enqueue(song, top = false) {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
      this.idleTimeout = null;
    }

    if (top) {
      this.songs.splice(1, 0, song);
    } else {
      this.songs.push(song);
    }

    if (this.player.state.status === AudioPlayerStatus.Idle && this.songs.length === 1) {
      this.play();
    }
  }

  /**
   * Spawns a yt-dlp child process and returns its stdout stream
   * @param {string} url
   * @returns {import('node:stream').Readable}
   */
  createYtdlStream(url) {
    const ytDlp = spawn('python', [
      '-m', 'yt_dlp',
      '--js-runtimes', 'node',
      '-o', '-',
      '-f', 'bestaudio[ext=webm]/bestaudio/best',
      '--no-playlist',
      url
    ]);

    ytDlp.on('error', err => {
      console.error('[YTDL SPAWN ERROR]', err);
    });

    ytDlp.stderr.on('data', chunk => {
      const msg = chunk.toString().trim();
      if (msg) console.log(`[YTDL LOG] ${msg}`);
    });

    const stream = ytDlp.stdout;

    // Ensure the child process is terminated when the stream is closed
    stream.on('close', () => {
      if (ytDlp.exitCode === null) {
        ytDlp.kill();
      }
    });

    return stream;
  }

  /**
   * Play the current song in queue
   */
  async play() {
    if (this.songs.length === 0) {
      // Start idle timeout of 2 minutes before leaving
      this.startIdleTimeout();
      return;
    }

    const song = this.songs[0];

    try {
      let stream;
      // Get the playable YouTube stream
      if (song.source === 'youtube') {
        stream = this.createYtdlStream(song.url);
      } else if (song.source === 'spotify') {
        // Spotify song. We need to search and stream from YouTube
        const searchResults = await play.search(`${song.title} ${song.artist}`, {
          limit: 1,
          source: { youtube: 'video' }
        });

        if (searchResults.length === 0) {
          this.textChannel.send(`❌ Could not find a playable YouTube source for: **${song.title}**`);
          this.onSongEnd();
          return;
        }

        stream = this.createYtdlStream(searchResults[0].url);
      } else {
        throw new Error('Unsupported music source');
      }

      this.audioResource = createAudioResource(stream, {
        inputType: StreamType.Arbitrary,
        inlineVolume: true
      });

      this.audioResource.volume.setVolume(this.volume);
      this.player.play(this.audioResource);

      this.textChannel.send(`🎶 Now playing: **${song.title}** ${song.artist ? `by *${song.artist}*` : ''} - Requested by <@${song.requestedBy}>`);
    } catch (error) {
      console.error('[PLAY ERROR] Failed to start stream:', error);
      this.textChannel.send(`❌ Failed to play **${song.title}**: ${error.message}`);
      this.onSongEnd();
    }
  }

  onSongEnd() {
    if (this.loopMode === 'track') {
      // Do nothing to the queue list, just play the same index 0 song again
      this.play();
    } else if (this.loopMode === 'queue') {
      // Push first song to back
      const song = this.songs.shift();
      if (song) this.songs.push(song);
      this.play();
    } else {
      // Normal shifting
      this.songs.shift();
      this.play();
    }
  }

  skip() {
    if (this.songs.length === 0) return false;
    // Stop triggers the Idle event, which triggers play() on the next track
    this.player.stop();
    return true;
  }

  pause() {
    if (this.player.state.status === AudioPlayerStatus.Paused) return false;
    this.player.pause();
    return true;
  }

  resume() {
    if (this.player.state.status !== AudioPlayerStatus.Paused) return false;
    this.player.unpause();
    return true;
  }

  stop() {
    this.songs = [];
    this.loopMode = 'none';
    this.player.stop();
    this.startIdleTimeout();
  }

  /**
   * Set volume scale (0 to 100)
   * @param {number} vol
   */
  setVolume(vol) {
    this.volume = vol / 100;
    if (this.audioResource && this.audioResource.volume) {
      this.audioResource.volume.setVolume(this.volume);
    }
  }

  /**
   * Set loop mode
   * @param {'none' | 'track' | 'queue'} mode
   */
  setLoopMode(mode) {
    this.loopMode = mode;
  }

  startIdleTimeout() {
    if (this.idleTimeout) clearTimeout(this.idleTimeout);
    this.idleTimeout = setTimeout(() => {
      this.textChannel.send('👋 Disconnected from voice channel due to inactivity.');
      this.destroy();
    }, 120000); // 2 minutes
  }

  destroy() {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
      this.idleTimeout = null;
    }

    try {
      this.player.stop();
    } catch { }

    try {
      this.connection.destroy();
    } catch { }

    this.client.queues.delete(this.guildId);
  }
}
