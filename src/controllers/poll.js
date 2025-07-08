const Poll = require("../models/Poll");
const Option = require("../models/Option");
const Teacher = require("../models/Teacher");

// 🟢 Create a new poll
exports.createPoll = async (pollData) => {
  try {
    console.log("📩 createPoll called for:", pollData.teacherUsername);

    const teacher = await Teacher.findOne({
      where: { username: pollData.teacherUsername },
    });

    if (!teacher) {
      console.warn("❌ Teacher not found:", pollData.teacherUsername);
      throw new Error("Teacher not found");
    }

    // 🚫 Check for existing active poll
    const activePoll = await Poll.findOne({
      where: { TeacherId: teacher.id, status: "active" },
    });

    if (activePoll) {
      console.warn("🚫 Active poll already exists for this teacher.");
      throw new Error("An active poll already exists. Complete it before starting a new one.");
    }

    // ✅ Create new poll
    const poll = await Poll.create({
      question: pollData.question,
      timer: pollData.timer || 60,
      status: "active",
      TeacherId: teacher.id,
    });

    console.log("🟢 Poll created:", poll.id);

    // ✅ Create poll options
    const formattedOptions = pollData.options.map((opt) => ({
      text: opt.text,
      correct: !!opt.correct,
      votes: 0,
      PollId: poll.id,
    }));

    const options = await Option.bulkCreate(formattedOptions);
    console.log("🟢 Options created:", options.length);

    // 📦 Return poll with options
    const pollWithOptions = await Poll.findOne({
      where: { id: poll.id },
      include: {
        model: Option,
        attributes: ["id", "text", "votes", "correct"],
      },
    });

    return {
      id: pollWithOptions.id,
      question: pollWithOptions.question,
      timer: pollWithOptions.timer,
      options: pollWithOptions.Options,
    };
  } catch (error) {
    console.error("❌ createPoll error:", error.message);
    throw error;
  }
};

// 🗳️ Vote on an option
exports.voteOnOption = async (pollId, optionText) => {
  try {
    const option = await Option.findOne({
      where: {
        PollId: pollId,
        text: optionText,
      },
    });

    if (!option) {
      console.warn("⚠️ Option not found for poll:", pollId, optionText);
      return;
    }

    option.votes += 1;
    await option.save();

    console.log(`🗳️ Vote registered for "${option.text}" in poll ${pollId}`);
  } catch (err) {
    console.error("❌ voteOnOption error:", err.message);
  }
};

// 📜 Get poll history for a teacher
exports.getPolls = async (req, res) => {
  const { teacherUsername } = req.params;

  try {
    console.log("📖 Fetching poll history for:", teacherUsername);

    const teacher = await Teacher.findOne({
      where: { username: teacherUsername },
    });

    if (!teacher) {
      console.warn("❌ Teacher not found:", teacherUsername);
      return res.status(404).json({ error: "Teacher not found" });
    }

    const polls = await Poll.findAll({
      where: { TeacherId: teacher.id },
      include: {
        model: Option,
        attributes: ["id", "text", "votes", "correct"],
      },
      order: [["createdAt", "DESC"]],
    });

    console.log(`✅ Found ${polls.length} poll(s) for ${teacherUsername}`);
    res.status(200).json({ data: polls });
  } catch (err) {
    console.error("❌ getPolls error:", err.message);
    res.status(500).json({
      error: "Failed to fetch polls",
      details: err.message,
    });
  }
};
