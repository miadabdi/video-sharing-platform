const jwt = require("jsonwebtoken");
const { promisify } = require("util");
const crypto = require("crypto");
const UserModel = require("../models/User");
const CatchAsync = require("../utilities/CatchAsync");
const AppError = require("../utilities/AppError");
const Email = require("../services/Email");

// TODO: maybe refresh token?

exports.signToken = (userID) => {
	// signing jwt token
	return jwt.sign({ id: userID }, process.env.JWT_SECRET, {
		expiresIn: process.env.JWT_EXPIRES_IN,
	});
};

exports.setTokenCookie = (res, user) => {
	const token = exports.signToken(user._id);

	// httpOnly prevents access to token in client's browser, so it is safe
	const cookieOptions = {
		expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000),
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		// Secure makes it so token will be sent only in secure(ssl, tls) connections
	};

	res.cookie("jwt", token, cookieOptions);
};

exports.createSendToken = (res, user, statusCode, message = undefined) => {
	exports.setTokenCookie(res, user);

	// Removing unnecessary fields from output
	user.password = undefined;
	user.google = undefined;
	user.github = undefined;
	user.isActive = undefined;
	user.__v = undefined;

	res.status(statusCode).json({
		status: "success",
		message,
		data: {
			user,
		},
	});
};

exports.signup = CatchAsync(async (req, res, next) => {
	// test if user was created with this email but isActive is set to false (account was deleted)
	let user = await UserModel.findOne({ email: req.body.email }).select("+isActive");

	// if the user exists and isActive(was deleted), then we grant access to reactivate it
	if (user && !user.isActive) {
		// user document exists, just updating it
		user.fullname = req.body.fullname;
		user.email = req.body.email;
		user.password = req.body.password;
		user.passwordConfirm = req.body.passwordConfirm;
		user.isActive = true;
		await user.save();
	} else {
		// Creating user
		user = await UserModel.create({
			fullname: req.body.fullname,
			email: req.body.email,
			password: req.body.password,
			passwordConfirm: req.body.passwordConfirm,
		});
	}

	exports.createSendToken(res, user, 201, "Signed up successfully.");
});

exports.login = CatchAsync(async (req, res, next) => {
	const { email, password } = req.body;

	if (!email || !password) {
		return next(new AppError("Please provide email and password", 400));
	}

	// password field is not included in results by default
	// Account should be active
	const user = await UserModel.findOne({
		email,
		isActive: { $ne: false },
	}).select("+password");

	if (!user) {
		return next(new AppError("Email or password is wrong!", 401));
	}

	if (!user.password) {
		return next(
			new AppError(
				"This account was created through oAuth, Therefore you can only log in using oAuth"
			)
		);
	}

	if (!(await user.isPassCorrect(password, user.password))) {
		return next(new AppError("Email or password is wrong!", 401));
	}

	exports.createSendToken(res, user, 200, "Logged in successfully");
});

exports.isLoggedIn = CatchAsync(async (req, res, next) => {
	// Check if there is a token
	// Accept the token only from cookies
	let token;
	if (req.cookies.jwt) {
		token = req.cookies.jwt;
	} else {
		return next();
	}

	// Verify token
	let decoded;
	try {
		decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
	} catch (err) {
		// if token was modified or expired or not valid
		return next();
	}

	// Check if the user actually exists and is active
	const user = await UserModel.findById(decoded.id).select(
		"+isActive +passwordChangedAt +password"
	);

	if (!user || !user.isActive) return next();

	// checks if password is not changed since the token was issued
	const tokenIssuedAt = new Date(decoded.iat * 1000);
	// if tokenIssuedAt is smaller(older) than user.passwordChangedAt
	// then it means token was issued before password was changed
	if (user.passwordChangedAt && tokenIssuedAt < user.passwordChangedAt) return next();

	// Access granted
	req.user = user;
	res.locals.user = user;
	next();
});

exports.protect = CatchAsync(async (req, res, next) => {
	// Check if there is a token
	let token;
	if (req.cookies.jwt) {
		token = req.cookies.jwt;
	} else {
		return next(new AppError("Please Login!", 401));
	}

	// Verify token
	const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

	// Check if the user actually exists and is active
	const user = await UserModel.findOne({
		_id: decoded.id,
		isActive: { $ne: false },
	}).select("+passwordChangedAt +password");
	if (!user)
		return next(
			new AppError("This account was deleted! Please login to another account.", 401)
		);

	// checks if password is not changed since the token was issued
	const tokenIssuedAt = new Date(decoded.iat * 1000);
	// if tokenIssuedAt is smaller(older) than user.passwordChangedAt
	// then it means token was issued before password was changed
	if (user.passwordChangedAt && tokenIssuedAt < user.passwordChangedAt)
		return next(new AppError("Password is changed! Please login again."));

	req.user = user;
	res.locals.user = user;
	next();
});

exports.forgotPassword = CatchAsync(async (req, res, next) => {
	// Get the user
	const { email } = req.body;
	const user = await UserModel.findOne({ email }).select("+password");
	if (!user) {
		return next(new AppError("There is no user associated to this email!", 400));
	}

	// generate Token and save to DB and send back to client's email
	const token = user.genResetToken();

	await user.save({ validateBeforeSave: false });

	// the line below returns the result and can be assigned to a variable if needed
	await Email.sendForgotToken(token, req, user.email);

	res.status(200).json({
		status: "success",
		message: "Reset token is sent to your email",
	});
});

exports.ResetPassword = CatchAsync(async (req, res, next) => {
	// encode the token and get the user using that
	const { resetToken, password, passwordConfirm } = req.body;

	const decodedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

	const user = await UserModel.findOne({
		passwordResetToken: decodedToken,
		passwordResetExpire: { $gt: Date.now() },
	});

	// check if the token is expired or there is a user
	if (!user) {
		return next(new AppError("Token has expired or is invalid!", 401));
	}

	// set the password (passwordChangedAt will be updated automatically when saving)
	user.password = password;
	user.passwordConfirm = passwordConfirm;
	user.passwordResetToken = undefined;
	user.passwordResetExpire = undefined;
	await user.save();

	// TODO: Providing a link to the end user instead of a token

	// log the user in
	exports.createSendToken(res, user, 200, "Password has been reseted successfully");
});

exports.restrictedTo = (...allowedRoles) => {
	return (req, res, next) => {
		if (allowedRoles.includes(req.user.role)) {
			return next();
		}
		next(new AppError(`This is restricted to ${allowedRoles.reduce((el) => `${el} ,`)}`, 401));
	};
};

exports.updatePassword = CatchAsync(async (req, res, next) => {
	// check if fields were passed
	const { password, passwordConfirm, passwordCurrent } = req.body;

	if ((req.user.password && !passwordCurrent) || !passwordConfirm || !password) {
		// if password is not set for user, we won't demand it to update password
		return next(
			new AppError(
				`Please provide required fields: ${
					req.user.password ? "passwordCurrent, " : ""
				}password, passwordConfirm`,
				400
			)
		);
	}

	if (req.user.password) {
		// check the current password is correct
		if (!(await req.user.isPassCorrect(passwordCurrent, req.user.password))) {
			return next(new AppError("Current password is not correct!"));
		}
	}

	// save the password
	req.user.password = password;
	req.user.passwordConfirm = passwordConfirm;
	await req.user.save();

	// sign token and send back response
	exports.createSendToken(res, req.user, 200, "Password updated successfully!");
});

exports.deleteMe = CatchAsync(async (req, res, next) => {
	// if password is set, we demand it
	if (req.user.password) {
		// check if password was passed
		const { password } = req.body;
		if (!password) {
			return next(new AppError("Please provide your password.", 400));
		}

		// check the current password is correct
		if (!(await req.user.isPassCorrect(password, req.user.password))) {
			return next(new AppError("password is not correct!", 401));
		}
	}

	// setting isActive to false
	await UserModel.findByIdAndUpdate(req.user._id, { isActive: false });

	// send back response
	res.status(204).json({
		status: "success",
		message: "Account was deleted successfully!",
	});
});

exports.logOut = (req, res, next) => {
	res.cookie("jwt", "loggedout", {
		expiresIn: new Date(Date.now() + 1 * 1000),
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
	});

	res.status(200).json({
		status: "success",
		message: "Logged out successfully",
	});
};
