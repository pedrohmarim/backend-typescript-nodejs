export interface IPostSaveScore {
  awnsers: IAwnser[];
  date: string;
  userId: string;
}

export interface IAwnser {
  score: number;
  success: boolean | undefined;
  tabKey: number;
}
