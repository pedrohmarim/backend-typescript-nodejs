import express from "express";
const router = express.Router();

import * as Controller from "./controllers/DiscordMessagesController";
import { getTimer } from "./chooseFiveRandomMessagePerDay";

router.get("/getHints", Controller.GetHints);
router.get("/getChoosedMessages", Controller.GetChoosedMessages);
router.get("/getTimer", getTimer);
router.post("/saveScore", Controller.SaveScore);
router.post("/createDiscordleInstance", Controller.CreateDiscordleInstance);

export default router;
