const { Op } = require("sequelize");
const Poll = require("../models/Poll");
const Option = require("../models/Option");
const Teacher = require("../models/Teacher");

// ✅ Create a new poll
exports.createPoll = async (pollData) => {
  try {
    console.log("📩 Creating poll for:", pollData.teacherUsername);

    // 🔍 Find teacher by username (case-insensitive)
    const teacher = await Teacher.findOne({
      where: {
        username: {
          [Op.iLike]: pollData.teacherUsername,
        },
      },
    });

    if (!teacher) {
      console.warn("❌ Teacher not found:", pollData.teacherUsername);
      throw new Error("Teacher not found");
    }

    // 🚫 Prevent multiple active polls per teacher
    const existingPoll = await Poll.findOne({
      where: { TeacherId: teacher.id, status: "active" },
    });

    if (existingPoll) {
      throw new Error("An active poll already exists. Complete it before creating a new one.");
    }

    // ✅ Create new poll
    const newPoll = await Poll.create({
      question: pollData.question,
      timer: pollData.timer || 60,
      status: "active",
      TeacherId: teacher.id,
    });

    // ✅ Create options
    const formattedOptions = pollData.options.map((option) => ({
      text: option.text,
      correct: !!option.correct,
      votes: 0,
      PollId: newPoll.id,
    }));

    await Option.bulkCreate(formattedOptions);

    // ✅ Fetch poll with options
    const pollWithOptions = await Poll.findOne({
      where: { id: newPoll.id },
      include: {
        model: Option,
        attributes: ["id", "text", "votes", "correct"],
      },
    });

    console.log("🟢 Poll created successfully:", newPoll.id);

    return {
      id: pollWithOptions.id,
      question: pollWithOptions.question,
      timer: pollWithOptions.timer,
      options: pollWithOptions.Options,
    };
  } catch (error) {
    console.error("❌ Error in createPoll:", error.message);
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
      console.warn(`⚠️ Option not found: "${optionText}" in poll ${pollId}`);
      return;
    }

    option.votes += 1;
    await option.save();

    console.log(`🗳️ Vote recorded for "${option.text}" (Poll ${pollId})`);
  } catch (err) {
    console.error("❌ Error in voteOnOption:", err.message);
  }
};

// ✅ Get poll history for a teacher
exports.getPolls = async (req, res) => {
  const { teacherUsername } = req.params;

  try {
    if (!teacherUsername) {
      return res.status(400).json({ error: "Teacher username is required" });
    }

    // 🔍 Find teacher (case-insensitive)
    const teacher = await Teacher.findOne({
      where: {
        username: {
          [Op.iLike]: teacherUsername,
        },
      },
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

    console.log(`📚 ${polls.length} poll(s) found for ${teacherUsername}`);
    return res.status(200).json({ data: polls });
  } catch (err) {
    console.error("❌ Error in getPolls:", err.message);
    return res.status(500).json({
      error: "Failed to fetch poll history",
      details: err.message,
    });
  }
};
