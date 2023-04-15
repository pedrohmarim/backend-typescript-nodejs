import { Request, Response } from "express";
import { request, FormData } from "undici";
import MessageInstanceModel from "../models/MessageInstanceModel";
import GuildInstanceModel from "../models/GuildInstanceModel";
import ScoreInstanceModel from "../models/ScoreInstanceModel";
import moment from "moment-timezone";
import sqlite3 from "sqlite3";
import {
  IAwnser,
  IGetTableResponse,
  IRankingTableData,
  IScoreInstance,
  IUserScoreDetail,
} from "interfaces/IScore";
import {
  IGuildInstance,
  IInstanceChannel,
  IMember,
} from "interfaces/IGuildInstance";
import {
  IChannel,
  IMessage,
  IMessageInstance,
  IGuild,
  IAuthor,
} from "../interfaces/IMessage";

const authToken = `Bot ${process.env.BOT_TOKEN}`;

//#region GetDiscordMessages

async function handleDistinctAuthorArray(
  messages: IMessage[],
  guildId: string,
  channelId: string
): Promise<IAuthor[]> {
  const authorsId: string[] = [];

  messages.forEach(({ author }) => {
    if (!author) return;

    const { bot, id } = author;

    if (!bot && !authorsId.find((authorId) => authorId === id))
      authorsId.push(author.id);
  });

  const guildInstance: IGuildInstance = await GuildInstanceModel.findOne({
    guildId,
  });

  const channel: IInstanceChannel = guildInstance.channels.find(
    (channel) => channel.channelId === channelId
  );

  const authors = channel.members
    .map((member) => {
      if (authorsId.includes(member.id))
        return {
          id: member.id,
          username: member.username,
          avatarUrl: member.avatarUrl,
        } as IAuthor;

      return null;
    })
    .filter((author) => author);

  console.log("authors", authors);

  return authors;
}

async function handleGetPreviousMessageArray(
  id: string,
  instanceUrl: string,
  authToken: string
) {
  const result = await request(`${instanceUrl}&before=${id}`, {
    headers: { authorization: authToken },
  });

  const messages: IMessage[] = await result.body.json();

  return messages;
}

async function handleDeleteYesterdayMessages(channelId: string) {
  await MessageInstanceModel.findOneAndDelete({ channelId });
}

async function GetServerName(channelId: string, authToken: string) {
  const channelResult = await request(
    `https://discord.com/api/channels/${channelId}`,
    {
      headers: { authorization: authToken },
    }
  );

  const channel: IChannel = await channelResult.body.json();

  const guildResult = await request(
    `https://discord.com/api/guilds/${channel.guild_id}`,
    {
      headers: { authorization: authToken },
    }
  );

  const guild: IGuild = await guildResult.body.json();

  return {
    serverName: `${guild.name} - #${channel.name}`,
    serverIcon: `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.webp`,
  };
}

async function AddPrivateChannel(
  guildId: string,
  privateChannel: IInstanceChannel
) {
  const guildInstance = await GuildInstanceModel.findOne({ guildId });

  if (
    !guildInstance?.channels.some(
      (c) => c.channelId === privateChannel.channelId
    )
  ) {
    const query = { guildId };
    const update = { $push: { channels: privateChannel } };
    const options = { upsert: true };

    await GuildInstanceModel.updateOne(query, update, options);
  }
}

function getRandomUniquePositions(max: number, count: number): number[] {
  const result = [];
  const minDistance = Math.ceil(max / count);

  while (result.length < count) {
    const randomIndex = Math.floor(Math.random() * max);
    const lastResultIndex = result[result.length - 1];
    const distance = Math.abs(randomIndex - lastResultIndex);

    if (distance >= minDistance || result.length === 0) {
      if (!result.includes(randomIndex)) result.push(randomIndex);
    }
  }

  return result;
}

async function handleLoopForChooseFiveMessages(
  channelId: string,
  guildId: string
) {
  const instanceUrl = `https://discord.com/api/v10/channels/${channelId}/messages?limit=100`;

  const result = await request(`${instanceUrl}`, {
    headers: { authorization: authToken },
  });

  let firstHundredMessages: IMessage[] = await result.body.json();
  let messages: IMessage[] = [];

  // maximo de 2000 mensagens
  for (let index = 1; index <= 20; index++) {
    const lastElementId = messages.length
      ? messages[messages.length - 1].id
      : firstHundredMessages[firstHundredMessages.length - 1].id;

    const previousArray = await handleGetPreviousMessageArray(
      lastElementId,
      instanceUrl,
      authToken
    );

    messages = messages.concat(previousArray);

    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  if (!messages.length) messages = firstHundredMessages;

  messages = messages.filter((message) => {
    const isSticker = message.sticker_items?.length;
    const isServerEmoji = message.content?.includes("<:");
    const isBot = message.author?.bot;
    const allEqualCharacters = /^(.)\1+$/.test(message.content);
    const shortMessage =
      !message.attachments?.length && message.content?.length < 15;
    const hasOnlyOneMention =
      message.content?.split("<@").length - 1 === 1 &&
      !message.attachments?.length;

    if (
      !isSticker &&
      !isServerEmoji &&
      !allEqualCharacters &&
      !isBot &&
      !shortMessage &&
      !hasOnlyOneMention
    )
      return message;
  });

  const randomPositions = getRandomUniquePositions(messages.length - 1, 5);

  const choosedMessages: IMessage[] = [];

  for (let i = 0; i < 5; i++) {
    choosedMessages.push(messages[randomPositions[i]]);
  }

  const serverNameAndIcon = await GetServerName(channelId, authToken);

  const { serverIcon, serverName } = serverNameAndIcon;

  const messageInstance: IMessageInstance = {
    messages: choosedMessages,
    authors: await handleDistinctAuthorArray(messages, guildId, channelId),
    serverName,
    serverIcon,
    guildId,
    channelId,
  };

  await MessageInstanceModel.create(messageInstance);
}

//#endregion GetDiscordMessages

//#region GetHints
async function GetHints(req: Request, res: Response) {
  const { id, channelId } = req.query;

  const instanceUrl = `https://discord.com/api/v10/channels/${channelId}/messages?limit=50&around=${id}`;

  const result = await request(instanceUrl, {
    headers: { authorization: authToken },
  });

  const messages: IMessage[] = await result.body.json();

  const messageIndex = messages.findIndex((x) => x.id === id);

  const previousPosition = messages[messageIndex - 1];
  const consecutivePosition = messages[messageIndex + 1];

  return res.json({ previousPosition, consecutivePosition });
}
//#endregion GetHints

//#region GetChoosedMessages
async function GetChoosedMessages(req: Request, res: Response) {
  const { channelId } = req.query;

  const messageInstance: IMessageInstance = await MessageInstanceModel.findOne({
    channelId,
  })
    .select("messages authors channelId serverName serverIcon -_id")
    .lean();

  const choosedMessages: IMessageInstance = {
    guildId: messageInstance.guildId,
    channelId: messageInstance.channelId,
    serverIcon: messageInstance.serverIcon,
    serverName: messageInstance.serverName,
    authors: messageInstance.authors,
    messages: messageInstance.messages.map((message: IMessage) => {
      return {
        content: message.content,
        attachments: message.attachments,
        mentions: message.mentions,
        timestamp: message.timestamp,
        id: message.id,
        sticker_items: message.sticker_items,
        author: {
          username: message.author.username,
          id: message.author.id,
        },
      } as IMessage;
    }),
  };

  return res.json(choosedMessages);
}
//#endregion

//#region SaveScore
async function getAwnser(userId: string, channelId: string) {
  const currentDate = new Date().toLocaleDateString("pt-br", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const scoreInstance: IScoreInstance = await ScoreInstanceModel.findOne({
    channelId,
  }).lean();

  if (!scoreInstance) return [] as IAwnser[];

  const currentDayAwnsers = scoreInstance.scores.find(
    (x) => x.member.id === userId && x.date === currentDate
  );

  if (!currentDayAwnsers) return [] as IAwnser[];

  return currentDayAwnsers.scoreDetails.map(({ score, success, tabKey }) => {
    return {
      score,
      success,
      tabKey,
    } as IAwnser;
  });
}

async function VerifyAlreadyAwnsered(req: Request, res: Response) {
  const { userId, channelId } = req.query;

  const currentDayAwnsers = await getAwnser(
    userId.toString(),
    channelId.toString()
  );

  return res.json(currentDayAwnsers);
}

async function findDailyDiscordleChannelId(guildId: string) {
  const url = `https://discord.com/api/v10/guilds/${guildId}/channels`;

  const result = await request(url, {
    headers: { authorization: authToken },
  });

  const channels: IChannel[] = await result.body.json();

  const dailyDiscordleChannelId = channels.find(
    ({ name }) => name === "daily-discordle"
  ).id;

  return dailyDiscordleChannelId;
}

async function SendScoreMessageOnDailyDiscordle(
  guildId: string,
  channelId: string,
  userId: string,
  scoreDetails: IAwnser[]
) {
  const dailyDiscordleChannelId = await findDailyDiscordleChannelId(guildId);

  const body = new FormData();

  let scoreEmojis = "";

  const totalScore = scoreDetails.reduce((accumulator, curValue) => {
    return accumulator + curValue.score;
  }, 0);

  scoreDetails.forEach(({ success, score }) => {
    scoreEmojis += success
      ? score === 2
        ? ":green_square: "
        : ":orange_square: "
      : ":red_square: ";
  });

  const today = new Date().toLocaleDateString("pt-br", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const content = `<@${userId}> respondeu o Discordle diário! (${today}) \n\nPontuação: ${totalScore} \n\n   **1**     **2**     **3**    **4**     **5** \n ${scoreEmojis} \n\nResponda você também! \nhttps://discordlle.vercel.app/game?channelId=${channelId}&guildId=${guildId}`;

  body.append("content", content);

  await request(
    `https://discord.com/api/v10/channels/${dailyDiscordleChannelId}/messages`,
    {
      method: "POST",
      body,
      headers: { authorization: authToken },
    }
  );
}

async function SaveScore(req: Request, res: Response) {
  const { scores, channelId, guildId } = req.body;

  const currentDayAwnsers = await getAwnser(
    scores.userId.toString(),
    channelId
  );

  const guildInstance = await GuildInstanceModel.findOne({
    guildId,
  }).lean();

  const channel = guildInstance.channels.find((c) => c.channelId === channelId);

  const member = channel.members.find(
    (member: IMember) => member.id === scores.userId
  );

  if (currentDayAwnsers.length) {
    currentDayAwnsers.push(scores.scoreDetails);

    const today = new Date().toLocaleDateString("pt-br", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    await ScoreInstanceModel.updateOne(
      {
        scores: { $elemMatch: { date: today, "member.id": member.id } },
        channelId,
      },
      { $push: { "scores.$.scoreDetails": scores.scoreDetails } }
    );

    if (currentDayAwnsers.length === 5) {
      await SendScoreMessageOnDailyDiscordle(
        guildId,
        channelId,
        member.id,
        currentDayAwnsers
      );

      return res.json(true).status(200);
    }
  } else {
    const query = { channelId };
    const update = {
      guildId,
      member,
      $push: { scores: { ...scores, member } },
    };
    const options = { upsert: true };

    await ScoreInstanceModel.findOneAndUpdate(query, update, options);
  }

  return res.json(false).status(200);
}

//#endregion

async function GetDiscordleChannelName(channelId: string, guildId: string) {
  const url = `https://discord.com/api/v10/guilds/${guildId}/channels`;

  const result = await request(url, {
    headers: { authorization: authToken },
  });

  const channels: IChannel[] = await result.body.json();

  const channelName = channels.find(({ id }) => id === channelId).name;

  return channelName;
}

//#region SendNewDiscordleMessagesAvaible
async function sendNewDiscordleMessagesAvaible(
  channelId: string,
  guildId: string
) {
  const body = new FormData();

  const dailyDiscordleChannelId = await findDailyDiscordleChannelId(guildId);

  const channelName = await GetDiscordleChannelName(channelId, guildId);

  const today = new Date().toLocaleDateString("pt-br", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const content = `:warning:  AVISO!  :warning: \n\nNOVO DISCORDLE DE **#${channelName}** JÁ DISPONÍVEL!!! (${today}) \n\nResponda agora mesmo! \n\nhttps://discordlle.vercel.app/game?channelId=${channelId}&guildId=${guildId} \n\nAté mais.  :robot:`;

  body.append("content", content);

  await request(
    `https://discord.com/api/v10/channels/${dailyDiscordleChannelId}/messages`,
    {
      method: "POST",
      body,
      headers: { authorization: authToken },
    }
  );
}
//#endregion

//#region Timer
let timer = "";

function GetTimer(req: Request, res: Response) {
  const { guildId, channelId } = req.query;

  if (!timer.length) {
    const timeLeft = updateMessagesAtMidnight(
      channelId.toString(),
      guildId.toString(),
      true
    );
    return res.json(timeLeft);
  }
  return res.json(timer);
}

function updateMessagesAtMidnight(
  channelId: string,
  guildId: string,
  nullTimer = false
) {
  const now = moment.tz("America/Sao_Paulo");

  const timeUntilMidnight = moment.duration({
    hours: 23 - now.hours(),
    minutes: 59 - now.minutes(),
    seconds: 59 - now.seconds(),
    milliseconds: 1000 - now.milliseconds(),
  });

  let timeLeft = moment
    .utc(timeUntilMidnight.asMilliseconds())
    .format("HH:mm:ss");

  setInterval(() => {
    timeUntilMidnight.subtract(1, "second");

    timeLeft = moment
      .utc(timeUntilMidnight.asMilliseconds())
      .format("HH:mm:ss");

    timer = timeLeft;
    console.log(`Tempo restante até a meia-noite: ${timeLeft}`);
  }, 1000);

  const msUntilMidnight = timeUntilMidnight.asMilliseconds();

  setTimeout(async () => {
    await handleDeleteYesterdayMessages(channelId);

    await handleLoopForChooseFiveMessages(channelId, guildId);

    await sendNewDiscordleMessagesAvaible(channelId, guildId);
  }, msUntilMidnight);

  if (nullTimer) return timeLeft;
}
//#endregion

//#region DiscordleInstance

async function GetInstanceChannels(req: Request, res: Response) {
  const { guildId } = req.query;

  const guildInstance: IGuildInstance = await GuildInstanceModel.findOne({
    guildId,
  })
    .select("channels -_id")
    .lean();

  const filteredChannels =
    guildInstance?.channels.map(({ channelName, channelId, notListed }) => {
      return {
        channelName,
        channelId,
        notListed,
      };
    }) || [];

  return res.json(filteredChannels);
}

async function GetChannelMembers(req: Request, res: Response) {
  const { guildId, channelId } = req.query;

  const guildInstance = await GuildInstanceModel.findOne({
    guildId,
  }).lean();

  if (!guildInstance?.channels.length) return res.json([]);

  const channel = guildInstance.channels.find((c) => c.channelId === channelId);

  const members = channel.members.map(({ id, username, avatarUrl }) => ({
    id,
    username,
    avatarUrl,
  }));

  return res.json(members);
}

async function CreateGuildInstance(guildInstance: IGuildInstance) {
  await GuildInstanceModel.create(guildInstance);
}

async function sendCreatedInstanceMessage(channelId: string, guildId: string) {
  const dailyDiscordleChannelId = await findDailyDiscordleChannelId(guildId);

  const channelName = await GetDiscordleChannelName(channelId, guildId);

  const body = new FormData();

  const content = `A instância do canal **#${channelName}** foi criada! :white_check_mark: \n\nAgora é só começar a jogar! \n\nhttps://discordlle.vercel.app/chooseProfile?channelId=${channelId}&guildId=${guildId} \n\nAté mais.  :robot:`;

  body.append("content", content);

  await request(
    `https://discord.com/api/v10/channels/${dailyDiscordleChannelId}/messages`,
    {
      method: "POST",
      body,
      headers: { authorization: authToken },
    }
  );
}

async function CreateDiscordleInstance(req: Request, res: Response) {
  const { channelId, guildId } = req.body;

  await GuildInstanceModel.updateMany(
    {},
    { $set: { "channels.$[].notListed": false } }
  );

  const messages = await MessageInstanceModel.find({ channelId });

  if (!messages.length) {
    await handleLoopForChooseFiveMessages(channelId, guildId);

    await sendCreatedInstanceMessage(channelId.toString(), guildId.toString());
  }

  updateMessagesAtMidnight(channelId.toString(), guildId.toString());

  return res.json().status(200);
}

//#endregion

//#region GetDiscordleHistory

async function GetDiscordleHistory(req: Request, res: Response) {
  const { channelId, guildId } = req.query;

  const scoreInstance: IScoreInstance = await ScoreInstanceModel.findOne({
    channelId,
  }).lean();

  if (!scoreInstance?.scores) return res.json([]);

  const membersData: Record<string, IRankingTableData> =
    scoreInstance.scores.reduce(
      (
        acc: Record<string, IRankingTableData>,
        { member, scoreDetails, _id }
      ) => {
        const totalScore = scoreDetails.reduce((accumulator, curValue) => {
          return accumulator + curValue.score;
        }, 0);

        if (acc[member.id]) acc[member.id].totalScore += totalScore;
        else {
          acc[member.id] = {
            rowId: _id,
            member: {
              avatarUrl: member.avatarUrl,
              username: member.username,
              userId: member.id,
            },
            totalScore,
            position: 0,
          };
        }

        return acc;
      },
      {}
    );

  const rankingTableData: IRankingTableData[] = Object.values(membersData)
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((data, index, array) => {
      switch (index) {
        case 0:
          data.position = 1;
          break;
        case 1:
          data.position = 2;
          break;
        case 2:
          data.position = 3;
          break;
        default:
          data.position = index + 1;
          break;
      }

      // tratamento para empates
      if (data.totalScore === array[index - 1]?.totalScore) {
        data.position = array[index - 1].position;
      }

      return data;
    });

  const guildInstance: IGuildInstance = await GuildInstanceModel.findOne({
    guildId,
  }).lean();

  const channelName = guildInstance.channels.find(
    (channel) => channel.channelId === channelId
  ).channelName;

  return res.json({ channelName, rankingTableData } as IGetTableResponse);
}

async function UpdateMemberUsername(
  guildId: string,
  memberId: string,
  username: string
) {
  const query = { guildId, "channels.members.id": memberId };
  const update = {
    $set: {
      "channels.$[channel].members.$[member].username": username,
    },
  };
  const options = {
    arrayFilters: [
      { "channel.members.id": memberId },
      { "member.id": memberId },
    ],
  };

  await GuildInstanceModel.updateMany(query, update, options);

  const queryMessage = { guildId, "authors.id": memberId };
  const updateMessage = {
    $set: {
      "authors.$[author].username": username,
    },
  };
  const optionsMessage = {
    arrayFilters: [{ "author.id": memberId }, { id: memberId }],
  };

  await MessageInstanceModel.updateMany(
    queryMessage,
    updateMessage,
    optionsMessage
  );

  const queryScore = { guildId, "scores.member.id": memberId };
  const updateScore = {
    $set: {
      "scores.$[score].member.username": username,
    },
  };
  const optionsScore = {
    arrayFilters: [{ "score.member.id": memberId }, { "member.id": memberId }],
  };

  await ScoreInstanceModel.updateMany(queryScore, updateScore, optionsScore);
}

async function UpdateAvatarUrl(memberId: string, avatarUrl: string) {
  const query = { "channels.members.id": memberId };
  const update = {
    $set: {
      "channels.$[channel].members.$[member].avatarUrl": avatarUrl,
    },
  };
  const options = {
    arrayFilters: [
      { "channel.members.id": memberId },
      { "member.id": memberId },
    ],
  };

  await GuildInstanceModel.updateMany(query, update, options);

  const queryMessage = { "authors.id": memberId };
  const updateMessage = {
    $set: {
      "authors.$[author].avatarUrl": avatarUrl,
    },
  };
  const optionsMessage = {
    arrayFilters: [{ "author.id": memberId }, { id: memberId }],
  };

  await MessageInstanceModel.updateMany(
    queryMessage,
    updateMessage,
    optionsMessage
  );

  const queryScore = { "scores.member.id": memberId };
  const updateScore = {
    $set: {
      "scores.$[score].member.avatarUrl": avatarUrl,
    },
  };
  const optionsScore = {
    arrayFilters: [{ "score.member.id": memberId }, { "member.id": memberId }],
  };

  await ScoreInstanceModel.updateMany(queryScore, updateScore, optionsScore);
}

async function GetUserScoreDetail(req: Request, res: Response) {
  const { userId, channelId } = req.query;

  const scoreInstance: IScoreInstance = await ScoreInstanceModel.findOne({
    channelId,
  }).lean();

  if (!scoreInstance?.scores) return res.json([]);

  const result: IUserScoreDetail[] = scoreInstance.scores
    .filter(({ member }) => member.id === userId)
    .map(({ date, scoreDetails, _id }) => {
      return {
        rowId: _id,
        date,
        scoreDetails,
      } as IUserScoreDetail;
    })
    .sort(
      (a, b) =>
        new Date(a.date.split("/").reverse().join("-")).getTime() -
        new Date(b.date.split("/").reverse().join("-")).getTime() -
        new Date().getTime()
    );

  return res.json(result);
}

//#endregion

async function ValidateToken(req: Request, res: Response) {
  const { token, userId } = req.query;

  var db = new sqlite3.Database("code_database");

  db.serialize(() => {
    db.all(
      `SELECT userid, code FROM UsersCode WHERE userid = ${userId} AND code = ${token}`,
      (err, rows) => {
        if (err) {
          db.close();
          return res.json(false);
        }

        if (rows.length > 0) {
          db.run(`DELETE FROM UsersCode WHERE userid = ${userId}`, (err) => {
            db.close();
            if (err) {
              return res.json(false);
            } else {
              return res.json(true);
            }
          });
        } else {
          db.close();
          return res.json(false);
        }
      }
    );
  });
}

export {
  UpdateAvatarUrl,
  UpdateMemberUsername,
  ValidateToken,
  GetUserScoreDetail,
  GetDiscordleHistory,
  CreateGuildInstance,
  GetChannelMembers,
  SaveScore,
  GetHints,
  handleDeleteYesterdayMessages,
  GetChoosedMessages,
  handleLoopForChooseFiveMessages,
  GetTimer,
  VerifyAlreadyAwnsered,
  GetInstanceChannels,
  AddPrivateChannel,
  CreateDiscordleInstance,
};
