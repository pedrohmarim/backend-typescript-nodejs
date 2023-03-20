import { model, Schema } from "mongoose";
import {
  IGetDiscordMessagesResponse,
  IMessage,
  IAuthor,
  IMention,
  IAttachments,
} from "interfaces/IMessage";

const ChoosedMessage = new Schema<IGetDiscordMessagesResponse>(
  {
    authors: {
      type: [String],
      required: true,
    },
    message: {
      type: new Schema<IMessage>({
        id: {
          type: String,
          required: true,
        },
        author: new Schema<IAuthor>({
          id: {
            type: String,
            required: true,
          },
          username: {
            type: String,
            required: true,
          },
        }),
        content: {
          type: String,
          required: true,
        },
        mentions: {
          type: [
            new Schema<IMention>({
              id: {
                type: String,
                required: true,
              },
              username: {
                type: String,
                required: true,
              },
            }),
          ],
          required: false,
        },
        attachments: {
          type: [
            new Schema<IAttachments>({ url: { type: String, required: true } }),
          ],
          required: false,
        },
        sticker_items: {
          type: [],
          required: false,
        },
        timestamp: {
          type: String,
          required: true,
        },
      }),
      required: true,
    },
  },
  { timestamps: true }
);

export default model("ChoosedMessage", ChoosedMessage);
