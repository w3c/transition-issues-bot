"use strict";
import * as monitor from "./monitor.js";
import config from "./config.js";

const HR_REPOSITORIES = fetch("https://w3c.github.io/common-labels.json")
  .then(res => res.json())
  .then(labels => labels.filter(l => l.repo))
  .then(labels => labels.map(l => l.repo));

let ALL_REPOSITORIES;

function updateRepositories() {
  ALL_REPOSITORIES = fetch("https://w3c.github.io/groups/repositories.json")
  .then(r => r.json());
  setTimeout(updateRepositories, 36000000); //every 10 hours
}

updateRepositories();

export
async function findGroups(issue) {
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

  for (const reg of REPO_MATCHES) {
    for (const match of issue.body.matchAll(reg)) {
      if (!repo) {
        const candidate = match[1];
        let AVOID = await HR_REPOSITORIES; // exclude horizontal repositoes
        AVOID = AVOID.concat([
          "w3c/transitions", // exclude past transition requests     
          // exclude all spec review requests repositories
          "w3ctag/design-reviews",
          "w3c/a11y-request",
          "w3c/i18n-request",
          "w3cping/privacy-request",
          "w3c/security-request"
        ]);
        if (!AVOID.includes(candidate)) {
          repo = candidate;
        }
      }
    }
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
  }
  if (repo) {
    return ALL_REPOSITORIES
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
