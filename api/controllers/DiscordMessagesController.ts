import { Request, Response } from "express";
import { IGetDiscordMessagesResponse, IMessage } from "../interfaces/IMessage";
import { request } from "undici";
import MessageModel from "../models/MessageModel";
import DiscordleInstanceModel from "../models/DiscordleInstanceModel";
import ScoreModel from "../models/ScoreModel";
import baseUrl from "./baseUrl";
import { IPostSaveScore } from "interfaces/IScore";
import { chooseFiveRandomMessagePerDay } from "../chooseFiveRandomMessagePerDay";
import {
  ICreateDiscordleInstanceModel,
  ICreateDiscordleInstancePost,
  IMessageInstance,
} from "interfaces/IDiscordleInstance";

//#region consts

const authorization = process.env.DISCORD_AUTH;
//#endregion consts

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
  const result = await request(`${instanceUrl}&before=${id}`, {
    headers: { authorization: authToken },
  });

  const messages: IMessage[] = await result.body.json();

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
  await MessageModel.findOneAndDelete({ channelId });
}

async function ChooseDiscordMessage(instanceUrl: string, authToken: string) {
  const result = await request(`${instanceUrl}`, {
    headers: { authorization: authToken },
  });

  const messages: IMessage[] = await result.body.json();

  const times: number = range(1, 5);

  const choosedMessage = await getLastElementRecursive(
    messages,
    times,
    instanceUrl,
    authToken
  );

  return choosedMessage;
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

  const messageInstance: IMessageInstance = {
    messages: choosedMessages,
    channelId,
  };

  await MessageModel.create(messageInstance);
}

async function handleVerifyIfDbIsEmpty(channelId: string) {
  const hasMessage = await MessageModel.find({ channelId });

  if (!hasMessage.length) await handleLoopForChooseFiveMessages(channelId);
}

//#endregion GetDiscordMessages

//#region GetHints
async function GetHints(req: Request, res: Response) {
  const { id, channelId } = req.query;

  const discordleInstance: ICreateDiscordleInstanceModel =
    await DiscordleInstanceModel.findOne({ channelId });

  const { instanceUrl, authToken } = discordleInstance;

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

  const result = await MessageModel.findOne({ channelId });

  return res.json(result);
}
//#endregion

//#region SaveScore

async function SaveScore(req: Request, res: Response) {
  const dto: IPostSaveScore = req.body;

  try {
    await ScoreModel.create(dto);

    return res.json().status(200);
  } catch (error) {
    return res.json(error).status(501);
  }
}

//#endregion

//#region SaveScore

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

  await chooseFiveRandomMessagePerDay(channelId);

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
};
