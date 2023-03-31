import { IMember } from "./IGuildInstance";

export interface IScoreInstance {
  scores: IPostSaveScore[];
  channelId: string;
}

export interface IPostSaveScore {
  scoreDetails: IAwnser[];
  date: string;
  member: IMember;
}

export interface IAwnser {
  score: number;
  success: boolean | undefined;
  tabKey: number;
}

export interface IRankingTableData {
  key: number;
  member: {
    avatarUrl: string;
    username: string;
    userId: string;
  };
  totalScore: number;
}

export interface IUserScoreDetail {
  scoreDetails: IAwnser[];
  date: string;
}
