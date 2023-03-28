export interface IGuildInstance {
  guildId: string;
  guildName: string;
  channels: IInstanceChannels[];
}

export interface IInstanceChannels {
  channelName: string;
  channelId: string;
  members: IMember[];
}

export interface IMember {
  id: string;
  username: string;
  avatarUrl: string;
}
