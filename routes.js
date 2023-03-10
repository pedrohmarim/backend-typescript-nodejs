const express = require("express");
const router = express.Router();

const baseUrl = "/User";

const UserController = require("./api/controllers/UserController");

router.get(`${baseUrl}/getUserById`, UserController.getUserById);

module.exports = router;
