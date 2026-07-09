import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skips the current song'),

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
      return interaction.reply({ content: '❌ There is no music playing to skip!', ephemeral: true });
    }

    const botVoiceChannel = interaction.guild.members.me.voice.channel;
    if (botVoiceChannel && botVoiceChannel.id !== memberVoiceChannel.id) {
      return interaction.reply({ content: '❌ You must be in the same voice channel as the bot to use this command!', ephemeral: true });
    }

    const skipped = queue.skip();
    if (skipped) {
      const currentSong = queue.songs[0];
      return interaction.reply(`⏭️ Skipped **${currentSong.title}**.`);
    } else {
      return interaction.reply({ content: '❌ Could not skip the song!', ephemeral: true });
    }
  }
};
