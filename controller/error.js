const mongoose = require("mongoose");
const multer = require("multer");
const AppError = require("../utilities/AppError");
const logger = require("../utilities/logger");

const sendErrDev = (err, res, req) => {
	// Sending error in development mode with the most information

	// if it is req to api send json
	if (req.originalUrl.startsWith("/api")) {
		res.status(err.statusCode).json({
			status: err.status,
			message: err.message,
			error: err,
			stack: err.stack,
		});
	} else {
		// else render error page

		res.status(err.statusCode).render("error", {
			title: "Something went wrong!",
			message: err.message,
		});
	}
};
const sendErrProd = (err, res, req) => {
	// Sending error with just the message because of production
	if (err.isOperational) {
		if (req.originalUrl.startsWith("/api")) {
			return res.status(err.statusCode).json({
				status: err.status,
				message: err.message,
			});
		}
		res.status(err.statusCode).render("error", {
			title: "Something went wrong!",
			message: err.message,
		});
	} else {
		// unknown or programming errors
		logger.error(err);

		// Then sending back the response
		if (req.originalUrl.startsWith("/api")) {
			return res.status(500).json({
				status: "error",
				message: "Something went wrong!",
			});
		}
		res.status(err.statusCode).render("error", {
			title: "Something went wrong!",
			message: "Please try again later",
		});
	}
};

const handleJWT = (err) => {
	return new AppError("Please login again. Token is not valid", 400);
};

const handleDuplicateFields = (err) => {
	const value = err.message.match(/(["'])(\\?.)*?\1/)[0];
	return new AppError(`Duplicate field value ${value}. Please use another value`, 400);
};

const handleValidationError = (err) => {
	const errorMessages = Object.values(err.errors).map((error) => `${error.properties.message} `);
	const message = `invalid data input: ${errorMessages}`;
	return new AppError(message, 400);
};

const handleCastErrorDB = (err) => new AppError(`Invalid ${err.path}: ${err.value}`, 400);

const handleMulterErr = (err) => new AppError("Error happened during file upload!", 409);

const handleExceededFileSize = (err) =>
	new AppError(
		`The file size limitation exceeded! File should be smaller than ${process.env.MAX_FILE_SIZE_UPLOAD}MB!`,
		413
	);

module.exports = (err, req, res, next) => {
	// Setting default values
	err.statusCode = err.statusCode || 500;
	err.status = err.status || "Error";

	// Send error in development
	if (process.env.NODE_ENV === "development") return sendErrDev(err, res, req);

	// Parse errors in production and then send the error
	// We wont make a copy of err because creating a full copy is not possible or very hard

	if (
		err.name === "JsonWebTokenError" ||
		err.name === "TokenExpiredError" ||
		err.name === "NotBeforeError"
	)
		err = handleJWT(err);
	if (err instanceof mongoose.Error.CastError) err = handleCastErrorDB(err);
	if (err.code === 11000) err = handleDuplicateFields(err);
	if (err instanceof mongoose.Error.ValidationError) err = handleValidationError(err);
	if (err.code === "LIMIT_FILE_SIZE") err = handleExceededFileSize(err);
	if (err instanceof multer.MulterError) err = handleMulterErr(err);

	sendErrProd(err, res, req);
};
