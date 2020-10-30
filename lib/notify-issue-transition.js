"use strict";
const monitor  = require("./monitor.js");
const config  = require("../config.json");
const email = require("./email.js");
const fs = require('fs').promises;
const fetch = require("node-fetch");
const { Repository } = require("./github.js");


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

const REPO_MATCHES = [
  "https://github.com/\([-_a-zA-Z0-9]+/[-_a-zA-Z0-9]+\)/",
  "https://raw.githack.com/\([-_a-zA-Z0-9]+/[-_a-zA-Z0-9]+\)/",
  "https://pr-preview.s3.amazonaws.com/\([-_a-zA-Z0-9]+/[-_a-zA-Z0-9]+\)",
];

function findGroup(issue) {
  let repo,
    index = 0;

  while (!repo && index < REPO_MATCHES.length) {
    repo = issue.body.match(REPO_MATCHES[index++]);
  }
  if (!repo) {
    repo = issue.body.match("https://\([-_a-zA-Z0-9]+\).github.io/\([-_a-zA-Z0-9]+\)/?");
    if (repo) {
      repo = `${repo[1]}/${repo[2]}`;
    } else {
      // csswg, fxtf, css-houdini
      repo = issue.body.match("https://drafts.\([-a-zA-Z]+\).org/");
      if (repo) {
        repo = `w3c/${repo[1]}-drafts`;
      } else {
        repo = issue.body.match("https://drafts.\([-a-zA-Z]+\).org/");
      }
    }
  } else {
    repo = repo[1];
  }
  if (repo) {
    repo = new Repository(repo);
    return repo.w3c.then(w3c => {
      if (!w3c.group) {
        return undefined;
      } else {
        return w3c.group;
      }
    }).catch(err => {
      monitor.error(`No repository ${repo} ?`);
      monitor.error(err);
      return undefined;
    });
  }
  return undefined;
}

async function message(issue) {
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
  mail.text    = "This is a transition request: " + issue.title
    + "\nfrom https://github.com/w3c/transitions/issues/" + issue.number
    + "\n\n" + issue.body;
  mail.text += "\n\n-- \nThis email was generated automatically using https://github.com/w3c/transition-issues-bot"
  // WAI handling
  const LOGINS = [ 'michael-n-cooper', 'ruoxiran', 'nitedog', 'slhenry' ];
  let extraNotify = LOGINS.includes(issue.user.login);
  if (!extraNotify) {
    const groupId = await findGroup(issue);
    const GROUPS = [ 35422, 83907, 83726, 35532 ];
    extraNotify = groupId && groupId.reduce((a, c) => a || GROUPS.includes(c), false);
    if (!groupId) {
      monitor.error(`No group found for ${issue.html_url} - ${issue.title}`);
    }
  }
  if (extraNotify) {
    return email(mail).then(res => {
      monitor.log(`WAI notification for ${issue.title}`);

      transitions.setIssueAssignee(issue, [ "brewerj" ]).catch(monitor.error);
      mail.to = 'jbrewer@w3.org';
      mail.bcc = undefined;
      mail.replyTo = undefined;
      mail.subject = "[Transition approval request] " + issue.title;
      return email(mail);
    })
  } else {
    return email(mail);
  }
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


let transitions = new Repository(config.repository);

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
