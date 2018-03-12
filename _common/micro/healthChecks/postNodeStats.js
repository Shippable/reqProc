'use strict';
var self = postNodeStats;
module.exports = self;

var exec = require('child_process').exec;
var ShippableAdapter = require('../../shippable/Adapter.js');
var STATS_PERIOD = 2 * 60 * 1000; // 2 minutes
var os = require('os');
var diskUsage = require('diskusage');
var path = require('path');

function postNodeStats(params, callback) {
  if (!config.nodeId) {
    logger.verbose('Skipping node stats update as no nodeId is present');
    return callback();
  }

  var bag = {
    params: params,
    isSystemNode: config.isSystemNode
  };

  bag.who = util.format('%s|_common|%s', msName, self.name);
  logger.verbose('Validating node status of nodeId: %s',
    config.nodeId);

  async.series([
      _checkInputParams.bind(null, bag),
      _postNodeStatsPeriodically.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, 'Failed to validate node status');
      else
        logger.verbose(bag.who, 'Successfully validated node status');
      return callback(err);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.debug(who, 'Inside');

  var consoleErrors = [];
  bag.adapter = new ShippableAdapter('');

  bag.defaultShell = '/bin/bash -c';

  if (global.config.shippableNodeOperatingSystem === 'WindowsServer_2016')
    bag.defaultShell = 'powershell';

  if (consoleErrors.length > 0) {
    _.each(consoleErrors,
      function (e) {
        logger.error(bag.who, e);
      }
    );
    return next(true);
  }
  return next();
}

function _postNodeStatsPeriodically(bag, next) {
  var who = bag.who + '|' + _postNodeStatsPeriodically.name;
  logger.debug(who, 'Inside');

  setInterval(
    function () {
      __postNodeStats(bag);
    },
    STATS_PERIOD
  );
  return next();
}

function __postNodeStats(innerBag) {
  var who = innerBag.who + '|' + __postNodeStats.name;
  logger.debug(who, 'Inside');

  async.series([
      __checkActiveContainers.bind(null, innerBag),
      __checkTotalContainers.bind(null, innerBag),
      __checkMemoryUsage.bind(null, innerBag),
      __checkCpuUsage.bind(null, innerBag),
      __checkDiskUsage.bind(null, innerBag),
      __postClusterNodeStat.bind(null, innerBag),
      __postSystemNodeStat.bind(null, innerBag)
    ],
    function (err) {
      if (err)
        logger.warn(
          util.format('Unable to POST node stats with err:%s', err)
        );
    }
  );
}

function __checkActiveContainers(bag, done) {
  var who = bag.who + '|' + __checkActiveContainers.name;
  logger.debug(who, 'Inside');

  var scriptPath = util.format('%s/%s/activeContainerCount.%s',
    global.config.shippableNodeArchitecture,
    global.config.shippableNodeOperatingSystem,
    global.config.scriptExtension);
  scriptPath = path.resolve(__dirname, scriptPath);

  var command = util.format('%s %s', bag.defaultShell, scriptPath);
  exec(command,
    function (err, stdout) {
      if (err)
        return done(err);
      bag.activeContainersCount = parseInt(stdout) - 1;
      return done();
    }
  );
}

function __checkTotalContainers(bag, done) {
  var who = bag.who + '|' + __checkTotalContainers.name;
  logger.debug(who, 'Inside');

  var scriptPath = util.format('%s/%s/totalContainerCount.%s',
    global.config.shippableNodeArchitecture,
    global.config.shippableNodeOperatingSystem,
    global.config.scriptExtension);
  scriptPath = path.resolve(__dirname, scriptPath);

  var command = util.format('%s %s', bag.defaultShell, scriptPath);
  exec(command,
    function (err, stdout) {
      if (err)
        return done(err);
      bag.totalContainersCount = parseInt(stdout) - 1;
      return done();
    }
  );
}

function __checkMemoryUsage(bag, done) {
  var who = bag.who + '|' + __checkMemoryUsage.name;
  logger.debug(who, 'Inside');

  var totalMem = os.totalmem();
  var freeMem = os.freemem();

  bag.memoryUsageInPercentage = (totalMem - freeMem) * 100 / totalMem;
  return done();
}

function __checkCpuUsage(bag, done) {
  var who = bag.who + '|' + __checkCpuUsage.name;
  logger.debug(who, 'Inside');

  bag.cpuLoadInPercentage = (_.first(os.loadavg())/os.cpus().length) * 100;
  return done();
}

function __checkDiskUsage(bag, done) {
  var who = bag.who + '|' + __checkDiskUsage.name;
  logger.debug(who, 'Inside');

  diskUsage.check('/',
    function (err, info) {
      if (err)
        return done(err);
      var freeDiskInBytes = info.free;
      var totalDiskInBytes = info.total;

      bag.diskUsageInPercentage =
        (totalDiskInBytes - freeDiskInBytes) * 100 /totalDiskInBytes;
      return done();
    }
  );
}

function __postClusterNodeStat(bag, done) {
  if (bag.isSystemNode) return done();

  var who = bag.who + '|' + __postClusterNodeStat.name;
  logger.debug(who, 'Inside');

  var clusterNodeStat = {
    subscriptionId: global.config.subscriptionId,
    activeContainersCount: bag.activeContainersCount,
    totalContainersCount: bag.totalContainersCount,
    memoryUsageInPercentage: bag.memoryUsageInPercentage,
    cpuLoadInPercentage: bag.cpuLoadInPercentage,
    diskUsageInPercentage: bag.diskUsageInPercentage,
    clusterNodeId: global.config.nodeId,
    reportedAt: Date.now()
  };

  bag.adapter.postClusterNodeStats(clusterNodeStat,
    function (err) {
      if (err)
        return done(err);
      return done();
    }
  );
}

function __postSystemNodeStat(bag, done) {
  if (!bag.isSystemNode) return done();

  var who = bag.who + '|' + __postSystemNodeStat.name;
  logger.debug(who, 'Inside');

  var systemNodeStat = {
    activeContainersCount: bag.activeContainersCount,
    totalContainersCount: bag.totalContainersCount,
    memoryUsageInPercentage: bag.memoryUsageInPercentage,
    cpuLoadInPercentage: bag.cpuLoadInPercentage,
    diskUsageInPercentage: bag.diskUsageInPercentage,
    systemNodeId: global.config.nodeId,
    reportedAt: Date.now()
  };

  bag.adapter.postSystemNodeStats(systemNodeStat,
    function (err) {
      if (err)
        return done(err);
      return done();
    }
  );
}
