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
