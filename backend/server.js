require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const { router: authRouter, authenticateToken } = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
.then(() => {
  console.log('✅ Successfully connected to MongoDB');
})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// MongoDB connection event listeners
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected from MongoDB');
});

// Import models
const Init = require('./models/init');
const Params = require('./models/params');
const Bets = require('./models/bets');

// Basic route
app.use('/auth', authRouter);

app.get('/', (req, res) => {
  res.json({ 
    message: 'Server is running!',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString()
  });
});

// Protect all /api routes with authentication
app.use('/api', authenticateToken);

// Init API endpoints

// Get all meeting names
app.get('/api/meetings', async (req, res) => {
  try {
    const meetings = await Init.aggregate([
      {
        $group: {
          _id: '$meetingName',
          latestDate: { $max: '$createdAt' }
        }
      },
      {
        $sort: { latestDate: -1 }
      },
      {
        $project: {
          _id: 0,
          meetingName: '$_id'
        }
      }
    ]);
    res.json(meetings.map(m => m.meetingName));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get races for a specific meeting
app.get('/api/meetings/:meetingName/races', async (req, res) => {
  try {
    const races = await Init.find({ meetingName: req.params.meetingName }).sort({ raceNum: 1 });
    res.json(races);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save races for a meeting (create or update)
app.post('/api/meetings/races', async (req, res) => {
  try {
    console.log('Received POST request to /api/meetings/races');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const { meetingName, races, selected } = req.body;
    
    if (!meetingName) {
      return res.status(400).json({ error: 'Meeting name is required' });
    }
    
    if (!races || !Array.isArray(races) || races.length === 0) {
      return res.status(400).json({ error: 'Races array is required' });
    }
    
    // If selected is true, set all other meetings to false
    if (selected) {
      console.log('Setting all other meetings selected to false');
      await Init.updateMany(
        { meetingName: { $ne: meetingName } },
        { $set: { selected: false } }
      );
    }
    
    console.log(`Deleting existing races for meeting: ${meetingName}`);
    // Delete existing races for this meeting
    await Init.deleteMany({ meetingName });
    
    console.log(`Inserting ${races.length} races`);
    // Insert new races
    const savedRaces = await Init.insertMany(
      races.map(race => ({
        meetingName,
        raceNum: race.raceNum,
        raceName: race.raceName,
        numHorse: race.numHorse,
        selected: selected || false
      }))
    );
    
    console.log('Races saved successfully');
    res.json({ success: true, races: savedRaces });
  } catch (error) {
    console.error('Error in POST /api/meetings/races:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Params API endpoints

// Get all races where selected is true
app.get('/api/params/selected-races', async (req, res) => {
  try {
    const selectedRaces = await Init.find({ selected: true }).sort({ raceNum: 1 });
    res.json(selectedRaces);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get params for selected races
app.get('/api/params', async (req, res) => {
  try {
    const { meetingName } = req.query;
    const query = meetingName ? { meetingName } : {};
    const params = await Params.find(query).sort({ raceNum: 1, horseNum: 1 });
    res.json(params);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save params (bulk upsert)
app.post('/api/params', async (req, res) => {
  try {
    const { params } = req.body;
    
    if (!params || !Array.isArray(params)) {
      return res.status(400).json({ error: 'Params array is required' });
    }
    
    // Get meetingName from first param
    const meetingName = params.length > 0 ? params[0].meetingName : null;
    
    if (meetingName) {
      // Delete only params for this meeting
      await Params.deleteMany({ meetingName });
    }
    
    // Insert new params
    const savedParams = await Params.insertMany(params);
    
    res.json({ success: true, params: savedParams });
  } catch (error) {
    console.error('Error saving params:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bets API endpoints

// Get recent client names (last 6 unique)
app.get('/api/bets/recent-clients', async (req, res) => {
  try {
    const recentClients = await Bets.aggregate([
      { $match: { clientName: { $exists: true, $ne: '' } } },
      { $sort: { betTime: -1 } },
      { $group: { 
        _id: '$clientName',
        firstBetTime: { $first: '$betTime' }
      }},
      { $sort: { firstBetTime: -1 } },
      { $limit: 6 },
      { $project: { _id: 0, clientName: '$_id' } }
    ]);
    res.json(recentClients.map(item => item.clientName));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get last bet
app.get('/api/bets/last', async (req, res) => {
  try {
    const lastBet = await Bets.findOne().sort({ betTime: -1 });
    res.json(lastBet || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all bets
app.get('/api/bets', async (req, res) => {
  try {
    const { meetingName } = req.query;
    const query = meetingName ? { meetingName } : {};
    const bets = await Bets.find(query).sort({ betTime: -1 });
    res.json(bets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save a bet
app.post('/api/bets', async (req, res) => {
  try {
    const bet = new Bets(req.body);
    const savedBet = await bet.save();
    res.json({ success: true, bet: savedBet });
  } catch (error) {
    console.error('Error saving bet:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update bet cancelled status
app.patch('/api/bets/:id/cancel', async (req, res) => {
  try {
    const { cancelled } = req.body;
    const bet = await Bets.findByIdAndUpdate(
      req.params.id,
      { cancelled },
      { new: true }
    );
    res.json({ success: true, bet });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update params (for winner, special, rule4 etc)
app.patch('/api/params/:id', async (req, res) => {
  try {
    const param = await Params.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json({ success: true, param });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a bet
app.delete('/api/bets/:id', async (req, res) => {
  try {
    await Bets.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a meeting (all data for a meeting)
app.delete('/api/meetings/:meetingName', async (req, res) => {
  try {
    const meetingName = decodeURIComponent(req.params.meetingName);
    
    // Delete from all collections
    const [initResult, paramsResult, betsResult] = await Promise.all([
      Init.deleteMany({ meetingName }),
      Params.deleteMany({ meetingName }),
      Bets.deleteMany({ meetingName })
    ]);
    
    res.json({ 
      success: true, 
      deleted: {
        init: initResult.deletedCount,
        params: paramsResult.deletedCount,
        bets: betsResult.deletedCount
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📍 API URL: ${process.env.API_URL}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed through app termination');
  process.exit(0);
});
