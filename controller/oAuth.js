const Axios = require("axios");
const {google} = require('googleapis');
const UserModel = require("../models/User");
const CatchAsync = require("../utilities/CatchAsync");
const AppError = require("../utilities/AppError");
const {setTokenCookie} = require('./auth');
const downloadImage = require("../utilities/downloadImage");

const redirectSetToken = (res, user) => {
    setTokenCookie(res, user);
    res.status(302).redirect("/");
}

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_CALLBACK_URL
    //"http://127.0.0.1:5000/api/auth/google/callback"
);

const handleUserLogin = async (data, tokens, serviceProvider) => {
    let user;
    user = await UserModel.findOne({email: data.email});
    if(!user) {
        // we download the avatar at this point, because if the user signed up before
        // the user probably has an avatar picture
        if(data.avatar) {
            // sending current time in number as userId,
            // because we haven't made a user document at this point
            const file = await downloadImage(data.avatar, `avatar-${Date.now()}` );
            data.avatar = file.fileName;
        }

        const userData = {
            fullname: data.name,
            email: data.email,
            avatar: data.avatar
        };

        // adding tokens
        userData[serviceProvider] = {
            id: data.id,
            tokens
        };

        user = await UserModel.create(userData);
    } else {
        user[serviceProvider] = {
            id: data.id,
            tokens
        };

        // if account was deleted before, after login set account to active
        user.isActive = true;
        await user.save();
    }

    return user;
};

exports.googleOauthCallback = CatchAsync(async(req, res, next) => {
    const authCode = req.query.code;
    const {tokens} = await oauth2Client.getToken(authCode);

    const userinfo = await google.oauth2("v2").userinfo.get({
        oauth_token: tokens.access_token
    });

    const user = await handleUserLogin({
        id: userinfo.data.id,
        email: userinfo.data.email,
        name: userinfo.data.name,
        avatar: userinfo.data.picture 
    }, tokens, "google");

    redirectSetToken(res, user);
});

exports.googleOauth = CatchAsync(async(req, res, next) => {
    const scopes = [
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
        "openid"
    ];

    const url = oauth2Client.generateAuthUrl({
        // 'online' (default) or 'offline' (gets refresh_token)
        access_type: 'offline',
      
        // If you only need one scope you can pass it as a string
        scope: scopes
    });

    res.status(200).redirect(url);
});

exports.githubOauth = CatchAsync(async(req, res, next) => {
    const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_OAUTH_CLIENT_ID}&scope=read:user,user:email`;

    res.status(302).redirect(redirectUrl);
});

exports.githubOauthCallback = CatchAsync(async(req, res, next) => {
    body = {
        client_id: process.env.GITHUB_OAUTH_CLIENT_ID,
        client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
        code: req.query.code
    };

    // getting access token
    const result = await Axios({
        method: "POST",
        url: `https://github.com/login/oauth/access_token`,
        headers: { accept: 'application/json' },
        data: body
    });
    
    const access_token = result.data.access_token;

    // getting user info
    const userinfo = await Axios({
        method: "GET",
        url: `https://api.github.com/user`,
        headers: {
            'Authorization': `token ${access_token}`
        }
    });

    // getting user email and taking out primary email
    // the reason we are doing this is, if the user has set email visibility to false
    // email will be set to null on the request above, so we have to make an 
    // aditional request for emails, which is the request below.
    const userEmails = await Axios({
        method: "GET",
        url: `https://api.github.com/user/emails`,
        headers: {
            'Authorization': `token ${access_token}`
        }
    });

    const primaryEmail = (userEmails.data.find(item => item.primary === true)).email;

    // github only provides access token which never expires
    const tokens = {access_token};

    const user = await handleUserLogin({
        id: userinfo.data.id,
        email: primaryEmail,
        name: userinfo.data.name,
        avatar: userinfo.data.picture
    }, tokens, "github");

    redirectSetToken(res, user);
});