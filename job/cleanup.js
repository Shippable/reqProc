'use strict';

var self = cleanup;
module.exports = self;

var fs = require('fs-extra');

function cleanup(externalBag, callback) {
  var bag = {
    buildDir: externalBag.buildDir,    
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

  if (_.isEmpty(bag.buildDir)) {
    logger.warn(util.format('%s, Build dir is empty.', who));
    return next(true);
  }

  return next();
}

function _cleanupBuildDirectory(bag, next) {
  var who = bag.who + '|' + _cleanupBuildDirectory.name;
  logger.verbose(who, 'Inside');

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
        return next();
      }

      bag.consoleAdapter.publishMsg('Successfully cleaned up');
      bag.consoleAdapter.closeCmd(true);
      return next();
    }
  );
}
