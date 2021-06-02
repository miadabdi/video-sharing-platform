const express = require("express");

const { createComment, updateComment, createReply, updateReply } = require("../controller/comment");

const { protect } = require("../controller/auth");

const router = express.Router();

router.use(protect);

router.patch("/:commentId/reply/:replyId", updateReply);
router.patch("/:commentId", updateComment);
router.post("/:commentId", createReply);
router.post("/", createComment);

module.exports = router;
