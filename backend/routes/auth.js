const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../model/user");
const Init = require("../models/init");
const Params = require("../models/params");
const Bets = require("../models/bets");
const Report = require("../model/report");

const router = express.Router();

async function purgeExpiredMeetings() {
  try {
    const cutoff = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);

    // Find the earliest createdAt per meetingName
    const meetings = await Init.aggregate([
      {
        $group: {
          _id: "$meetingName",
          firstCreated: { $min: "$createdAt" }
        }
      },
      {
        $match: { firstCreated: { $lt: cutoff } }
      }
    ]);

    if (meetings.length === 0) return;

    const expiredNames = meetings.map(m => m._id);
    console.log(`Purging expired meetings (>6 days old): ${expiredNames.join(", ")}`);

    await Promise.all([
      Init.deleteMany({ meetingName: { $in: expiredNames } }),
      Params.deleteMany({ meetingName: { $in: expiredNames } }),
      Bets.deleteMany({ meetingName: { $in: expiredNames } }),
      Report.deleteMany({ meetingName: { $in: expiredNames } })
    ]);

    console.log(`Purged data for ${expiredNames.length} meeting(s).`);
  } catch (err) {
    console.error("Error purging expired meetings:", err);
  }
}

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Username and password are required" });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user._id, username: user.username },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
      },
    });

    // Purge meetings older than 6 days (fire-and-forget)
    purgeExpiredMeetings();
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid token" });
    }
    req.user = user;
    next();
  });
};

router.post("/change-password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Current password and new password are required" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "New password must be at least 6 characters long" });
    }

    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isValidCurrentPassword = await user.comparePassword(currentPassword);
    
    if (!isValidCurrentPassword) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

module.exports = { router, authenticateToken };
