'use strict';

const async = require('async');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const ses = require('nodemailer-ses-transport');
const passport = require('passport');
const User = require('../models/User');
const utils = require('../config/utils');

const transporter = nodemailer.createTransport(ses({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
}));
// const transporter = nodemailer.createTransport({
//   service: 'SendGrid',
//   auth: {
//     user: process.env.SENDGRID_USER,
//     pass: process.env.SENDGRID_PASSWORD
//     // token: process.env.SENDGRID_TOKEN
//   }
// });

/* *****************************************
  GET /login
  Login page.
***************************************** */
exports.getLogin = (req, res) => {
  if (req.user) {
    return res.redirect('/');
  }
  res.render('account/login', {
    title: 'Login'
  });
};

/* *****************************************
  POST /login
  Sign in using email and password.
***************************************** */
exports.postLogin = (req, res, next) => {
  req.assert('email', 'Email is not valid').isEmail();
  req.assert('password', 'Password cannot be blank').notEmpty();
  req.sanitize('email').normalizeEmail({remove_dots: false});
  const rememberMe = req.body.rememberMe; // values will be 'on' or undefined
  const errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/login');
  }

  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      req.flash('errors', info);
      return res.redirect('/login');
    }
    req.logIn(user, (loginErr) => { // http://passportjs.org/docs/login
      if (loginErr) {
        return next(loginErr);
      }

      // set a cookie
      if (rememberMe !== undefined) {
        // pass in a user and get back a token
        utils.issueToken(req.user, function (rememberErr, token) {
          const maxAge = utils.getMaxAge(); // TODO return maxAge from issueToken

          if (rememberErr) {
            return next(rememberErr);
          }
          res.cookie('remember_me', token, {path: '/', httpOnly: true, maxAge});
          return next();
        });
      }
      req.flash('success', {msg: 'Success! You are logged in.'});
      res.redirect(req.session.returnTo || '/');
    });
  })(req, res, next);
};

/* *****************************************
  GET /logout
  Log out.
***************************************** */
exports.logout = (req, res) => {
  // TODO call utils function that deletes the userToken
  if (req.user) {
    utils.deleteToken(req.user.id, req.cookies.remember_me);
    console.log(`logging out user ${req.user.id}`);
  }
  res.clearCookie('remember_me');
  req.logout();
  res.redirect('/');
};

/* *****************************************
  GET /signup
  Signup page.
***************************************** */
exports.getSignup = (req, res) => {
  if (req.user) {
    return res.redirect('/');
  }
  res.render('account/signup', {
    title: 'Create Account'
  });
};

/* *****************************************
  POST /signup
  Create a new local account.
***************************************** */
exports.postSignup = (req, res, next) => {
  req.assert('email', 'Email is not valid').isEmail();
  req.assert('password', 'Password must be at least 4 characters long').len(4);
  req.assert('confirmPassword', 'Passwords do not match').equals(req.body.password);
  req.sanitize('email').normalizeEmail({remove_dots: false});

  const errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/signup');
  }

  const user = new User({
    email: req.body.email,
    password: req.body.password
  });

  User.findOne({email: req.body.email}, (err, existingUser) => {
    if (existingUser) {
      req.flash('errors', {msg: 'Account with that email address already exists.'});
      return res.redirect('/signup');
    }
    user.save((saveErr) => { // create a new user
      if (saveErr) {
        return next(saveErr);
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          return next(loginErr);
        }
        res.redirect('/');
      });
    });
  });
};

/* *****************************************
  GET /account
  Profile page.
***************************************** */
exports.getAccount = (req, res) => {
  res.render('account/profile', {
    title: 'Account Management'
  });
};

/* *****************************************
  POST /account/profile
  Update profile information.
***************************************** */
exports.postUpdateProfile = (req, res, next) => {
  req.assert('email', 'Please enter a valid email address.').isEmail();
  req.sanitize('email').normalizeEmail({remove_dots: false});

  const errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/account');
  }

  User.findById(req.user.id, (err, user) => {
    if (err) {
      return next(err);
    }
    user.email = req.body.email || '';
    user.profile.name = req.body.name || '';
    user.profile.gender = req.body.gender || '';
    user.profile.location = req.body.location || '';
    user.profile.website = req.body.website || '';
    user.save((nextErr) => { // update an existing user
      if (nextErr) {
        if (nextErr.code === 11000) {
          req.flash('errors', {
            msg: 'The email address you have entered is already associated with an account.'
          });
          return res.redirect('/account');
        }
        return next(nextErr);
      }
      req.flash('success', {msg: 'Profile information has been updated.'});
      res.redirect('/account');
    });
  });
};

/* *****************************************
  POST /account/password
  Update current password.
***************************************** */
exports.postUpdatePassword = (req, res, next) => {
  req.assert('password', 'Password must be at least 4 characters long').len(4);
  req.assert('confirmPassword', 'Passwords do not match').equals(req.body.password);

  const errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/account');
  }

  User.findById(req.user.id, (err, user) => {
    if (err) {
      return next(err);
    }
    user.password = req.body.password;
    user.save((nextErr) => { // update a user password
      if (nextErr) {
        return next(nextErr);
      }
      req.flash('success', {msg: 'Password has been changed.'});
      res.redirect('/account');
    });
  });
};

/* *****************************************
  POST /account/delete
  Delete user account.
***************************************** */
exports.postDeleteAccount = (req, res, next) => {
  User.remove({_id: req.user.id}, (err) => {
    if (err) {
      return next(err);
    }
    req.logout();
    req.flash('info', {msg: 'Your account has been deleted.'});
    res.redirect('/');
  });
};

/* *****************************************
  GET /account/unlink/:provider
  Unlink OAuth provider.
***************************************** */
exports.getOauthUnlink = (req, res, next) => {
  const provider = req.params.provider;

  User.findById(req.user.id, (err, user) => {
    if (err) {
      return next(err);
    }
    user[provider] = undefined;
    user.tokens = user.tokens.filter(token => token.kind !== provider);
    user.save((nextErr) => {
      if (nextErr) {
        return next(nextErr);
      }
      req.flash('info', {msg: `${provider} account has been unlinked.`});
      res.redirect('/account');
    });
  });
};

/* *****************************************
  GET /reset/:token
  Reset Password page.
***************************************** */
exports.getReset = (req, res, next) => {
  if (req.isAuthenticated()) {
    return res.redirect('/');
  }
  User
    .findOne({passwordResetToken: req.params.token})
    .where('passwordResetExpires').gt(Date.now())
    .exec((err, user) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        req.flash('errors', {
          msg: 'Password reset token is invalid or has expired.'
        });
        return res.redirect('/forgot');
      }
      res.render('account/reset', {
        title: 'Password Reset'
      });
    });
};

/* *****************************************
  POST /reset/:token
  Process the reset password request.
***************************************** */
exports.postReset = (req, res, next) => {
  req.assert('password', 'Password must be at least 4 characters long.').len(4);
  req.assert('confirm', 'Passwords must match.').equals(req.body.password);

  const errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('back');
  }

  async.waterfall([
    function (done) {
      User
        .findOne({passwordResetToken: req.params.token})
        .where('passwordResetExpires').gt(Date.now())
        .exec((err, user) => {
          if (err) {
            return next(err);
          }
          if (!user) {
            req.flash('errors', {msg: 'Password reset token is invalid or has expired.'});
            return res.redirect('back');
          }
          user.password = req.body.password;
          user.passwordResetToken = undefined;
          user.passwordResetExpires = undefined;
          user.save((saveErr) => {
            if (saveErr) {
              return next(saveErr);
            }
            req.logIn(user, (loginErr) => {
              done(loginErr, user);
            });
          });
        });
    },
    function (user, done) {
      let messageText = 'Greetings from SendLove.io!\n\n';

      messageText += `This is a confirmation that the password for your account ${user.email} has been changed.\n\n`;
      messageText += 'Please let us know if you did not request this change. Thanks!\n\nThe Sendlove.io Team';

      const mailOptions = {
        to: user.email,
        from: 'joe@sendlove.io',
        subject: 'Your SendLove.io password has been changed',
        text: messageText
      };

      transporter.sendMail(mailOptions, (err) => {
        req.flash('success', {msg: 'Success! Your password has been changed.'});
        done(err);
      });
    }
  ], (err) => {
    if (err) { return next(err); }
    res.redirect('/');
  });
};

/* *****************************************
  GET /forgot
  Forgot Password page.
***************************************** */
exports.getForgot = (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/');
  }
  res.render('account/forgot', {
    title: 'Forgot Password'
  });
};

/* *****************************************
  POST /forgot
  Create a random token, then the send user an email with a reset link.
***************************************** */
exports.postForgot = (req, res, next) => {
  req.assert('email', 'Please enter a valid email address.').isEmail();
  req.sanitize('email').normalizeEmail({remove_dots: false});

  const errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/forgot');
  }

  async.waterfall([
    function (done) {
      crypto.randomBytes(16, (err, buf) => {
        const token = buf.toString('hex');
        done(err, token);
      });
    },
    function (token, done) {
      User.findOne({email: req.body.email}, (err, user) => {
        if (!user) {
          req.flash('errors', { msg: 'Account with that email address does not exist.' });
          return res.redirect('/forgot');
        }
        user.passwordResetToken = token;
        user.passwordResetExpires = Date.now() + 3600000; // 1 hour
        user.save((err) => {
          done(err, token, user);
        });
      });
    },
    function (token, user, done) {
      let messageText = 'Greetings from Sendlove.io! You (or someone else) has requested a password reset.\n\n ';

      messageText += 'Please click on the following link, or paste this into your browser to complete the process:\n\n';
      messageText += `http://${req.headers.host}/reset/${token}\n\n`;
      messageText += 'If you did not request this, please ignore this email and your password will remain unchanged.\n';

      const mailOptions = {
        to: user.email,
        from: 'joe@sendlove.io',
        subject: 'Reset your password on SendLove.io',
        text: messageText
      };

      transporter.sendMail(mailOptions, (err) => {
        if (err) {
          req.flash('errors', {msg: err.message});
          return res.redirect('/forgot');
        }
        req.flash('info', {msg: `An e-mail has been sent to ${user.email} with further instructions.`});
        done(err);
      });
    }
  ], (err) => {
    if (err) { return next(err); }
    res.redirect('/forgot');
  });
};
