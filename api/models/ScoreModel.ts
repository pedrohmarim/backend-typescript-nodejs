import { model, Schema } from "mongoose";

import { IPostSaveScore, IAwnser } from "interfaces/IScore";

const Score = new Schema<IPostSaveScore>({
  awnsers: {
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
  date: {
    type: String,
    required: true,
  },
  userId: {
    type: String,
    required: true,
  },
});

export default model("Score", Score);
