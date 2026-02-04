const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  meetingName: {
    type: String,
    required: true
  },
  horseName: {
    type: String,
    required: false
  },
  stake: {
    type: Number,
    required: true
  },
  betTime: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Report', reportSchema);
