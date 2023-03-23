import { IGetDiscordMessagesResponse } from "./IMessage";

export interface ICreateDiscordleInstancePost {
  authToken: string;
  channelId: string;
}

export interface ICreateDiscordleInstanceModel
  extends ICreateDiscordleInstancePost {
  instanceUrl: string;
}

export interface IMessageInstance {
  messages: IGetDiscordMessagesResponse[];
  channelId: string;
}
