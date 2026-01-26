const mongoose = require('mongoose');

const betsSchema = new mongoose.Schema({
  meetingName: {
    type: String,
    required: true
  },
  raceNum: {
    type: Number,
    required: true
  },
  horseNum: {
    type: Number,
    required: true
  },
  horseName: {
    type: String,
    required: true
  },
  betTime: {
    type: Date,
    required: true
  },
  clientName: {
    type: String,
    required: true
  },
  odds100: {
    type: Number,
    required: false
  },
  stake: {
    type: Number,
    required: true
  },
  books: {
    type: Number,
    required: false
  },
  f500: {
    type: Number,
    required: false
  },
  payout: {
    type: Number,
    required: true
  },
  tax: {
    type: Number,
    required: true
  },
  cancelled: {
    type: Boolean,
    required: false,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Bets', betsSchema);
