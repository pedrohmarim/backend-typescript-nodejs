import {
  CreateGuildInstance,
  AddPrivateChannel,
} from "./controllers/DiscordMessagesController";
import {
  ChannelType,
  Client,
  GatewayIntentBits,
  MessageFlags,
  NonThreadGuildBasedChannel,
  PermissionFlagsBits,
} from "discord.js";
import {
  IGuildInstance,
  IInstanceChannel,
  IMember,
} from "interfaces/IGuildInstance";
import sqlite3 from "sqlite3";

const DiscordBotConnection = async () => {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
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
          try {
            const messages = await channel.messages.fetch({ limit: 5 });
            const hasBotMessages = messages.some(
              (message) => message.author.bot
            );
            if (messages.size === 5 && !hasBotMessages) return channel;
          } catch {
            return null;
          }
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
        } as IInstanceChannel;
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
            id: client.user.id,
            allow: [PermissionFlagsBits.SendMessages],
          },
          {
            id: guild.ownerId,
            allow: [PermissionFlagsBits.SendMessages],
          },
        ],
      })
      .then(async (channel) => {
        const content = `Saudações! Eu sou o bot do Discordle. \n\nSerei responsável por informá-los sobre cada **atualização** diária do Discordle de ${guild.name}. \n\nEstarei a disposição para qualquer ajuda.  :robot:`;

        await channel.send(content);
      });
  });

  client.on("channelUpdate", async (channel: NonThreadGuildBasedChannel) => {
    try {
      if (
        channel.type === ChannelType.GuildText &&
        channel.name !== "daily-discordle"
      ) {
        const messages = await channel.messages.fetch({ limit: 5 });
        const hasBotMessages = messages.some((message) => message.author.bot);

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

        const privateChannel: IInstanceChannel = {
          channelId: channel.id,
          channelName: channel.name,
          members,
          notListed: true,
        };

        if (messages.size === 5 && !hasBotMessages)
          await AddPrivateChannel(channel.guild.id, privateChannel);
      }
    } catch {
      return null;
    }
  });

  client.on("ready", async () => {
    await client.application.commands.create({
      name: "code",
      description: "Retorna o código único para login no Discordle.",
    });
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand() || interaction.commandName !== "code") return;

    const MIN_VALUE = 10000;
    const MAX_VALUE = 99999;

    const randomNum =
      Math.floor(Math.random() * (MAX_VALUE - MIN_VALUE + 1)) + MIN_VALUE;

    const code = randomNum.toString();

    const message = `Olá, <@${interaction.user.id}>! \n\n Aqui está seu código: ${code} \n\n Até mais! :robot:`;

    var db = new sqlite3.Database("code_database");

    db.serialize(() => {
      db.run(
        "CREATE TABLE IF NOT EXISTS UsersCode (id INTEGER PRIMARY KEY AUTOINCREMENT, userid TEXT, code TEXT)"
      );

      db.run(`DELETE FROM UsersCode WHERE userid = ?`, [interaction.user.id]);

      db.run(
        `INSERT INTO UsersCode (userid, code) VALUES (${interaction.user.id}, ${code})`
      );
    });

    db.close();

    await interaction.reply({
      content: message,
      ephemeral: true,
      flags: MessageFlags.Ephemeral,
    });
  });

  client.login(process.env.BOT_TOKEN);
};

export default DiscordBotConnection;
