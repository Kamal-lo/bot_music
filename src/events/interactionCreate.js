export default {
  name: 'interactionCreate',
  once: false,
  /**
   * @param {import('../structures/Client.js').MusicClient} client
   * @param {import('discord.js').Interaction} interaction
   */
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) {
      console.warn(`[WARNING] No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction, client);
    } catch (error) {
      console.error(`[COMMAND ERROR] Error executing ${interaction.commandName}:`, error);

      const errorMessage = {
        content: '❌ There was an error while executing this command!',
        ephemeral: true
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage).catch(() => null);
      } else {
        await interaction.reply(errorMessage).catch(() => null);
      }
    }
  }
};
