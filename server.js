// uncaughtException should be defined at the very beginning of the proccess
process.on("uncaughtException", (err) => {
    console.log(err.name, err.message);
    console.log("UNHANDLED EXECPTION, SHUTTING DOWN...");
    process.exit(1);
});

const mongoose = require("mongoose");
const dotenv = require("dotenv");
// require("./services/caching");

dotenv.config({ path: "./config.env" });

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
        console.log("Connected to DB succesfully!");
    })
    .catch((err) => {
        console.log(`Failed to connect to DB: ${err}`);
    });

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`App started on port ${PORT}`);
});

process.on("unhandledRejection", (err) => {
    console.log(err.name, err.message);
    console.log("UNHANDLED REJECTION, SHUTTING DOWN...");
    server.close(() => {
        process.exit(1);
    });
});

process.on("SIGTERM", (err) => {
    console.log("SIGTERM EVENT, SHUTTING DOWN...");
    server.close(() => {});
});