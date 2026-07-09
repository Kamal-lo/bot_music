import { Client, GatewayIntentBits, Collection } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MusicClient extends Client {
  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages
      ]
    });

    this.commands = new Collection();
    // Maps GuildID -> MusicQueue instance
    this.queues = new Map();
  }

  /**
   * Load all commands from src/commands/
   */
  async loadCommands() {
    const commandsPath = path.join(__dirname, '..', 'commands');
    if (!fs.existsSync(commandsPath)) {
      fs.mkdirSync(commandsPath, { recursive: true });
    }

    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      // Using pathToFileURL to get a valid URL for ESM import on Windows
      const fileUrl = pathToFileURL(filePath).href;
      try {
        const { default: command } = await import(fileUrl);
        if (command && command.data && typeof command.execute === 'function') {
          this.commands.set(command.data.name, command);
        } else {
          console.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
      } catch (error) {
        console.error(`[ERROR] Failed to load command at ${filePath}:`, error);
      }
    }
    console.log(`[SUCCESS] Loaded ${this.commands.size} commands.`);
  }

  /**
   * Load all events from src/events/
   */
  async loadEvents() {
    const eventsPath = path.join(__dirname, '..', 'events');
    if (!fs.existsSync(eventsPath)) {
      fs.mkdirSync(eventsPath, { recursive: true });
    }

    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    let count = 0;
    for (const file of eventFiles) {
      const filePath = path.join(eventsPath, file);
      const fileUrl = pathToFileURL(filePath).href;
      try {
        const { default: event } = await import(fileUrl);
        if (event && typeof event.name === 'string' && typeof event.execute === 'function') {
          if (event.once) {
            this.once(event.name, (...args) => event.execute(this, ...args));
          } else {
            this.on(event.name, (...args) => event.execute(this, ...args));
          }
          count++;
        } else {
          console.warn(`[WARNING] The event at ${filePath} is missing a required "name" or "execute" property.`);
        }
      } catch (error) {
        console.error(`[ERROR] Failed to load event at ${filePath}:`, error);
      }
    }
    console.log(`[SUCCESS] Loaded ${count} events.`);
  }
}
