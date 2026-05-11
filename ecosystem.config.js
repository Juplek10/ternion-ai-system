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
      env: { NODE_ENV: "production" }
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
      restart_delay: 5000,
      kill_timeout: 3000,
      max_restarts: 5
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
      name: "drive-watcher",
      script: "/root/ai-system/core/integrations/drive-watcher.js",
      instances: 1,
      exec_mode: "fork",
      restart_delay: 5000,
      kill_timeout: 3000,
      max_restarts: 5
    },
    {
      name: "dream-engine",
      script: "/root/ai-system/core/dreaming/dream-engine.js",
      instances: 1,
      exec_mode: "fork",
      restart_delay: 10000,
      kill_timeout: 5000,
      max_restarts: 3
    },
    {
      name: "backup-scheduler",
      script: "/root/ai-system/backup-scheduler.js",
      instances: 1,
      exec_mode: "fork",
      restart_delay: 10000,
      kill_timeout: 5000,
      max_restarts: 3
    },
    {
      name: "health-check",
      script: "/root/ai-system/core/health-check.js",
      instances: 1,
      exec_mode: "fork",
      restart_delay: 5000,
      kill_timeout: 3000,
      max_restarts: 10
    },
    {
      name: "auto-recovery",
      script: "/root/ai-system/core/auto-recovery.js",
      instances: 1,
      exec_mode: "fork",
      restart_delay: 10000,
      kill_timeout: 5000,
      max_restarts: 5
    },
    {
      name: "notification-engine",
      script: "/root/ai-system/core/proactive/notification-engine.js",
      instances: 1,
      exec_mode: "fork",
      restart_delay: 5000,
      kill_timeout: 3000,
      max_restarts: 5
    },
    {
      name: "lpse-monitor",
      script: "/root/ai-system/core/tools/lpse-monitor.js",
      instances: 1,
      exec_mode: "fork",
      restart_delay: 30000,
      kill_timeout: 5000,
      max_restarts: 3
    },
    {
      name: "whatsapp",
      script: "/root/ai-system/whatsapp-gateway.js",
      instances: 1,
      exec_mode: "fork",
      restart_delay: 15000,
      kill_timeout: 15000,
      max_restarts: 999,
      min_uptime: "30s",
      env: { NODE_ENV: "production" }
    },
    {
      name: "follow-up-engine",
      script: "/root/ai-system/core/contacts/follow-up-engine.js",
      instances: 1,
      exec_mode: "fork",
      restart_delay: 10000,
      kill_timeout: 5000,
      max_restarts: 5,
      cron_restart: "0 * * * *",
      env: { NODE_ENV: "production" }
    }
  ]
};
