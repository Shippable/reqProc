'use strict';
var self = validateNode;
module.exports = self;

var exec = require('child_process').exec;
var ShippableAdapter = require('../../shippable/Adapter.js');
var VALIDATION_PERIOD = 2 * 60 * 1000; // 2 minutes

function validateNode(params, callback) {
  if (!config.nodeId) {
    logger.verbose('Skipping node validation as no nodeId is present');
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
      _validateClusterNodeStatusPeriodically.bind(null, bag),
      _validateSystemNodeStatusPeriodically.bind(null, bag)
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

function _validateClusterNodeStatusPeriodically(bag, next) {
  if (bag.isSystemNode) return next();
  var who = bag.who + '|' + _validateClusterNodeStatusPeriodically.name;
  logger.debug(who, 'Inside');

  setInterval(
    function () {
      __validateClusterNode(bag);
    },
    VALIDATION_PERIOD
  );
  return next();
}

function _validateSystemNodeStatusPeriodically(bag, next) {
  if (!bag.isSystemNode) return next();
  var who = bag.who + '|' + _validateSystemNodeStatusPeriodically.name;
  logger.debug(who, 'Inside');

  setInterval(
    function () {
      __validateSystemNode(bag);
    },
    VALIDATION_PERIOD
  );
  return next();
}

function __validateClusterNode(innerBag) {
  if (global.config.isProcessingRunSh) return;

  var who = innerBag.who + '|' + __validateClusterNode.name;
  logger.debug(who, 'Inside');

  innerBag.adapter.validateClusterNodeById(config.nodeId,
    function (err, clusterNode) {
      if (err) {
        logger.warn(who,
          util.format('Failed to :validateClusterNodeById for ' +
            'clusterNodeId: %s', config.nodeId), err
        );
      }

      innerBag.action = clusterNode && clusterNode.action;
      if (innerBag.action === 'continue')
        innerBag.skipAllSteps = true;
      else
        innerBag.skipAllSteps = false;

      async.series([
          __removeCexecContainer.bind(null, innerBag),
          __restartExecContainer.bind(null, innerBag),
          __stopExecContainer.bind(null, innerBag)
        ],
        function (err) {
          if (err)
            logger.warn(
              util.format('Unable to perform %s with err:%s', innerBag.action,
                err)
            );
          else
            logger.debug(who,
              util.format('clusterNodeId:%s action is %s, doing nothing',
                config.nodeId, clusterNode.action)
            );
        }
      );
    }
  );
}

function __validateSystemNode(innerBag) {
  if (global.config.isProcessingRunSh) return;

  var who = innerBag.who + '|' + __validateSystemNode.name;
  logger.debug(who, 'Inside');

  innerBag.adapter.validateSystemNodeById(config.nodeId,
    function (err, systemNode) {
      if (err) {
        logger.warn(who,
          util.format('Failed to :validateSystemNodeById for ' +
            'systemNodeId: %s', config.nodeId), err
        );
      }

      innerBag.action = systemNode && systemNode.action;
      if (innerBag.action === 'continue')
        innerBag.skipAllSteps = true;
      else
        innerBag.skipAllSteps = false;

      async.series([
          __removeCexecContainer.bind(null, innerBag),
          __restartExecContainer.bind(null, innerBag),
          __stopExecContainer.bind(null, innerBag)
        ],
        function (err) {
          if (err)
            logger.warn(
              util.format('Unable to perform %s with err:%s', innerBag.action,
                err)
            );
          else
            logger.debug(who,
              util.format('SystemNodeId:%s action is %s, doing nothing',
                config.nodeId, systemNode.action)
            );
        }
      );
    }
  );
}

function __removeCexecContainer(bag, next) {
  if (bag.skipAllSteps) return next();

  var who = bag.who + '|' + __removeCexecContainer.name;
  logger.debug(who, 'Inside');

  exec('docker ps | grep \'c.exec.\' | awk \'{print $1}\' |' +
    ' xargs -I {} docker rm -fv {}',
    function (err) {
      if (err)
        logger.error(
          util.format('Failed to stop cexec container with err:%s', err)
        );
      return next(err);
    }
  );
}

function __restartExecContainer(bag, next) {
  if (bag.skipAllSteps) return next();
  if (bag.action !== 'restart') return next();

  var who = bag.who + '|' + __restartExecContainer.name;
  logger.debug(who, 'Inside');

  exec(util.format('docker restart -t=0 %s', config.reqProcContainerName),
    function (err) {
      if (err)
        logger.error(
          util.format('Failed to stop container with err:%s', err)
        );
      return next(err);
    }
  );
}

function __stopExecContainer(bag, next) {
  if (bag.skipAllSteps) return next();
  if (bag.action !== 'shutdown') return next();

  var who = bag.who + '|' + __stopExecContainer.name;
  logger.debug(who, 'Inside');

  exec(util.format('docker stop -t=0 %s', config.reqProcContainerName),
    function (err) {
      if (err)
        logger.error(
          util.format('Failed to stop container with err:%s', err)
        );
      return next(err);
    }
  );
}
