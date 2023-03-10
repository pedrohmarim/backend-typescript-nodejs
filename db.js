const mongoose = require("mongoose");

module.exports = async function connection() {
  try {
    mongoose.connect(process.env.DB);
  } catch (error) {
    console.log(error, "could not connect to database");
  }
};
