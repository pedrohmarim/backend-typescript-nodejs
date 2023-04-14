export interface IMessageInstance {
  messages: IMessage[];
  authors: string[];
  channelId: string;
  serverName: string;
  serverIcon: string;
}

export interface IMessage {
  id: string;
  author: IAuthor;
  content: string;
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

export interface IGuild {
  name: string;
  id: string;
  icon: string;
}
