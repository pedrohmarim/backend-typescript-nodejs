export interface IMessageInstance {
  messages: IGetDiscordMessagesResponse[];
  channelId: string;
  serverName: string;
}

export interface IGetDiscordMessagesResponse {
  message: IMessage;
  authors: string[];
}

export interface IMessage {
  id: string;
  author: IAuthor;
  content: string;
  type: number;
  mentions: IMention[];
  attachments: IAttachments[];
  sticker_items?: [];
  timestamp: string;
}

export interface IAttachments {
  url: string;
}

export interface IAuthor {
  id: string;
  username: string;
  bot: boolean;
}

export interface IMention {
  id: string;
  username: string;
}

export interface IChannel {
  name: string;
  id: string;
  guild_id: string;
}

export interface IServer {
  name: string;
}
