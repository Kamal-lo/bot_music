import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Displays the current music queue'),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {import('../structures/Client.js').MusicClient} client
   */
  async execute(interaction, client) {
    const queue = client.queues.get(interaction.guildId);

    if (!queue || queue.songs.length === 0) {
      return interaction.reply({ content: '📭 The queue is currently empty!', ephemeral: true });
    }

    const currentSong = queue.songs[0];
    const incomingSongs = queue.songs.slice(1);

    const embed = new EmbedBuilder()
      .setColor('#1DB954') // Premium Spotify Green accent
      .setTitle(`Queue for ${interaction.guild.name}`)
      .setDescription(`**Now Playing:**\n[${currentSong.title}](${currentSong.url}) | \`${currentSong.duration}\` (Requested by <@${currentSong.requestedBy}>)`)
      .setThumbnail(currentSong.thumbnail);

    if (incomingSongs.length > 0) {
      const songsList = incomingSongs
        .slice(0, 10)
        .map((song, index) => `**${index + 1}.** [${song.title}](${song.url}) | \`${song.duration}\` (Requested by <@${song.requestedBy}>)`)
        .join('\n');

      let listText = songsList;
      if (incomingSongs.length > 10) {
        listText += `\n\n*... and ${incomingSongs.length - 10} more song(s)*`;
      }
      embed.addFields({ name: '👉 Up Next:', value: listText });
    } else {
      embed.addFields({ name: '👉 Up Next:', value: 'No songs in queue. Add more with `/play`!' });
    }

    // Add footer for details
    const loopStatus = queue.loopMode === 'track' ? '🔂 Loop: Track' : queue.loopMode === 'queue' ? '🔁 Loop: Queue' : '➡️ Loop: Off';
    embed.setFooter({ text: `${queue.songs.length} song(s) in queue | ${loopStatus} | Volume: ${Math.round(queue.volume * 100)}%` });

    return interaction.reply({ embeds: [embed] });
  }
};
