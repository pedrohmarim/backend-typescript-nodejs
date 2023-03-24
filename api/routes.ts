import express from "express";
const router = express.Router();

import * as Controller from "./controllers/DiscordMessagesController";

router.get("/getHints", Controller.GetHints);
router.get("/getChoosedMessages", Controller.GetChoosedMessages);
router.get("/getTimer", Controller.GetTimer);
router.get("/verifyAlreadyAwnsered", Controller.VerifyAlreadyAwnsered);
router.post("/saveScore", Controller.SaveScore);
router.post("/createDiscordleInstance", Controller.CreateDiscordleInstance);

export default router;
