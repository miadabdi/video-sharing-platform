const Path = require("path");

function getFilenameAndExt(path) {
	const fullFilename = Path.basename(path);
	const lastDotIndex = fullFilename.lastIndexOf(".");
	const filename = fullFilename.substring(0, lastDotIndex);
	const ext = fullFilename.substring(lastDotIndex + 1);
	return [filename, ext];
}

module.exports = getFilenameAndExt;
