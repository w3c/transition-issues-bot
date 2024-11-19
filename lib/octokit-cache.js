/* eslint-env node */

"use strict";

import config from './config.js';
import { Octokit as OCore } from "@octokit/core";
import { throttling } from "@octokit/plugin-throttling";
import * as monitor from "./monitor.js";

const Octokit = OCore.plugin(throttling);

const MAX_RETRIES = 3;

const octokit = new Octokit({
  auth: config.ghToken,
  throttle: {
    onRateLimit: (retryAfter, options) => {
      if (options.request.retryCount < MAX_RETRIES) {
        monitor.warn(`Rate limit exceeded, retrying after ${retryAfter} seconds`)
        return true;
      } else {
        monitor.error(`Rate limit exceeded, giving up after ${MAX_RETRIES} retries`);
        return false;
      }
    },
    onSecondaryRateLimit: (retryAfter, options) => {
      if (options.request.retryCount < MAX_RETRIES) {
        monitor.warn(`Secondary detection triggered, retrying after ${retryAfter} seconds`)
        return true;
      } else {
        monitor.error(`Secondary detection triggered, giving up after ${MAX_RETRIES} retries`);
        return false;
      }
    }
  }
});

octokit.get = async function(query_url, options) {
  if (options && options.ttl !== undefined) {
    if (query_url.indexOf("?") !== -1) {
      query_url += "&";
    } else {
      query_url += "?";
    }
    query_url += "ttl=" + options.ttl;
  }
  if (options && options.fields) {
    if (query_url.indexOf("?") !== -1) {
      query_url += "&";
    } else {
      query_url += "?";
    }
    query_url += "fields=" + options.fields;
  }

  function attempt(number) {
    return fetch(config.cache + query_url).then(res => {
      if (res.ok) return res.json();
      if (res.status === 504 && number < 3) {
        // The server was acting as a gateway or proxy and
        // did not receive a timely response from the upstream server.
        // so try again
        return attempt(number++);
      }
      throw new Error(`${res.status} ${config.cache}${query_url}`);
    });
  }
  return attempt(0);
}

export default octokit;
