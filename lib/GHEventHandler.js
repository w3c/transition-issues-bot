"use strict";

const monitor  = require("./monitor.js");
const GitHub = require("./GitHub.js");
const notify = require("./notify-email.js");

const repository = new GitHub();

// transition specific labels and comments
const TRANSITION_READY = "(this )?transition (is )?ready\\.?";
const director_regexp = new RegExp("ok-label", "i");


exports.dispatchEvent = function (event, payload) {

  switch(event) {
  case "ping":
    pingEvent(payload);
    break;
  case "label":
    labelEvent(payload);
    break;
  case "issue":
    issueEvent(payload);
    break;
  case "issues":
    issuesEvent(payload);
    break;
  case "issue_comment":
    issueCommentEvent(payload);
    break;
  default:
    monitor.warn("GitHub-Event " + event + " is unhandled (" + payload.action + ")");
  }
};

// X-GitHub-Event: ping
function pingEvent(payload) {
  return payload;
}

// X-GitHub-Event: label
function labelEvent(payload) {
  return payload;
}

// X-GitHub-Event: issue
function issueEvent(payload) {
  if (payload.issue.state !== "open") {
    return;
  }
}

// X-GitHub-Event: issues
function issuesEvent(payload) {
  if (payload.issue.state !== "open") {
    return;
  }
  let action = payload.action;
  if (action === "opened") {
    monitor.log("new comment from " + payload.sender.login);
    analyzeComment(payload.issue.labels, payload.issue.body);
  } else if (action === "labeled") {
    let newLabel = payload.label.name;
    let user = payload.sender.login;
    monitor.log("new label " + newLabel + " from " + user);
    if (director_regexp.test(newLabel)) {
      let issue = payload.issue;
      repository.getIssue(issue.number).then(ghIssue => {
        return notify(ghIssue);
      }).catch(console.error);
    }
  }
}

// X-GitHub-Event: issue_comment
function issueCommentEvent(payload) {
  if (payload.issue.state !== "open") {
    return;
  }
  monitor.log("new comment from " + payload.comment.user.login);
  analyzeComment(payload.issue, payload.comment.body);
}


function analyzeComment(issue, comment) {
  // directorLabel(issue, comment);
  manageLabels(issue, comment);
}

// Handle the label important to the Director
function directorLabel(issue, comment) {
  const comment_regexp = new RegExp(TRANSITION_READY, "im");

  const hasLabel = (issue.labels.find((v) => director_regexp.test(v.name)) !== undefined);

  if (!hasLabel && comment_regexp.test(comment)) {
    repository.addLabel(issue.number, DIRECTOR_LABEL).catch(console.error);
  }
}

// Handle the addition or removal of labels based on comments
function manageLabels(issue, comment) {
  const LABEL_MATCH = "[-_A-Za-z0-9]+";

  const LABEL_ACTION = "label:(" + LABEL_MATCH + ")";
  const add_regexp = new RegExp("\\+" + LABEL_ACTION);
  const remove_regexp = new RegExp("-" + LABEL_ACTION);

  if (add_regexp.test(comment)) {
    let newLabel = comment.match(add_regexp)[1];
    let hasLabel = (issue.labels.find((v) => newLabel === v.name) !== undefined);
    if (!hasLabel) {
      repository.addLabel(issue.number, newLabel);
    } else {
      monitor.warn("Label " + newLabel + " is already set");
    }
  } else if (remove_regexp.test(comment)) {
    let oldLabel = comment.match(remove_regexp)[1];
    let hasLabel = (issue.labels.find((v) => oldLabel === v.name) !== undefined);
    if (hasLabel) {
      repository.removeLabel(issue.number, oldLabel);
    } else {
      monitor.warn("Label " + oldLabel + " is not set");
    }
  } else {
    monitor.log("Not an addition or removal of a label");
  }

}