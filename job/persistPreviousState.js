'use strict';

var self = persistPreviousState;
module.exports = self;

var fs = require('fs-extra');

function persistPreviousState(externalBag, callback) {
  var bag = {
    consoleAdapter: externalBag.consoleAdapter,
    buildStateDir: externalBag.buildStateDir,
    buildPreviousStateDir: externalBag.buildPreviousStateDir
  };
  bag.who = util.format('%s|job|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _persistPreviousStateOnFailure.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, util.format('Failed to create trace'));
      else
        logger.info(bag.who, 'Successfully created trace');

      return callback(err);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  var expectedParams = [
    'consoleAdapter',
    'buildStateDir',
    'buildPreviousStateDir'
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

function _persistPreviousStateOnFailure(bag, next) {
  var who = bag.who + '|' + _persistPreviousStateOnFailure.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Copy previous state to current state');
  var srcDir = bag.buildPreviousStateDir ;
  var destDir = bag.buildStateDir;
  fs.copy(srcDir, destDir,
    function (err) {
      if (err) {
        bag.consoleAdapter.publishMsg(
          'Failed to persist previous state of job');
        bag.consoleAdapter.closeCmd(false);
      } else {
        bag.consoleAdapter.publishMsg(
          'Successfully persisted previous state of job');
        bag.consoleAdapter.closeCmd(true);
      }
      return next(err);
    }
  );
}
