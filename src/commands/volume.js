import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Changes the playback volume')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Volume level from 0 to 100')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(100)
    ),

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
      return interaction.reply({ content: '❌ There is no active music playing!', ephemeral: true });
    }

    const botVoiceChannel = interaction.guild.members.me.voice.channel;
    if (botVoiceChannel && botVoiceChannel.id !== memberVoiceChannel.id) {
      return interaction.reply({ content: '❌ You must be in the same voice channel as the bot to use this command!', ephemeral: true });
    }

    const volumeAmount = interaction.options.getInteger('amount');
    queue.setVolume(volumeAmount);

    return interaction.reply(`🔊 Volume set to **${volumeAmount}%**.`);
  }
};
