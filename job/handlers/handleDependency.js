'use strict';

var self = handleDependency;
module.exports = self;

var pathPlaceholder = '{{TYPE}}';
var osType = global.config.shippableNodeOperatingSystem;
var inStepPath = './resources/_common/' + pathPlaceholder + '/inStep.js';
var outStepPath = './resources/_common/' + pathPlaceholder + '/outStep.js';
var inStepOSPath =
  './resources/' + osType + '/' + pathPlaceholder + '/inStep.js';
var outStepOSPath =
  './resources/' + osType + '/' + pathPlaceholder + '/outStep.js';

function handleDependency(externalBag, dependency, callback) {
  var bag = {
    inPayload: _.clone(externalBag.inPayload),
    operation: externalBag.operation,
    consoleAdapter: externalBag.consoleAdapter,
    builderApiAdapter: externalBag.builderApiAdapter,
    buildJobId: externalBag.buildJobId,
    buildInDir: externalBag.buildInDir,
    buildOutDir: externalBag.buildOutDir,
    buildScriptsDir: externalBag.buildScriptsDir,
    buildSecretsDir: externalBag.buildSecretsDir,
    stepMessageFilename: externalBag.stepMessageFilename
  };
  bag.who = util.format('%s|job|handlers|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _handleDependency.bind(null, bag, dependency)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, util.format('Failed to process IN dependencies'));
      else
        logger.info(bag.who, 'Successfully processed IN dependencies');

      return callback(err);
    }
  );

}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  return next();
}

function _handleDependency(bag, dependency, next) {
  // We don't know where the group will end so need a flag
  bag.isGrpSuccess = true;

  if (dependency.operation === bag.operation.TASK) return next();
  if (dependency.operation === bag.operation.NOTIFY) return next();

  var who = bag.who + '|' + _handleDependency.name;
  logger.verbose(who, 'Inside');

  var msg = util.format('Processing %s Dependency: %s', dependency.operation,
    dependency.name);
  bag.consoleAdapter.openGrp(msg);
  bag.consoleAdapter.openCmd('Dependency Info');
  bag.consoleAdapter.publishMsg('Version Number: ' +
    dependency.version.versionNumber);

  if (dependency.version.versionName !== null)
    bag.consoleAdapter.publishMsg('Version Name: ' +
      dependency.version.versionName);
  bag.consoleAdapter.closeCmd(true);

  bag.consoleAdapter.openCmd('Validating ' + dependency.name + ' handler');

  var dependencyHandler;
  var dependencyHandlerPath = '';
  var rootDir;

  if (dependency.operation === bag.operation.IN) {
    dependencyHandlerPath =
      inStepOSPath.replace(pathPlaceholder, dependency.type);
    rootDir = bag.buildInDir;
  } else if (dependency.operation === bag.operation.OUT) {
    dependencyHandlerPath =
      outStepOSPath.replace(pathPlaceholder, dependency.type);
    rootDir = bag.buildOutDir;
  }
  try {
    dependencyHandler = require(dependencyHandlerPath);
  } catch (e) {
    logger.debug(util.inspect(e));
  }

  if (!dependencyHandler) {
    if (dependency.operation === bag.operation.IN) {
      dependencyHandlerPath =
        inStepPath.replace(pathPlaceholder, dependency.type);
      rootDir = bag.buildInDir;
    } else if (dependency.operation === bag.operation.OUT) {
      dependencyHandlerPath =
        outStepPath.replace(pathPlaceholder, dependency.type);
      rootDir = bag.buildOutDir;
    }
    try {
      dependencyHandler = require(dependencyHandlerPath);
    } catch (e) {
      logger.debug(util.inspect(e));
    }
  }

  if (!dependencyHandler) {
    msg = util.format('No special dependencyHandler for dependency type: %s %s',
      dependency.operation, dependency.type);
    bag.consoleAdapter.publishMsg(msg);
    bag.consoleAdapter.closeCmd(true);
    return next();
  }

  if (!rootDir) {
    msg = util.format('No root directory for dependency type: %s %s',
      dependency.operation, dependency.type);
    bag.consoleAdapter.publishMsg(msg);
    bag.isGrpSuccess = false;
    return next(true);
  }

  // Closing the command as dependencyHandler will call it's own cmd
  bag.consoleAdapter.publishMsg('Successfully validated handler');
  bag.consoleAdapter.closeCmd(true);

  var params = {
    bag: bag,
    dependency: dependency,
    consoleAdapter: bag.consoleAdapter,
    builderApiAdapter: bag.builderApiAdapter,
    inPayload: bag.inPayload,
    rootDir: rootDir,
    stepMessageFilename: bag.stepMessageFilename,
    buildScriptsDir: bag.buildScriptsDir,
    buildSecretsDir: bag.buildSecretsDir
  };

  dependencyHandler(params,
    function (err) {
      if (err)
        bag.isGrpSuccess = false;
      return next(err);
    }
  );
}
