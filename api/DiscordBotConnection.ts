import { CreateGuildInstance } from "./controllers/DiscordMessagesController";
import { ChannelType, Client, GatewayIntentBits } from "discord.js";
import {
  IGuildInstance,
  IInstanceChannels,
  IMember,
} from "interfaces/IGuildInstance";

const DiscordBotConnection = async () => {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildPresences,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.on("guildCreate", async (guild) => {
    const channels = await guild.channels.fetch();

    const mappedChannelsInstance = channels
      .filter((channel) => channel.type === ChannelType.GuildText)
      .map((channel) => {
        const members: IMember[] = channel.members
          .filter((x) => !x.user.bot)
          .map((member) => {
            return {
              id: member.id,
              username: member.nickname || member.user.username,
              avatarUrl: member.displayAvatarURL(),
              inUse: false,
            } as IMember;
          });

        return {
          channelId: channel.id,
          channelName: channel.name,
          members,
        } as IInstanceChannels;
      });

    const guildInstance: IGuildInstance = {
      guildId: guild.id,
      guildName: guild.name,
      channels: mappedChannelsInstance,
    };

    await CreateGuildInstance(guildInstance);
  });

  client.login(process.env.BOT_TOKEN);
};

export default DiscordBotConnection;
