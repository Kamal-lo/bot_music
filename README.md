# Discord Music Bot (YouTube & Spotify)

A modular, robust, and modern Discord music bot that supports playing music from YouTube (searches/videos/playlists) and Spotify (tracks/albums/playlists) using Discord's official slash commands.

## Features

- **Slash Commands**: Fully compatible with modern Discord applications.
- **YouTube Playback**: Play YouTube URLs, playlists, or search queries.
- **Spotify Integration**: Supports playing Spotify tracks, albums, and playlists (automatically resolves to matching YouTube audio).
- **Queue Management**: Add songs, view the queue, skip, pause, resume, change volume, and clear playback.
- **Looping Modes**: Loop the current track, loop the entire queue, or disable looping.
- **Auto-Disconnect**: Automatically cleans up and leaves the voice channel when empty or idle.
- **Easy Windows Setup**: Bundles FFmpeg via `ffmpeg-static` for a zero-manual-install setup.

## Requirements

- [Node.js](https://nodejs.org/) v18.0.0 or higher.
- A Discord Bot account (created via the Discord Developer Portal).

## Installation & Setup

1. **Install Dependencies**:
   Open a terminal in this directory and run:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env` (or edit the created `.env` directly) and fill in the parameters:
   - `DISCORD_TOKEN`: Your bot's token from the Developer Portal.
   - `CLIENT_ID`: Your bot's Application ID.
   - `GUILD_ID`: (Optional) The ID of a Discord server where you'd like to test the bot. Providing this registers slash commands instantly on that server, rather than waiting up to an hour for global registration.

3. **Configure Discord Developer Portal settings**:
   Under the **Bot** tab of your application:
   - Enable the **Message Content Intent** (required for certain commands and interactive reactions).
   - Enable **Server Members Intent** (optional, useful for voice channel presence checks).

4. **Invite the Bot**:
   Generate an invite link under **OAuth2** -> **URL Generator**:
   - Check the **bot** and **applications.commands** scopes.
   - Check the following bot permissions:
     - **Send Messages**
     - **Connect** (Voice)
     - **Speak** (Voice)
     - **Use Voice Activity**
   - Copy the generated URL, open it in your browser, and select your server to invite the bot.

5. **Start the Bot**:
   To start the bot, run:
   ```bash
   npm start
   ```

## Bot Commands

- `/play <search query or URL>` - Plays a track from YouTube or Spotify, or adds it to the queue.
- `/skip` - Skips the currently playing song.
- `/stop` - Stops playback, clears the queue, and leaves the voice channel.
- `/pause` - Pauses the music.
- `/resume` - Resumes the paused music.
- `/queue` - Displays the current queue.
- `/nowplaying` - Displays detailed information about the current song.
- `/volume <0-100>` - Changes the volume of the playback.
- `/loop <mode>` - Changes the looping mode (`None`, `Track`, `Queue`).
