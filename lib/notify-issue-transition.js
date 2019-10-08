"use strict";
const monitor  = require("./monitor.js");
const io = require("io-promise");

const WEBHOOKS = "./webhooks.json";

let hooks = [];

// @@load closed issues number to bootstrap the thing
io.readJSON(WEBHOOKS).then(data => {
  WEBHOOKS = data;
  monitor.log("Handling " + data.length + " webhooks");
}).catch(monitor.error);

function addHook(url) {
  if (!WEBHOOKS.includes(url)) {
    monitor.log("Add webhook " + url);
    WEBHOOKS.push(url);
  } else {
    monitor.warn("Webhook " + url + " is already there");
  }
}

function message(issue) {
  // EMAIL
  let mail = {};
  if (process.env.NODE_ENV == 'production') {
    mail = {
      to: "public-transition-announce@w3.org",
      bcc: "w3t-comm@w3.org,chairs@w3.org";
      from: "sysbot+notifier@w3.org" }
  } else {
    mail = {
       to: "plh@w3.org",
       from: "plh@w3.org"
    }
  }
  mail.subject = "[transition] " + issue.title;
  mail.text    = issue.body;
  email.sendMail(mail);
}

function hooks(issue) {
  WEBHOOKS.forEach(hook => {
    io.post(hook, issue).then(res => {
      monitor.log("webhook " + hook + " was told");
    }).catch(err => {
      monitor.warn("webhook " + hook + "  failed " + err);
    });
  })
}

function notify(issue) {
  if (wasNotified(issue.number)) {
    monitor.log("Ignoring duplicate notification for issue " + issue.number);
    return;
  }
  message(issue);
  hooks(issue);
}


module.exports = { notify: notify, addHook: addHook};
