"use strict";

const express = require("express");
const bodyParser = require("body-parser");
const io = require("io-promise");
const t0 = Date.now();
// const ghHandler = require("./lib/GHEventHandler.js");
const { loop, addHook } = require("./lib/notify-issue-transition.js");

const config = require("./config.json");

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

  // io.save("/tmp/gh-" + ghEvent + ".json", req.body);
  try {
    // HOOK DEACTIVATED ghHandler.dispatchEvent(ghEvent, req.body);
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

app.get("/doc", function (req, res, next) {
  io.read("./docs/index.html").then(data => {
    res.send(data);

  }).catch(() => res.status(500).send("contact Starman. He is orbiting somewhere in space in his car."))
  .then(() => next());

});

app.get("/doc/hook", function (req, res, next) {
  io.read("./docs/hook.html").then(data => {
    res.send(data);

  }).catch(() => res.status(500).send("contact Starman. He is orbiting somewhere in space in his car."))
  .then(() => next());

});

monitor.stats(app);

loop();

let port = process.env.PORT || 4567;

/* eslint-disable no-console */
app.listen(port, () => {
  console.log("Express server listening on port %d in %s mode", port, process.env.NODE_ENV);
  console.log("App started in", (Date.now() - t0) + "ms.");
  monitor.log("Express server listening on port " + port + " in " + process.env.NODE_ENV + " mode");
  monitor.log("App started in " + (Date.now() - t0) + "ms.");
});
/* eslint-enable no-console */
