import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Shows details about the currently playing song'),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {import('../structures/Client.js').MusicClient} client
   */
  async execute(interaction, client) {
    const queue = client.queues.get(interaction.guildId);

    if (!queue || queue.songs.length === 0) {
      return interaction.reply({ content: '❌ There is no music playing right now!', ephemeral: true });
    }

    const song = queue.songs[0];
    
    // Calculate progress
    let playbackStr = '';
    if (queue.audioResource) {
      const currentMs = queue.audioResource.playbackDuration;
      const currentSec = Math.floor(currentMs / 1000);
      const totalSec = durationToSeconds(song.duration);

      if (totalSec > 0) {
        const barSize = 15;
        const progressIndex = Math.round((currentSec / totalSec) * barSize);
        const progressIndexClamped = Math.max(0, Math.min(barSize, progressIndex));
        
        const progressBar = '▬'.repeat(progressIndexClamped) + '🔘' + '▬'.repeat(barSize - progressIndexClamped);
        playbackStr = `\n\n\`${formatSeconds(currentSec)}\` ${progressBar} \`${song.duration}\``;
      } else {
        playbackStr = `\n\n🔴 Live / Unknown duration`;
      }
    }

    const embed = new EmbedBuilder()
      .setColor('#1DB954')
      .setTitle('🎶 Now Playing')
      .setDescription(`[${song.title}](${song.url})${playbackStr}`)
      .setThumbnail(song.thumbnail)
      .addFields(
        { name: 'Channel/Artist', value: song.artist || 'Unknown', inline: true },
        { name: 'Requested By', value: `<@${song.requestedBy}>`, inline: true },
        { name: 'Platform Source', value: song.source === 'spotify' ? '🟢 Spotify' : '🔴 YouTube', inline: true }
      );

    return interaction.reply({ embeds: [embed] });
  }
};

/**
 * Convert MM:SS or HH:MM:SS to total seconds
 * @param {string} duration
 * @returns {number}
 */
function durationToSeconds(duration) {
  if (!duration) return 0;
  const parts = duration.split(':').map(Number);
  if (parts.some(isNaN)) return 0;

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parts[0] || 0;
}

/**
 * Format total seconds to MM:SS or HH:MM:SS
 * @param {number} totalSecs
 * @returns {string}
 */
function formatSeconds(totalSecs) {
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  const formattedMins = mins < 10 && hrs > 0 ? `0${mins}` : mins;
  const formattedSecs = secs < 10 ? `0${secs}` : secs;

  return hrs > 0 
    ? `${hrs}:${formattedMins}:${formattedSecs}` 
    : `${formattedMins}:${formattedSecs}`;
}
