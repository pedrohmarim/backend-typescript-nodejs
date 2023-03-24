export interface ICreateDiscordleInstancePost {
  authToken: string;
  channelId: string;
}

export interface ICreateDiscordleInstanceModel
  extends ICreateDiscordleInstancePost {
  instanceUrl: string;
}
