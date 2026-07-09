import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stops the music, clears the queue, and disconnects the bot'),

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
    if (!queue) {
      return interaction.reply({ content: '❌ The bot is not currently in a voice channel!', ephemeral: true });
    }

    const botVoiceChannel = interaction.guild.members.me.voice.channel;
    if (botVoiceChannel && botVoiceChannel.id !== memberVoiceChannel.id) {
      return interaction.reply({ content: '❌ You must be in the same voice channel as the bot to use this command!', ephemeral: true });
    }

    queue.stop();
    return interaction.reply('🛑 Stopped playback, cleared the queue, and left the voice channel.');
  }
};
