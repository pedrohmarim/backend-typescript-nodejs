import { model, Schema } from "mongoose";
import {
  IMessage,
  IAuthor,
  IMention,
  IAttachments,
  IMessageInstance,
} from "interfaces/IMessage";

const MessageInstance = new Schema<IMessageInstance>(
  {
    guildId: {
      type: String,
      required: true,
    },
    channelId: {
      type: String,
      required: true,
    },
    serverIcon: {
      type: String,
      required: true,
    },
    serverName: {
      type: String,
      required: true,
    },
    authors: {
      type: [
        {
          required: true,
          type: new Schema<IAuthor>({
            id: {
              type: String,
              required: true,
            },
            username: {
              type: String,
              required: true,
            },
            avatarUrl: {
              type: String,
              required: true,
            },
          }),
        },
      ],
      required: true,
    },
    messages: [
      {
        required: true,
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
            required: false,
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
              new Schema<IAttachments>({
                url: { type: String, required: true },
              }),
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
      },
    ],
  },

  { versionKey: false }
);

export default model("MessageInstance", MessageInstance);
