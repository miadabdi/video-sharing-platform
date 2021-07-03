const winston = require("winston");
const Path = require("path");

const { json, timestamp, combine, colorize, simple, errors } = winston.format;

const logsPath = process.env.LOG_FILES_DIR_PATH;

const logger = winston.createLogger({
	level: "info",
	format: combine(errors({ stack: true }), timestamp(), json()),
	transports: [
		new winston.transports.File({
			filename: Path.join(logsPath, "info.log"),
			// filename: "info.log",
			level: "info",
			maxsize: 20000, // in bytes: 20mb
		}),
		new winston.transports.Console({
			level: "info",
			format: combine(colorize(), errors({ stack: true }), simple()),
		}),
	],
	exitOnError: false,
});

module.exports = logger;
