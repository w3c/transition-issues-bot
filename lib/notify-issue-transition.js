"use strict";
const monitor  = require("./monitor.js");
const config  = require("./config.js");
const email = require("./email.js");
const fs = require('fs').promises;
const path = require('path');
const fetch = require("node-fetch");
const { Repository } = require("./github.js");


const NOTIFICATIONS = path.resolve(config.basedir, "notifications.json");

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

const WEBHOOKS = path.resolve(config.basedir, "webhooks.json");

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

function getGroup(identifier) {
  if (typeof identifier === "string" && identifier.match(/^[0-9]+$/)) {
    identifier = Number.parseInt(identifier);
  }
  return identifier;
}

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
  //    repo = new Repository(repo);
  //    return repo.w3c.then(w3c => {
    return fetch(`https://api.github.com/repos/${repo}/contents/w3c.json`)
      .then(JSON.parse)
      .then(w3c => {
        let groups = [];
        if (Array.isArray(w3c.group)) {
          groups = w3c.group.map(getGroup);
        } else if (w3c.group !== undefined) {
          groups = [getGroup(w3c.group)];
        }
        return groups;
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
      from: "sysbot+notifier@w3.org"
    };
  } else {
    mail = {
      to: "plh@w3.org",
      from: "plh@w3.org"
    };
  }

  let status;
  let status_text;

  if (issue.title.indexOf("] FPWD Request") !== -1) {
    status = 'WD';
    status_text = "for a First Public Working Draft";
  } else if (issue.title.indexOf("CR Request") !== -1) {
    status = 'CR';
    status_text = "for a Candidate Recommendation";
  } else if (issue.title.indexOf("] CR Snapshot Update Request") !== -1) {
    status = 'CRS';
    status_text = "for an update as a Candidate Recommendation Snapshot";
  } else if (issue.title.indexOf("] PR Request") !== -1) {
    status = 'PR';
    status_text = "for a new Proposed Recommendation";
  } else if (issue.title.indexOf("] REC Request") !== -1) {
    status = 'REC';
    status_text = "for a Recommendation";
  } else if (issue.title.indexOf("] REC Update Request") !== -1) {
    status = 'REC_update';
    status_text = "for an update to a Recommendation";
  } else if (issue.title.indexOf("] Obsolete") !== -1) {
    status = 'REC_obsolete';
    status_text = "to obsolete a Recommendation";
  } else if (issue.title.indexOf("] Supersede") !== -1) {
    status = 'REC_supersede';
    status_text = "to supersede a Recommendation";
  } else if (issue.title.indexOf("] First Note") !== -1) {
    status = 'Note';
    status_text = "for a First Public Note";
  } else if (issue.title.indexOf("] Statement") !== -1) {
    status = 'Statement';
    status_text = "for a Statement";
  } else if (issue.title.indexOf("] Statement Update Request") !== -1) {
    status = 'Statement_update';
    status_text = "for an update to a Statement";
  } else if (issue.title.indexOf("] DRY Request") !== -1) {
    status = 'DRY';
    status_text = "for a First Public Draft Registry";
  } else if (issue.title.indexOf("CRY Request") !== -1) {
    status = 'Candidate Registry';
    status_text = "for a Candidate Registry";
  } else if (issue.title.indexOf("] CRY Snapshot Update Request") !== -1) {
    status = 'CRY';
    status_text = "for an update as a Candidate Registry Snapshot";
  } else if (issue.title.indexOf("] Registry Request") !== -1) {
    status = 'Registry';
    status_text = "for a Registry";
  } else if (issue.title.indexOf("] Registry Update Request") !== -1) {
    status = 'Registry_update';
    status_text = "for an update to a Registry";
  }
  mail.subject = "[transition] " + issue.title;


  if (status_text) {
    mail.text    = `This is a transition request ${status_text}`;
  } else {
    mail.text = "";
  }

  if (status === 'REC') {
    // don't send emails on REC transitions
    return 'success';
  }

  mail.text += "\n" + issue.title
    + "\nfrom https://github.com/w3c/transitions/issues/" + issue.number
    + "\n\n" + issue.body;
  mail.text += "\n\n-- \nThis email was generated automatically using https://github.com/w3c/transition-issues-bot"
  // WAI handling
  const LOGINS = [ 'michael-n-cooper', 'ruoxiran', 'RealJoshue108', 'slhenry' ];
  let extraNotify = LOGINS.includes(issue.user.login);
  if (!extraNotify) {
    const groupId = await findGroup(issue);
    const GROUPS = [ 35422, 83907, 83726, 35532 ];
    extraNotify = groupId && groupId.reduce((a, c) => a || GROUPS.includes(c), false);
    if (!groupId) {
      monitor.error(`No group found for ${issue.html_url} - ${issue.title}`);
    }
  }

  const extras = [ {
    name: "brewerj",
    email : "jbrewer"
  }, {
    name: "slhenry",
    email : "shawn"
  } ];
  let index = 0;
  async function sendExtra() {
    if (index >= extras.length) {
      return true;
    }
    monitor.log(`Extra notification for ${extras[index].name} for ${issue.title}`);

    transitions.setIssueAssignee(issue, [ extras[index].name ]).catch(monitor.error);
    mail.to = extras[index].email + '@' + 'w3.org';
    mail.bcc = undefined;
    mail.replyTo = undefined;
    mail.subject = "[Transition approval request] " + issue.title;
    index++;
    return email(mail).then(() => sendExtra()); // iterate through extras
  }

  if (extraNotify) {
    return email(mail).then(() => sendExtra());
  } else {
    return email(mail);
  }
}

function pingHooks(issue) {
  hooks.forEach(hook => {
    fetch(hook, { method: 'POST',
      body: JSON.stringify(issue),
      headers: { 'Content-Type': 'application/json' }
    }).then(() => {
      monitor.log("webhook " + hook + " was told");
    }).catch(err => {
      monitor.warn("webhook " + hook + "  failed " + err);
    });
  });
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
    gotNotified(issue.number);
    monitor.log(`Message sent for ${issue.number}`);
    pingHooks(issue);
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
