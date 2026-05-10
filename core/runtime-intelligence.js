const os =
  require("os");

function getRuntimeHealth() {

  const totalMemory =

    os.totalmem();

  const freeMemory =

    os.freemem();

  const usedMemory =

    totalMemory -
    freeMemory;

  const memoryUsage =

    (
      usedMemory /
      totalMemory
    ) * 100;

  const cpuLoad =

    os.loadavg()[0];

  const uptime =

    os.uptime();

  const cpus =

    os.cpus().length;

  const health = [];

  if(
    memoryUsage > 80
  ) {

    health.push({
      level: "high",
      issue:
        "High memory usage"
    });
  }

  if(
    cpuLoad > cpus
  ) {

    health.push({
      level: "high",
      issue:
        "High CPU load"
    });
  }

  if(
    uptime < 300
  ) {

    health.push({
      level: "medium",
      issue:
        "Recent restart detected"
    });
  }

  return {

    totalMemory,

    freeMemory,

    usedMemory,

    memoryUsage:
      memoryUsage
      .toFixed(2),

    cpuLoad,

    cpuCores:
      cpus,

    uptime,

    health
  };
}

module.exports = {
  getRuntimeHealth
};
