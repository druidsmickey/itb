const mongoose = require('mongoose');

const initSchema = new mongoose.Schema({
  raceNum: {
    type: Number,
    required: true
  },
  numHorse: {
    type: Number,
    required: true
  },
  raceName: {
    type: String,
    required: true
  },
  meetingName: {
    type: String,
    required: true
  },
  selected:{
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Init', initSchema);
