const express = require("express");

const {
    googleOauth,
    googleOauthCallback,
    githubOauth,
    githubOauthCallback
} = require("../controller/oAuth");

const {
    signup,
    login,
    forgotPassword,
    ResetPassword,
    logOut,
    updatePassword,
    protect,
    deleteMe
} = require("../controller/auth");

const router = express.Router();


// oAuth2
router.get("/google/callback", googleOauthCallback);
router.get("/google", googleOauth);
router.get("/github/callback", githubOauthCallback);
router.get("/github", githubOauth);


router.post("/signup", signup);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.patch("/reset-password", ResetPassword);
router.get("/logout", logOut);

router.use(protect);
router.patch("/update-password", updatePassword);
router.delete("/delete-me", deleteMe);


module.exports = router;
