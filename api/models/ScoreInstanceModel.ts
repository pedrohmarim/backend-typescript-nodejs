import { model, Schema } from "mongoose";

import { IAwnser, IScoreInstance } from "interfaces/IScore";
import { IMember } from "interfaces/IGuildInstance";

const ScoreInstance = new Schema<IScoreInstance>(
  {
    guildId: {
      type: String,
      required: true,
    },
    channelId: {
      type: String,
      required: true,
    },
    scores: [
      {
        member: {
          type: new Schema<IMember>({
            id: {
              type: String,
              required: true,
            },
            avatarUrl: {
              type: String,
              required: true,
            },
            username: {
              type: String,
              required: true,
            },
          }),
        },
        date: {
          type: String,
          required: true,
        },
        scoreDetails: {
          type: [
            new Schema<IAwnser>({
              score: {
                type: Number,
                required: true,
              },
              success: {
                type: Boolean,
                required: true,
              },
              tabKey: {
                type: Number,
                required: true,
              },
            }),
          ],
          required: true,
        },
      },
    ],
  },
  {
    versionKey: false,
  }
);

export default model("ScoreInstance", ScoreInstance);
