'use strict';

var self = generateCleanupGitConfigScript;
module.exports = self;

var path = require('path');
var fs = require('fs-extra');

function generateCleanupGitConfigScript(externalBag, callback) {
  var bag = {
    scriptHeaderFileName: util.format('header.%s',
      global.config.scriptExtension),
    cleanupGitConfigFileName: util.format('cleanup_git_configs.%s',
      global.config.scriptExtension),
    buildRootDir: externalBag.buildRootDir,
    consoleAdapter: externalBag.consoleAdapter,
    cleanupGitConfigScript: '',
    scriptFilePermissions: '755'
  };

  bag.who = util.format('%s|job|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _getScriptHeader.bind(null, bag),
      _getCleanupGitConfigScript.bind(null, bag),
      _createCleanupGitConfigScript.bind(null, bag)
    ],
    function (err) {
      var result = {};
      if (err) {
        logger.error(bag.who,
          util.format('Failed to create cleanup git config script'));
      } else {
        logger.info(bag.who, 'Successfully created cleanup git config script');
        result.cleanupGitConfigScriptFilePath =
          bag.cleanupGitConfigScriptFilePath;
      }

      return callback(err, result);
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
