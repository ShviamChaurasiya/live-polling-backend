const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const sequelize = require("./db");

const { TeacherLogin } = require("./controllers/login");
const {
  createPoll,
  voteOnOption,
  getPolls,
} = require("./controllers/poll");

const Poll = require("./models/Poll"); // 🆕 Needed to update poll status

const app = express();
const server = http.createServer(app);

// Middlewares
app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const PORT = process.env.PORT || 3000;

// Sync database
sequelize.sync({ alter: true })
  .then(() => console.log("✅ PostgreSQL connected and models synced"))
  .catch((err) => console.error("❌ DB connection failed:", err));

// In-memory state
let connectedUsers = {}; // socket.id => username
let votes = {}; // option => vote count
let answeredUsers = new Set();

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("🔌 New client connected:", socket.id);

  // Handle student joining
  socket.on("joinChat", ({ username }) => {
    connectedUsers[socket.id] = username;
    console.log(`👥 ${username} joined. Total connected: ${Object.values(connectedUsers).length}`);

    io.emit("participantsUpdate", Object.values(connectedUsers));

    socket.on("disconnect", () => {
      console.log(`❌ ${username} disconnected`);
      delete connectedUsers[socket.id];
      answeredUsers.delete(username);
      io.emit("participantsUpdate", Object.values(connectedUsers));
    });
  });

  // Handle poll creation
  socket.on("createPoll", async (pollData) => {
    try {
      console.log("📢 Poll creation requested by:", pollData.teacherUsername);

      // Reset previous poll state
      votes = {};
      answeredUsers.clear();

      const poll = await createPoll(pollData);
      console.log("✅ Poll created successfully with ID:", poll.id);

      io.emit("pollCreated", poll);
    } catch (err) {
      console.error("❌ Error creating poll:", err.message);
      socket.emit("errorCreatingPoll", err.message);
    }
  });

  // Handle vote submission
  socket.on("submitAnswer", async ({ username, option, pollId }) => {
    console.log(`📨 ${username} submitted answer: ${option} (Poll ID: ${pollId})`);

    if (!username || !option || !pollId) {
      console.warn("⚠️ Incomplete vote data received:", { username, option, pollId });
      return;
    }

    // Track vote
    votes[option] = (votes[option] || 0) + 1;
    answeredUsers.add(username);

    await voteOnOption(pollId, option);
    io.emit("pollResults", votes);

    // Check if all students have responded
    const studentUsernames = Object.values(connectedUsers).filter(u => !u.toLowerCase().startsWith("teacher"));
    const allAnswered = studentUsernames.every(u => answeredUsers.has(u));

    if (allAnswered && studentUsernames.length > 0) {
      console.log("✅ All students have submitted. Ending poll.");

      try {
        const poll = await Poll.findByPk(pollId);
        if (poll && poll.status === "active") {
          poll.status = "completed";
          await poll.save();
          console.log(`📝 Poll ${pollId} marked as completed in DB.`);
        }
      } catch (err) {
        console.error("❌ Failed to update poll status:", err);
      }

      io.emit("pollOver");
    } else {
      console.log(`⏳ Waiting for responses... ${answeredUsers.size}/${studentUsernames.length} students answered.`);
    }
  });

  // Kick student
  socket.on("kickOut", (targetUsername) => {
    console.log("🦶 Kick requested for:", targetUsername);

    for (const [id, username] of Object.entries(connectedUsers)) {
      if (username === targetUsername) {
        console.log("🔒 Kicking:", username);

        io.to(id).emit("kickedOut", { message: "You have been kicked out." });

        const sock = io.sockets.sockets.get(id);
        if (sock) sock.disconnect(true);

        delete connectedUsers[id];
        answeredUsers.delete(username);
        break;
      }
    }

    io.emit("participantsUpdate", Object.values(connectedUsers));
  });

  // Handle chat messages
  socket.on("chatMessage", (message) => {
    console.log("💬 Chat:", message);
    io.emit("chatMessage", message);
  });

  // Confirm student login
  socket.on("studentLogin", (username) => {
    console.log("👤 Student login:", username);
    socket.emit("loginSuccess", { message: "Login successful", name: username });
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    const username = connectedUsers[socket.id];
    console.log("🔌 Disconnected:", socket.id, username);
    delete connectedUsers[socket.id];
    answeredUsers.delete(username);
    io.emit("participantsUpdate", Object.values(connectedUsers));
  });
});

// Express routes
app.get("/", (req, res) => {
  res.send("🎯 Live Polling Backend is running");
});

app.post("/teacher-login", TeacherLogin);
app.get("/polls/:teacherUsername", getPolls);

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
