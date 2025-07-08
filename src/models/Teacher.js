const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Teacher = sequelize.define("Teacher", {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
});

module.exports = Teacher;
