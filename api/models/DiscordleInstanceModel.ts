import { ICreateDiscordleInstanceModel } from "interfaces/IDiscordleInstance";
import {} from "interfaces/IScore";
import { model, Schema } from "mongoose";

const DiscordleInstance = new Schema<ICreateDiscordleInstanceModel>(
  {
    authToken: {
      type: String,
      required: true,
    },
    channelId: {
      type: String,
      required: true,
    },
    instanceUrl: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

export default model("DiscordleInstance", DiscordleInstance);
