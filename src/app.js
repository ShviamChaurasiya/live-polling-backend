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

const Poll = require("./models/Poll");

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Socket.IO setup with production origins
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173", // for local dev
      "https://live-polling-frontend-liart.vercel.app", // your Vercel domain
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const PORT = process.env.PORT || 3000;

// Database sync
sequelize.sync({ alter: true })
  .then(() => console.log("✅ PostgreSQL connected and models synced"))
  .catch((err) => console.error("❌ DB connection failed:", err));

// In-memory state
let connectedUsers = {};        // socket.id => username
let votes = {};                 // option => count
let answeredUsers = new Set(); // track who has answered

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("🔌 New client connected:", socket.id);

  socket.on("joinChat", ({ username }) => {
    connectedUsers[socket.id] = username;
    console.log(`👥 ${username} joined. Total: ${Object.values(connectedUsers).length}`);
    io.emit("participantsUpdate", Object.values(connectedUsers));

    socket.on("disconnect", () => {
      console.log(`❌ ${username} disconnected`);
      delete connectedUsers[socket.id];
      answeredUsers.delete(username);
      io.emit("participantsUpdate", Object.values(connectedUsers));
    });
  });

  socket.on("createPoll", async (pollData) => {
    try {
      console.log("📢 Poll creation requested by:", pollData.teacherUsername);
      votes = {};
      answeredUsers.clear();

      const poll = await createPoll(pollData);
      console.log("✅ Poll created:", poll.id);
      io.emit("pollCreated", poll);
    } catch (err) {
      console.error("❌ Error creating poll:", err.message);
      socket.emit("errorCreatingPoll", err.message);
    }
  });

  socket.on("submitAnswer", async ({ username, option, pollId }) => {
    console.log(`📨 ${username} answered: ${option} (Poll ID: ${pollId})`);

    if (!username || !option || !pollId) {
      console.warn("⚠️ Invalid answer received:", { username, option, pollId });
      return;
    }

    // Count vote and track user
    votes[option] = (votes[option] || 0) + 1;
    answeredUsers.add(username);
    await voteOnOption(pollId, option);
    io.emit("pollResults", votes);

    const studentUsernames = Object.values(connectedUsers).filter(
      (name) => !name.toLowerCase().startsWith("teacher")
    );

    const allAnswered = studentUsernames.every((u) => answeredUsers.has(u));
    if (allAnswered && studentUsernames.length > 0) {
      console.log("✅ All students have answered. Ending poll...");

      try {
        const poll = await Poll.findByPk(pollId);
        if (poll && poll.status === "active") {
          poll.status = "completed";
          await poll.save();
          console.log("📝 Poll marked as completed:", pollId);
        }
      } catch (err) {
        console.error("❌ Error updating poll status:", err.message);
      }

      io.emit("pollOver");
    } else {
      console.log(`⏳ Still waiting: ${answeredUsers.size}/${studentUsernames.length}`);
    }
  });

  socket.on("kickOut", (targetUsername) => {
    console.log("🦶 Kick requested for:", targetUsername);
    for (const [id, username] of Object.entries(connectedUsers)) {
      if (username === targetUsername) {
        console.log("🚫 Kicking:", username);
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

  socket.on("chatMessage", (msg) => {
    console.log("💬 Chat message:", msg);
    io.emit("chatMessage", msg);
  });

  socket.on("studentLogin", (username) => {
    console.log("👤 Student logged in:", username);
    socket.emit("loginSuccess", { message: "Login successful", name: username });
  });

  socket.on("disconnect", () => {
    const username = connectedUsers[socket.id];
    console.log("🔌 Disconnected:", socket.id, username);
    delete connectedUsers[socket.id];
    answeredUsers.delete(username);
    io.emit("participantsUpdate", Object.values(connectedUsers));
  });
});

// REST API Routes
app.get("/", (req, res) => {
  res.send("🎯 Live Polling Backend is running");
});

app.post("/teacher-login", TeacherLogin);
app.get("/polls/:teacherUsername", getPolls);

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
