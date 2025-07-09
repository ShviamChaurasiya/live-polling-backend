const Poll = require("../models/Poll");
const Option = require("../models/Option");
const Teacher = require("../models/Teacher");

// ✅ Create a new poll
exports.createPoll = async (pollData) => {
  try {
    console.log("📩 Creating poll for teacher:", pollData.teacherUsername);

    const teacher = await Teacher.findOne({
      where: { username: pollData.teacherUsername },
    });

    if (!teacher) {
      console.warn("❌ Teacher not found:", pollData.teacherUsername);
      throw new Error("Teacher not found");
    }

    // 🚫 Prevent duplicate active poll
    const existingActivePoll = await Poll.findOne({
      where: { TeacherId: teacher.id, status: "active" },
    });

    if (existingActivePoll) {
      throw new Error("An active poll already exists. Complete it before starting a new one.");
    }

    // ✅ Create poll
    const newPoll = await Poll.create({
      question: pollData.question,
      timer: pollData.timer || 60,
      status: "active",
      TeacherId: teacher.id,
    });

    // ✅ Create options
    const pollOptions = pollData.options.map((option) => ({
      text: option.text,
      correct: !!option.correct,
      votes: 0,
      PollId: newPoll.id,
    }));

    await Option.bulkCreate(pollOptions);

    // ✅ Return poll with options
    const pollWithOptions = await Poll.findOne({
      where: { id: newPoll.id },
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
    console.error("❌ Error creating poll:", error.message);
    throw error;
  }
};

// ✅ Vote on an option
exports.voteOnOption = async (pollId, optionText) => {
  try {
    const option = await Option.findOne({
      where: {
        PollId: pollId,
        text: optionText,
      },
    });

    if (!option) {
      console.warn(`⚠️ Option "${optionText}" not found for poll ID ${pollId}`);
      return;
    }

    option.votes += 1;
    await option.save();

    console.log(`🗳️ Vote registered for "${option.text}" in Poll ID: ${pollId}`);
  } catch (err) {
    console.error("❌ Error while voting:", err.message);
  }
};

// ✅ Get all polls for a teacher
exports.getPolls = async (req, res) => {
  const { teacherUsername } = req.params;

  try {
    if (!teacherUsername) {
      return res.status(400).json({ error: "Teacher username is required" });
    }

    const teacher = await Teacher.findOne({
      where: { username: teacherUsername },
    });

    if (!teacher) {
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

    console.log(`📚 ${polls.length} poll(s) found for ${teacherUsername}`);
    return res.status(200).json({ data: polls });
  } catch (err) {
    console.error("❌ Error fetching poll history:", err.message);
    return res.status(500).json({
      error: "Failed to fetch polls",
      details: err.message,
    });
  }
};
