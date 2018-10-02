"use strict";

const express = require("express");
const bodyParser = require("body-parser");
const io = require("io-promise");
const t0 = Date.now();
const ghHandler = require("./lib/GHEventHandler.js");
const config = require("./config.json");

const monitor  = require("./lib/monitor.js");
let app = module.exports = express();

app.enable("trust proxy");

app.use(bodyParser.json());

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

app.get("/events", function (req, res, next) {
  let events = ghHandler.getEvents();
  let body = "<h1>Event log (" + events.length + ")</h1>";
  for (const entry of events) {
    body += "<p>[" + entry.timestamp + "] [" + entry.event + "] " + entry.payload.action;
  }
  res.send(body);
  next();
});

app.post("/payload", function (req, res, next) {
  if (!fromGitHub(req)) {
    monitor.warn("POST isn't from GitHub");
    res.status(400).send("<p>Not a GitHub payload</p>");
    next();
    return; // no action
  }
  let ghEvent = req.get("X-GitHub-Event");
  monitor.log("GitHub event " + ghEvent + " " + req.body.action);

  io.save("gh-" + ghEvent + ".json", req.body);
  try {
    ghHandler.dispatchEvent(ghEvent, req.body);
    res.status(200).send("<p>roger</p>");
  } catch (error) {
    /* eslint-disable no-console */
    console.error(error);
    /* eslint-enable no-console */
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

monitor.stats(app);

let port = process.env.PORT || 4567;

/* eslint-disable no-console */
app.listen(port, () => {
  console.log("Express server listening on port %d in %s mode", port, app.settings.env);
  console.log("App started in", (Date.now() - t0) + "ms.");
});
/* eslint-enable no-console */
