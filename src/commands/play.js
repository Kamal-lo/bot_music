import { SlashCommandBuilder } from 'discord.js';
import play from 'play-dl';
import { MusicQueue } from '../structures/MusicQueue.js';

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
      // Validate the query type
      const ytValidation = await play.yt_validate(query);
      const spValidation = await play.sp_validate(query);

      // 1. YouTube Playlist
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

      // 2. YouTube Video (URL)
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

      // 3. Spotify Track
      if (spValidation === 'track') {
        const track = await play.spotify(query);
        
        const song = {
          title: track.name,
          url: track.url,
          duration: secondsToDuration(track.durationInSec),
          thumbnail: track.thumbnail?.url || '',
          source: 'spotify',
          artist: track.artists.map(a => a.name).join(', '),
          requestedBy: interaction.user.id
        };

        queue.enqueue(song);
        return interaction.editReply(`✅ Added Spotify track **${song.title}** to the queue!`);
      }

      // 4. Spotify Playlist or Album
      if (spValidation === 'playlist' || spValidation === 'album') {
        const spotifyData = await play.spotify(query);
        const tracks = await spotifyData.all_tracks();

        for (const track of tracks) {
          queue.enqueue({
            title: track.name,
            url: track.url,
            duration: secondsToDuration(track.durationInSec),
            thumbnail: track.thumbnail?.url || '',
            source: 'spotify',
            artist: track.artists.map(a => a.name).join(', '),
            requestedBy: interaction.user.id
          });
        }

        return interaction.editReply(`✅ Added Spotify ${spValidation} **${spotifyData.name}** (${tracks.length} tracks) to the queue!`);
      }

      // 5. Search YouTube (Text Query)
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
