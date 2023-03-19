import { connect } from "mongoose";

const DBConnection = async () => {
  try {
    const variable = process.env.DB || "";

    connect(variable);
  } catch (error) {
    console.log(error, "could not connect to database");
  }
};

export default DBConnection;
