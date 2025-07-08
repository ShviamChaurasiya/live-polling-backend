const { DataTypes } = require("sequelize");
const sequelize = require("../db");
const Poll = require("./Poll");

const Option = sequelize.define("Option", {
  text: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  correct: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  votes: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});

Poll.hasMany(Option);
Option.belongsTo(Poll);

module.exports = Option;
