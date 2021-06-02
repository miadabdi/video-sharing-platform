const CatchAsync = require("../utilities/CatchAsync");
const downloadImage = require("../utilities/downloadImage");

module.exports = CatchAsync(async (req, res, next) => {
	const { url } = req.body;

	const file = await downloadImage(url, req.user._id);
	req.file = file;

	next();
});
