export enum FilterMessageEnum {
  isText = 1,
  isLink = 3,
  isImage = 4,
  isImageWithText = 5,
  isImageWithTextAndLink = 6,
  isImageWithLink = 7,
}

export enum MessageLevelEnum {
  isPrevious = 1,
  isConsecutive = 2,
  isMain = 3,
  dontExist = 4,
}

export interface IFilterMessageResponse {
  messageType: FilterMessageEnum;
  urlLink: string;
  formattedAttachs: JSX.Element[];
}
