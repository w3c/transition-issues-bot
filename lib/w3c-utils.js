"use strict";
const monitor  = require("./monitor.js");
const config  = require("./config.js");

function findGroups(issue) {
  const REPO_MATCHES = [
    new RegExp("https://github.com/\([-_a-zA-Z0-9]+/[-_a-zA-Z0-9]+\)/", 'g'),
    new RegExp("https://raw.githack.com/\([-_a-zA-Z0-9]+/[-_a-zA-Z0-9]+\)/", 'g'),
    new RegExp("https://pr-preview.s3.amazonaws.com/\([-_a-zA-Z0-9]+/[-_a-zA-Z0-9]+\)", 'g'),
  ];

  let repo,
    index = 0;

  if (!issue.body) { // safeguard
    return undefined;
  }

  REPO_MATCHES.forEach(reg => {
    for (const match of issue.body.matchAll(reg)) {
      if (!repo) {
        const candidate = match[1];
        const AVOID = [ "w3c/transitions" ];
        if (!AVOID.includes(candidate)) {
          repo = candidate;
        }
      }
    }
  });
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
  }
  if (repo) {
  //    repo = new Repository(repo);
  //    return repo.w3c.then(w3c => {
    return fetch("https://w3c.github.io/groups/repositories.json").then(r => r.json())
      .then(repositories => {
        for (let index = 0; index < repositories.length; index++) {
          const r = repositories[index];
          if (repo === `${r.owner.login}/${r.name}`) {
            return r.w3cjson.group;
          }
        }
        return undefined;
      }).catch(err => {
        monitor.error(err);
        return undefined;
      });
  }
  return undefined;
}

module.exports = { findGroups: findGroups };
