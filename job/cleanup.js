'use strict';

var self = cleanup;
module.exports = self;

var fs = require('fs-extra');

var generateCleanupGitConfig =
  require('./scriptsGen/generateCleanupGitConfigScript.js');
var executeScript = require('./handlers/executeScript.js');

function cleanup(externalBag, callback) {
  var bag = {
    buildRootDir: externalBag.buildRootDir,
    consoleAdapter: externalBag.consoleAdapter
  };
  bag.who = util.format('%s|job|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _generateCleanupGitConfigScript.bind(null, bag),
      _executeCleanupGitConfigScript.bind(null, bag),
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

function _generateCleanupGitConfigScript(bag, next) {
  var who = bag.who + '|' + _generateCleanupGitConfigScript.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd(util.format('Generate cleanup git config script'));

  var params = {};
  params.buildRootDir = bag.buildRootDir;
  params.consoleAdapter = bag.consoleAdapter;

  generateCleanupGitConfig(params,
    function (err, resultBag) {
      if (err) {
        var msg = util.format('%s, Failed to generate cleanup git config ' +
          'script with err: %s', who, err);
        logger.error(msg);
        return next(err);
      }

      bag.cleanupGitConfigPath = resultBag.cleanupGitConfigScriptFilePath;
      return next();
    }
  );
}

function _executeCleanupGitConfigScript(bag, next) {
  var who = bag.who + '|' + _executeCleanupGitConfigScript.name;
  logger.verbose(who, 'Inside');

  var scriptBag = {
    scriptPath: bag.cleanupGitConfigPath,
    args: [],
    options: {},
    consoleAdapter: bag.consoleAdapter,
    ignoreCmd: false
  };

  executeScript(scriptBag,
    function (err) {
      if (err) {
        var msg = util.format('%s, Failed to execute cleanup git config ' +
          'script with err: %s', who, err);
        return next(msg);
      }

      return next();
    }
  );
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
