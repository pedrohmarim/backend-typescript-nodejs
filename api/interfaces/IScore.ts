export interface IScoreInstance {
  userId: string;
  scores: IPostSaveScore;
  channelId: string;
}

export interface IPostSaveScore {
  scoreDetails: IAwnser[];
  date: string;
}

export interface IAwnser {
  score: number;
  success: boolean | undefined;
  tabKey: number;
}
