const express = require("express");
const { protect, isLoggedIn } = require("../controller/auth");
const {
	createPlaylist,
	updatePlaylist,
	addToPlaylist,
	deletePlaylist,
	getPlaylist,
	removeFromPlaylist,
} = require("../controller/playlist");

const router = express.Router();

router.get("/:playlistId", isLoggedIn, getPlaylist);

router.use(protect);
router.post("/:playlistId/addToPlaylist", addToPlaylist);
router.post("/:playlistId/removeFromPlaylist", removeFromPlaylist);
router.patch("/:playlistId", updatePlaylist);
router.delete("/:playlistId", deletePlaylist);
router.post("/", createPlaylist);

module.exports = router;
