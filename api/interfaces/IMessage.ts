export interface IMessageInstance {
  messages: IGetDiscordMessagesResponse[];
  channelId: string;
  serverName: string;
}

export interface IGetDiscordMessagesResponse {
  message: IMessage;
  authors: string[];
}

export interface IGetDiscordHintsResponse {
  previousPosition: IMessage;
  consecutivePosition: IMessage;
}

export interface IMessage {
  id: string;
  author: IAuthor;
  content: string;
  mentions: IMention[];
  attachments: IAttachments[];
  sticker_items: [];
  timestamp: string;
}

export interface IAttachments {
  url: string;
}

export interface IAuthor {
  id: string;
  username: string;
}

export interface IMention {
  id: string;
  username: string;
}

export interface IChannel {
  name: string;
  guild_id: string;
}

export interface IServer {
  name: string;
}
