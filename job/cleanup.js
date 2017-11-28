'use strict';

var self = cleanup;
module.exports = self;

var fs = require('fs-extra');

function cleanup(externalBag, callback) {
  var bag = {
    buildRootDir: externalBag.buildRootDir,
    consoleAdapter: externalBag.consoleAdapter
  };
  bag.who = util.format('%s|job|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _cleanupBuildDirectory.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, util.format('Failed to update buildJob status'));
      else
        logger.info(bag.who, 'Successfully updated buildJob status');

      return callback(err);
    }
  );

}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  var expectedParams = [
    'buildRootDir',
    'consoleAdapter'
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

function _cleanupBuildDirectory(bag, next) {
  var who = bag.who + '|' + _cleanupBuildDirectory.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd(
    util.format('Cleaning directory %s', bag.buildRootDir)
  );

  fs.emptyDir(bag.buildRootDir,
    function (err) {
      if (err) {
        var msg = util.format('%s, Failed to cleanup: %s with err: %s',
          who, bag.buildRootDir, err);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        return next(err);
      }

      bag.consoleAdapter.publishMsg(
        'Successfully cleaned up ' + bag.buildRootDir);
      bag.consoleAdapter.closeCmd(true);
      return next();
    }
  );
}
