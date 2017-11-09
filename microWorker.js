'use strict';

var self = microWorker;
module.exports = self;

var Adapter = require('./_common/shippable/Adapter.js');
var exec = require('child_process').exec;

var pathPlaceholder = '{{TYPE}}';
var workflowPath = './workflows/' + pathPlaceholder + '.js';
var JobConsoleAdapter = require('./_common/jobConsoleAdapter.js');
var BuildJobConsoleAdapter = require('./_common/buildJobConsoleAdapter.js');

function microWorker(message, callback) {
  var bag = {
      rawMessage: message
    };

  bag.who = util.format('%s|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _instantiateConsoleAdapter.bind(null, bag),
      _applyWorkflowStrategy.bind(null, bag)
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

  if (!bag.rawMessage.builderApiToken) {
    logger.warn(util.format('%s, No builderApiToken present' +
      ' in incoming message', who));
    return next(true);
  }
  bag.builderApiToken = bag.rawMessage.builderApiToken;
  bag.builderApiAdapter = new Adapter(bag.rawMessage.builderApiToken);
  return next();
}

function _instantiateConsoleAdapter(bag, next) {
  var who = bag.who + '|' + _instantiateConsoleAdapter.name;
  logger.verbose(who, 'Inside');

  if (bag.rawMessage.jobId) {
    bag.workflow = 'ci';
    bag.consoleAdapter = new JobConsoleAdapter(bag.rawMessage.builderApiToken,
      bag.rawMessage.jobId, bag.rawMessage.consoleBatchSize,
      bag.rawMessage.consoleBufferTimeIntervalInMS);
  } else if (bag.rawMessage.buildJobId) {
    bag.workflow = 'runSh';
    var batchSize = bag.rawMessage.consoleBatchSize ||
      (global.systemSettings && global.systemSettings.jobConsoleBatchSize);
    var timeInterval = bag.rawMessage.consoleBufferTimeIntervalInMS ||
      (global.systemSettings &&
      global.systemSettings.jobConsoleBufferTimeIntervalInMS);

    bag.consoleAdapter = new BuildJobConsoleAdapter(
      bag.rawMessage.builderApiToken, bag.rawMessage.buildJobId,
      batchSize, timeInterval);
  } else {
    logger.warn(util.format('%s, No job/buildJob ID ' +
      'in incoming message', who));
    return next(true);
  }

  return next();
}

function _applyWorkflowStrategy(bag, next) {
  var who = bag.who + '|' + _applyWorkflowStrategy.name;
  logger.verbose(who, 'Inside');

  if (bag.workflow === 'ci')
    if (bag.rawMessage.payload && bag.rawMessage.payload.resourceId)
      bag.workflow = 'runCI';

  var strategyPath = workflowPath.replace(pathPlaceholder, bag.workflow);
  var workflowStrategy;
  try {
    workflowStrategy = require(strategyPath);
  } catch (e) {
    logger.warn(bag.who, util.inspect(e));
  }

  if (!workflowStrategy) {
    logger.warn(util.format(
      'Strategy not found workflow: %s', bag.workflow));
    return next(true);
  }
  workflowStrategy(bag,
    function (err) {
      if (err) {
        logger.warn(who,
          util.format('Failed to apply strategy for workflow: %s',
           bag.workflow)
        );

        return next(err);
      }
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

  exec(util.format('docker restart -t=0 %s', config.reqProcContainerName),
    function (err) {
      if (err)
        logger.error(util.format('Failed to stop container with ' +
          'err:%s', err));
    }
  );
}
