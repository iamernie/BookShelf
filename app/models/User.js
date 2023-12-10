const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../config/database"); // Adjust the path as needed

const User = sequelize.define(
  "User",
  {
    // Sequelize will automatically create an 'id' field as primary key
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM,
      values: ["admin", "editor", "user"],
      defaultValue: "user",
      allowNull: false,
    },
    // Optional fields
    firstName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Timestamps
    createdAt: Sequelize.DATE,
    updatedAt: Sequelize.DATE,
  },
  {
    // Model options
    tableName: "users",
    timestamps: true,
  }
);

module.exports = User;
