'use strict';

var self = microWorker;
module.exports = self;

var Adapter = require('./_common/shippable/Adapter.js');
var exec = require('child_process').exec;
var fs = require('fs-extra');

var BuildJobConsoleAdapter = require('./_common/buildJobConsoleAdapter.js');
var setupDirs = require('./job/setupDirs.js');

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
    buildSharedDir: util.format('%s/shared', global.config.buildDir),
    buildScriptsDir: util.format('%s/scripts', global.config.buildDir),
    buildSecretsDir: util.format('%s/secrets', global.config.buildDir),
    // TODO: Currently reqProc could only run pipeline jobs
    // set this to true for CI jobs when reqProc supports it in future
    isCI: false
  };
  bag.who = util.format('%s|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _instantiateBuildJobConsoleAdapter.bind(null, bag),
      _setupDirectories.bind(null, bag),
      _setExecutorAsReqProc.bind(null, bag),
      _generateSteps.bind(null, bag),
      _writeJobSteps.bind(null, bag),
      _setExecutorAsReqKick.bind(null, bag),
      _pollExecutorForReqProc.bind(null, bag),
      _readJobStatus.bind(null, bag),
      _cleanupBuildDirectory.bind(null, bag),
      _updateBuildJobStatus.bind(null, bag)
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
  var who = bag.who + '|' + _setupDirectories.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openGrp('Initializing job');

  setupDirs(bag,
    function (err) {
      if (err) {
        bag.consoleAdapter.closeGrp(false);
        bag.jobStatusCode = __getStatusCodeByName('error', bag.isCI);
        return next();
      }

      return next();
    }
  );
}

function _setExecutorAsReqProc(bag, next) {
  if (bag.jobStatusCode) return next();

  var who = bag.who + '|' + _setExecutorAsReqProc.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Setting executor as reqProc');

  var whoPath = util.format('%s/job.who', bag.buildStatusDir);
  fs.writeFile(whoPath, 'reqProc\n',
    function (err) {
      if (err) {
        var msg = util.format('%s, Failed to write file: %s ' +
          'with err: %s', who, whoPath, err);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        bag.consoleAdapter.closeGrp(false);
        bag.jobStatusCode = __getStatusCodeByName('error', bag.isCI);
        return next();
      }

      bag.consoleAdapter.publishMsg(
        util.format('Updated %s', whoPath)
      );
      bag.consoleAdapter.closeCmd(true);
      return next();
    }
  );
}

function _generateSteps(bag, next) {
  if (bag.jobStatusCode) return next();

  var who = bag.who + '|' + _generateSteps.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Generating job steps');

  // TODO: job steps are being read from example file temporarily
  // This section will be replaced by actual generation of job steps in future

  var exampleSteps = util.format('%s/_common/example/steps.json', __dirname);
  fs.readFile(exampleSteps, 'utf8',
    function (err, steps) {
      if (err) {
        var msg = util.format('%s, Failed to read file: %s ' +
          'with err: %s', who, exampleSteps, err);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        bag.consoleAdapter.closeGrp(false);
        bag.jobStatusCode = __getStatusCodeByName('error', bag.isCI);
        return next();
      }

      bag.jobSteps = steps;
      bag.consoleAdapter.publishMsg(
        util.format('Successfully read %s', exampleSteps)
      );
      bag.consoleAdapter.closeCmd(true);
      return next();
    }
  );
}

function _writeJobSteps(bag, next) {
  if (bag.jobStatusCode) return next();

  var who = bag.who + '|' + _writeJobSteps.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Writing job steps');

  var stepsPath = util.format('%s/job.steps.json', bag.buildStatusDir);
  fs.writeFile(stepsPath, bag.jobSteps,
    function (err) {
      if (err) {
        var msg = util.format('%s, Failed to write file: %s ' +
          'with err: %s', who, stepsPath, err);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        bag.consoleAdapter.closeGrp(false);
        bag.jobStatusCode = __getStatusCodeByName('error', bag.isCI);
        return next();
      }

      bag.consoleAdapter.publishMsg(
        util.format('Updated %s', stepsPath)
      );
      bag.consoleAdapter.closeCmd(true);
      return next();
    }
  );
}

function _setExecutorAsReqKick(bag, next) {
  if (bag.jobStatusCode) return next();

  var who = bag.who + '|' + _setExecutorAsReqKick.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Setting executor as reqKick');

  var whoPath = util.format('%s/job.who', bag.buildStatusDir);
  fs.writeFile(whoPath, 'reqKick\n',
    function (err) {
      if (err) {
        var msg = util.format('%s, Failed to write file: %s ' +
          'with err: %s', who, whoPath, err);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        bag.consoleAdapter.closeGrp(false);
        bag.jobStatusCode = __getStatusCodeByName('error', bag.isCI);
        return next();
      }

      bag.consoleAdapter.publishMsg(
        util.format('Updated %s', whoPath)
      );
      bag.consoleAdapter.closeCmd(true);
      bag.consoleAdapter.closeGrp(true);
      return next();
    }
  );
}

function _pollExecutorForReqProc(bag, next) {
  if (bag.jobStatusCode) return next();

  var who = bag.who + '|' + _pollExecutorForReqProc.name;
  logger.verbose(who, 'Inside');

  function checkForReqProc(bag, callback) {
    var whoPath = util.format('%s/job.who', bag.buildStatusDir);
    var isReqProc = false;

    try {
      var executor = fs.readFileSync(whoPath, {encoding: 'utf8'});
      isReqProc = executor.trim() === 'reqProc';
    } catch (err) {
      isReqProc = false;
    }

    if (isReqProc)
      return callback();

    setTimeout(function () {
      checkForReqProc(bag, callback);
    }, 5000);
  }

  checkForReqProc(bag, next);
}

function _readJobStatus(bag, next) {
  if (bag.jobStatusCode) return next();

  var who = bag.who + '|' + _readJobStatus.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openGrp('Reading Status');
  bag.consoleAdapter.openCmd('Reading job status');

  var statusPath = util.format('%s/job.status', bag.buildStatusDir);

  fs.readFile(statusPath, 'utf8',
    function (err, statusCode) {
      if (err) {
        var msg = util.format('%s, failed to read file: %s for ' +
          'buildJobId: %s with err: %s', who, statusPath,
          bag.rawMessage.buildJobId, err);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        bag.consoleAdapter.closeGrp(false);
        bag.jobStatusCode = __getStatusCodeByName('error', bag.isCI);
        return next();
      }

      bag.jobStatusCode = parseInt(statusCode);
      bag.consoleAdapter.publishMsg('Successfully read job status');
      bag.consoleAdapter.closeCmd(true);
      bag.consoleAdapter.closeGrp(true);
      return next();
    }
  );
}

function _cleanupBuildDirectory(bag, next) {
  var who = bag.who + '|' + _cleanupBuildDirectory.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openGrp('Job cleanup');
  bag.consoleAdapter.openCmd(
    util.format('Cleaning %s directory', bag.buildDir)
  );

  fs.emptyDir(bag.buildDir,
    function (err) {
      if (err) {
        var msg = util.format('%s, Failed to cleanup: %s with err: %s',
          who, bag.buildDir, err);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        bag.consoleAdapter.closeGrp(false);
        bag.jobStatusCode = __getStatusCodeByName('error', bag.isCI);
        return next();
      }

      bag.consoleAdapter.publishMsg('Successfully cleaned up');
      bag.consoleAdapter.closeCmd(true);
      bag.consoleAdapter.closeGrp(true);
      return next();
    }
  );
}

function _updateBuildJobStatus(bag, next) {
  var who = bag.who + '|' + _updateBuildJobStatus.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openGrp('Updating Status');
  bag.consoleAdapter.openCmd('Updating build job status');
  var update = {};

  // bag.jobStatusCode is set in previous functions
  // only for states other than success
  if (!bag.jobStatusCode)
    bag.jobStatusCode = __getStatusCodeByName('success', bag.isCI);

  update.statusCode = bag.jobStatusCode;

  bag.builderApiAdapter.putBuildJobById(bag.rawMessage.buildJobId, update,
    function (err) {
      if (err) {
        var msg = util.format('%s, failed to :putBuildJobById for ' +
          'buildJobId: %s with err: %s', who, bag.rawMessage.buildJobId, err);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        bag.consoleAdapter.closeGrp(false);
      } else {
        bag.consoleAdapter.publishMsg('Successfully updated buildJob status');
        bag.consoleAdapter.closeCmd(true);
        bag.consoleAdapter.closeGrp(true);
      }
      return next();
    }
  );
}

//TODO: remove this, change all references to use the function in
//`common/getStatusCodeByName
function __getStatusCodeByName(codeName, isCI) {
  var group = 'status';
  if (isCI) {
    var pipelinesToCI = {
      failure: 'FAILED',
      processing: 'PROCESSING',
      cancelled: 'CANCELED',
      error: 'FAILED',
      success: 'SUCCESS',
      timeout: 'TIMEOUT'
    };
    group = 'statusCodes';
    codeName = pipelinesToCI[codeName];
  }

  return _.findWhere(global.systemCodes,
    { group: group, name: codeName}).code;
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

  exec(util.format('docker restart -t=0 %s', config.reqProcContainerName),
    function (err) {
      if (err)
        logger.error(util.format('Failed to stop container with ' +
          'err:%s', err));
    }
  );
}
