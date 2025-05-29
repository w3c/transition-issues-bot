"use strict";
import nodemailer from 'nodemailer';
import * as config from "./config.js";
import debuglog from "debug";
import * as monitor from "./monitor.js";

const debug = debuglog('email');

const TOOL_NAME = "transition-issues-bot";
const FOOTER = "\n\nProduced by https://github.com/w3c/transition-issues-bot";

const transporter = nodemailer.createTransport({
  sendmail: true,
  newline: 'unix',
  path: '/usr/sbin/sendmail',
});

export
function email(options) {
  monitor.log("[Email] To:" + options.to + " Subject: " + options.subject);

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

let MAILING_LIST, SENDER_EMAIL;

if (process.production) {
  MAILING_LIST = ["plh@w3.org", "w3t-archive@w3.org"];
  SENDER_EMAIL = "noreply@w3.org";
}

export
function sendError(msg, error) {
  debug('error email would be sent if in production', error);
  if (!config.production) return;

  // if things go wrong, please call the maintainer
  const mailOptions = {
    from:  `${TOOL_NAME} <${SENDER_EMAIL}>`,
    to: "plh@w3.org",
    subject: `[tool] ${TOOL_NAME}: ${error} (error)`,
    text: `We've got an error on the ${TOOL_NAME} tool.\n ${msg}\n\n` + JSON.stringify(error, null, " ") + FOOTER
  };

  return transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.error(JSON.stringify(error));
    }
    console.log('Error message sent: %s', info.messageId);
  });

}

export default email;
