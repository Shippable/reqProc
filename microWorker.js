'use strict';

var self = microWorker;
module.exports = self;

var Adapter = require('./_common/shippable/Adapter.js');
var exec = require('child_process').exec;
var fs = require('fs-extra');

var BuildJobConsoleAdapter = require('./_common/buildJobConsoleAdapter.js');

function microWorker(message, callback) {
  var bag = {
    rawMessage: message,
    reqProcDir: global.config.reqProcDir,
    reqKickDir: global.config.reqKickDir,
    reqExecDir: global.config.reqExecDir,
    buildDir: global.config.buildDir,
    reqKickScriptsDir: util.format('%s/scripts', global.config.reqKickDir),
    buildInDir: util.format('%s/IN', global.config.buildDir),
    buildOutDir: util.format('%s/OUT', global.config.buildDir),
    buildStateDir: util.format('%s/state', global.config.buildDir),
    buildStatusDir: util.format('%s/status', global.config.buildDir),
    buildSharedDir: util.format('%s/shared', global.config.buildDir)
  };
  bag.who = util.format('%s|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _instantiateBuildJobConsoleAdapter.bind(null, bag),
      _updateBuildJobStatus.bind(null, bag),
      _setupDirectories.bind(null, bag),
      _setupFiles.bind(null, bag),
      _cleanupBuildDirectory.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, util.format('Failed to process message'));
      else
        logger.info(bag.who, util.format('Successfully processed message'));

      if (!config.isServiceNode)
        __restartExecContainer(bag);
      return callback();
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  if (_.isEmpty(bag.rawMessage)) {
    logger.warn(util.format('%s, Message is empty.', who));
    return next(true);
  }

  if (_.isEmpty(bag.rawMessage.builderApiToken)) {
    logger.warn(util.format('%s, No builderApiToken present' +
      ' in incoming message', who));
    return next(true);
  }

  if (_.isEmpty(bag.rawMessage.buildJobId)) {
    logger.warn(util.format('%s, No buildJobId present' +
      ' in incoming message', who));
    return next(true);
  }

  bag.builderApiAdapter = new Adapter(bag.rawMessage.builderApiToken);
  return next();
}

function _instantiateBuildJobConsoleAdapter(bag, next) {
  var who = bag.who + '|' + _instantiateBuildJobConsoleAdapter.name;
  logger.verbose(who, 'Inside');

  var batchSize = bag.rawMessage.consoleBatchSize ||
    (global.systemSettings && global.systemSettings.jobConsoleBatchSize);
  var timeInterval = bag.rawMessage.consoleBufferTimeIntervalInMS ||
    (global.systemSettings &&
    global.systemSettings.jobConsoleBufferTimeIntervalInMS);

  bag.consoleAdapter = new BuildJobConsoleAdapter(
    bag.rawMessage.builderApiToken, bag.rawMessage.buildJobId,
    batchSize, timeInterval);

  return next();
}

function _setupDirectories(bag, next) {
  var dirsToBeCreated = [
    bag.reqKickScriptsDir, bag.buildInDir, bag.buildOutDir,
    bag.buildStateDir, bag.buildStatusDir, bag.buildSharedDir
  ];

  async.eachLimit(dirsToBeCreated, 10,
    function (dir, nextDir) {
      fs.ensureDir(dir,
        function (err) {
          return nextDir(err);
        }
      );
    },
    function (err) {
      return next(err);
    }
  );
}

function _setupFiles(bag, next) {
  var filesToBeCreated = [
    util.format('%s/version', bag.reqProcDir),
    util.format('%s/status', bag.reqProcDir),
    util.format('%s/version', bag.reqKickDir),
    util.format('%s/status', bag.reqKickDir),
    util.format('%s/kill_reqExec.sh', bag.reqKickScriptsDir),
    util.format('%s/cancel_reqExec.sh', bag.reqKickScriptsDir),
    util.format('%s/timeout_reqExec.sh', bag.reqKickScriptsDir),
    util.format('%s/version', bag.reqExecDir),
    util.format('%s/job.pid', bag.buildStatusDir),
    util.format('%s/job.status', bag.buildStatusDir),
    util.format('%s/job.who', bag.buildStatusDir),
    util.format('%s/job.steps.json', bag.buildStatusDir)
  ];
  async.eachLimit(filesToBeCreated, 10,
    function (file, nextFile) {
      fs.ensureFile(file,
        function (err) {
          return nextFile(err);
        }
      );
    },
    function (err) {
      return next(err);
    }
  );
}

function _cleanupBuildDirectory(bag, next) {
  fs.emptyDir(bag.buildDir,
    function (err) {
      return next(err);
    }
  );
}

function _updateBuildJobStatus(bag, next) {
  var who = bag.who + '|' + _updateBuildJobStatus.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openGrp('Updating Status');
  bag.consoleAdapter.openCmd('Updating build job status');
  var update = {};

  var successStatusCode = _.findWhere(global.systemCodes,
    { group: 'status', name: 'success'}).code;

  update.statusCode = successStatusCode;

  bag.builderApiAdapter.putBuildJobById(bag.rawMessage.buildJobId, update,
    function (err) {
      if (err) {
        var msg = util.format('%s, failed to :putBuildJobById for ' +
          'buildJobId: %s with err: %s', who, bag.rawMessage.buildJobId, err);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        bag.isGrpSuccess = false;
      } else {
        bag.consoleAdapter.publishMsg('Successfully updated buildJob status');
        bag.consoleAdapter.closeCmd(true);
      }
      bag.consoleAdapter.closeGrp(bag.isGrpSuccess);
      return next();
    }
  );
}

function __restartExecContainer(bag) {
  var who = bag.who + '|' + __restartExecContainer.name;
  logger.verbose(who, 'Inside');

  var retryOpts = {
    times: 5,
    interval: function (retryCount) {
      return 1000 * Math.pow(2, retryCount);
    }
  };

  async.retry(retryOpts,
    function (callback) {
      var callsPending = 0;

      if (bag.consoleAdapter)
        callsPending = bag.consoleAdapter.getPendingApiCallCount();

      if (callsPending < 1) {
        __restartContainer(bag);
        return callback();
      }
      return callback(true);
    },
    function (err) {
      if (err)
        logger.error('Still posting build consoles');
      // force restarting container
      __restartContainer(bag);
    }
  );
}

function __restartContainer(bag) {
  var who = bag.who + '|' + __restartContainer.name;
  logger.verbose(who, 'Inside');

  exec('docker restart -t=0 shippable-exec-$NODE_ID',
    function (err) {
      if (err)
        logger.error(util.format('Failed to stop container with ' +
          'err:%s', err));
    }
  );
}
