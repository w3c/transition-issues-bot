"use strict";

const express = require("express");
const bodyParser = require("body-parser");
const fs = require('fs').promises;
const t0 = Date.now();
// const ghHandler = require("./lib/GHEventHandler.js");
const { addHook, nudge } = require("./lib/notify-issue-transition.js");

const path = require('path');

const config = require("./lib/config.js");

const monitor  = require("./lib/monitor.js");
let app = module.exports = express();

app.enable("trust proxy");

app.use(bodyParser.json());

monitor.setName("Transition request notifier");
monitor.install(app);

function fromGitHub(req) {
  let ghEvent = req.get("X-GitHub-Event");
  let header = req.get("X-Hub-Signature");
  let secret = config.webhook_secret;
  let contentType = req.get("Content-Type");
  return (secret === undefined || header === secret)
          && contentType === "application/json"
          && ghEvent !== undefined;
}

app.post("/payload", function (req, res, next) {
  if (!fromGitHub(req)) {
    monitor.warn("POST isn't from GitHub");
    res.status(400).send("<p>Not a GitHub payload</p>");
    next();
    return; // no action
  }
  let ghEvent = req.get("X-GitHub-Event");
  monitor.log("GitHub event " + ghEvent + " " + req.body.action);

  try {
    // HOOK DEACTIVATED ghHandler.dispatchEvent(ghEvent, req.body);
    monitor.log("Webhook disabled");
    res.status(200).send("<p>roger</p>");
  } catch (error) {
    monitor.error(error);
    res.status(500).send("mayday");
  }
  next();
  return;
});

app.post("/hook", function (req, res, next) {
  try {
    addHook(req.body.url);
    res.status(200).send("<p>Added " + req.body + "</p>");
  } catch (error) {
    monitor.error(error);
    res.status(500).send("mayday");
  }
  next();
  return;
});

app.post("/nudge", function (req, res, next) {
  try {
    nudge();
    res.status(200).send("<p>Nudged</p>");
  } catch (error) {
    monitor.error(error);
    res.status(500).send("mayday");
  }
  next();
  return;
});

app.get("/doc", function (req, res, next) {
  fs.readFile(path.resolve(__dirname, "./docs/index.html")).then(data => {
    res.set('Content-Type', 'text/html')
    res.send(data);

  }).catch(() => res.status(500).send("contact Starman. He is orbiting somewhere in space in his car."))
  .then(() => next());

});

app.get("/doc/hook", function (req, res, next) {
  fs.readFile(path.resolve(__dirname, "./docs/hook.html")).then(data => {
    res.set('Content-Type', 'text/html')
    res.send(data);

  }).catch(() => res.status(500).send("contact Starman. He is orbiting somewhere in space in his car."))
  .then(() => next());

});

app.get("/doc/nudge", function (req, res, next) {
  fs.readFile(path.resolve(__dirname, "./docs/nudge.html")).then(data => {
    res.set('Content-Type', 'text/html');
    res.send(data);

  }).catch(() => res.status(500).send("contact Starman. He is orbiting somewhere in space in his car."))
  .then(() => next());

});

monitor.stats(app);

if (!config.checkOptions("host", "port", "env")) {
  console.error("Improper configuration. Not Starting");
  return;
}

/* eslint-disable no-console */
app.listen(config.port, () => {
  console.log(`Express server ${config.host} listening on port ${config.port} in ${config.env} mode`);
  console.log("App started in", (Date.now() - t0) + "ms.");
  if (!config.debug && config.env != "production") {
    console.warn("WARNING: 'export NODE_ENV=production' is missing");
    console.warn("See http://expressjs.com/en/advanced/best-practice-performance.html#set-node_env-to-production");
  }
});
/* eslint-enable no-console */
