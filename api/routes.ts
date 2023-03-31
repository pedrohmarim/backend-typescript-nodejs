import express from "express";
const router = express.Router();

import * as Controller from "./controllers/DiscordMessagesController";

router.get("/getHints", Controller.GetHints);
router.get("/getChoosedMessages", Controller.GetChoosedMessages);
router.get("/getTimer", Controller.GetTimer);
router.get("/verifyAlreadyAwnsered", Controller.VerifyAlreadyAwnsered);
router.get("/getInstanceChannels", Controller.GetInstanceChannels);
router.get("/getChannelMembers", Controller.GetChannelMembers);
router.get("/getDiscordleHistory", Controller.GetDiscordleHistory);
router.get("/getUserScoreDetail", Controller.GetUserScoreDetail);
router.post("/createDiscordleInstance", Controller.CreateDiscordleInstance);
router.post("/saveScore", Controller.SaveScore);

export default router;
