const mongoose = require('mongoose');

const AuthSchema = new mongoose.Schema({
  userAgent: {
    type: Object,
  },
  ip: {
    type: String,
  },
  createAt: {
    type: Date,
    default: Date.now,
  },
  signout: {
    type: Object,
  },
});

const Schema = {
  email: {
    type: String,
    unique: true,
    required: true,
  },
  passwordHash: {
    type: String,
    select: false,
  },
  tempPassword: {
    type: Object,
    select: false,
  },
  authLog: {
    type: [AuthSchema],
    select: false,
  },
  createAt: {
    type: Date,
    default: Date.now,
  },
};

module.exports = Schema;
