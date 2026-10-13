module.exports = {
  apps: [
    {
      name: 'discord-music-stream',
      cwd: __dirname,
      script: 'dist/index.js',
      interpreter: 'node',
      node_args: '--enable-source-maps',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      exp_backoff_restart_delay: 1000,
      max_memory_restart: '512M',
      kill_timeout: 20000,
      env: { NODE_ENV: 'production' },
    },
  ],
};
