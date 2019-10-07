"use strict";
const monitor  = require("./monitor.js");
const io = require("io-promise");
const nodemailer = require("nodemailer");

const NOTIFICATIONS = "./notifications.json";

let pastNotifications = [];

// @@load closed issues number to bootstrap the thing
io.readJSON(NOTIFICATIONS).then(data => {
  pastNotifications = data;
  monitor.log("Notified " + data.length + " issues in the past");
}).catch(monitor.error);


let MAILING_LIST, SENDER_EMAIL;

if (process.env.NODE_ENV == 'production') {
  MAILING_LIST = "public-transition-announce@w3.org";
  SENDER_EMAIL = "sysbot+notifier@w3.org";
} else {
  MAILING_LIST = "plh@w3.org";
  SENDER_EMAIL = "plh@w3.org";
}

function notify(issue) {
  let found = pastNotifications.filter(n => n.number === issue.number);
  if (found.length) {
    monitor.log("Ignoring duplicate notification for issue " + issue.number);
    return;
  }
  monitor.log("[Email] Notification: issue " + issue.number);

  let transporter = nodemailer.createTransport({
    sendmail: true,
    newline: 'unix',
    path: '/usr/sbin/sendmail'
  });
  transporter.sendMail({
    from: SENDER_EMAIL,
    to: MAILING_LIST,
    subject: "[transition] " + issue.title,
    text: issue.body
  }, (error, info) => {
    if (error) {
      monitor.error(JSON.stringify(error));
    } else {
      monitor.log("Message sent for issue " + issue.number);
      pastNotifications.push({number: issue.number, date: (new Date())});
      io.save(NOTIFICATIONS, pastNotifications).catch(monitor.error);
    }
  });
}

module.exports = notify;
