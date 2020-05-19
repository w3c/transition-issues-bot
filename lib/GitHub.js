"use strict";

const config = require("../config.json");
const monitor  = require("./monitor.js");
const fetch = require("node-fetch");

const CACHE = config.cache || "https://labs.w3.org/github-cache/v3";

const DIRECTOR="Awaiting Director";

class Repository {
  constructor(name) {
    if (!name) {
      this.repository = config.repository;
    } else {
      this.repository = name;
    }
    this.url = CACHE + "/repos/" + this.repository;
  }
/*
  async addLabel(issueNumber, label) {
    monitor.log("add label " + label);
    return io.post(this.url + "/issues/" + issueNumber + "/labels", [ label ], {
      headers: this.headers
    }).catch(monitor.error);
  }
  async removeLabel(issueNumber, label) {
    monitor.log(this.repository + " remove label " + label);
    return io.delete(this.url + "/issues/" + issueNumber + "/labels/" + label, {}, {
      headers: this.headers
    }).catch(monitor.error);
  }
*/
  async getIssue(issueNumber) {
    monitor.log(this.repository + " get issue " + issueNumber);
    return fetch(this.url + "/issues/" + issueNumber, {
      headers: this.headers
    }).then(res => res.json()).catch(monitor.error);
  }

  async getIssues() {
    monitor.log(this.repository + " get issues");
    return fetch(this.url + "/issues", {
      headers: this.headers
    }).then(res => res.json()).catch(monitor.error);
  }

  async getAwaitingDirector() {
    monitor.log(this.repository + " get issues["+DIRECTOR+"]");
    return this.getIssues().then(issues =>
      issues.filter((issue) => (issue.labels.reduce((a, c) => a || c.name.includes(DIRECTOR), false)))
    ).catch(monitor.error);
  }

}

module.exports  = Repository;


