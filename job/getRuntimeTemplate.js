'use strict';

var self = getRuntimeTemplate;
module.exports = self;

function getRuntimeTemplate(externalBag, callback) {
  var bag = {
    consoleAdapter: externalBag.consoleAdapter,
    builderApiAdapter: externalBag.builderApiAdapter,
    nodeId: global.config.nodeId,
    nodeTypeCode: global.config.nodeTypeCode
  };
  bag.who = util.format('%s|job|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _getClusterNode.bind(null, bag),
      _getCluster.bind(null, bag),
      _getSystemNode.bind(null, bag),
      _getSystemCluster.bind(null, bag),
      _getRuntimeTemplate.bind(null, bag)
    ],
    function (err) {
      var result;
      if (err) {
        logger.error(bag.who, util.format('Failed to get runtime template'));
      } else {
        logger.info(bag.who, 'Successfully got runtime template');
        result = {
          runtimeTemplate: bag.runtimeTemplate
        };
      }
      return callback(err, result);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  var expectedParams = [
    'consoleAdapter',
    'builderApiAdapter',
    'nodeId',
    'nodeTypeCode'
  ];

  var paramErrors = [];
  _.each(expectedParams,
    function (expectedParam) {
      if (_.isNull(bag[expectedParam]) || _.isUndefined(bag[expectedParam]))
        paramErrors.push(
          util.format('%s: missing param :%s', who, expectedParam)
        );
    }
  );

  var hasErrors = !_.isEmpty(paramErrors);
  if (hasErrors)
    logger.error(paramErrors.join('\n'));
  return next(hasErrors);
}

function _getClusterNode(bag, next) {
  if (bag.nodeTypeCode === global.nodeTypeCodes.system) return next();
  var who = bag.who + '|' + _getClusterNode.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Fetching runtime template');
  bag.builderApiAdapter.getClusterNodeById(bag.nodeId,
    function (err, clusterNode) {
      if (err) {
        var msg = util.format('%s, Failed to get clusterNode' +
          ' for id:%s, with err: %s', who, bag.nodeId, err);
        logger.warn(msg);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
      } else {
        bag.consoleAdapter.publishMsg('Successfully obtained cluster node');
        bag.clusterNode = clusterNode;
      }

      return next(err);
    }
  );
}

function _getCluster(bag, next) {
  if (bag.nodeTypeCode === global.nodeTypeCodes.system) return next();
  var who = bag.who + '|' + _getCluster.name;
  logger.verbose(who, 'Inside');

  var query = util.format('clusterIds=%s', bag.clusterNode.clusterId);
  bag.builderApiAdapter.getClusters(query,
    function (err, clusters) {
      if (err) {
        var msg = util.format('%s, Failed to get cluster' +
          ' for id:%s, with err: %s', who, bag.clusterNode.clusterId, err);
        logger.warn(msg);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
      } else if (!clusters.length) {
        var missingMsg = util.format('%s, Failed to find cluster for id:%s',
          who, bag.clusterNode.clusterId);
        logger.warn(missingMsg);
        err = 'Failed to find cluster';
        bag.consoleAdapter.publishMsg(missingMsg);
        bag.consoleAdapter.closeCmd(false);
      } else {
        bag.consoleAdapter.publishMsg('Successfully obtained cluster');
        bag.cluster = clusters[0];
      }

      return next(err);
    }
  );
}

function _getSystemNode(bag, next) {
  if (bag.nodeTypeCode !== global.nodeTypeCodes.system) return next();
  var who = bag.who + '|' + _getSystemNode.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Fetching runtime template');
  bag.builderApiAdapter.getSystemNodeById(bag.nodeId,
    function (err, systemNode) {
      if (err) {
        var msg = util.format('%s, Failed to get systemNode' +
          ' for id:%s, with err: %s', who, bag.nodeId, err);
        logger.warn(msg);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
      } else {
        bag.consoleAdapter.publishMsg('Successfully obtained system node');
        bag.systemNode = systemNode;
      }

      return next(err);
    }
  );
}

function _getSystemCluster(bag, next) {
  if (bag.nodeTypeCode !== global.nodeTypeCodes.system) return next();
  var who = bag.who + '|' + _getSystemCluster.name;
  logger.verbose(who, 'Inside');

  var query = util.format('systemClusterIds=%s',
    bag.systemNode.systemClusterId);
  bag.builderApiAdapter.getSystemClusters(query,
    function (err, systemClusters) {
      if (err) {
        var msg = util.format('%s, Failed to get system cluster' +
          ' for id:%s, with err: %s', who, bag.systemNode.systemClusterId, err);
        logger.warn(msg);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
      } else if (!systemClusters.length) {
        var missingMsg = util.format('%s, Failed to find system cluster' +
          ' for id:%s', who, bag.systemNode.systemClusterId);
        logger.warn(missingMsg);
        err = 'Failed to find system cluster';
        bag.consoleAdapter.publishMsg(missingMsg);
        bag.consoleAdapter.closeCmd(false);
      } else {
        bag.consoleAdapter.publishMsg('Successfully obtained system cluster');
        bag.systemCluster = systemClusters[0];
      }

      return next(err);
    }
  );
}

function _getRuntimeTemplate(bag, next) {
  var who = bag.who + '|' + _getRuntimeTemplate.name;
  logger.verbose(who, 'Inside');

  var cluster = bag.cluster || bag.systemCluster;
  bag.builderApiAdapter.getRuntimeTemplates('',
    function (err, runtimeTemplates) {
      if (err) {
        var msg = util.format('%s, Failed to get runtimeTemplates' +
          ' with err: %s', who, err);
        logger.warn(msg);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
      } else {
        var runtimeTemplate = _.findWhere(runtimeTemplates,
          {id: cluster.runtimeTemplateId});
        if (runtimeTemplate) {
          bag.consoleAdapter.publishMsg(
            'Successfully obtained runtime template');
          bag.runtimeTemplate = runtimeTemplate;
        } else {
          var missingMsg = util.format('%s, Failed to find runtime template' +
            ' for id:%s', who, cluster.runtimeTemplateId);
          logger.warn(missingMsg);
          err = 'Failed to find runtime template';
          bag.consoleAdapter.publishMsg(missingMsg);
          bag.consoleAdapter.closeCmd(false);
        }
      }

      return next(err);
    }
  );
}
