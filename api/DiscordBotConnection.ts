import { CreateGuildInstance } from "./controllers/DiscordMessagesController";
import {
  ChannelType,
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
} from "discord.js";
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
    ],
  });

  client.on("guildCreate", async (guild) => {
    const channels = await guild.channels.fetch();

    channels
      .filter(
        ({ name, parentId }) => name === "daily-discordle" && parentId === null
      )
      .forEach((channel) => channel.delete());

    const filteredChannels = await Promise.all(
      channels.map(async (channel) => {
        if (
          channel.type === ChannelType.GuildText &&
          channel.name !== "daily-discordle"
        ) {
          const messages = await channel.messages.fetch({ limit: 5 });
          const hasBotMessages = messages.some((message) => message.author.bot);

          if (messages.size === 5 && !hasBotMessages) return channel;
        }

        return null;
      })
    );

    const mappedChannelsInstance = filteredChannels
      .filter((channel) => channel !== null)
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
      channels: mappedChannelsInstance,
    };

    await CreateGuildInstance(guildInstance);

    guild.channels
      .create({
        name: "Daily Discordle",
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: guild.roles.everyone,
            allow: [PermissionFlagsBits.ViewChannel],
            deny: [
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.CreateInstantInvite,
            ],
          },
          {
            id: "1089918362311733378", //bot id
            allow: [PermissionFlagsBits.SendMessages],
          },
          {
            id: guild.ownerId,
            allow: [PermissionFlagsBits.SendMessages],
          },
        ],
      })
      .then(async (channel) => {
        const content = `Saudações! Eu sou o bot do Discordle. \n\n Serei responsável por informá-los sobre cada **atualização** diária do Discordle de ${guild.name}. \n\n Estarei a disposição para qualquer ajuda.  :robot:`;

        await channel.send(content);
      });
  });

  client.login(process.env.BOT_TOKEN);
};

export default DiscordBotConnection;
