import express from "express";
const router = express.Router();

import {
  GetHints,
  GetChoosedMessages,
  SaveScore,
} from "./controllers/DiscordMessagesController";
import { getTimer } from "./chooseFiveRandomMessagePerDay";

router.get("/getHints", GetHints);
router.get("/getChoosedMessages", GetChoosedMessages);
router.get("/getTimer", getTimer);
router.post("/saveScore", SaveScore);

export default router;
