"use strict";
import * as monitor from "./monitor.js";
import config from "./config.js";
import { email, sendError } from "./email.js";
import fs from 'fs/promises';
import path from 'path';
import { Repository } from "./github.js";
import * as utils from "./w3c-utils.js";


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
  hooks.forEach(monitor.log);
}).catch(monitor.error);

export
function addHook(url) {
  if (!hooks.includes(url)) {
    monitor.log("Add webhook " + url);
    hooks.push(url);
    fs.writeFile(WEBHOOKS, JSON.stringify(hooks)).catch(monitor.error);
  } else {
    monitor.warn("Webhook " + url + " is already there");
  }
}

// encoding is https://nodejs.org/dist/latest/docs/api/buffer.html#buffer_buffers_and_character_encodings
// decoder is "json" or "text"
function decode(content, encoding, decoder = "text") {
  if (encoding) {
    content = Buffer.from(content, encoding).toString();
  }
  switch (decoder) {
  case "json":
    try {
      return JSON.parse(content);
    } catch (e) {
      return undefined;
    }
  default:
    return content;
  }
}

function transformContent(ghObject, encoding) {
  try {
    if (ghObject) {
      ghObject = ghObject[0];
      if (!ghObject.transformed) {
        ghObject.transformed = decode(ghObject.content, ghObject.encoding, encoding);
      }
      if (ghObject.transformed) {
        return ghObject.transformed;
      }
    }
  } catch (e) {
    //otherwise ignore
  }
  return (encoding == "json") ? {} : "";
}

async function content(repo, path, encoding) {
  try {
    return transformContent(await fetch(`https://api.github.com/repos/${repo}/contents/${path}`), encoding);
  } catch (e) {
    if (e.status === 304) {
      monitor.error(`compounded requests aren't allowed to return 304`);
    }
    //otherwise ignore
  }
  return (encoding == "json") ? {} : "";
}

async function message(issue) {
  // EMAIL
  let mail = {};
  if (process.env.NODE_ENV == 'production') {
    mail = {
      to: "public-transition-announce@w3.org",
      replyTo: "public-transition-announce@w3.org",
      bcc: "w3t-comm@w3.org,chairs@w3.org",
      from: "noreply@w3.org"
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

  // groups associated with the transition request
  let groups = await utils.findGroups(issue);
  if (groups) {
    // CG and TF don't send transitions
    groups = groups.filter(g => !(g.startsWith("cg/") || g.startsWith("tf/")));
    groups = groups.map(g => g.replace('/', ':'));
    // decorate transitions with group labels
    transitions.setIssueLabel(issue, groups).then(r => {
      monitor.log("set groups labels succeeded");
    }).catch(err => {
      monitor.error(err);
    })
  } else {
    monitor.error(`No group found for ${issue.html_url} - ${issue.title}`);
  }

  // WAI handling
  const LOGINS = [ 'iadawn', 'ruoxiran', 'slhenry' ];
  let extraNotify = LOGINS.includes(issue.user.login);
  if (!extraNotify) {
    const WAI_GROUPS = [ "wg/ag", "wg/apa", "wg/aria" ];
    extraNotify = groups && groups.reduce((a, c) => a || WAI_GROUPS.includes(c), false);
  }

  const extras = [ {
    name: "iadawn",
    email : "kevin"
  // }, {
  // name: "shanna-slh",
  // email : "shawn"
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

export
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

export
function nudge() {
  transitions.getAwaitingDirector().then(issues => {
    issues.forEach(issue => {
      notify(issue);
    });
  }).catch(monitor.error);
}

function updateNotifications() {
  nudge();
  setTimeout(updateNotifications, 3600000); //every hour
}

setTimeout(updateNotifications, 10000); // wait 10 seconds before working
