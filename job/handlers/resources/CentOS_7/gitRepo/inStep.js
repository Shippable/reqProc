'use strict';
var self = inStep;
module.exports = self;

var path = require('path');
var executeDependencyScript = require('../../../executeDependencyScript.js');

function inStep(params, callback) {
  var bag = {
    resBody: {},
    subPrivateKeyPath: params.bag.subPrivateKeyPath,
    dependency: params.dependency,
    templatePath: path.resolve(__dirname, 'templates/inStep.sh'),
    buildInDir: params.rootDir,
    buildSecretsDir: params.buildSecretsDir,
    scriptName: 'inStep.sh',
    builderApiAdapter: params.builderApiAdapter,
    consoleAdapter: params.consoleAdapter
  };

  bag.who = util.format('%s|job|handlers|resources|gitRepo|%s',
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
  var consoleErrors = [];

  if (!bag.dependency.propertyBag.normalizedRepo)
    consoleErrors.push(
      util.format('%s gitRepo %s is missing required repository information.',
        who, bag.dependency.name)
    );

  if (!bag.dependency.version ||
    _.isEmpty(bag.dependency.version.propertyBag) ||
    _.isEmpty(bag.dependency.version.propertyBag.shaData))
    consoleErrors.push(
      util.format('%s gitRepo %s version %s does not have shaData. ' +
        'Create a new version by webhook before using this resource. ',
        who, bag.dependency.name,
        bag.dependency.version && bag.dependency.version.versionNumber)
    );

  if (consoleErrors.length > 0) {
    _.each(consoleErrors,
      function (e) {
        var msg = e;
        logger.error(bag.who, e);
        bag.consoleAdapter.publishMsg(msg);
      }
    );
    bag.consoleAdapter.closeCmd(false);
    return next(true);
  }

  bag.consoleAdapter.publishMsg('Successfully validated dependencies');
  bag.consoleAdapter.closeCmd(true);
  return next();
}

function _injectDependencies(bag, next) {
  var who = bag.who + '|' + _injectDependencies.name;
  logger.debug(who, 'Inside');

  bag.consoleAdapter.openCmd('Injecting dependencies');

  bag.dependency.privateKey = bag.dependency.propertyBag.sysDeployKey.private;
  bag.dependency.isPrivate =
    bag.dependency.propertyBag.normalizedRepo.isPrivateRepository;

  if (!_.isEmpty(bag.dependency.version.propertyBag.sourceUrl)) {
    bag.dependency.projectUrl = bag.dependency.version.propertyBag.sourceUrl;
  } else {
    if (bag.dependency.isPrivate)
      bag.dependency.projectUrl =
        bag.dependency.propertyBag.normalizedRepo.repositorySshUrl;
    else
      bag.dependency.projectUrl =
        bag.dependency.propertyBag.normalizedRepo.repositoryHttpsUrl;
  }

  bag.dependency.cloneLocation = path.join(bag.buildInDir,
    bag.dependency.name, bag.dependency.type);
  bag.dependency.keyLocation = path.join(bag.buildSecretsDir,
    bag.dependency.name + '_key.pem');
  bag.dependency.commitSha = bag.dependency.version.versionName;
  bag.dependency.shaData = bag.dependency.version.propertyBag.shaData;
  bag.dependency.subPrivateKeyPath = bag.subPrivateKeyPath;

  bag.consoleAdapter.publishMsg('Successfully injected dependencies');
  bag.consoleAdapter.closeCmd(true);
  return next();
}

function _executeScript(bag, next) {
  var who = bag.who + '|' + _executeScript.name;
  logger.debug(who, 'Inside');

  var scriptBag = {
    dependency: bag.dependency,
    templatePath: bag.templatePath,
    scriptPath: bag.scriptPath,
    parentGroupDescription: 'IN Git Repo',
    builderApiAdapter: bag.builderApiAdapter,
    consoleAdapter: bag.consoleAdapter
  };

  var provider = bag.dependency.propertyBag.normalizedRepo.repositoryProvider;

  if (provider === 'github')
    scriptBag.templatePath =
      path.resolve(__dirname, 'templates/providers/_github.sh');
  else if (provider === 'bitbucket' || provider === 'bitbucketServer')
    scriptBag.templatePath =
      path.resolve(__dirname, 'templates/providers/_bitbucket.sh');
  else if (provider === 'gitlab')
    scriptBag.templatePath =
      path.resolve(__dirname, 'templates/providers/_gitlab.sh');

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
