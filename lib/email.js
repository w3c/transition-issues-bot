"use strict";
const monitor  = require("./monitor.js");
const nodemailer = require("nodemailer");

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
