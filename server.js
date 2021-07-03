const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config({ path: "./config.env" });

const logger = require("./utilities/logger");
// require("./services/caching");

// uncaughtException should be defined at the very beginning of the process
process.on("uncaughtException", (err) => {
	logger.error(err);
	logger.info("UNHANDLED EXECPTION, SHUTTING DOWN...");

	// always terminate process in uncaughtException.
	// The state of program is not suitable to continue running.
	process.exit(1);
});

const app = require("./app");

const DBConStr = process.env.DB_CONNECTION_STRING;
mongoose
	.connect(DBConStr, {
		useNewUrlParser: true,
		useCreateIndex: true,
		useUnifiedTopology: true,
		useFindAndModify: false,
	})
	.then(() => {
		logger.info("Connected to DB succesfully!");
	})
	.catch((err) => {
		logger.error("Failed to connect to DB", err);
	});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
	logger.info(`App started on port ${PORT}`);
});

process.on("unhandledRejection", (err) => {
	logger.error(err);
	logger.info("UNHANDLED REJECTION, SHUTTING DOWN...");
	server.close(() => {
		process.exit(1);
	});
});

process.on("SIGTERM", (err) => {
	logger.error(err);
	logger.info("SIGTERM EVENT, SHUTTING DOWN...");
	server.close(() => {});
});
