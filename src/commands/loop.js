import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Changes the looping mode of the queue')
    .addStringOption(option =>
      option.setName('mode')
        .setDescription('Loop mode')
        .setRequired(true)
        .addChoices(
          { name: 'Off', value: 'none' },
          { name: 'Track', value: 'track' },
          { name: 'Queue', value: 'queue' }
        )
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

    const loopMode = interaction.options.getString('mode');
    queue.setLoopMode(loopMode);

    const modeLabels = {
      none: 'Off',
      track: 'Looping Track 🔂',
      queue: 'Looping Queue 🔁'
    };

    return interaction.reply(`🔄 Loop mode set to: **${modeLabels[loopMode]}**.`);
  }
};
