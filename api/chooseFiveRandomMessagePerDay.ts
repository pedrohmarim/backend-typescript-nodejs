import { Request, Response } from "express";
import {
  handleDeleteYesterdayMessages,
  handleVerifyIfDbIsEmpty,
  handleLoopForChooseFiveMessages,
} from "./controllers/DiscordMessagesController";

let timer: string = "";

async function chooseFiveRandomMessagePerDay(channelId: string) {
  await handleVerifyIfDbIsEmpty(channelId);

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  setInterval(async () => {
    var now = new Date().getTime();

    var distance = tomorrow.getTime() - now;

    var hours = Math.floor(
      (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    var seconds = Math.floor((distance % (1000 * 60)) / 1000);

    timer = `${hours}:${minutes}:${seconds}`;
    console.log(timer);

    if (distance < 0) {
      clearInterval(0);

      await handleDeleteYesterdayMessages(channelId);

      await handleLoopForChooseFiveMessages(channelId);

      tomorrow.setDate(tomorrow.getDate() + 1);
    }
  }, 1000);
}

async function getTimer(req: Request, res: Response) {
  const timerValue = timer;
  return res.json(timerValue);
}

export { chooseFiveRandomMessagePerDay, getTimer };
