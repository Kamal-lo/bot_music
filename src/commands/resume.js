import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resumes the paused track'),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {import('../structures/Client.js').MusicClient} client
   */
  async execute(interaction, client) {
    const memberVoiceChannel = interaction.member.voice.channel;
    if (!memberVoiceChannel) {
      return interaction.reply({ content: '❌ You must be in a voice channel to use this command!', ephemeral: true });
    }

    const queue = client.queues.get(interaction.guildId);
    if (!queue || queue.songs.length === 0) {
      return interaction.reply({ content: '❌ There is no music playing to resume!', ephemeral: true });
    }

    const botVoiceChannel = interaction.guild.members.me.voice.channel;
    if (botVoiceChannel && botVoiceChannel.id !== memberVoiceChannel.id) {
      return interaction.reply({ content: '❌ You must be in the same voice channel as the bot to use this command!', ephemeral: true });
    }

    const resumed = queue.resume();
    if (resumed) {
      return interaction.reply('▶️ Resumed playback.');
    } else {
      return interaction.reply({ content: '❌ The music is not paused!', ephemeral: true });
    }
  }
};
