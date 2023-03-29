import { Request, Response } from "express";
import { request, FormData } from "undici";
import MessageInstance from "../models/MessageInstance";
import GuildInstanceModel from "../models/GuildInstanceModel";
import ScoreModel from "../models/ScoreInstance";
import moment from "moment";
import { IAwnser, IScoreInstance } from "interfaces/IScore";
import { IGuildInstance, IMember } from "interfaces/IGuildInstance";
import {
  IChannel,
  IGetDiscordMessagesResponse,
  IMessage,
  IMessageInstance,
  IServer,
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

function ChooseFiveMessages(messages: IMessage[]): IGetDiscordMessagesResponse {
  const randomPosition = range(0, messages.length - 1);

  const message: IMessage = messages[randomPosition];

  const isSticker = message.sticker_items?.length;
  const isServerEmoji = message.content.includes("<:");
  const hasOnlyOneMention = message.content.split("<@").length - 1 === 1;
  const notShortMessage = message.content.length > 5;
  const allEqualCharacters = verifyMessage(message.content);
  const isntBot = !message.author.bot;
  const isTextMessage = message.type === 0 && message.content !== "";

  const isValidMessage =
    !isSticker &&
    !isServerEmoji &&
    !hasOnlyOneMention &&
    !allEqualCharacters &&
    isntBot &&
    isTextMessage &&
    notShortMessage;

  if (isValidMessage) {
    const authors = handleDistinctAuthorArray(messages);

    return { message, authors };
  } else return ChooseFiveMessages(messages);
}

async function handleDeleteYesterdayMessages(channelId: string) {
  await MessageInstance.findOneAndDelete({ channelId });
}

async function GetServerName(channelId: string, authToken: string) {
  const channelResult = await request(
    `https://discord.com/api/channels/${channelId}`,
    {
      headers: { authorization: authToken },
    }
  );

  const channel: IChannel = await channelResult.body.json();

  const serverResult = await request(
    `https://discord.com/api/guilds/${channel.guild_id}`,
    {
      headers: { authorization: authToken },
    }
  );

  const server: IServer = await serverResult.body.json();

  return `${server.name} - #${channel.name}`;
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

  const choosedMessages: IGetDiscordMessagesResponse[] = [];

  for (let index = 1; index <= 5; index++) {
    const choosedMessage = ChooseFiveMessages(messages);
    choosedMessages.push(choosedMessage);
  }

  const serverName = await GetServerName(channelId, authToken);

  const messageInstance: IMessageInstance = {
    messages: choosedMessages,
    serverName,
    channelId,
  };

  await MessageInstance.create(messageInstance);

  return;
}

async function handleVerifyIfDbIsEmpty(channelId: string) {
  const hasMessage = await MessageInstance.find({ channelId });

  if (!hasMessage.length) await handleLoopForChooseFiveMessages(channelId);

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

  if (previousPosition && consecutivePosition)
    return res.json({ previousPosition, consecutivePosition });
}
//#endregion GetHints

//#region GetChoosedMessages
async function GetChoosedMessages(req: Request, res: Response) {
  const { channelId } = req.query;

  const messageInstance: IMessageInstance = await MessageInstance.findOne({
    channelId,
  }).select("messages channelId serverName -_id");

  return res.json(messageInstance);
}
//#endregion

//#region SaveScore
async function getAwnser(userId: string, channelId: string) {
  const currentDate = new Date().toLocaleDateString();

  const scoreInstance: IScoreInstance = await ScoreModel.findOne({
    channelId,
  });

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

async function SendScoreMessageOnDailyDiscordle(
  guildId: string,
  channelId: string,
  username: string,
  scoreDetails: IAwnser[]
) {
  const url = `https://discord.com/api/v10/guilds/${guildId}/channels`;

  const result = await request(url, {
    headers: { authorization: authToken },
  });

  const channels: IChannel[] = await result.body.json();

  const dailyDiscordleChannelId = channels.find(
    ({ name }) => name === "daily-discordle"
  ).id;

  const body = new FormData();

  let scoreEmojis = "";

  const totalScore = scoreDetails.reduce((accumulator, curValue) => {
    return accumulator + curValue.score;
  }, 0);

  scoreDetails.forEach(({ success }) => {
    scoreEmojis += success ? ":white_check_mark: " : ":x: ";
  });

  const content = `${username} respondeu o Discordle diário! (${new Date().toLocaleDateString()}) \n\n Pontuação: ${totalScore} \n\n   **1**     **2**     **3**    **4**     **5** \n ${scoreEmojis} \n \n Responda você também! \n http://localhost:3000/game?channelId=${channelId}&guildId=${guildId}`;

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
  });

  const channel = guildInstance.channels.find((c) => c.channelId === channelId);

  const member = channel.members.find((member) => member.id === scores.userId);

  const query = { channelId };
  const update = { member, $push: { scores: { ...scores, member } } };
  const options = { upsert: true };

  await ScoreModel.updateOne(query, update, options);

  await SendScoreMessageOnDailyDiscordle(
    guildId,
    channelId,
    member.username,
    scores.scoreDetails
  );

  return res.json().status(200);
}

//#endregion

//#region Timer
let timer = "";

function GetTimer(req: Request, res: Response) {
  return res.json(timer);
}

function updateMessagesAtMidnight(channelId: string) {
  const now = moment();

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

    updateMessagesAtMidnight(channelId);
  }, msUntilMidnight);
}
//#endregion

//#region DiscordleInstance

async function GetInstanceChannels(req: Request, res: Response) {
  const { guildId } = req.query;

  const guildInstance = await GuildInstanceModel.findOne({ guildId }).select(
    "channels"
  );

  return res.json(guildInstance);
}

async function GetChannelMembers(req: Request, res: Response) {
  const { guildId, channelId } = req.query;

  const guildInstance = await GuildInstanceModel.findOne({
    guildId,
  });

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

  const alreadyExists = await GuildInstanceModel.findOne({ guildId });

  if (alreadyExists !== null) return;

  await GuildInstanceModel.create(guildInstance);
}

async function CreateDiscordleInstance(req: Request, res: Response) {
  const { channelId } = req.body;

  await handleVerifyIfDbIsEmpty(channelId.toString());

  updateMessagesAtMidnight(channelId.toString());

  return res.json().status(200);
}

//#endregion

export {
  CreateGuildInstance,
  GetChannelMembers,
  SaveScore,
  GetHints,
  handleDeleteYesterdayMessages,
  GetChoosedMessages,
  handleVerifyIfDbIsEmpty,
  handleLoopForChooseFiveMessages,
  GetTimer,
  VerifyAlreadyAwnsered,
  GetInstanceChannels,
  CreateDiscordleInstance,
};
