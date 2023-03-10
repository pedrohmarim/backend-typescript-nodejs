const UserModel = require("../models/UserModel");

module.exports = {
  async getUserById(req, res) {
    const { username } = req.query;
    const result = await UserModel.findOne({ username });
    res.status(200).json(result);
  },
};
