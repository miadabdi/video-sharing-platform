const nodemailer = require("nodemailer");

class Email {
	static _instance = null;
	constructor() {
		if (Email._instance) {
			return Email._instance;
		}
		Email._instance = this;

		this.from = `${process.env.EMAIL_SENDER} <${process.env.EMAIL_ADDRESS}>`;
		this.transporter = nodemailer.createTransport({
			//host: process.env.EMAIL_SERVER,
			//port: parseInt(process.env.EMAIL_PORT, 10),
			service: "gmail",
			auth: {
				user: process.env.EMAIL_USERNAME,
				pass: process.env.EMAIL_PASSWORD,
			},
			secure: process.env.NODE_ENV === "production",
		});
	}

	async sendMail(text, subject, email, template = undefined) {
		const mailOptions = {
			from: this.from,
			to: email,
			subject,
			text,
			html: template,
		};
		// sending mail
		// Returns the results and can be assigned to a variable
		await this.transporter.sendMail(mailOptions);
	}

	async sendForgotToken(token, req, email) {
		// sending reset token
		// const message = `Your reset token: ${token}\nClick the link to reset your password: ${req.protocol}://${req.headers.host}/reset/${token}`;
		const message = `Your reset token: ${token}\nToken is valid for 10 minutes`;
		await this.sendMail(message, "Youtube: Reset Token", email);
	}

	async sendOneTimePass(oneTimePass, user) {
		const message = `Dear ${
			user.fullname.split(" ")[0]
		},\nAn attempt was made to login to your account, if you didn't make this attempt please ignore this message.\n Your one time passcode: ${oneTimePass}\n This passcode will expire in 10 minutes.`;

		await this.sendMail(message, `Youtube: One time passcode`);
	}
}

module.exports = new Email();
