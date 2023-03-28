import {
  IGuildInstance,
  IInstanceChannels,
  IMember,
} from "interfaces/IGuildInstance";
import { model, Schema } from "mongoose";

const GuildInstance = new Schema<IGuildInstance>(
  {
    guildId: {
      type: String,
      required: true,
    },
    guildName: {
      type: String,
      required: true,
    },
    channels: [
      {
        type: new Schema<IInstanceChannels>({
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
              }),
            },
          ],
        }),
        required: true,
      },
    ],
  },
  { timestamps: true }
);

export default model("GuildInstance", GuildInstance);
