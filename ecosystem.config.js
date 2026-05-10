module.exports = {
  apps: [
    {
      name: "telegram",
      script: "/root/ai-system/telegram.js",
      instances: 1,
      exec_mode: "fork",
      restart_delay: 5000,
      kill_timeout: 5000,
      max_restarts: 10,
      min_uptime: "10s",
      env: {
        NODE_ENV: "production"
      }
    },
    {
      name: "worker",
      script: "/root/ai-system/worker.js",
      instances: 1,
      exec_mode: "fork",
      restart_delay: 3000,
      kill_timeout: 3000
    },
    {
      name: "heartbeat",
      script: "/root/ai-system/heartbeat.js",
      instances: 1,
      exec_mode: "fork",
      restart_delay: 3000,
      kill_timeout: 3000
    },
    {
      name: "background-worker",
      script: "/root/ai-system/background-worker.js",
      instances: 1,
      exec_mode: "fork",
      restart_delay: 3000,
      kill_timeout: 3000
    },
    {
      name: "monitor-loop",
      script: "/root/ai-system/monitor-loop.js",
      instances: 1,
      exec_mode: "fork",
      restart_delay: 3000,
      kill_timeout: 3000
    },
    {
      name: "civilization-runtime",
      script: "/root/ai-system/persistent-runtime.js",
      instances: 1,
      exec_mode: "fork",
      restart_delay: 3000,
      kill_timeout: 3000
    },
    {
      name: "drive-watcher",
      script: "/root/ai-system/core/integrations/drive-watcher.js",
      instances: 1,
      exec_mode: "fork",
      restart_delay: 5000,
      kill_timeout: 3000,
      max_restarts: 5
    }
  ]
};
