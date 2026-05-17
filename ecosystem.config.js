module.exports = {
  apps: [
    {
      name: "whatsapp",
      script: "/root/ai-system/whatsapp-gateway.js",
      cwd: "/root/ai-system",
      watch: false,
      max_memory_restart: "512M",
      restart_delay: 15000,
      kill_timeout: 15000,
      max_restarts: 999,
      min_uptime: "30s",
      error_file: "logs/whatsapp-error.log",
      out_file: "logs/whatsapp-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      env: { NODE_ENV: "production" }
    },
    {
      name: "api-gateway",
      script: "/root/ai-system/api-gateway.js",
      cwd: "/root/ai-system",
      watch: false,
      max_memory_restart: "256M",
      restart_delay: 5000,
      kill_timeout: 5000,
      max_restarts: 10,
      error_file: "logs/gateway-error.log",
      out_file: "logs/gateway-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    },
    {
      name: "heartbeat",
      script: "/root/ai-system/heartbeat.js",
      cwd: "/root/ai-system",
      watch: false,
      max_memory_restart: "128M",
      restart_delay: 5000,
      kill_timeout: 3000,
      max_restarts: 5,
      error_file: "logs/heartbeat-error.log",
      out_file: "logs/heartbeat-out.log"
    },
    {
      name: "dream-engine",
      script: "/root/ai-system/core/dreaming/dream-engine.js",
      cwd: "/root/ai-system",
      watch: false,
      max_memory_restart: "256M",
      restart_delay: 10000,
      kill_timeout: 5000,
      max_restarts: 3,
      error_file: "logs/dream-error.log",
      out_file: "logs/dream-out.log"
    },
    {
      name: "auto-recovery",
      script: "/root/ai-system/core/auto-recovery.js",
      cwd: "/root/ai-system",
      watch: false,
      max_memory_restart: "128M",
      restart_delay: 10000,
      kill_timeout: 5000,
      max_restarts: 5,
      error_file: "logs/recovery-error.log",
      out_file: "logs/recovery-out.log"
    },
    {
      name: "notification-engine",
      script: "/root/ai-system/core/proactive/notification-engine.js",
      cwd: "/root/ai-system",
      watch: false,
      max_memory_restart: "128M",
      restart_delay: 5000,
      kill_timeout: 3000,
      max_restarts: 5,
      error_file: "logs/notif-error.log",
      out_file: "logs/notif-out.log"
    },
    {
      name: "backup-scheduler",
      script: "/root/ai-system/backup-scheduler.js",
      cwd: "/root/ai-system",
      watch: false,
      max_memory_restart: "128M",
      restart_delay: 10000,
      kill_timeout: 5000,
      max_restarts: 3,
      error_file: "logs/backup-error.log",
      out_file: "logs/backup-out.log"
    },
    {
      name: "lpse-monitor",
      script: "/root/ai-system/core/tools/lpse-monitor.js",
      cwd: "/root/ai-system",
      watch: false,
      max_memory_restart: "128M",
      restart_delay: 30000,
      kill_timeout: 5000,
      max_restarts: 3,
      error_file: "logs/lpse-error.log",
      out_file: "logs/lpse-out.log"
    },
    {
      name: "follow-up-engine",
      script: "/root/ai-system/core/contacts/follow-up-engine.js",
      cwd: "/root/ai-system",
      watch: false,
      max_memory_restart: "128M",
      restart_delay: 10000,
      kill_timeout: 5000,
      max_restarts: 5,
      cron_restart: "0 * * * *",
      error_file: "logs/followup-error.log",
      out_file: "logs/followup-out.log",
      env: { NODE_ENV: "production" }
    }
  ]
};
