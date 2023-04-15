import {
  IGuildInstance,
  IInstanceChannel,
  IMember,
} from "interfaces/IGuildInstance";
import { model, Schema } from "mongoose";

const GuildInstance = new Schema<IGuildInstance>(
  {
    guildId: {
      type: String,
      required: true,
    },
    channels: [
      {
        type: new Schema<IInstanceChannel>({
          notListed: {
            type: Boolean,
            default: false,
            required: false,
          },
          channelId: {
            type: String,
            required: true,
          },
          channelName: {
            type: String,
            required: true,
          },
          members: [
            {
              type: new Schema<IMember>({
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
        }),
        required: true,
      },
    ],
  },
  { timestamps: true, versionKey: false }
);

export default model("GuildInstance", GuildInstance);
