'use strict';
var self = executeCleanupGitConfigScript;
module.exports = self;

var path = require('path');
var fs = require('fs-extra');
var executeScript = require('./executeScript.js');

function executeCleanupGitConfigScript(externalBag, callback) {
  var bag = {
    scriptHeaderFileName: util.format('header.sh'),
    cleanupGitConfigFileName: util.format('cleanup_git_configs.sh'),
    buildRootDir: global.config.buildDir,
    consoleAdapter: externalBag.consoleAdapter,
    cleanupGitConfigScript: '',
    scriptFilePermissions: '755'
  };

  bag.who = msName + '|_common|' + self.name;
  logger.verbose(bag.who, 'Starting');

  async.series([
      _checkInputParams.bind(null, bag),
      _getScriptHeader.bind(null, bag),
      _getCleanupGitConfigScript.bind(null, bag),
      _createCleanupGitConfigScript.bind(null, bag),
      _executeCleanupGitConfigScript.bind(null, bag)
    ],
    function (err) {
      logger.verbose(bag.who, 'Completed');
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

function _getScriptHeader(bag, next) {
  var who = bag.who + '|' + _getScriptHeader.name;
  logger.verbose(who, 'Inside');

  var headerFile = path.join(global.config.execTemplatesDir, 'job',
    bag.scriptHeaderFileName);

  fs.readFile(headerFile, 'utf8',
    function (err, header) {
      if (err) {
        bag.consoleAdapter.openCmd('Failed to read file: ' + headerFile);
        bag.consoleAdapter.publishMsg('Failed to read file: ' + headerFile +
          'with err: ' + err);
        bag.consoleAdapter.closeCmd(true);
        logger.error(util.format('%s, Failed to read file: %s ' +
          'with err: %s', who, headerFile, err));
        return next(err);
      }
      bag.cleanupGitConfigScript = bag.cleanupGitConfigScript.concat(header);
      return next();
    }
  );
}

function _getCleanupGitConfigScript(bag, next) {
  var who = bag.who + '|' + _getCleanupGitConfigScript.name;
  logger.verbose(who, 'Inside');

  var cleanupGitConfigFile = path.join(global.config.execTemplatesDir, 'job',
    bag.cleanupGitConfigFileName);

  fs.readFile(cleanupGitConfigFile, 'utf8',
    function (err, cleanupGitConfig) {
      if (err) {
        bag.consoleAdapter.openCmd('Failed to read file: ' +
          cleanupGitConfigFile);
        bag.consoleAdapter.publishMsg('Failed to read file: ' +
          cleanupGitConfigFile + 'with err: ' + err);
        bag.consoleAdapter.closeCmd(true);
        logger.error(util.format('%s, Failed to read file: %s ' +
          'with err: %s', who, cleanupGitConfigFile, err));
        return next(err);
      }
      bag.cleanupGitConfigScript =
        bag.cleanupGitConfigScript.concat(cleanupGitConfig);
      return next();
    }
  );
}

function _createCleanupGitConfigScript(bag, next) {
  var who = bag.who + '|' + _createCleanupGitConfigScript.name;
  logger.verbose(who, 'Inside');

  bag.cleanupGitConfigScriptFilePath = path.join(bag.buildRootDir,
    bag.cleanupGitConfigFileName);

  __writeScriptFile(bag.cleanupGitConfigScript,
    bag.cleanupGitConfigScriptFilePath, bag.scriptFilePermissions,
    function (err) {
      if (err) {
        bag.consoleAdapter.openCmd('Failed to create file: ' +
          'cleanupGitConfigScript');
        bag.consoleAdapter.publishMsg('Failed to create file: '+
          ' cleanupGitConfigScript with err: ' + err);
        bag.consoleAdapter.closeCmd(true);
        return next(err);
      }
      return next();
    }
  );
}

function _executeCleanupGitConfigScript(bag, next) {
  var who = bag.who + '|' + _executeCleanupGitConfigScript.name;
  logger.debug(who, 'Inside');

  var scriptBag = {
    scriptPath: bag.cleanupGitConfigScriptFilePath,
    consoleAdapter: bag.consoleAdapter
  };

  bag.consoleAdapter.openCmd('Cleaning up git configs');

  executeScript(scriptBag,
    function (err) {
      if (err) {
        logger.error(who, 'Failed to execute cleanup git config', err);
        bag.consoleAdapter.publishMsg('Failed to execute file: '+
          ' cleanupGitConfigScript with err: ' + err);
        bag.consoleAdapter.closeCmd(true);
      }

      return next(err);
    }
  );
}

function __writeScriptFile(script, scriptFilePath, scriptFilePermissions,
  callback) {
  fs.writeFile(scriptFilePath, script,
    function (err) {
      if (err) {
        logger.error(util.format('Failed to write file: %s ' +
          'with err: %s', scriptFilePath, err));
        return callback(err);
      }
      fs.chmodSync(scriptFilePath, scriptFilePermissions);
      return callback();
    }
  );
}
