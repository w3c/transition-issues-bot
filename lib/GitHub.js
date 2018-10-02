"use strict";

const config = require("../config.json");
const monitor  = require("./monitor.js");
const io = require("io-promise");

const GH_API = "https://api.github.com/";

class Repository {
  constructor() {
    this.repository = config.repository;
    this.url = GH_API + "repos/" + this.repository;
    this.headers =  {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "transition-token-test/0.1",
      "Authorization": "token " + config.ghToken
    };
    monitor.log("GitHub repository: " + this.repository);
  }

  async addLabel(issueNumber, label) {
    monitor.log("add label " + label);
    return io.post(this.url + "/issues/" + issueNumber + "/labels", [ label ], {
      headers: this.headers
    }).catch(monitor.error);
  }
  async removeLabel(issueNumber, label) {
    monitor.log("remove label " + label);
    return io.delete(this.url + "/issues/" + issueNumber + "/labels/" + label, {}, {
      headers: this.headers
    }).catch(monitor.error);
  }

  async getIssue(issueNumber) {
    monitor.log("get issue " + issueNumber);
    return io.get(this.url + "/issues/" + issueNumber, {
      headers: this.headers
    }).then(res => res.json()).catch(monitor.error);
  }

}

module.exports  = Repository;


