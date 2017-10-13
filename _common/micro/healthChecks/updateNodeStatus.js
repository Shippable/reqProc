'use strict';
var self = updateNodeStatus;
module.exports = self;

var ShippableAdapter = require('../../../../_global/shippable/Adapter.js');
var statusCodes = require('../../../../_global/statusCodes.js');

function updateNodeStatus(params, callback) {
  if (!config.nodeId) {
    logger.verbose('Skipping node status update as no nodeId is present');
    return callback();
  }

  var bag = {
    params: params,
    skipStatusUpdate: false,
    isSystemNode: config.isSystemNode
  };

  bag.who = util.format('%s|_common|%s', msName, self.name);
  logger.verbose(bag.who, 'Starting');

  async.series([
      _checkInputParams.bind(null, bag),
      _updateClusterNodeStatus.bind(null, bag),
      _updateSystemNodeStatus.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, 'Failed to update node status');
      else
        logger.verbose(bag.who, 'Successfully updated node status');
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

function _updateClusterNodeStatus(bag, next) {
  if (bag.isSystemNode) return next();
  if (bag.skipStatusUpdate) return next();

  var who = bag.who + '|' + _updateClusterNodeStatus.name;
  logger.debug(who, 'Inside');

  var update = {
    statusCode: statusCodes.SUCCESS,
    execImage: config.execImage
  };

  bag.adapter.putClusterNodeById(config.nodeId,
    update,
    function (err) {
      if (err) {
        logger.error(
          util.format('%s has failed to update status of cluster node %s ' +
            'with err %s', who, config.nodeId, err)
        );
        return next(true);
      }
      return next();
    }
  );
}

function _updateSystemNodeStatus(bag, next) {
  if (!bag.isSystemNode) return next();
  if (bag.skipStatusUpdate) return next();

  var who = bag.who + '|' + _updateSystemNodeStatus.name;
  logger.debug(who, 'Inside');

  var update = {
    statusCode: statusCodes.SUCCESS,
    execImage: config.execImage
  };

  bag.adapter.putSystemNodeById(config.nodeId,
    update,
    function (err) {
      if (err) {
        logger.error(
          util.format('%s has failed to update status of system node %s ' +
            'with err %s', who, config.nodeId, err)
        );
        return next(true);
      }
      return next();
    }
  );
}
