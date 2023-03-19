import {
  FilterMessageEnum,
  MessageLevelEnum,
} from "../interfaces/filterMessageEnum";

export interface IChoosedMessage {
  id: string;
  urlLink: string;
  content: string;
  timestamp: string;
  messageType: FilterMessageEnum;
  messageLevel: MessageLevelEnum;
  formattedAttachs: any;
}

export interface ILinkContainer {
  content: string;
  urlLink: string;
}
