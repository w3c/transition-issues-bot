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
      "node_args": "--max_old_space_size=400"
    }
  ]
};
