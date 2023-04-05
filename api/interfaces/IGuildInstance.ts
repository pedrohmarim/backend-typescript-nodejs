export interface IGuildInstance {
  guildId: string;
  channels: IInstanceChannel[];
}

export interface IInstanceChannel {
  channelName: string;
  channelId: string;
  members: IMember[];
  notListed: boolean;
}

export interface IMember {
  id: string;
  username: string;
  avatarUrl: string;
  inUse: boolean;
}
