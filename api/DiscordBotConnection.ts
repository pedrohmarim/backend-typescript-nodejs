import sqlite3 from "sqlite3";
import {
  CreateGuildInstance,
  AddPrivateChannel,
  UpdateMember,
  UpdateAvatarUrl,
} from "./controllers/DiscordMessagesController";
import {
  ChannelType,
  Client,
  GatewayIntentBits,
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

    // const discordleChannelId = channels.find(
    //   (c) => c.name === "daily-discordle" && c.type === ChannelType.GuildText
    // )?.id;

    // if (discordleChannelId)
    //   await request(
    //     `https://discord.com/api/v10/channels/${discordleChannelId}`,
    //     {
    //       method: "DELETE",
    //       headers: { authorization: `Bot ${process.env.BOT_TOKEN}` },
    //     }
    //   );

    const filteredChannels = await Promise.all(
      channels.map(async (channel) => {
        if (
          channel.type === ChannelType.GuildText &&
          channel.name !== "daily-discordle"
        ) {
          try {
            const messages = await channel.messages.fetch({ limit: 5 });

            if (messages.size === 5) return channel;
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
    await client.application.commands.create({
      name: "code",
      description: "Retorna o código único para login no Discordle.",
    });
  });

  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    if (
      oldMember.nickname !== newMember.nickname ||
      oldMember.user.username !== newMember.user.username ||
      oldMember.user.avatar !== newMember.user.avatar
    )
      await UpdateMember(
        newMember.id,
        newMember.nickname || newMember.user.username
      );
  });

  client.on("userUpdate", async (oldMember, newMember) => {
    if (oldMember.avatar !== newMember.avatar)
      await UpdateAvatarUrl(newMember.id, newMember.displayAvatarURL());
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    if (
      interaction.commandName === "code" &&
      interaction.channel.name !== "daily-discordle"
    )
      await interaction.reply({
        content: "Use este comando no chat daily-discordle!",
        ephemeral: true,
      });

    if (
      interaction.commandName === "code" &&
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

        db.close();

        interaction
          .reply({ content: "Gerando código...", ephemeral: true })
          .then(async () => {
            await interaction.editReply({
              content: `Olá, <@${interaction.user.id}>! \n\nAqui está seu código: ${code}. \n\nAté mais! :robot:`,
            });
          });
      });
    }
  });

  client.login(process.env.BOT_TOKEN);
};

export default DiscordBotConnection;
