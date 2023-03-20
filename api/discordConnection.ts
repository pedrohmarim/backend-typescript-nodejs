import { Client, Events, GatewayIntentBits } from "discord.js";

export default async function DiscordConnection() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    await interaction.deferReply();
  });

  client.login(process.env.DISCORD_TOKEN);
}
