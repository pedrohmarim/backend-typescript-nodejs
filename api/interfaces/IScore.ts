export interface IScoreInstance {
  scores: IPostSaveScore;
  channelId: string;
}

export interface IPostSaveScore {
  scoreDetails: IAwnser[];
  date: string;
  userId: string;
}

export interface IAwnser {
  score: number;
  success: boolean | undefined;
  tabKey: number;
}
