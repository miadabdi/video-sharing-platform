const path = require("path");
const fs = require("fs");
const axios = require("axios");
const mime = require("mime-types");
const AppError = require("./AppError");

const allowedToUpload = ["image"];
const uploadDirectory = path.join(__dirname, "../public/img");

module.exports = async(url, userId) => {
    // Testing if the file size is exceeded
    const head = await axios({
        url,
        method: "HEAD",
    });

    if (
        head.headers["content-length"] >
        process.env.MAX_FILE_SIZE_UPLOAD * 1024 * 1024
    ) {
        return new AppError(
                `The file size limitation exceeded! File should be smaller than ${process.env.MAX_FILE_SIZE_UPLOAD}MB!`,
                413
        );
    }

    const contentType = head.headers["content-type"];
    if (!contentType) {
        return new AppError(
                "This url does not provide mimetype. Download is not possible.",
                400
        );
    }

    if (!allowedToUpload.includes(contentType.split("/")[0])) {
        return new AppError("Only images are allowed!", 400);
    }

    const contentLength = head.headers["content-length"];
    const ext = mime.extension(contentType);
    const fileName = `${userId}-${Date.now()}${ext ? "." + ext : ""}`;
    const filePath = path.resolve(uploadDirectory, fileName);

    // Download the file
    const response = await axios({
        method: "GET",
        url,
        responseType: "stream",
    });

    // Writing the stream into a binary file
    response.data.pipe(fs.createWriteStream(filePath));

    const res = await new Promise((resolve, reject) => {
        response.data.on("end", () => {
            const file = {};
            file.size = contentLength;
            file.mimetype = contentType;
            file.fileName = fileName;
            file.path = `img/${fileName}`;
            resolve(file);
        });

        response.data.on("error", (err) => {
            reject(new AppError("Error occured during download. Please try again!", 500));
        });
    });

    return res;
}
