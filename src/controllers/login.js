const Teacher = require("../models/Teacher");

exports.TeacherLogin = async (req, res) => {
  try {
    const randomNumber = Math.floor(1000 + Math.random() * 9000);
    const username = `teacher${randomNumber}`;
    const newTeacher = await Teacher.create({ username });

    res.status(201).json({
      status: "success",
      username: newTeacher.username,
    });
  } catch (err) {
    res.status(500).json({ error: "Login failed", details: err.message });
  }
};
