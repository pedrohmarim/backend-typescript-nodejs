import { Request, Response } from "express";
import Axios from "axios";
import MessageInstance from "../models/MessageModel";
import DiscordleInstanceModel from "../models/DiscordleInstanceModel";
import ScoreModel from "../models/ScoreModel";
import baseUrl from "./baseUrl";
import moment from "moment";
import { IScoreInstance } from "interfaces/IScore";
import {
  IChannel,
  IGetDiscordMessagesResponse,
  IMessage,
  IMessageInstance,
  IServer,
} from "../interfaces/IMessage";
import {
  ICreateDiscordleInstanceModel,
  ICreateDiscordleInstancePost,
} from "interfaces/IDiscordleInstance";

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
    const { username } = author;
    authors.push(username);
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
  const result = await Axios.get(`${instanceUrl}&before=${id}`, {
    headers: { authorization: authToken },
  }).then(({ data }) => data);

  const messages: IMessage[] = result;

  return messages;
}

async function getLastElementRecursive(
  messages: IMessage[],
  rangeNumber: number,
  instanceUrl: string,
  authToken: string
): Promise<IGetDiscordMessagesResponse> {
  const randomPosition = range(0, messages.length - 1);

  const message: IMessage = messages[randomPosition];

  const isSticker = message.sticker_items?.length;
  const isServerEmoji = message.content.includes("<:");
  const hasOnlyOneMention = message.content.split("<@").length - 1 === 1;
  const notShortMessage = message.content.length > 5;
  const allEqualCharacters = verifyMessage(message.content);

  const isValidMessage =
    rangeNumber == 0 &&
    !isSticker &&
    !isServerEmoji &&
    !hasOnlyOneMention &&
    !allEqualCharacters &&
    notShortMessage;

  if (isValidMessage) {
    const authors = handleDistinctAuthorArray(messages);

    return { message, authors };
  } else {
    const lastElementId = messages[messages.length - 1].id;

    const previousArray = await handleGetPreviousMessageArray(
      lastElementId,
      instanceUrl,
      authToken
    );

    return getLastElementRecursive(
      previousArray,
      rangeNumber - 1 < 0 ? range(1, 5) : rangeNumber - 1,
      instanceUrl,
      authToken
    );
  }
}

async function handleDeleteYesterdayMessages(channelId: string) {
  await MessageInstance.findOneAndDelete({ channelId });
}

async function ChooseDiscordMessage(instanceUrl: string, authToken: string) {
  const result = await Axios.get(`${instanceUrl}`, {
    headers: { authorization: authToken },
  }).then(({ data }) => data);

  const messages: IMessage[] = result;

  const times: number = range(1, 5);

  const choosedMessage = await getLastElementRecursive(
    messages,
    times,
    instanceUrl,
    authToken
  );

  return choosedMessage;
}

async function GetServerName(channelId: string, authToken: string) {
  const channelResult = await Axios.get(
    `https://discord.com/api/channels/${channelId}`,
    {
      headers: { authorization: authToken },
    }
  ).then(({ data }) => data);

  const channel: IChannel = channelResult;

  const serverResult = await Axios.get(
    `https://discord.com/api/guilds/${channel.guild_id}`,
    {
      headers: { authorization: authToken },
    }
  ).then(({ data }) => data);

  const server: IServer = serverResult;

  return `${server.name} - #${channel.name}`;
}

async function handleLoopForChooseFiveMessages(channelId: string) {
  const totalMessagesPerDay = 5;

  const discordleInstance: ICreateDiscordleInstanceModel =
    await DiscordleInstanceModel.findOne({ channelId });

  const { instanceUrl, authToken } = discordleInstance;

  const choosedMessages: IGetDiscordMessagesResponse[] = [];

  for (let index = 1; index <= totalMessagesPerDay; index++) {
    const choosedMessage = await ChooseDiscordMessage(instanceUrl, authToken);

    choosedMessages.push(choosedMessage);
  }

  const serverName = await GetServerName(channelId, authToken);

  const messageInstance: IMessageInstance = {
    messages: choosedMessages,
    serverName,
    channelId,
  };

  await MessageInstance.create(messageInstance);
}

async function handleVerifyIfDbIsEmpty(channelId: string) {
  const hasMessage = await MessageInstance.find({ channelId });

  if (!hasMessage.length) await handleLoopForChooseFiveMessages(channelId);
}
//#endregion GetDiscordMessages

//#region GetHints
async function GetHints(req: Request, res: Response) {
  const { id, channelId } = req.query;

  const discordleInstance: ICreateDiscordleInstanceModel =
    await DiscordleInstanceModel.findOne({ channelId });

  const { instanceUrl, authToken } = discordleInstance;

  const result = await Axios.get(`${instanceUrl}&around=${id}`, {
    headers: { authorization: authToken },
  }).then(({ data }) => data);

  const messages: IMessage[] = result;

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
  });

  return res.json(messageInstance);
}
//#endregion

//#region SaveScore
async function getAwnser(userId: string) {
  const currentDate = new Date().toLocaleDateString();

  const currentDayAwnsers: IScoreInstance = await ScoreModel.findOne({
    userId: userId,
    $and: [{ "scores.date": { $eq: currentDate } }],
  }).select("scores.scoreDetails");

  return currentDayAwnsers;
}

async function VerifyAlreadyAwnsered(req: Request, res: Response) {
  const { userId } = req.query;

  const currentDayAwnsers = await getAwnser(userId.toString());

  if (currentDayAwnsers) return res.json(currentDayAwnsers.scores);
  else res.json([]);
}

async function SaveScore(req: Request, res: Response) {
  const dto: IScoreInstance = req.body;

  const { scores, userId, channelId } = dto;

  const currentDayAwnsers = await getAwnser(userId.toString());

  if (currentDayAwnsers) return res.json();

  const query = { channelId };
  const update = { userId, $push: { scores } };
  const options = { upsert: true };

  await ScoreModel.updateOne(query, update, options);

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

async function CreateDiscordleInstance(req: Request, res: Response) {
  const body: ICreateDiscordleInstancePost = req.body;

  const { channelId } = body;

  const alreadyExists = await DiscordleInstanceModel.findOne({ channelId });

  if (alreadyExists)
    return res.json({
      errorMessage:
        "Discordle já criado para o ID Canal de texto específicado.",
    });

  const instanceUrl = baseUrl(body.channelId);

  const dto: ICreateDiscordleInstanceModel = {
    ...body,
    instanceUrl,
  };

  await DiscordleInstanceModel.create(dto);

  await handleVerifyIfDbIsEmpty(channelId);

  updateMessagesAtMidnight(channelId);

  return res.json().status(200);
}
//#endregion

export {
  CreateDiscordleInstance,
  SaveScore,
  GetHints,
  handleDeleteYesterdayMessages,
  GetChoosedMessages,
  handleVerifyIfDbIsEmpty,
  handleLoopForChooseFiveMessages,
  GetTimer,
  VerifyAlreadyAwnsered,
};
