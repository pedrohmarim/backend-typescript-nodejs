import { IMember } from "./IGuildInstance";

export interface IScoreInstance {
  scores: IPostSaveScore[];
  channelId: string;
}

export interface IPostSaveScore {
  _id: string;
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
  rowId: string;
  position: number;
  member: {
    avatarUrl: string;
    username: string;
    userId: string;
  };
  totalScore: number;
}

export interface IUserScoreDetail {
  rowId: string;
  scoreDetails: IAwnser[];
  date: string;
}
