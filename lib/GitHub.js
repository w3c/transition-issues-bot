"use strict";

const config = require("../config.json");
const monitor  = require("./monitor.js");
const io = require("io-promise");

const GH_API = "https://api.github.com/";

const DIRECTOR="Awaiting Director";

class Repository {
  constructor(name) {
    if (!name) {
      this.repository = config.repository;
    } else {
      this.repository = name;
    }
    this.url = GH_API + "repos/" + this.repository;
    this.headers =  {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "transition-token-test/0.1",
      "Authorization": "token " + config.ghToken
    };
  }

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

  async getIssue(issueNumber) {
    monitor.log(this.repository + " get issue " + issueNumber);
    return io.get(this.url + "/issues/" + issueNumber, {
      headers: this.headers
    }).then(res => res.json()).catch(monitor.error);
  }

  async getIssues() {
    monitor.log(this.repository + " get issues");
    return io.get(this.url + "/issues", {
      headers: this.headers
    }).then(res => res.json()).catch(monitor.error);
  }

  async getAwaitingDirector() {
    monitor.log(this.repository + " get issues["+DIRECTOR+"]");
    return io.get(this.url + "/issues?labels="+DIRECTOR, {
      headers: this.headers
    }).then(res => res.json()).catch(monitor.error);
  }

}

module.exports  = Repository;


