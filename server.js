require("dotenv").config();
const express = require("express");
const app = express();
const connection = require("./db");
const routes = require("./routes");
const bodyParser = require("body-parser");
const cors = require("cors");
// const path = require("path");

connection();

// app.use("/uploads", express.static(path.join(__dirname, "/uploads")));
app.use(express.json());
app.use(bodyParser.json());
app.use(cors());
app.listen(process.env.PORT, () => {
  console.log(`Servidor rodando na porta ${process.env.PORT}`);
});
app.use(routes);
