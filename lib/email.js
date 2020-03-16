"use strict";
const monitor  = require("./monitor.js");
const nodemailer = require("nodemailer");

function email(options) {
  monitor.log("[Email] To:" + options.to + " Subject: " + options.subject);

  let transporter = nodemailer.createTransport({
    sendmail: true,
    newline: 'unix',
    path: '/usr/sbin/sendmail'
  });
  return new Promise((resolve, reject) => {
    transporter.sendMail(options, (error, info) => {
      if (error) {
        reject(error);
      } else {
        resolve({options, info});
      }
    });
  });
}

module.exports = email;
