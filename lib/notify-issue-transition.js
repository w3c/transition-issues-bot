"use strict";
const monitor  = require("./monitor.js");
const email = require("./email.js");
const io = require("io-promise");

const NOTIFICATIONS = "./notifications.json";

let pastNotifications = [];

// @@load closed issues number to bootstrap the thing
io.readJSON(NOTIFICATIONS).then(data => {
  pastNotifications = data;
  monitor.log("Notified " + data.length + " times in the past");
}).catch(monitor.error);

function wasNotified(ident) {
  let found = pastNotifications.filter(n => n.identifier === ident);
  return (found.length !== 0);
}

function gotNotified(ident) {
  pastNotifications.push({identifier: ident, date: (new Date())});
  io.save(NOTIFICATIONS, pastNotifications).catch(monitor.error);
}

const WEBHOOKS = "./webhooks.json";

let hooks = [];

// @@load closed issues number to bootstrap the thing
io.readJSON(WEBHOOKS).then(data => {
  hooks = data;
  monitor.log("Handling " + data.length + " webhooks");
}).catch(monitor.error);

function addHook(url) {
  if (!hooks.includes(url)) {
    monitor.log("Add webhook " + url);
    hooks.push(url);
    io.save(WEBHOOKS, hooks).catch(monitor.error);
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
      bcc: "w3t-comm@w3.org,chairs@w3.org",
      from: "sysbot+notifier@w3.org" }
  } else {
    mail = {
       to: "plh@w3.org",
       from: "plh@w3.org"
    }
  }
  mail.subject = "[transition] " + issue.title;
  mail.text    = "From https://github.com/w3c/transitions/issues/" + issue.number + "\n\n" + issue.body;
  email.sendMail(mail);
}

function pingHooks(issue) {
  hooks.forEach(hook => {
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
  pingHooks(issue);
  gotNotified(issue.number);
}


module.exports = { notify: notify, addHook: addHook};
