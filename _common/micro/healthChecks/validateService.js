'use strict';
var self = validateService;
module.exports = self;

var ShippableAdapter = require('../../shippable/Adapter.js');
var VALIDATION_PERIOD = 2 * 60 * 1000; // 2 minutes

function validateService(params, callback) {
  if (!config.isServiceNode) {
    logger.verbose('Skipping service call home as this is not a serviceNode');
    return callback();
  }

  var bag = {
    params: params
  };

  bag.who = util.format('%s|_common|%s', msName, self.name);
  logger.verbose('Validating node status of nodeId: %s',
    config.nodeId);

  async.series([
      _checkInputParams.bind(null, bag),
      _postNewService.bind(null, bag),
      _callHomeService.bind(null, bag)
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
  // since this is on a serviceNode, it must have an apiToken
  bag.adapter = new ShippableAdapter(config.apiToken);

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

function _postNewService(bag, next) {
  var who = bag.who + '|' + _postNewService.name;
  logger.debug(who, 'Inside');
  // TODO:
  // this service is booting for the first time.
  // we need to create a new entry in the DB for this service
  // and store the object in global.config so that the workflow
  // can access it for updating
  // api should set this service's status to 'success'
  global.config.service = {id:'abc123', isActive: true};
  return next();
}

function _callHomeService(bag, next) {
  var who = bag.who + '|' + _callHomeService.name;
  logger.debug(who, 'Inside');

  setInterval(
    function () {
      __updateCallHome(bag);
    },
    VALIDATION_PERIOD
  );
  return next();
}

function __updateCallHome(bag) {
  var who = bag.who + '|' + __updateCallHome.name;
  logger.debug(who, 'Inside');
  // TODO:
  // fill out these stubs
  //
  // 2 minute interval here.  cron should delete any service that has no
  // hearbeat update for over 5 minutes.
  // This will allow for two missed heartbeats
  var innerBag = {};
  async.series([
      __getService.bind(null, innerBag),
      __postService.bind(null, innerBag),
      __putService.bind(null, innerBag),

    ], function (err) {
      if (err)
        logger.warn(
          util.format('Unable to perform %s with err:%s', innerBag.action,
            err)
        );
    }
  );
}
function __getService(innerBag, next) {
  //using config.service.id
  innerBag.action = 'GET';
  return next();
}
function __postService(innerBag, next) {
  // if get failed with 404, need to POST again. it implies the entry
  // in the DB was incorrectly removed.
  // if post is required, store result in config.service
  // otherwise, skip this.
  innerBag.action = 'POST';
  return next();
}
function __putService(innerBag, next) {
  // this function should perform 'call home'
  // which should be its own route to ensure we don't clobber other fields
  // in the service, which could be updated from other sources.
  // much like how clusterNodes have a `validateClusterNodeById` route
  innerBag.action = 'heartbeat';
  return next();
}
