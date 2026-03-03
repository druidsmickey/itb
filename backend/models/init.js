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

<<<<<<< HEAD
=======
// Indexes for query performance
initSchema.index({ meetingName: 1, raceNum: 1 });
initSchema.index({ selected: 1, raceNum: 1 });

>>>>>>> 9aac1f3c2fd33f2f8c91f8ebd961a239a611b9b0
module.exports = mongoose.model('Init', initSchema);
