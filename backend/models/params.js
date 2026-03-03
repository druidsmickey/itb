const mongoose = require('mongoose');

const paramsSchema = new mongoose.Schema({
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
    required: false
  },
  winner: {
    type: Boolean,
    required: false,
    default: false
  },
  special: {
    type: Date,
    required: false
  },
  rule4: {
    type: Date,
    required: false
  },
  rule4deduct: {
    type: Number,
    required: false
  }
}, {
  timestamps: true
});

<<<<<<< HEAD
=======
// Indexes for query performance
paramsSchema.index({ meetingName: 1, raceNum: 1, horseNum: 1 });
paramsSchema.index({ meetingName: 1 });

>>>>>>> 9aac1f3c2fd33f2f8c91f8ebd961a239a611b9b0
module.exports = mongoose.model('Params', paramsSchema);
