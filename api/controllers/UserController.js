const usersMock = require("../data/usersMock.json");

module.exports = {
  async getUserById(req, res) {
    const { userId } = req.query;
    const result = usersMock.users.data.find(({ id }) => id === Number(userId));
    res.status(200).json(result);
  },
};
