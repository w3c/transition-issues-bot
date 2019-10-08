"use strict";
const monitor  = require("./monitor.js");
const nodemailer = require("nodemailer");

let MAILING_LIST, SENDER_EMAIL;

if (process.env.NODE_ENV == 'production') {
  MAILING_LIST = "public-transition-announce@w3.org";
  BCC = "w3t-comm@w3.org,chairs@w3.org";
  SENDER_EMAIL = "sysbot+notifier@w3.org";
} else {
  MAILING_LIST = "plh@w3.org";
  BCC = "";
  SENDER_EMAIL = "plh@w3.org";
}

function sendMail(options) {
  monitor.log("[Email] To:" + options.to + " Subject: " + options.subject);

  let transporter = nodemailer.createTransport({
    sendmail: true,
    newline: 'unix',
    path: '/usr/sbin/sendmail'
  });
  transporter.sendMail(options, (error, info) => {
    if (error) {
      monitor.error(JSON.stringify(error));
    } else {
      monitor.log("Message sent for issue " + issue.number);
      gotNotified(issue.number);
      io.save(NOTIFICATIONS, pastNotifications).catch(monitor.error);
    }
  });
}

module.exports = notify;
