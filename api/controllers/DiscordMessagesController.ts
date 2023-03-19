import { Request, Response } from "express";
import {
  IGetDiscordHintsResponse,
  IGetDiscordMessagesResponse,
  IMessage,
} from "../interfaces/IMessage";
import { request } from "undici";

const limit = "limit=100";
const baseUrl = `https://discord.com/api/v9/channels/790633651888324618/messages?${limit}`;
const authorization =
  "NTkwNTI0NTc5Nzg1NjA1MTIw.GIKTQ8.jQltZga3SGXlGsHfgG-XvE_SANDaUw1aJUl9pA";

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

async function handleGetPreviousMessageArray(id: string) {
  const result = await request(`${baseUrl}?before=${id}&${limit}`, {
    headers: { authorization },
  });

  const messages: IMessage[] = await result.body.json();

  return messages;
}

async function getLastElementRecursive(
  messages: IMessage[],
  rangeNumber: number
): Promise<IGetDiscordMessagesResponse> {
  const randomPosition = range(0, messages.length - 1);

  const message: IMessage = messages[randomPosition];

  const isSticker = message.sticker_items?.length;
  const isServerEmoji = message.content.includes("<:");
  const hasOnlyOneMention = message.content.split("<@").length - 1 === 1;
  const notShortMessage = message.content.length > 5;
  const allEqualCharacters = verifyMessage(message.content);

  const isValidMessage =
    rangeNumber <= 0 &&
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

    const previousArray = await handleGetPreviousMessageArray(lastElementId);

    return getLastElementRecursive(
      previousArray,
      rangeNumber - 1 < 0 ? range(1, 5) : rangeNumber - 1
    );
  }
}

async function GetDiscordMessages(req: Request, res: Response) {
  const result = await request(baseUrl, { headers: { authorization } });

  const messages: IMessage[] = await result.body.json();

  const times: number = range(1, 5);

  const choosedMessage = await getLastElementRecursive(messages, times);

  return res.json(choosedMessage);
}

async function GetHints(req: Request, res: Response) {
  const { id } = req.params;

  const result = await request(`${baseUrl}&before=${id}`, {
    headers: { authorization },
  });

  const messages: IMessage[] = await result.body.json();

  const messageIndex = messages.findIndex((x) => x.id === id);

  const previousPosition = res[messageIndex - 1];
  const consecutivePosition = res[messageIndex + 1];

  if (previousPosition && consecutivePosition)
    return res.json({ previousPosition, consecutivePosition });
}

export { GetDiscordMessages, GetHints };
