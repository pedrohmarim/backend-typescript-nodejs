import sqlite3 from "sqlite3";
import { request } from "undici";
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

    const discordleChannelId = channels.find(
      (c) => c.name === "daily-discordle" && c.type === ChannelType.GuildText
    ).id;

    await request(
      `https://discord.com/api/v10/channels/${discordleChannelId}`,
      {
        method: "DELETE",
        headers: { authorization: `Bot ${process.env.BOT_TOKEN}` },
      }
    );

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

    const existingChannel = channels.find(
      (c) => c.name === "daily-discordle" && c.type === ChannelType.GuildText
    );

    if (existingChannel) return;

    await guild.channels
      .create({
        name: "daily-discordle",
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
      name: "getcode",
      description: "Retorna o código único para login no Discordle.",
    });
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    if (
      interaction.commandName === "getcode" &&
      interaction.channel.name !== "daily-discordle"
    )
      await interaction.reply({
        content: "Use este comando no chat daily-discordle!",
        ephemeral: true,
        flags: MessageFlags.Ephemeral,
      });

    if (
      interaction.commandName === "getcode" &&
      interaction.channel.name === "daily-discordle"
    ) {
      const MIN_VALUE = 10000;
      const MAX_VALUE = 99999;

      const randomNum =
        Math.floor(Math.random() * (MAX_VALUE - MIN_VALUE + 1)) + MIN_VALUE;

      const code = randomNum.toString();

      var db = new sqlite3.Database("code_database");

      db.serialize(() => {
        db.run(
          "CREATE TABLE IF NOT EXISTS UsersCode (id INTEGER PRIMARY KEY AUTOINCREMENT, userid TEXT, code TEXT)"
        );

        db.each(`DELETE FROM UsersCode WHERE userid = ${interaction.user.id}`);

        db.run(
          `INSERT INTO UsersCode (userid, code) VALUES (${interaction.user.id}, ${code})`
        );
      });

      const message = `Olá, <@${interaction.user.id}>! \n\n Aqui está seu código: ${code} \n\n Até mais! :robot:`;

      try {
        await interaction.reply({
          content: message,
          ephemeral: true,
          flags: MessageFlags.Ephemeral,
        });

        db.close();
      } catch {
        return;
      }
    }
  });

  client.login(process.env.BOT_TOKEN);
};

export default DiscordBotConnection;
