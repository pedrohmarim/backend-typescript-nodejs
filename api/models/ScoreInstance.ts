import { model, Schema } from "mongoose";

import { IAwnser, IScoreInstance } from "interfaces/IScore";

const ScoreInstance = new Schema<IScoreInstance>({
  channelId: {
    type: String,
    required: true,
  },
  scores: {
    userId: {
      type: String,
      required: true,
    },
    date: {
      type: String,
      required: true,
    },
    scoreDetails: [
      {
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
    ],
  },
});

export default model("ScoreInstance", ScoreInstance);
