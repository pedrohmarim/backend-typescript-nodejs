import express from "express";
const router = express.Router();

import {
  GetDiscordMessages,
  GetHints,
} from "./controllers/DiscordMessagesController";

router.get("/getChoosedMessage", GetDiscordMessages);
router.get("/getHints", GetHints);

export default router;
