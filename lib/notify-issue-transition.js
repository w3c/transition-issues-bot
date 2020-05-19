"use strict";
const monitor  = require("./monitor.js");
const email = require("./email.js");
const fs = require('fs').promises;
const fetch = require("node-fetch");
const Repository = require("./GitHub.js");


const NOTIFICATIONS = "./notifications.json";

let pastNotifications = [];

// @@load closed issues number to bootstrap the thing
fs.readFile(NOTIFICATIONS).then(JSON.parse).then(data => {
  pastNotifications = data;
  monitor.log("Notified " + data.length + " times in the past");
}).catch(err => {
  transitions.getAwaitingDirector().then(issues => {
    issues.forEach(issue => {
      gotNotified(issue.number);
    });
  });
});

function wasNotified(identifier) {
  return pastNotifications.find(notification => notification.identifier == identifier);
}

function gotNotified(identifier) {
  pastNotifications.push({identifier, date: (new Date())});
  fs.writeFile(NOTIFICATIONS, JSON.stringify(pastNotifications)).catch(monitor.error);
  monitor.log("notified " + identifier);
}

const WEBHOOKS = "./webhooks.json";

let hooks = [];

// @@load closed issues number to bootstrap the thing
fs.readFile(WEBHOOKS).then(JSON.parse).then(data => {
  hooks = data;
  monitor.log("Handling " + data.length + " webhooks");
}).catch(monitor.error);

function addHook(url) {
  if (!hooks.includes(url)) {
    monitor.log("Add webhook " + url);
    hooks.push(url);
    fs.writeFile(WEBHOOKS, JSON.stringify(hooks)).catch(monitor.error);
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
      replyTo: "public-transition-announce@w3.org",
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
  const LOGINS = [ 'michael-n-cooper', 'ruoxiran', 'nitedog', 'slhenry' ];
  let extraNotify = LOGINS.includes(issue.user.login);
  if (!extraNotify) {
    const groupId = await findGroup(issue);
    const GROUPS = [ 35422, 83907, 83726, 35532 ];
    extraNotify = groupId && GROUPS.includes(groupId);
    if (!groupId) {
      monitor.error(`No group found for ${issue.html_url} - ${issue.title}`);
    }
  }
  if (extraNotify) {
    monitor.log(`Ping Judy for ${issue.title}`);
  }

  return email(mail);
}

function pingHooks(issue) {
  hooks.forEach(hook => {
    fetch.post(hook, { method: 'POST',
        body: JSON.stringify(issue),
        headers: { 'Content-Type': 'application/json' }
      }).then(res => {
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

  // anti-spam
  if (issue.title.includes("<title>")
    || !issue.body
    || !issue.body.includes("https://")
    || (!issue.body.includes("github.io")
        && !issue.body.includes("w3.org"))) {
    monitor.warn("Issue " + issue.number + " looks like SPAM to me");
    return;
  }

  message(issue).catch(err => {
    monitor.error(err);
  }).then(() => {
    monitor.log(`Message sent for ${issue.number}`);
    pingHooks(issue);
    gotNotified(issue.number);
  });
}


let transitions = new Repository();

function action() {
  transitions.getAwaitingDirector().then(issues => {
    issues.forEach(issue => {
      notify(issue);
    });
  }).catch(monitor.error);
}

function updateNotifications() {
  action();
  setTimeout(updateNotifications, 3600000); //every hour
}

setTimeout(updateNotifications, 10000); // wait 10 seconds before working

module.exports = { notify: notify, nudge: action, addHook: addHook};
