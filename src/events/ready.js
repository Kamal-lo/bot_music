import { ActivityType } from 'discord.js';

export default {
  name: 'ready',
  once: true,
  /**
   * @param {import('../structures/Client.js').MusicClient} client
   */
  async execute(client) {
    console.log(`[READY] Logged in as ${client.user.tag}!`);

    // Set activity
    client.user.setActivity({
      name: 'music | /play',
      type: ActivityType.Listening
    });

    try {
      const commandsData = client.commands.map(cmd => cmd.data.toJSON());

      if (process.env.GUILD_ID) {
        const guildIds = process.env.GUILD_ID.split(',').map(id => id.trim());
        for (const guildId of guildIds) {
          if (!guildId) continue;
          const guild = await client.guilds.fetch(guildId).catch(() => null);
          if (guild) {
            await guild.commands.set(commandsData);
            console.log(`[READY] Successfully registered ${commandsData.length} slash commands locally in guild: ${guild.name} (${guild.id})`);
          } else {
            console.warn(`[WARNING] GUILD_ID is specified in .env, but the bot is not in a guild with ID ${guildId}.`);
          }
        }
      } else {
        await client.application.commands.set(commandsData);
        console.log(`[READY] Successfully registered ${commandsData.length} slash commands globally.`);
      }
    } catch (error) {
      console.error('[ERROR] Failed to register slash commands:', error);
    }
  }
};
