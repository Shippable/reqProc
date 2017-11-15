'use strict';
var self = inStep;
module.exports = self;

var path = require('path');
var executeDependencyScript = require('../../executeDependencyScript.js');

function inStep(params, callback) {
  var bag = {
    resBody: {},
    dependency: params.dependency,
    buildInDir: params.rootDir,
    builderApiAdapter: params.builderApiAdapter,
    consoleAdapter: params.consoleAdapter,
    templatePath: path.resolve(__dirname, 'templates/inStep.sh'),
    scriptName: 'inStep.sh'
  };

  bag.who = util.format('%s|job|handlers|resources|image|%s',
    msName, self.name);
  logger.verbose(bag.who, 'Starting');

  bag.scriptPath =
    path.join(bag.buildInDir, bag.dependency.name, bag.scriptName);

  async.series([
      _checkInputParams.bind(null, bag),
      _injectDependencies.bind(null, bag),
      _executeScript.bind(null, bag)
    ],
    function (err) {
      logger.verbose(bag.who, 'Completed');
      return callback(err, bag.resBody);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.debug(who, 'Inside');

  bag.consoleAdapter.openCmd('Validating dependencies');

  bag.shouldExecuteScript = bag.dependency.versionDependencyPropertyBag.pull;

  bag.consoleAdapter.publishMsg('Successfully validated dependencies');
  bag.consoleAdapter.closeCmd(true);
  return next();
}

function _injectDependencies(bag, next) {
  if (!bag.shouldExecuteScript) return next();
  var who = bag.who + '|' + _injectDependencies.name;
  logger.debug(who, 'Inside');

  bag.consoleAdapter.openCmd('Injecting dependencies');

  bag.dependency.imageName = bag.dependency.sourceName;
  bag.dependency.imageTag = bag.dependency.version.versionName;

  bag.consoleAdapter.publishMsg('Successfully injected dependencies');
  bag.consoleAdapter.closeCmd(true);
  return next();
}

function _executeScript(bag, next) {
  if (!bag.shouldExecuteScript) return next();
  var who = bag.who + '|' + _executeScript.name;
  logger.debug(who, 'Inside');

  var scriptBag = {
    dependency: bag.dependency,
    templatePath: bag.templatePath,
    scriptPath: bag.scriptPath,
    parentGroupDescription: 'IN Image',
    builderApiAdapter: bag.builderApiAdapter,
    consoleAdapter: bag.consoleAdapter
  };

  executeDependencyScript(scriptBag,
    function (err) {
      if (err) {
        logger.error(who,
          util.format('Failed to execute script for dependency %s ' +
          'with error: %s', bag.dependency.name, err)
        );
        return next(true);
      }
      logger.debug(
        util.format('Successfully executed script for dependency %s',
          bag.dependency.name
        )
      );
      return next();
    }
  );
}
