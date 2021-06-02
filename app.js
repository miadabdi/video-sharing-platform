const path = require("path");
const cookieParser = require("cookie-parser");
const rateLimiter = require("express-rate-limit");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const favicon = require("serve-favicon");
const hpp = require("hpp");
const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const AppError = require("./utilities/AppError");
const globalErrorHandler = require("./controller/error");
const userRoute = require("./routers/user");
const authRoute = require("./routers/auth");
const channelRoute = require("./routers/channel");
const videoRoute = require("./routers/video");
const commentRoute = require("./routers/comment");
const liveRoute = require("./routers/live");

const app = express();

// setting the view engine to pug and views directory
// app.set("view engine", "pug");
// app.set("views", path.join(__dirname, "views"));

// serving fav icon
app.use(favicon(path.resolve(__dirname, "public", "favicon.ico")));

// serving the public folder
app.use(express.static(path.join(__dirname, "public")));

if (process.env.NODE_ENV === "development") {
	app.use(morgan("dev"));
}

// setting security HTTP headers
app.use(helmet());

// Limiting number of requests to prevent
// DOS and brute force attacks
const limiter = rateLimiter({
	max: process.env.GENERAL_RATE_LIMITER_MAX,
	windowMs: process.env.GENERAL_RATE_LIMITER_TIME * 60 * 1000,
	message: `Too many requests from this IP. Please try again in ${process.env.GENERAL_RATE_LIMITER_TIME} minutes`,
});
app.use("/api", limiter);

const limiterAuth = rateLimiter({
	max: process.env.AUTH_RATE_LIMITER_MAX,
	windowMs: process.env.AUTH_RATE_LIMITER_TIME * 60 * 1000,
	message: `Too many requests from this IP for authentication. Please try again in ${process.env.AUTH_RATE_LIMITER_TIME} minutes`,
});
app.use("/api/auth", limiterAuth);

// accepting req.body and limiting the incoming data by 100kb of size as json
app.use(
	express.json({
		limit: "100kb",
	})
);

// accepting req.body and limiting the incoming data by 100kb of size as array or strings
app.use(
	express.urlencoded({
		limit: "100kb",
		extended: true,
	})
);

// cors
app.use(cors());

// accepting cookies
app.use(cookieParser());

// Data sanitization against NoSQL query attack
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// preventing HTTP parameter polution
app.use(hpp());

// ROUTES
app.use("/api/auth", authRoute);
app.use("/api/user", userRoute);
app.use("/api/channel", channelRoute);
app.use("/api/video", videoRoute);
app.use("/api/comment", commentRoute);
app.use("/api/live", liveRoute);

// Handling unhandled routes
app.all("*", (req, res, next) => {
	if (req.originalUrl.startsWith("/api")) {
		return next(new AppError(`can't find ${req.originalUrl} on this server!`, 404));
	}
	next(new AppError("Page not found! 404", 404));
});

// Global Error Handler
app.use(globalErrorHandler);

module.exports = app;
