module.exports = {
  /**
   * Application configuration section
   * http://pm2.keymetrics.io/docs/usage/application-declaration/
   */
  apps : [
    {
      name      : 'transition-issues-bot',
      script    : 'index.js',
      env: {
        NODE_ENV: 'production'
      },
      error_file : "/var/log/nodejs/transition-issues-bot.err",
      out_file : "/var/log/nodejs/transition-issues-bot.log",
      "node_args": "--max_old_space_size=400"
    }
  ]
};
