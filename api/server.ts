require("dotenv").config();
import express from "express";
import DBConnection from "./dbConnection";
import routes from "./routes";
import bodyParser from "body-parser";
import cors from "cors";

DBConnection();

const app = express();
app.use(express.json());
app.use(bodyParser.json());
app.use(cors());
app.listen(process.env.PORT);
app.use(routes);
