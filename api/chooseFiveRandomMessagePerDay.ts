import { Request, Response } from "express";
import moment from "moment";
import {
  handleDeleteYesterdayMessages,
  handleVerifyIfDbIsEmpty,
  handleLoopForChooseFiveMessages,
} from "./controllers/DiscordMessagesController";

let timer: string = "";

function updateVariableAtMidnight(channelId: string) {
  const now = moment();

  const timeUntilMidnight = moment.duration({
    hours: 23 - now.hours(),
    minutes: 59 - now.minutes(),
    seconds: 59 - now.seconds(),
    milliseconds: 1000 - now.milliseconds(),
  });

  let timeLeft = moment
    .utc(timeUntilMidnight.asMilliseconds())
    .format("HH:mm:ss");

  setInterval(function () {
    timeUntilMidnight.subtract(1, "second");

    timeLeft = moment
      .utc(timeUntilMidnight.asMilliseconds())
      .format("HH:mm:ss");

    timer = timeLeft;
    console.log(`Tempo restante até a meia-noite: ${timeLeft}`);
  }, 1000);

  const msUntilMidnight = moment
    .duration({
      hours: 23 - now.hours(),
      minutes: 59 - now.minutes(),
      seconds: 59 - now.seconds(),
      milliseconds: 1000 - now.milliseconds(),
    })
    .asMilliseconds();

  setTimeout(async () => {
    await handleDeleteYesterdayMessages(channelId);

    await handleLoopForChooseFiveMessages(channelId);

    updateVariableAtMidnight(channelId);
  }, msUntilMidnight);
}

async function chooseFiveRandomMessagePerDay(channelId: string) {
  await handleVerifyIfDbIsEmpty(channelId);

  updateVariableAtMidnight(channelId);

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
}

async function getTimer(req: Request, res: Response) {
  const timerValue = timer;
  return res.json(timerValue);
}

export { chooseFiveRandomMessagePerDay, getTimer };
