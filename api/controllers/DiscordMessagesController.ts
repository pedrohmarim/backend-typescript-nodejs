import { Request, Response } from "express";
import { request, FormData } from "undici";
import MessageInstanceModel from "../models/MessageInstanceModel";
import GuildInstanceModel from "../models/GuildInstanceModel";
import ScoreInstanceModel from "../models/ScoreInstanceModel";
import moment from "moment-timezone";
import {
  IAwnser,
  IRankingTableData,
  IScoreInstance,
  IUserScoreDetail,
} from "interfaces/IScore";
import { IGuildInstance } from "interfaces/IGuildInstance";
import {
  IChannel,
  IGetDiscordMessagesResponse,
  IMessage,
  IMessageInstance,
  IGuild,
} from "../interfaces/IMessage";

const authToken = `Bot ${process.env.BOT_TOKEN}`;

//#region GetDiscordMessages
const range = (start: number, end: number): number =>
  Math.floor(Math.random() * (end - start + 1)) + start;

function verifyMessage(content: string): boolean {
  let allEqual = true;

  content.split("").forEach((caractere) => {
    if (caractere !== content[0]) {
      allEqual = false;
    }
  });

  return allEqual;
}

function handleDistinctAuthorArray(messages: IMessage[]): string[] {
  const authors: string[] = [];

  messages.forEach(({ author }) => {
    const { username, bot } = author;
    if (!bot) authors.push(username);
  });

  return authors.filter(
    (value, index, array) => array.indexOf(value) === index
  );
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

function getRandomUniquePositions(length: number, count: number): number[] {
  const positions: number[] = [];

  while (positions.length < count) {
    const newPosition = Math.floor(Math.random() * length);

    if (!positions.includes(newPosition)) {
      positions.push(newPosition);
    }
  }

  return positions;
}

async function handleLoopForChooseFiveMessages(channelId: string) {
  const instanceUrl = `https://discord.com/api/v10/channels/${channelId}/messages?limit=100`;

  const result = await request(`${instanceUrl}`, {
    headers: { authorization: authToken },
  });

  const messages: IMessage[] = await result.body.json();

  // maximo de 500 mensagens
  for (let index = 1; index <= 5; index++) {
    const lastElementId = messages[messages.length - 1].id;

    const previousArray = await handleGetPreviousMessageArray(
      lastElementId,
      instanceUrl,
      authToken
    );

    messages.concat(previousArray);
  }

  messages.filter((message) => {
    const isSticker = message.sticker_items?.length;
    const isServerEmoji = message.content.includes("<:");
    const hasOnlyOneMention = message.content.split("<@").length - 1 === 1;
    const allEqualCharacters = verifyMessage(message.content);
    const isntBot = !message.author.bot;
    const notShortMessage =
      message.content.length > 5 && !message.attachments.length;

    if (
      !isSticker &&
      !isServerEmoji &&
      !hasOnlyOneMention &&
      !allEqualCharacters &&
      isntBot &&
      notShortMessage
    )
      return message;
  });

  const randomPositions = getRandomUniquePositions(messages.length - 1, 5);

  const choosedMessages: IGetDiscordMessagesResponse[] = [];

  for (let i = 0; i < 5; i++) {
    choosedMessages.push({
      message: messages[randomPositions[i]],
      authors: handleDistinctAuthorArray(messages),
    });
  }

  const serverNameAndIcon = await GetServerName(channelId, authToken);

  const { serverIcon, serverName } = serverNameAndIcon;

  const messageInstance: IMessageInstance = {
    messages: choosedMessages,
    serverName,
    serverIcon,
    channelId,
  };

  await MessageInstanceModel.create(messageInstance);

  return;
}

//#endregion GetDiscordMessages

//#region GetHints
async function GetHints(req: Request, res: Response) {
  const { id, channelId } = req.query;

  const instanceUrl = `https://discord.com/api/v10/channels/${channelId}/messages?limit=50`;

  const result = await request(`${instanceUrl}&around=${id}`, {
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
    .select("messages channelId serverName serverIcon -_id")
    .lean();

  return res.json(messageInstance);
}
//#endregion

//#region SaveScore
async function getAwnser(userId: string, channelId: string) {
  const currentDate = new Date().toLocaleDateString("pt-br");

  const scoreInstance: IScoreInstance = await ScoreInstanceModel.findOne({
    channelId,
  }).lean();

  if (!scoreInstance) return;

  const currentDayAwnsers = scoreInstance.scores.find(
    (x) => x.member.id === userId && x.date === currentDate
  );

  if (!currentDayAwnsers) return [] as IAwnser[];

  return currentDayAwnsers.scoreDetails;
}

async function VerifyAlreadyAwnsered(req: Request, res: Response) {
  const { userId, channelId } = req.query;

  const currentDayAwnsers = await getAwnser(
    userId.toString(),
    channelId.toString()
  );

  if (currentDayAwnsers) return res.json(currentDayAwnsers);
  else res.json([]);
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

  scoreDetails.forEach(({ success }) => {
    scoreEmojis += success ? ":white_check_mark: " : ":x: ";
  });

  const today = new Date().toLocaleDateString("pt-br");

  const content = `<@${userId}> respondeu o Discordle diário! (${today}) \n\n Pontuação: ${totalScore} \n\n   **1**     **2**     **3**    **4**     **5** \n ${scoreEmojis} \n \n Responda você também! \n https://discordlle.vercel.app/game?channelId=${channelId}&guildId=${guildId}`;

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

  if (currentDayAwnsers?.length) return res.json();

  const guildInstance = await GuildInstanceModel.findOne({
    guildId,
  }).lean();

  const channel = guildInstance.channels.find((c) => c.channelId === channelId);

  const member = channel.members.find((member) => member.id === scores.userId);

  const query = { channelId };
  const update = { member, $push: { scores: { ...scores, member } } };
  const options = { upsert: true };

  await ScoreInstanceModel.updateOne(query, update, options);

  await SendScoreMessageOnDailyDiscordle(
    guildId,
    channelId,
    member.id,
    scores.scoreDetails
  );

  return res.json().status(200);
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

  const today = new Date().toLocaleDateString("pt-br");

  const content = `:warning:  AVISO!  :warning: \n\n NOVO DISCORDLE DE **#${channelName}** JÁ DISPONÍVEL!!! (${today}) \n\n Responda agora mesmo! \n\n https://discordlle.vercel.app/game?channelId=${channelId}&guildId=${guildId} \n\n Até mais.  :robot:`;

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
  return res.json(timer);
}

function updateMessagesAtMidnight(channelId: string, guildId: string) {
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

  setInterval(function () {
    timeUntilMidnight.subtract(1, "second");

    timeLeft = moment
      .utc(timeUntilMidnight.asMilliseconds())
      .format("HH:mm:ss");

    timer = timeLeft;
    console.log(`Tempo restante até a meia-noite: ${timeLeft}`);
  }, 1000);

  const msUntilMidnight = moment
    .duration({
      hours: 23 - now.hours(),
      minutes: 59 - now.minutes(),
      seconds: 59 - now.seconds(),
      milliseconds: 1000 - now.milliseconds(),
    })
    .asMilliseconds();

  setTimeout(async () => {
    await handleDeleteYesterdayMessages(channelId);

    await handleLoopForChooseFiveMessages(channelId);

    await sendNewDiscordleMessagesAvaible(channelId, guildId);
  }, msUntilMidnight);
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

  const filteredChannels = guildInstance.channels.map(
    ({ channelName, channelId }) => {
      return {
        channelName,
        channelId,
      };
    }
  );

  return res.json(filteredChannels);
}

async function GetChannelMembers(req: Request, res: Response) {
  const { guildId, channelId } = req.query;

  const guildInstance = await GuildInstanceModel.findOne({
    guildId,
  }).lean();

  const channel = guildInstance.channels.find((c) => c.channelId === channelId);

  const members = channel.members.map(({ id, username, avatarUrl }) => ({
    id,
    username,
    avatarUrl,
  }));

  return res.json(members);
}

async function CreateGuildInstance(guildInstance: IGuildInstance) {
  const { guildId } = guildInstance;

  const alreadyExists = await GuildInstanceModel.findOne({ guildId }).lean();

  if (alreadyExists !== null) return;

  await GuildInstanceModel.create(guildInstance);
}

async function sendCreatedInstanceMessage(channelId: string, guildId: string) {
  const dailyDiscordleChannelId = await findDailyDiscordleChannelId(guildId);

  const channelName = await GetDiscordleChannelName(channelId, guildId);

  const body = new FormData();

  const content = `A instância do canal **#${channelName}** foi criada! :white_check_mark: \n\n Agora é só começar a jogar! \n\n https://discordlle.vercel.app/chooseProfile?channelId=${channelId}&guildId=${guildId} \n\n Até mais.  :robot:`;

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

  const messages = await MessageInstanceModel.find({ channelId });

  if (!messages.length) await handleLoopForChooseFiveMessages(channelId);

  updateMessagesAtMidnight(channelId.toString(), guildId.toString());

  await sendCreatedInstanceMessage(channelId.toString(), guildId.toString());

  return res.json().status(200);
}

//#endregion

//#region GetDiscordleHistory

async function GetDiscordleHistory(req: Request, res: Response) {
  const { channelId } = req.query;

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

  return res.json(rankingTableData);
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
    });

  return res.json(result);
}

//#endregion

export {
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
  CreateDiscordleInstance,
};
