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
    )?.id;

    if (discordleChannelId)
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

    guild.channels
      .create({
        name: "Daily Discordle",
        type: ChannelType.GuildText,
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

        if (messages.size === 5)
          await AddPrivateChannel(channel.guild.id, privateChannel);
      }
    } catch {
      return null;
    }
  });

  client.on("ready", async () => {
    client.application.commands.set([]);

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
      var db = new sqlite3.Database("code_database");

      db.serialize(async () => {
        const MIN_VALUE = 10000;
        const MAX_VALUE = 99999;

        const randomNum =
          Math.floor(Math.random() * (MAX_VALUE - MIN_VALUE + 1)) + MIN_VALUE;

        const code = randomNum.toString();

        db.run(
          "CREATE TABLE IF NOT EXISTS UsersCode (id INTEGER PRIMARY KEY AUTOINCREMENT, userid TEXT, code TEXT)"
        );

        db.each(`DELETE FROM UsersCode WHERE userid = ${interaction.user.id}`);

        db.run(
          `INSERT INTO UsersCode (userid, code) VALUES (${interaction.user.id}, ${code})`
        );

        const content = `Olá, <@${interaction.user.id}>! \n\nAqui está seu código: ${code}. \n\nAté mais! :robot:`;

        try {
          await interaction.reply({
            content,
            ephemeral: true,
            flags: MessageFlags.Ephemeral,
          });
        } catch {
          await interaction.reply({
            content:
              "Falha ao gerar seu código :frowning: \n\nTente novamente mais tarde.",
            ephemeral: true,
            flags: MessageFlags.Ephemeral,
          });
        } finally {
          db.close();
        }
      });
    }
  });

  client.login(process.env.BOT_TOKEN);
};

export default DiscordBotConnection;
