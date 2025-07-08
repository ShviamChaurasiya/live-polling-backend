const { DataTypes } = require("sequelize");
const sequelize = require("../db");
const Teacher = require("./Teacher");

// Define the Poll model
const Poll = sequelize.define("Poll", {
  question: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  timer: {
    type: DataTypes.INTEGER,
    defaultValue: 60,
  },
  status: {
    type: DataTypes.ENUM("active", "completed"),
    defaultValue: "active",
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

// Define associations
Teacher.hasMany(Poll, {
  foreignKey: {
    allowNull: false,
  },
  onDelete: "CASCADE",
});
Poll.belongsTo(Teacher, {
  foreignKey: {
    allowNull: false,
  },
});

module.exports = Poll;
