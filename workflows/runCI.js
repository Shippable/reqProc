'use strict';

var self = runCI;
module.exports = self;

var fs = require('fs-extra');
var path = require('path');

var getStatusCodeByName = require('../runCI/getStatusCodeByName.js');
var getPreviousState = require('../runCI/getPreviousState.js');
var executeJobScript = require('../runCI/executeJobScript.js');
var saveState = require('../runCI/saveState.js');
var executeScript = require('../runCI/executeScript.js');
var generateReplaceScript =
  require('../runCI/scriptsGen/generateReplaceScript.js');

var pathPlaceholder = '{{TYPE}}';
var inStepPath = '../runCI/resources/' + pathPlaceholder + '/inStep.js';
var outStepPath = '../runCI/resources/' + pathPlaceholder + '/outStep.js';

function runCI(externalBag, callback) {
  var bag = {
    consoleAdapter: externalBag.consoleAdapter,
    rawMessage: externalBag.rawMessage,
    builderApiAdapter: externalBag.builderApiAdapter,
    nodeId: config.nodeId,
    isSystemNode: config.isSystemNode,
    dirsToBeCreated: [],
    dirsToBeCleaned: [],
    buildRootDir: '/build',
    artifactsDir: '/shippableci',
    onStartEnvDir: 'onstartjobenvs',
    sshDir: '/tmp/ssh',
    buildManagedDir: '/build/managed',
    mexecScriptDir: '/tmp/mexec',
    mexecScriptRunner: '/scriptRunner.sh',
    cexecDir: '/tmp/cexec',
    cexecMessageName: 'message.json',
    operation: {
      IN: 'IN',
      OUT: 'OUT',
      TASK: 'TASK',
      NOTIFY: 'NOTIFY'
    },
    isCleanupGrpSuccess: true
  };
  bag.inRootDir = path.join(bag.buildRootDir, 'IN');
  bag.outRootDir = path.join(bag.buildRootDir, 'OUT');
  bag.stateDir = path.join(bag.buildRootDir, 'state');
  bag.previousStateDir = path.join(bag.buildRootDir, 'previousState');
  bag.subPrivateKeyPath = '/tmp/00_sub';
  bag.messageFilePath = path.join(bag.buildRootDir, 'message.json');
  bag.stepMessageFilename = 'version.json';
  bag.outputVersionFilePath = path.join(bag.stateDir,
    'outputVersion.json');
  bag.jobEnvDir = path.join(bag.artifactsDir, bag.onStartEnvDir);

  // push all the directories that need to be cleaned into this array
  bag.dirsToBeCleaned.push(bag.buildRootDir, bag.jobEnvDir, bag.sshDir);

  // Push all the directories to be created in this array
  bag.dirsToBeCreated.push(bag.buildRootDir, bag.inRootDir, bag.outRootDir,
    bag.previousStateDir, bag.stateDir, bag.buildManagedDir, bag.mexecScriptDir,
    bag.sshDir, bag.cexecDir, bag.artifactsDir, bag.jobEnvDir);

  bag.who = util.format('%s|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _getClusterNode.bind(null, bag),
      _getSystemNode.bind(null, bag),
      _checkInputParams.bind(null, bag),
      _getJobStatus.bind(null, bag),
      _validateCIJobMessage.bind(null, bag),
      _validateCIJobStepsOrder.bind(null, bag),
      _validateDependencies.bind(null, bag),
      _updateNodeIdInCIJob.bind(null, bag),
      _getBuildJobPropertyBag.bind(null, bag),
      _setUpDirectories.bind(null, bag),
      _getPreviousState.bind(null, bag),
      _getCISecrets.bind(null, bag),
      _extractSecrets.bind(null, bag),
      _saveSubPrivateKey.bind(null, bag),
      _logTimeout.bind(null, bag),
      _setUpDependencies.bind(null, bag),
      _saveCommonENVsToFile.bind(null, bag),
      _saveTaskMessage.bind(null, bag),
      _processInSteps.bind(null, bag),
      _closeSetupGroup.bind(null, bag),
      _processCITask.bind(null, bag),
      _processOutSteps.bind(null, bag),
      _createTrace.bind(null, bag),
      _getLatestJobStatus.bind(null, bag),
      _persistPreviousStateOnFailure.bind(null, bag),
      _saveStepState.bind(null, bag),
      _getOutputVersion.bind(null, bag),
      _extendOutputVersionWithEnvs.bind(null, bag),
      _postTaskVersion.bind(null, bag),
      _postOutResourceVersions.bind(null, bag),
      _updateJobStatus.bind(null, bag),
      _closeCleanupGroup.bind(null, bag),
      _cleanBuildDirectory.bind(null, bag)
    ],
    function (err) {
      return callback(err);
    }
  );
}

function _getClusterNode(bag, next) {
  if (bag.isSystemNode) return next();

  var who = bag.who + '|' + _getClusterNode.name;
  logger.verbose(who, 'Inside');

  bag.builderApiAdapter.getClusterNodeById(bag.nodeId,
    function (err) {
      if (err) {
        logger.warn(who, util.format('Failed to getClusterNodeById: %s' +
          ' with err: %s', bag.nodeId, err));
        return next(true);
      }

      return next();
    }
  );
}

function _getSystemNode(bag, next) {
  if (!bag.isSystemNode) return next();

  var who = bag.who + '|' + _getSystemNode.name;
  logger.verbose(who, 'Inside');

  bag.builderApiAdapter.getSystemNodeById(bag.nodeId,
    function (err) {
      if (err) {
        logger.warn(who, util.format('Failed to getSystemNodeById: %s' +
          ' with err: %s', bag.nodeId, err));
        return next(true);
      }

      return next();
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openGrp('Setup');
  bag.consoleAdapter.openCmd('Validating incoming message');

  bag.isSetupGrpSuccess = true;
  var consoleErrors = [];

  if (_.isEmpty(bag.rawMessage))
    consoleErrors.push(util.format('%s is missing: rawMessage', who));

  if (bag.rawMessage) {
    if (_.isEmpty(bag.rawMessage.payload))
      consoleErrors.push(util.format('%s is missing: payload', who));

    if (bag.rawMessage.payload) {
      bag.inPayload = bag.rawMessage.payload;
      bag.ciSteps = bag.rawMessage.steps;

      if (!bag.inPayload.type)
        consoleErrors.push(util.format('%s is missing: payload.type', who));

      if (!bag.rawMessage.jobId)
        consoleErrors.push(util.format('%s is missing: jobId', who));
      bag.jobId = bag.rawMessage.jobId;

      if (!bag.inPayload.resourceId)
        consoleErrors.push(
          util.format('%s is missing: inPayload.resourceId', who)
        );
      bag.resourceId = bag.inPayload.resourceId;

      if (!bag.inPayload.buildNumber)
        consoleErrors.push(
          util.format('%s is missing: inPayload.buildNumber', who));
      bag.buildNumber = bag.inPayload.buildNumber;

      if (!bag.inPayload.name)
        consoleErrors.push(util.format('%s is missing: inPayload.name', who));

      if (!bag.inPayload.subscriptionId)
        consoleErrors.push(
          util.format('%s is missing: inPayload.subscriptionId', who)
        );

      if (!bag.inPayload.secretsToken)
        consoleErrors.push(
          util.format('%s is missing: inPayload.secretsToken', who)
        );

      if (!_.isObject(bag.inPayload.propertyBag))
        consoleErrors.push(
          util.format('%s is missing: inPayload.propertyBag', who)
        );
      bag.buildJobPropertyBag = bag.inPayload.propertyBag;

      if (!_.isArray(bag.inPayload.dependencies))
        consoleErrors.push(
          util.format('%s is missing: inPayload.dependencies', who)
        );

      bag.projectId = bag.inPayload.projectId;
    }
  }

  if (consoleErrors.length > 0) {
    _.each(consoleErrors,
      function (e) {
        bag.consoleAdapter.publishMsg(e);
      }
    );
    bag.consoleAdapter.closeCmd(false);
    bag.isSetupGrpSuccess = false;

    bag.jobStatusCode = getStatusCodeByName('FAILED');
  } else {
    bag.consoleAdapter.publishMsg('Successfully validated incoming message');
    bag.consoleAdapter.closeCmd(true);
  }
  return next();
}

function _getJobStatus(bag, next) {
  if (bag.jobStatusCode) return next();

  var who = bag.who + '|' + _getJobStatus.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Getting job');

  bag.builderApiAdapter.getJobById(bag.jobId,
    function (err, job) {
      if (err) {
        bag.consoleAdapter.publishMsg(util.format('Failed to get ' +
          'job:%s with err:%s',bag.jobId, err));
        bag.consoleAdapter.closeCmd(false);
        bag.isSetupGrpSuccess = false;
        bag.ciJobStatusCode = getStatusCodeByName('FAILED');
      } else {
        bag.ciJob = job;

        if (job.statusCode === getStatusCodeByName('CANCELED') ||
            job.statusCode === getStatusCodeByName('TIMEOUT')) {
            bag.isJobCancelled = true;
            bag.consoleAdapter.publishMsg('Job:' + bag.jobId +
              ' is cancelled or has timed out, skipping');
            bag.consoleAdapter.closeCmd(true);
        } else {
          bag.consoleAdapter.publishMsg('Successfully fetched job');
          bag.consoleAdapter.closeCmd(true);
        }
      }
      return next();
    }
  );
}

function _validateCIJobMessage(bag, next) {
  if (bag.jobStatusCode) return next();
  if (bag.isJobCancelled) return next();

  var who = bag.who + '|' + _validateCIJobMessage.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Validating CI Steps');
  var consoleErrors = [];

  if (_.isEmpty(bag.ciSteps))
    consoleErrors.push('No steps found');
  else {
    _.each(bag.ciSteps,
      function (step) {
        if (!step.execOrder)
          consoleErrors.push(
            util.format('scriptType:%s is missing execOrder', step.scriptType));
      }
    );
  }

  if (consoleErrors.length > 0) {
    _.each(consoleErrors,
      function (e) {
        bag.consoleAdapter.publishMsg(e);
      }
    );
    bag.consoleAdapter.closeCmd(false);
    bag.isSetupGrpSuccess = false;

    bag.ciJobStatusCode = getStatusCodeByName('FAILED');
  } else {
    bag.consoleAdapter.publishMsg('Successfully validated CI Steps');
    bag.consoleAdapter.closeCmd(true);
  }
  return next();
}

function _validateCIJobStepsOrder(bag, next) {
  if (bag.jobStatusCode) return next();
  if (bag.isJobCancelled) return next();

  var who = bag.who + '|' + _validateCIJobStepsOrder.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Validating steps order');

  bag.ciStepsInSortedOrder = _.sortBy(bag.ciSteps, 'execOrder');

  var bootIndex = _.findIndex(bag.ciStepsInSortedOrder,
    {who: 'mexec', scriptType: 'boot'});

  var errMsg;
  if (!bag.ciStepsInSortedOrder[bootIndex + 1])
    errMsg = 'Missing cexec step after boot step';
  else if (bag.ciStepsInSortedOrder[bootIndex + 1].who !== 'cexec')
    errMsg = 'Incorrect ordering of cexec step';

  if (errMsg) {
    bag.consoleAdapter.publishMsg(errMsg);
    bag.consoleAdapter.closeCmd(false);
    bag.isSetupGrpSuccess = false;
    bag.ciJobStatusCode = getStatusCodeByName('FAILED');
  } else {
    bag.consoleAdapter.publishMsg('Successfully validated steps order');
    bag.consoleAdapter.closeCmd(true);
  }
  return next();
}

function _validateDependencies(bag, next) {
  if (bag.isJobCancelled) return next();
  if (bag.jobStatusCode) return next();

  var who = bag.who + '|' + _validateDependencies.name;
  logger.verbose(who, 'Inside');
  bag.consoleAdapter.openCmd('Validating job dependencies');

  var dependencyErrors = [];

  _.each(bag.inPayload.dependencies,
    function (dependency) {
      if (dependency.nonexistent)
        return dependencyErrors.push(
          util.format('%s dependency has been deleted from the yml ' +
            'or has no versions', dependency.name)
        );

      if (!dependency.name)
        dependencyErrors.push(
          util.format('%s dependency is missing :name', dependency)
        );

      if (!dependency.operation)
        dependencyErrors.push(
          util.format('%s dependency is missing :operation', dependency.name)
        );

      if (!dependency.resourceId)
        dependencyErrors.push(
          util.format('%s dependency is missing :resourceId', dependency.name)
        );

      if (!dependency.type)
        dependencyErrors.push(
          util.format('%s dependency is missing :type', dependency.name)
        );

      if (!_.isObject(dependency.propertyBag))
        dependencyErrors.push(
          util.format('%s dependency is missing :propertyBag', dependency.name)
        );

      if (!_.isObject(dependency.version) && dependency.operation !== 'OUT')
        dependencyErrors.push(
          util.format('Dependency %s has no version. ' +
            'A version must exist in order to use it as an input.',
            dependency.name)
        );

      if (_.isObject(dependency.version) && dependency.operation !== 'OUT') {
        if (!dependency.version.versionId)
          dependencyErrors.push(
            util.format('Dependency %s is missing a valid version. ' +
              'A version must exist in order to use it as an input.',
              dependency.name)
          );

        if (!_.isObject(dependency.version.propertyBag))
          dependencyErrors.push(
            util.format('Dependency %s does not have a valid version. ' +
              'Version %s does not have a propertyBag.',
                dependency.name, dependency.version.versionId)
          );
      }

      if (!dependency.isConsistent)
        dependencyErrors.push(
          util.format('%s dependency is inconsistent', dependency.name)
        );

    }
  );

  if (dependencyErrors.length > 0) {
    _.each(dependencyErrors,
      function (e) {
        bag.consoleAdapter.publishMsg(e);
      }
    );
    bag.consoleAdapter.closeCmd(false);

    bag.jobStatusCode = getStatusCodeByName('FAILED');
  } else {
    bag.consoleAdapter.publishMsg('Successfully validated ' +
      bag.inPayload.dependencies.length + ' dependencies');
    bag.consoleAdapter.closeCmd(true);
  }

  return next();
}

function _updateNodeIdInCIJob(bag, next) {
  if (bag.ciJobStatusCode) return next();

  var who = bag.who + '|' + _updateNodeIdInCIJob.name;
  logger.verbose(who, 'Inside');
  bag.consoleAdapter.openCmd('Updating node');

  var update = {
    node: bag.nodeId,
    statusCode: getStatusCodeByName('PROCESSING')
  };

  bag.builderApiAdapter.putJobById(bag.jobId, update,
    function (err) {
      if (err) {
        var msg =
          util.format('%s, failed to :putJobById for jobId: %s, %s',
            who, bag.jobId, err);

        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        bag.isSetupGrpSuccess = false;

        bag.jobStatusCode = getStatusCodeByName('FAILED');
      } else {
        bag.consoleAdapter.publishMsg('Successfully updated node in job');
        bag.consoleAdapter.closeCmd(true);
      }
      return next();
    }
  );
}

function _getBuildJobPropertyBag(bag, next) {
  if (bag.isJobCancelled) return next();
  if (bag.jobStatusCode) return next();

  var who = bag.who + '|' + _getBuildJobPropertyBag.name;
  logger.verbose(who, 'Inside');
  bag.consoleAdapter.openCmd('Parsing job properties');

  if (_.isEmpty(bag.buildJobPropertyBag.yml))
    bag.buildJobPropertyBag.yml = {};

  if (_.isEmpty(bag.buildJobPropertyBag.yml.on_success))
    bag.buildJobPropertyBag.yml.on_success = [];
  if (_.isEmpty(bag.buildJobPropertyBag.yml.on_failure))
    bag.buildJobPropertyBag.yml.on_failure = [];
  if (_.isEmpty(bag.buildJobPropertyBag.yml.always))
    bag.buildJobPropertyBag.yml.always = [];

  bag.consoleAdapter.publishMsg('Successfully parsed job properties');
  bag.consoleAdapter.closeCmd(true);
  return next();
}

function _setUpDirectories(bag, next) {
  if (bag.isJobCancelled) return next();

  var who = bag.who + '|' + _setUpDirectories.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Setting up build directories for job: ' +
    bag.jobId);

  async.series([
      __cleanDirectories.bind(null, bag),
      __createDirectories.bind(null, bag),
      __createTemplateFiles.bind(null, bag)
    ],
    function (err) {
      if (err) {
        bag.consoleAdapter.closeCmd(false);
        bag.isSetupGrpSuccess = false;
        bag.jobStatusCode = getStatusCodeByName('FAILED');
      } else {
        bag.consoleAdapter.closeCmd(true);
      }
      return next();
    }
  );
}

function __cleanDirectories(bag, next) {
  if (bag.isJobCancelled) return next();

  var who = bag.who + '|' + __cleanDirectories.name;
  logger.verbose(who, 'Inside');
  bag.consoleAdapter.publishMsg('Cleaning directories.');

  async.eachLimit(bag.dirsToBeCleaned, 10,
    function (path, nextPath) {
      fs.emptyDir(path,
        function (err) {
          if (err) {
            var msg = util.format('%s, Failed to clean dir at path:' +
              '%s with err: %s',
                who, path, err);

            bag.consoleAdapter.publishMsg(msg);

            return nextPath(true);
          }
          bag.consoleAdapter.publishMsg(
            'Successfully cleaned directory at path: ' + path);
          return nextPath();
        }
      );
    },
    function (err) {
      return next(err);
    }
  );
}

function __createDirectories(bag, next) {
  if (bag.isJobCancelled) return next();

  var who = bag.who + '|' + __createDirectories.name;
  logger.verbose(who, 'Inside');

  async.eachLimit(bag.dirsToBeCreated, 10,
    function (path, nextPath) {
      fs.mkdirp(path,
        function (err) {
          if (err) {
            var msg = util.format('%s, Failed to dir at path:%s with err: %s',
                who, path, err);

            bag.consoleAdapter.publishMsg(msg);
            return nextPath(true);
          }
          bag.consoleAdapter.publishMsg(
            'Successfully created directory at path: ' + path);
          return nextPath();
        }
      );
    },
    function (err) {
      return next(err);
    }
  );
}

function __createTemplateFiles(bag, next) {
  if (bag.isJobCancelled) return next();

  var who = bag.who + '|' + __createTemplateFiles.name;
  logger.verbose(who, 'Inside');
  // create all files that may or may not be used later in the state directory
  // <resourceName>.env
  var fileList = _.map(bag.inPayload.dependencies,
    function (dependency) {
      return path.join(bag.stateDir, util.format('%s.env', dependency.name));
    }
  );
  fileList.push(path.join(bag.stateDir, util.format('%s.env',
    bag.inPayload.name)));

  async.eachLimit(fileList, 10,
    function (filePath, done) {
      bag.consoleAdapter.publishMsg(
        'Creating template metadata file: ' + filePath);
      fs.open(filePath, 'w',
        function (err, fd) {
          if (err)
            return done(err);
          fs.close(fd,
            function (err) {
              return done(err);
            }
          );
        }
      );
    },
    function (err) {
      return next(err);
    }
  );
}

function _getPreviousState(bag, next) {
  if (bag.isJobCancelled) return next();

  var who = bag.who + '|' + _getPreviousState.name;
  logger.verbose(who, 'Inside');

  // All the commands are opened in the file
  getPreviousState(bag,
    function (err) {
      if (err) {
        var msg = util.format('%s, Did not find previous state for ' +
          'resource: %s', who, bag.inPayload.name);
        logger.verbose(msg);
      }

      if (bag.jobStatusCode)
        bag.isSetupGrpSuccess = false;

      return next();
    }
  );
}

function _getCISecrets(bag, next) {
  if (bag.isJobCancelled) return next();
  if (bag.jobStatusCode) return next();

  var who = bag.who + '|' + _getCISecrets.name;
  logger.verbose(who, 'Inside');

  bag.builderApiAdapter.headers['X-SECRETS-TOKEN'] =
    bag.inPayload.secretsToken;
  bag.builderApiAdapter.getJobById(bag.jobId,
    function (err, job) {
      if (err) {
        var msg = util.format('%s, Failed to get job secrets' +
          ' for jobId:%s, with err: %s', who, bag.jobId, err);
        logger.warn(msg);
        bag.jobStatusCode = getStatusCodeByName('FAILED');
      }
      bag.secrets = job.secrets;

      delete bag.builderApiAdapter.headers['X-SECRETS-TOKEN'];
      return next();
    }
  );
}

function _extractSecrets(bag, next) {
  if (bag.isJobCancelled) return next();
  if (bag.jobStatusCode) return next();

  var who = bag.who + '|' + _extractSecrets.name;
  logger.verbose(who, 'Inside');

  _.each(bag.inPayload.dependencies,
    function (dependency) {
      if (dependency.type === 'params') {
        var decryptedParams =
          _.findWhere(bag.secrets.data.steps, { name: dependency.name });
        if (decryptedParams)
          dependency.version.propertyBag.params = decryptedParams.params;
      }
    }
  );

  return next();
}

function _saveSubPrivateKey(bag, next) {
  if (bag.isJobCancelled) return next();
  if (bag.jobStatusCode) return next();

  var who = bag.who + '|' + _saveSubPrivateKey.name;
  logger.verbose(who, 'Inside');

  fs.outputFile(bag.subPrivateKeyPath,
    bag.secrets.data.subscription.sshPrivateKey,
    function (err) {
      if (err) {
        var msg = util.format('%s, Failed to save subscription private key, %s',
          who, err);
        logger.warn(msg);
        bag.jobStatusCode = getStatusCodeByName('FAILED');
      } else {
        fs.chmodSync(bag.subPrivateKeyPath, '600');
      }
      return next();
    }
  );
}

function _logTimeout(bag, next) {
  if (bag.isJobCancelled) return next();
  if (bag.jobStatusCode) return next();

  var who = bag.who + '|' + _logTimeout.name;
  logger.verbose(who, 'Inside');

  if (bag.ciJob.timeoutMS) {
    bag.consoleAdapter.openCmd('Setting timeout');
    bag.consoleAdapter.publishMsg(util.format('timeout set to %s minutes',
      bag.ciJob.timeoutMS / (60 * 1000))
    );
    bag.consoleAdapter.closeCmd(true);
  }
  return next();
}

function _setUpDependencies(bag, next) {
  if (bag.isJobCancelled) return next();
  if (bag.jobStatusCode) return next();

  var who = bag.who + '|' + _setUpDependencies.name;
  logger.verbose(who, 'Inside');

  if (!bag.inPayload.propertyBag.yml) {
    bag.consoleAdapter.openCmd('Step Errors');
    bag.consoleAdapter.publishMsg('No YML found for job steps');
    bag.consoleAdapter.closeCmd(false);
    bag.isSetupGrpSuccess = false;

    bag.jobStatusCode = getStatusCodeByName('FAILED');
    logger.warn('No yml found for job steps');
    return next();
  }

  var jobName = bag.inPayload.name.replace(/[^A-Za-z0-9_]/g, '').
    replace(/^[0-9]+/g, '').toUpperCase();

  bag.commonEnvs = [
    util.format('RESOURCE_ID=%s', bag.resourceId),
    util.format('BUILD_NUMBER=%s', bag.buildNumber),
    util.format('BUILD_JOB_NUMBER=%s', 1),
    util.format('SUBSCRIPTION_ID=%s', bag.inPayload.subscriptionId),
    util.format('JOB_NAME=%s', bag.inPayload.name),
    util.format('JOB_TYPE=%s', bag.inPayload.type),
    util.format('JOB_PATH="%s"', bag.buildRootDir),
    util.format('JOB_STATE="%s"', bag.stateDir),
    util.format('JOB_PREVIOUS_STATE="%s"', bag.previousStateDir),
    util.format('JOB_MESSAGE="%s"', bag.messageFilePath),
    util.format('%s_NAME=%s', jobName, bag.inPayload.name),
    util.format('%s_TYPE=%s', jobName, bag.inPayload.type),
    util.format('%s_PATH="%s"', jobName, bag.buildRootDir),
    util.format('%s_STATE="%s"', jobName, bag.stateDir),
    util.format('%s_PREVIOUS_STATE="%s"', jobName, bag.previousStateDir),
    util.format('%s_MESSAGE="%s"', jobName, bag.messageFilePath),
    util.format('JOB_TRIGGERED_BY_NAME=%s',
      bag.inPayload.triggeredByName),
    util.format('JOB_TRIGGERED_BY_ID=%s',
      bag.inPayload.triggeredById)
  ];
  bag.paramEnvs = [];

  if (bag.inPayload.injectedGlobalEnv) {
    _.each(bag.inPayload.injectedGlobalEnv,
      function (value, key) {
        var globalEnv = util.format('%s=%s', key, value);
        bag.commonEnvs.push(globalEnv);
      }
    );
  }

  var inAndOutSteps = _.filter(bag.inPayload.propertyBag.yml.steps,
    function (step) {
      return _.has(step, 'IN') || _.has(step, 'OUT');
    }
  );

  async.eachSeries(inAndOutSteps,
    function (step, nextStep) {
      logger.verbose('Executing step:', step);

      var operation = _.find(_.keys(step),
        function (key) {
          return _.contains(
            [bag.operation.IN, bag.operation.OUT], key);
        }
      );
      var name = step[operation];

      bag.consoleAdapter.openCmd('Setting up dependency: ' + name);

      var dependency = _.find(bag.inPayload.dependencies,
        function (dependency) {
          return dependency.name === name && dependency.operation === operation;
        }
      );

      if (!dependency) {
        bag.consoleAdapter.openCmd('Step Errors');

        var msg = util.format('%s, Missing dependency for: %s %s',
          who, operation, name);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        bag.isSetupGrpSuccess = false;
        return nextStep(true);
      }

      var seriesParams = {
        dependency: dependency
      };

      async.series([
          __createDataFile.bind(null, bag, seriesParams),
          __generateReplaceScript.bind(null, bag, seriesParams),
          __replacePlaceholders.bind(null, bag, seriesParams),
          __readTemplatedVersion.bind(null, bag, seriesParams),
          __addDependencyEnvironmentVariables.bind(null, bag, seriesParams),
          __getDependencyIntegrations.bind(null, bag, seriesParams),
          __createStateDirectory.bind(null, bag, seriesParams),
          __getStateInformation.bind(null, bag, seriesParams),
          __createStateFiles.bind(null, bag, seriesParams),
          __setStateFilePermissions.bind(null, bag, seriesParams)
        ],
        function (err) {
          if (err)
            bag.isSetupGrpSuccess = false;
          else
            bag.consoleAdapter.closeCmd(true);

          return nextStep(err);
        }
      );
    },
    function (err) {
      if (err)
        bag.jobStatusCode = getStatusCodeByName('FAILED');

      // adding bag.paramEnvs to the beginning of bag.commonEnvs because
      // Shippable envs should always override user envs
      bag.commonEnvs = bag.paramEnvs.concat(bag.commonEnvs);
      return next();
    }
  );
}

function __createDataFile(bag, seriesParams, next) {
  if (seriesParams.dependency.operation === bag.operation.NOTIFY)
    return next();

  var who = bag.who + '|' + __createDataFile.name;
  logger.verbose(who, 'Inside');

  var dataFilePath = path.join(bag.buildRootDir,
    seriesParams.dependency.operation, seriesParams.dependency.name);

  bag.consoleAdapter.publishMsg('Creating metadata file');

  var innerBag = {
    who: who,
    path: dataFilePath,
    fileName: bag.stepMessageFilename,
    object: seriesParams.dependency,
    consoleAdapter: bag.consoleAdapter
  };

  async.series([
      __createDir.bind(null, innerBag),
      __saveFile.bind(null, innerBag)
    ],
    function (err) {
      if (err) {
        bag.consoleAdapter.closeCmd(false);
        return next(true);
      }
      return next();
    }
  );
}

function __generateReplaceScript(bag, seriesParams, next) {
  if (seriesParams.dependency.operation === bag.operation.NOTIFY)
    return next();
  if (seriesParams.dependency.type === 'params')
    return next();

  var who = bag.who + '|' + __generateReplaceScript.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.publishMsg('Generating replace script');

  var dependencyPath = path.join(bag.buildRootDir,
    seriesParams.dependency.operation, seriesParams.dependency.name);

  var envs = _.map(bag.paramEnvs.concat(bag.commonEnvs),
    function (env) {
      var value = env.split('=').slice(1).join('=');
      if (_.isString(value) && value[0] === '"' &&
        value[value.length - 1] === '"')
        value = value.substring(1, value.length - 1);
      return {
        key: env.split('=')[0],
        value: value
      };
    }
  );

  var templateObject = {
    versionPath: path.join(dependencyPath, bag.stepMessageFilename),
    scriptFileName:  util.format('replace_placeholders.%s',
      global.config.scriptExtension),
    directory: dependencyPath,
    commonEnvs: envs
  };

  generateReplaceScript(templateObject,
    function (err) {
      if (err) {
        var msg = util.format('%s, Failed to generate replace script for %s '+
          ': %s with err: %s', who, seriesParams.dependency.name, err);
        bag.consoleAdapter.publishMsg(msg);
        logger.error(msg);
        bag.consoleAdapter.closeCmd(false);
        return next(err);
      }

      bag.consoleAdapter.publishMsg('Successfully generated replace script');
      return next();
    }
  );
}

function __replacePlaceholders(bag, seriesParams, next) {
  if (seriesParams.dependency.operation === bag.operation.NOTIFY)
    return next();
  if (seriesParams.dependency.type === 'params')
    return next();

  var who = bag.who + '|' + __replacePlaceholders.name;
  logger.verbose(who, 'Inside');

  var dependencyPath = path.join(bag.buildRootDir,
    seriesParams.dependency.operation, seriesParams.dependency.name);

  var scriptBag = {
    scriptPath: path.join(dependencyPath,
      util.format('replace_placeholders.%s', global.config.scriptExtension)),
    args: [],
    parentGroupDescription: 'Replacing placeholders',
    builderApiAdapter: bag.builderApiAdapter,
    consoleAdapter: bag.consoleAdapter,
    options: {
      env: {
        PATH: process.env.PATH
      }
    }
  };

  executeScript(scriptBag,
    function (err) {
      if (err)
        logger.error(who, 'Failed to execute dependency task', err);
      return next(err);
    }
  );
}

function __readTemplatedVersion(bag, seriesParams, next) {
  if (seriesParams.dependency.operation === bag.operation.NOTIFY)
    return next();

  if (seriesParams.dependency.type === 'params')
    return next();

  var who = bag.who + '|' + __readTemplatedVersion.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.publishMsg('Reading version.json');

  var versionPath = path.join(bag.buildRootDir,
    seriesParams.dependency.operation, seriesParams.dependency.name,
    bag.stepMessageFilename);

  fs.readJson(versionPath,
    function (err, versionJson) {
      if (err) {
        bag.consoleAdapter.publishMsg(util.format('Failed to read file %s.',
          versionPath));

        bag.consoleAdapter.closeCmd(false);
        return next(true);
      }

      var dependencyIndex =  _.findIndex(bag.inPayload.dependencies,
        function (dependency) {
          return dependency.name === seriesParams.dependency.name &&
          dependency.operation === seriesParams.dependency.operation;
        }
      );

      if (dependencyIndex > -1)
        bag.inPayload.dependencies[dependencyIndex] = versionJson;

      seriesParams.dependency = versionJson;

      return next();
    }
  );
}

function __addDependencyEnvironmentVariables(bag, seriesParams, next) {
  /* jshint maxstatements:60 */
  var who = bag.who + '|' + __addDependencyEnvironmentVariables.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.publishMsg('Generating environment variables');

  var dependency = seriesParams.dependency;

  var sanitizedDependencyName = dependency.name.replace(/[^A-Za-z0-9_]/g, '').
    replace(/^[0-9]+/g, '').toUpperCase();

  var dependencyPath = bag.buildRootDir + '/' +
    dependency.operation + '/' + dependency.name;

  bag.commonEnvs.push(
    util.format('%s_PATH="%s"', sanitizedDependencyName, dependencyPath)
  );

  bag.commonEnvs.push(
    util.format('%s_STATE="%s"',
      sanitizedDependencyName, path.join(dependencyPath, dependency.type))
  );

  bag.commonEnvs.push(
    util.format('%s_META="%s"', sanitizedDependencyName, dependencyPath)
  );

  bag.commonEnvs.push(
    util.format('%s_NAME="%s"', sanitizedDependencyName, dependency.name)
  );

  bag.commonEnvs.push(
    util.format('%s_TYPE="%s"', sanitizedDependencyName, dependency.type)
  );

  bag.commonEnvs.push(
    util.format('%s_OPERATION="%s"',
      sanitizedDependencyName, dependency.operation)
  );

  bag.commonEnvs.push(
    util.format('%s_ID="%s"', sanitizedDependencyName, dependency.resourceId)
  );

  if (dependency.version) {
    if (dependency.type === 'params' && dependency.operation === 'IN') {
      _.each(dependency.version.propertyBag.params,
        function (value, key) {
          if (_.isObject(value)) {
            value = JSON.stringify(value);
            // Escape spaces and everything else
            value = value.replace(/ /g, '\\ ');
            value = ___escapeEnvironmentVariable(value);

            bag.commonEnvs.push(util.format('%s_PARAMS_%s="%s"',
              sanitizedDependencyName,
              key.replace(/[^A-Za-z0-9_]/g, '').toUpperCase(),
              value
            ));
            bag.paramEnvs.push(util.format('%s="%s"',
              key.replace(/[^A-Za-z0-9_]/g, ''),
              value
            ));
          } else if (key === 'secure') {
            var secureEnvs = value;
            var index;

            while ((index = secureEnvs.indexOf('=')) > -1) {
              var secureKey, secureValue, secondHalf;
              secureKey = secureEnvs.substring(0, index);
              secondHalf = secureEnvs.substring(index + 1, secureEnvs.length);

              var hasMoreEnvs = secondHalf.indexOf('=') > -1;
              if (hasMoreEnvs) {
                var temp = secondHalf.substring(0, secondHalf.indexOf('='));
                var spaceIndex = temp.lastIndexOf(' ');
                secureValue = secondHalf.substring(0, spaceIndex);
                secureEnvs = secondHalf.substring(secureValue.length + 1,
                  secureEnvs.length);
              } else {
                secureValue = secondHalf;
                secureEnvs = '';
              }

              if (!_.isEmpty(secureKey)) {
                if (secureValue[0] === '"' &&
                  secureValue[secureValue.length - 1] === '"')
                  secureValue = secureValue.substring(1,
                    secureValue.length - 1);

                secureValue = ___escapeEnvironmentVariable(secureValue);

                bag.commonEnvs.push(util.format('%s_PARAMS_%s="%s"',
                  sanitizedDependencyName,
                  secureKey.replace(/[^A-Za-z0-9_]/g, '').toUpperCase(),
                  secureValue
                ));
                bag.paramEnvs.push(util.format('%s="%s"',
                  secureKey.replace(/[^A-Za-z0-9_]/g, ''),
                  secureValue
                ));
              }
            }
          } else {
            value = ___escapeEnvironmentVariable(value);
            bag.commonEnvs.push(util.format('%s_PARAMS_%s="%s"',
              sanitizedDependencyName,
              key.replace(/[^A-Za-z0-9_]/g, '').toUpperCase(),
              value
            ));
            bag.paramEnvs.push(util.format('%s="%s"',
              key.replace(/[^A-Za-z0-9_]/g, ''),
              value
            ));
          }
        }
      );
    } else if (dependency.type === 'gitRepo') {
      if (dependency.version.propertyBag &&
        dependency.version.propertyBag.shaData) {
        var shaData = dependency.version.propertyBag.shaData;

        bag.commonEnvs.push(util.format('%s_BRANCH="%s"',
          sanitizedDependencyName,
          ___escapeEnvironmentVariable(shaData.branchName)
        ));
        bag.commonEnvs.push(util.format('%s_BASE_BRANCH="%s"',
          sanitizedDependencyName,
          ___escapeEnvironmentVariable(shaData.baseCommitRef)
        ));
        bag.commonEnvs.push(util.format('%s_HEAD_BRANCH="%s"',
          sanitizedDependencyName,
          ___escapeEnvironmentVariable(shaData.headCommitRef || '')
        ));
        bag.commonEnvs.push(util.format('%s_PULL_REQUEST=%s',
          sanitizedDependencyName, shaData.pullRequestNumber || false
        ));
        bag.commonEnvs.push(util.format('%s_COMMIT=%s',
          sanitizedDependencyName, shaData.commitSha
        ));
        bag.commonEnvs.push(util.format('%s_COMMITTER="%s"',
          sanitizedDependencyName,
          ___escapeEnvironmentVariable(shaData.committer &&
            shaData.committer.displayName)
        ));
        bag.commonEnvs.push(util.format('%s_COMMIT_MESSAGE="%s"',
          sanitizedDependencyName,
          ___escapeEnvironmentVariable(shaData.commitMessage)
        ));
        bag.commonEnvs.push(util.format('%s_IS_GIT_TAG=%s',
          sanitizedDependencyName, shaData.isGitTag
        ));
        bag.commonEnvs.push(util.format('%s_GIT_TAG_NAME="%s"',
          sanitizedDependencyName,
          ___escapeEnvironmentVariable(shaData.gitTagName)
        ));
        bag.commonEnvs.push(util.format('%s_IS_RELEASE=%s',
          sanitizedDependencyName, shaData.isRelease
        ));
        bag.commonEnvs.push(util.format('%s_RELEASE_NAME="%s"',
          sanitizedDependencyName,
          ___escapeEnvironmentVariable(shaData.releaseName)
        ));
        bag.commonEnvs.push(util.format('%s_RELEASED_AT="%s"',
          sanitizedDependencyName,
          ___escapeEnvironmentVariable(shaData.releasedAt)
        ));
        bag.commonEnvs.push(util.format('%s_KEYPATH="%s"',
          sanitizedDependencyName, '/tmp/' + dependency.name + '_key.pem'
        ));
        bag.commonEnvs.push(util.format('%s_IS_PULL_REQUEST="%s"',
          sanitizedDependencyName,
          ___escapeEnvironmentVariable(shaData.isPullRequest)
        ));
        bag.commonEnvs.push(util.format('%s_IS_PULL_REQUEST_CLOSE="%s"',
          sanitizedDependencyName,
          ___escapeEnvironmentVariable(shaData.isPullRequestClose)
        ));
        var pullRequestRepoFullName = shaData.pullRequestRepoFullName || '';
        bag.commonEnvs.push(util.format('%s_PULL_REQUEST_REPO_FULL_NAME="%s"',
          sanitizedDependencyName,
          ___escapeEnvironmentVariable(pullRequestRepoFullName)
        ));
      }
      if (dependency.propertyBag.normalizedRepo) {
        var normalizedRepo = dependency.propertyBag.normalizedRepo;
        bag.commonEnvs.push(util.format('%s_SSH_URL="%s"',
          sanitizedDependencyName,
          ___escapeEnvironmentVariable(normalizedRepo.repositorySshUrl)
        ));
        bag.commonEnvs.push(util.format('%s_HTTPS_URL="%s"',
          sanitizedDependencyName,
          ___escapeEnvironmentVariable(normalizedRepo.repositoryHttpsUrl)
        ));
        bag.commonEnvs.push(util.format('%s_IS_FORK="%s"',
          sanitizedDependencyName,
          ___escapeEnvironmentVariable(normalizedRepo.isFork)
        ));
        bag.commonEnvs.push(util.format('%s_REPO_FULL_NAME="%s"',
          sanitizedDependencyName,
          ___escapeEnvironmentVariable(normalizedRepo.fullName)
        ));
      }
    }

    var versionName = dependency.version.versionName || '';
    versionName = ___escapeEnvironmentVariable(versionName);
    bag.commonEnvs.push(util.format('%s_VERSIONNAME="%s"',
      sanitizedDependencyName,
      versionName
    ));
    bag.commonEnvs.push(util.format('%s_VERSIONNUMBER="%s"',
      sanitizedDependencyName,
      dependency.version.versionNumber
    ));
    bag.commonEnvs.push(util.format('%s_VERSIONID="%s"',
      sanitizedDependencyName,
      dependency.version.versionId
    ));
  }

  if (dependency.version && dependency.version.propertyBag) {
    if (dependency.version.propertyBag.sourceName)
      bag.commonEnvs.push(util.format('%s_SOURCENAME="%s"',
        sanitizedDependencyName,
        ___escapeEnvironmentVariable(dependency.version.propertyBag.sourceName)
      ));
  }

  if (dependency.propertyBag.yml) {
    var pointer = dependency.propertyBag.yml.pointer;

    if (pointer)
      ___createEnvironmentVariablesFromObject(bag.commonEnvs,
        util.format('%s_POINTER', sanitizedDependencyName), pointer);

    var seed = dependency.propertyBag.yml.seed;

    if (seed)
      ___createEnvironmentVariablesFromObject(bag.commonEnvs,
        util.format('%s_SEED', sanitizedDependencyName), seed);
  }

  bag.consoleAdapter.publishMsg('Successfully added environment variables ' +
    'for ' + dependency.name);

  return next();
}

function __getDependencyIntegrations(bag, seriesParams, next) {
  if (!seriesParams.dependency.subscriptionIntegrationId) return next();

  var who = bag.who + '|' + __getDependencyIntegrations.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.publishMsg('Getting integrations');

  var dependencyPath = path.join(bag.buildRootDir,
    seriesParams.dependency.operation, seriesParams.dependency.name);

  bag.builderApiAdapter.getSubscriptionIntegrationById(
    seriesParams.dependency.subscriptionIntegrationId,
    function (err, subInt) {
      if (err) {
        var msg = util.format('%s, Failed getSubscriptionIntegrationById for ' +
          'id: %s, with err: %s', who,
          seriesParams.dependency.subscriptionIntegrationId, err);

        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);

        return next(err);
      }
      bag.consoleAdapter.publishMsg('Successfully fetched integration');
      var accountIntegration = _.findWhere(bag.secrets.data.accountIntegrations,
       { id: subInt.accountIntegrationId });

      var stringData = {};
      var arrayData = {};
      var objectData = {};
      _.each(accountIntegration,
        function (value, key) {
          if (_.isObject(value) && !_.isArray(value)) {
            _.each(value,
              function (objValue, objKey) {
                objectData[objKey] = objValue;
              }
            );
          } else if (_.isObject(value) && _.isArray(value)) {
            var arrData = [];
            _.each(value,
              function (arrValue) {
                if (_.isObject(arrValue)) {
                  _.each(arrValue,
                    function(value2) {
                      arrData.push(value2);
                    }
                  );
                } else {
                  arrData.push(arrValue);
                }
              }
            );
            arrayData[key] = arrData;
          } else {
            stringData[key] = value;
          }
        }
      );

      var stringAndObjectData = _.extend(_.clone(stringData), objectData);
      var allData = _.extend(_.clone(stringAndObjectData), arrayData);

      // integration.json should have object values flattened
      // arrays and strings should be saved as it is
      var innerBag = {
        who: who,
        path: dependencyPath,
        fileName: 'integration.json',
        object: allData,
        consoleAdapter: bag.consoleAdapter
      };

      // array should be a single quoted string with values in double quotes
      // and separated by comma
      _.each(arrayData,
        function (value, key) {
          var values = [];
          _.each(value,
            function (val) {
              values.push('"' + val + '"');
            }
          );
          arrayData[key] = '\'' + values.join(',') + '\'';
        }
      );

      stringAndObjectData = _.omit(stringAndObjectData, ['id', 'masterName']);
      var envString  = _.map(
        _.extend(_.clone(stringAndObjectData), arrayData),
        function (value, key) {
          if (_.has(arrayData, key))
            return key + '=' + value;
          else
            return key + '="' + value + '"';
        }
      ).join('\n');

      // add integrations to environment variables
      var sanitizedDependencyName = seriesParams.dependency.name.
        replace(/[^A-Za-z0-9_]/g, '').replace(/^[0-9]+/g, '').toUpperCase();
      var stringAndArrayData = _.extend(_.clone(stringData), arrayData);

      // environment variables should have objects flattened
      // arrays should be same as integration.env
      // and, special characters should be escaped in all the values
      stringAndArrayData = _.omit(stringAndArrayData, ['id', 'masterName']);
      _.each(stringAndArrayData,
        function (value, key) {
          value = ___escapeEnvironmentVariable(value);
          bag.commonEnvs.push(util.format('%s_INTEGRATION_%s="%s"',
            sanitizedDependencyName,
            key.replace(/[^A-Za-z0-9_]/g, '').toUpperCase(),
            value
          ));
        }
      );
      _.each(objectData,
        function (value, key) {
          value  = ___replaceSingleQuotes(value);
          bag.commonEnvs.push(util.format('%s=\'%s\'', key, value));
        }
      );

      // integrations.env should have object values flattened
      // array should be a single quoted string with values in double quotes
      // and separated by comma
      var innerBagEnv = {
        who: who,
        path: dependencyPath,
        fileName: 'integration.env',
        object: envString,
        consoleAdapter: bag.consoleAdapter
      };

      var innerBagKey = {
        who: who,
        path: dependencyPath,
        consoleAdapter: bag.consoleAdapter,
        permissions: '600',
        hasKey: false
      };

      var innerBagSshPublicKey = {
        who: who,
        path: dependencyPath,
        consoleAdapter: bag.consoleAdapter,
        permissions: '600',
        hasKey: false
      };

      if (accountIntegration.masterName === 'pem-key' ||
        accountIntegration.masterName === 'pemKey') {
        innerBagKey.fileName = seriesParams.dependency.name + '_key.pem';
        innerBagKey.object = accountIntegration.key;
        innerBagKey.hasKey = true;
      } else if (accountIntegration.masterName === 'ssh-key' ||
        accountIntegration.masterName === 'sshKey') {
        // private key
        innerBagKey.fileName = seriesParams.dependency.name + '_key';
        innerBagKey.object = accountIntegration.privateKey;
        innerBagKey.hasKey = true;
        bag.commonEnvs.push(util.format('%s_PRIVATE_KEY_PATH="%s"',
          sanitizedDependencyName, path.join(dependencyPath,
          innerBagKey.fileName)));

        // public key
        innerBagSshPublicKey.fileName =
          seriesParams.dependency.name + '_key.pub';
        innerBagSshPublicKey.object = accountIntegration.publicKey;
        innerBagSshPublicKey.hasKey = true;
        bag.commonEnvs.push(util.format('%s_PUBLIC_KEY_PATH="%s"',
          sanitizedDependencyName, path.join(dependencyPath,
          innerBagSshPublicKey.fileName)));
      }

      if (innerBagKey.hasKey)
        bag.commonEnvs.push(util.format('%s_KEYPATH="%s"',
          sanitizedDependencyName, path.join(dependencyPath,
          innerBagKey.fileName)
        ));
      else
        innerBagKey = {};

      if (!innerBagSshPublicKey.hasKey)
        innerBagSshPublicKey = {};

      var innerBagGitCredential = {};
      if (accountIntegration.masterName === 'gitCredential') {
        // Git credentials need to be saved in a specific location.
        innerBagGitCredential = {
          who: who,
          consoleAdapter: bag.consoleAdapter,
          path: process.env.HOME,
          fileName: '.git-credentials'
        };

        // Save credentials with and without port in case the port is implicit.
        var keyWithoutPort = util.format('https://%s:%s@%s',
          accountIntegration.username, accountIntegration.password,
          accountIntegration.host);
        var keyWithPort = util.format('%s:%s', keyWithoutPort,
          accountIntegration.port);
        innerBagGitCredential.object = util.format('%s\n%s\n',
          keyWithoutPort, keyWithPort);
      }

      async.series([
          __saveFile.bind(null, innerBag),
          __saveFile.bind(null, innerBagEnv),
          __saveFile.bind(null, innerBagKey),
          __saveFile.bind(null, innerBagSshPublicKey),
          __appendFile.bind(null, innerBagGitCredential)
        ],
        function (err) {
          if (err) {
            bag.consoleAdapter.publishMsg('Failed to create integration file');
            bag.consoleAdapter.closeCmd(false);
            return next(true);
          }

          return next();
        }
      );
    }
  );
}

function __createStateDirectory(bag, seriesParams, next) {
  if (seriesParams.dependency.type === 'params') return next();
  var who = bag.who + '|' + __createStateDirectory.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.publishMsg('Creating state directory');

  var dependencyStatePath = path.join(bag.buildRootDir,
    seriesParams.dependency.operation, seriesParams.dependency.name,
    seriesParams.dependency.type);

  var innerBag = {
    who: who,
    path: dependencyStatePath,
    consoleAdapter: bag.consoleAdapter
  };

  async.series([
      __createDir.bind(null, innerBag)
    ],
    function (err) {
      if (err) {
        bag.consoleAdapter.publishMsg('Failed to create state directory for ' +
          seriesParams.dependency.name);
        bag.consoleAdapter.closeCmd(false);
        return next(true);
      }

      return next();
    }
  );
}
function __getStateInformation(bag, seriesParams, next) {
  if (!seriesParams.dependency.isJob) return next();

  if (seriesParams.dependency.operation === 'OUT' &&
    (!seriesParams.dependency.version ||
    !seriesParams.dependency.version.propertyBag ||
    !seriesParams.dependency.version.propertyBag.sha))
    return next();

  if (seriesParams.dependency.type === 'externalCI')
    return next();

  var who = bag.who + '|' + __getStateInformation.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.publishMsg('Getting state information');

  // any job should have this value
  if (!seriesParams.dependency.version.propertyBag.sha) {
    bag.consoleAdapter.publishMsg(util.format(
      '%s is missing propertyBag.sha', seriesParams.dependency.name));
    bag.consoleAdapter.closeCmd(false);
    return next(true);
  }
  var sha = seriesParams.dependency.version.propertyBag.sha;

  var query = 'sha=' + sha;
  bag.builderApiAdapter.getFilesByResourceId(seriesParams.dependency.resourceId,
    query,
    function (err, data) {
      var msg;
      if (err) {
        msg = util.format('%s :getFilesByResourceId failed for ' +
          'resourceId: %s with error %s', who,
          seriesParams.dependency.resourceId, err);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        return next(true);
      }
      bag.outputFileJSON = data;
      if (_.isEmpty(bag.outputFileJSON))
        msg = 'No state files found for job';
      else
        msg = 'Successfully received state files for job';
      bag.consoleAdapter.publishMsg(msg);
      return next();
    }
  );
}
function __createStateFiles(bag, seriesParams, next) {
  if (!seriesParams.dependency.isJob) return next();
  if (_.isEmpty(bag.outputFileJSON)) return next();

  var who = bag.who + '|' + __createStateFiles.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.publishMsg('Writing state files');

  var dependencyStatePath = path.join(bag.buildRootDir,
    seriesParams.dependency.operation,
    seriesParams.dependency.name, seriesParams.dependency.type);

  async.eachLimit(bag.outputFileJSON, 10,
    function (file, nextFile) {
      var path = util.format('%s%s', dependencyStatePath, file.path);
      fs.outputFile(path, file.contents,
        function (err) {
          if (err) {
            var msg = util.format('%s, Failed to create file:%s with err:%s',
              who, file, err);
            bag.consoleAdapter.publishMsg(msg);
            return nextFile(true);
          }
          return nextFile();
        }
      );
    },
    function (err) {
      if (!err)
        bag.consoleAdapter.publishMsg(
          'Successfully created state files at path: ' + dependencyStatePath);
      return next(err);
    }
  );
}
function __setStateFilePermissions(bag, seriesParams, next) {
  if (!seriesParams.dependency.isJob) return next();

  var who = bag.who + '|' + __setStateFilePermissions.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.publishMsg('Setting state file permissions');

  var dependencyStatePath = path.join(bag.buildRootDir,
    seriesParams.dependency.operation,
    seriesParams.dependency.name, seriesParams.dependency.type);

  async.eachLimit(bag.outputFileJSON, 10,
    function (file, nextFile) {
      var path = util.format('%s%s', dependencyStatePath, file.path);
      fs.chmod(path, file.permissions,
        function (err) {
          if (err) {
            var msg = util.format('%s, Failed to set permissions for ' +
              'file:%s with err:%s', who, path, err);
            bag.consoleAdapter.publishMsg(msg);
            return nextFile(true);
          }
          return nextFile();
        }
      );
    },
    function (err) {
      if (!err)
        bag.consoleAdapter.publishMsg(
          'Successfully set permissions for state files');
      return next(err);
    }
  );
}

function _saveCommonENVsToFile(bag, next) {
  if (bag.isJobCancelled) return next();
  if (bag.jobStatusCode) return next();

  var who = bag.who + '|' + _saveCommonENVsToFile.name;
  logger.verbose(who, 'Inside');

  var filePath = bag.buildRootDir + '/common.env';
  bag.consoleAdapter.openCmd('writing ENVs to file');
  var exportedEnvs = _.map(bag.commonEnvs,
    function (env) {
      return 'export ' + env;
    }
  );
  var fileContents = exportedEnvs.join('\n');
  fs.outputFile(filePath, fileContents,
    function (err) {
      if (err) {
        var msg = util.format('Failed to create file %s with err: %s',
          filePath, err);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        bag.isSetupGrpSuccess = false;
        bag.jobStatusCode = getStatusCodeByName('FAILED');
      } else {
        bag.consoleAdapter.publishMsg('Successfully created file: ' + filePath);
        bag.consoleAdapter.closeCmd(true);
      }
      return next();
    }
  );
}

function _saveTaskMessage(bag, next) {
  if (bag.isJobCancelled) return next();
  if (bag.jobStatusCode) return next();

  var who = bag.who + '|' + _saveTaskMessage.name;
  logger.verbose(who, 'Inside');

  // If TASK step is not present, a managed TASK step is
  // automatically injected as last step by Shippable
  // This has to be done before saving the message,
  // as message.json is used by all the managed tasks.

  var isTaskStepPresent = _.some(bag.inPayload.propertyBag.yml.steps,
    function (step) {
      return _.has(step, bag.operation.TASK);
    }
  );
  if (!isTaskStepPresent)
    bag.inPayload.propertyBag.yml.steps.push({TASK : 'managed'});

  var taskMessage = {
    name: bag.inPayload.name,
    resourceId: bag.inPayload.resourceId,
    subscriptionId: bag.inPayload.subscriptionId,
    type: bag.inPayload.type,
    path: bag.buildRootDir,
    buildNumber: bag.inPayload.buildNumber,
    steps: bag.inPayload.propertyBag.yml.steps,
    force: bag.inPayload.force,
    reset: bag.inPayload.reset,
    dependencies: [],
    propertyBag: bag.inPayload.propertyBag
  };

  taskMessage.dependencies = _.map(bag.inPayload.dependencies,
    function (dep) {

      var depPath = path.join(bag.buildRootDir, dep.operation, dep.name);
      var taskMessageDependency = {
        operation: dep.operation,
        name: dep.name,
        resourceId: dep.resourceId,
        type: dep.type,
        path: depPath,
        propertyBag: dep.propertyBag,
        sourceName: dep.version && dep.version.propertyBag &&
          dep.version.propertyBag.sourceName
      };
      if (!_.isEmpty(dep.version)) {
        taskMessageDependency.version = {
          versionId: dep.version.versionId,
          versionNumber: dep.version.versionNumber,
          versionName: dep.version.versionName,
          propertyBag: dep.version.propertyBag
        };
      } else
        taskMessageDependency.version = {};

      if (!_.isEmpty(dep.versionDependencyPropertyBag))
        taskMessageDependency.versionDependencyPropertyBag =
          dep.versionDependencyPropertyBag;
      else
        taskMessageDependency.versionDependencyPropertyBag = {};

      return taskMessageDependency;
    }
  );
  bag.consoleAdapter.openCmd('Writing message to file');
  fs.writeFile(bag.messageFilePath, JSON.stringify(taskMessage),
    function (err) {
      if (err) {
        var msg = util.format('%s, Failed to save message, %s',
          who, err);

        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        bag.isSetupGrpSuccess = false;
        bag.jobStatusCode = getStatusCodeByName('FAILED');
      } else {
        bag.consoleAdapter.publishMsg(
          'Successfully saved message at: ' + bag.messageFilePath);
        bag.consoleAdapter.closeCmd(true);
      }

      return next();
    }
  );
}

function _processInSteps(bag, next) {
  if (bag.isJobCancelled) return next();
  if (bag.jobStatusCode) return next();

  var who = bag.who + '|' + _processInSteps.name;
  logger.verbose(who, 'Inside');

  async.eachSeries(bag.inPayload.propertyBag.yml.steps,
    function (step, nextStep) {

      var operation = _.find(_.keys(step),
        function (key) {
          return key === bag.operation.IN;
        }
      );
      if (!operation) return nextStep();
      logger.verbose('Executing step:', step);

      var name = step[operation];

      var dependency = _.find(bag.inPayload.dependencies,
        function (dependency) {
          return dependency.name === name && dependency.operation === operation;
        }
      );

      if (!dependency) {
        bag.consoleAdapter.openCmd('Step Errors');

        var msg = util.format('%s, Missing dependency for: %s %s',
          who, operation, name);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        bag.isSetupGrpSuccess = false;

        return nextStep(true);
      }

      async.series([
          __handleDependency.bind(null, bag, dependency),
        ],
        function (err) {
          if (err) {
            bag.consoleAdapter.closeCmd(false);
            bag.isSetupGrpSuccess = false;
          } else {
            bag.consoleAdapter.closeCmd(true);
          }
          return nextStep(err);
        }
      );
    },
    function (err) {
      if (err)
        bag.jobStatusCode = getStatusCodeByName('FAILED');
      return next();
    }
  );
}

function _closeSetupGroup(bag, next) {
  var who = bag.who + '|' + _closeSetupGroup.name;
  logger.verbose(who, 'Inside');

  if (bag.isSetupGrpSuccess)
    bag.consoleAdapter.closeGrp(true);
  else
    bag.consoleAdapter.closeGrp(false);

  return next();
}

function _processCITask(bag, next) {
  if (bag.isJobCancelled) return next();
  if (bag.jobStatusCode) return next();

  var who = bag.who + '|' + _processCITask.name;
  logger.verbose(who, 'Inside');

  var scriptBag = {
    consoleAdapter: bag.consoleAdapter,
    steps: bag.ciStepsInSortedOrder,
    mexecFileNameWithPath: path.join(bag.mexecScriptDir,
      bag.mexecScriptRunner),
    ciJob: bag.ciJob,
    jobEnvDir: bag.jobEnvDir,
    builderApiAdapter: bag.builderApiAdapter,
    rawMessage: bag.rawMessage,
    workflow: bag.workflow,
    cexecMessageNameWithLocation: path.join(bag.cexecDir,
      bag.cexecMessageName),
    sshDir: bag.sshDir
  };

  executeJobScript(scriptBag,
    function (err) {
      if (err) {
        bag.jobStatusCode = getStatusCodeByName('FAILED');
        bag.consoleAdapter.closeGrp(false);
      } else {
        bag.consoleAdapter.closeGrp(true);
      }

      return next();
    }
  );
}

function _processOutSteps(bag, next) {
  if (bag.isJobCancelled) return next();

  var who = bag.who + '|' + _processOutSteps.name;
  logger.verbose(who, 'Inside');

  // We will close the group at end, as we don't
  // really know when the group will be closed
  // we use bag.isCleanupGrpSuccess to check whether
  // group is success or not.
  bag.consoleAdapter.openGrp('Cleanup');
  async.eachSeries(bag.inPayload.propertyBag.yml.steps,
    function (step, nextStep) {

      var operation = _.find(_.keys(step),
        function (key) {
          return key === bag.operation.OUT;
        }
      );
      if (!operation) return nextStep();

      logger.verbose('Executing step:', step);
      var name = step[operation];

      var dependency = _.find(bag.inPayload.dependencies,
        function (dependency) {
          return dependency.name === name && dependency.operation === operation;
        }
      );

      if (!dependency) {
        bag.consoleAdapter.openCmd('Step Errors');

        var msg = util.format('%s, Missing dependency for: %s %s',
          who, operation, name);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        bag.isCleanupGrpSuccess = false;

        return nextStep(true);
      }

      if (dependency.type !== 'state' && bag.jobStatusCode)
        return nextStep();

      async.series([
          __handleDependency.bind(null, bag, dependency),
        ],
        function (err) {
          if (err) {
            bag.consoleAdapter.closeCmd(false);
            bag.isCleanupGrpSuccess = false;
          } else {
            bag.consoleAdapter.closeCmd(true);
          }
          return nextStep(err);
        }
      );
    },
    function (err) {
      if (err)
        bag.jobStatusCode = getStatusCodeByName('FAILED');
      return next();
    }
  );
}

function __handleDependency(bag, dependency, next) {
  if (dependency.operation === bag.operation.TASK) return next();
  if (dependency.operation === bag.operation.NOTIFY) return next();

  var who = bag.who + '|' + __handleDependency.name;
  logger.verbose(who, 'Inside');

  var msg = util.format('Processing %s Dependency: %s', dependency.operation,
    dependency.name);
  bag.consoleAdapter.openCmd(msg);
  bag.consoleAdapter.publishMsg('Version Number: ' +
    dependency.version.versionNumber);

  if (dependency.version.versionName !== null)
    bag.consoleAdapter.publishMsg('Version Name: ' +
      dependency.version.versionName);

  var dependencyHandler;
  var dependencyHandlerPath = '';
  var rootDir;
  if (dependency.operation === bag.operation.IN) {
    dependencyHandlerPath =
      inStepPath.replace(pathPlaceholder, dependency.type);
    rootDir = bag.inRootDir;
  } else if (dependency.operation === bag.operation.OUT) {
    dependencyHandlerPath =
      outStepPath.replace(pathPlaceholder, dependency.type);
    rootDir = bag.outRootDir;
  }
  try {
    dependencyHandler = require(dependencyHandlerPath);
  } catch (e) {
    logger.debug(util.inspect(e));
  }

  if (!dependencyHandler) {
    msg = util.format('No special dependencyHandler for dependency type: %s %s',
      dependency.operation, dependency.type);
    bag.consoleAdapter.publishMsg(msg);
    return next();
  }

  if (!rootDir) {
    msg = util.format('No root directory for dependency type: %s %s',
      dependency.operation, dependency.type);
    bag.consoleAdapter.publishMsg(msg);
    return next(true);
  }

  bag.consoleAdapter.publishMsg('Successfully validated handler');

  var params = {
    bag: bag,
    dependency: dependency,
    consoleAdapter: bag.consoleAdapter,
    builderApiAdapter: bag.builderApiAdapter,
    rawMessage: bag.rawMessage,
    rootDir: rootDir,
    stepMessageFilename: bag.stepMessageFilename
  };

  dependencyHandler(params,
    function (err) {
      return next(err);
    }
  );
}

function _createTrace(bag, next) {
  if (!_.isArray(bag.inPayload.dependencies)) return next();

  var who = bag.who + '|' + _createTrace.name;
  logger.verbose(who, 'Inside');

  bag.trace = [];
  _.each(bag.inPayload.dependencies,
    function (dependency) {
      if (dependency.operation !== 'IN' && dependency.operation !== 'OUT')
        return;

      var resourceType = _.findWhere(global.systemCodes,
        {name: dependency.type, group: 'resource'});

      var traceObject = {
        operation: dependency.operation,
        resourceId: dependency.resourceId,
        resourceName: dependency.name,
        resourceTypeCode: (resourceType && resourceType.code) || null,
        versionId: null,
        versionNumber: null,
        versionName: null,
        versionCreatedAt: null,
        usedByVersionId: 0 // Save 0 for the current version
      };

      if (dependency.operation === 'OUT' || !dependency.version) {
        bag.trace.push(traceObject);
        return;
      }

      traceObject.versionId = dependency.version.versionId;
      traceObject.versionNumber = dependency.version.versionNumber;
      traceObject.versionName = dependency.version.versionName;
      traceObject.versionCreatedAt = dependency.version.createdAt;

      bag.trace.push(traceObject);

      if (!dependency.version.propertyBag) return;

      _.each(dependency.version.propertyBag.trace,
        function (dependencyTraceObject) {
          if (dependencyTraceObject.operation !== 'IN')
            return;
          if (dependencyTraceObject.usedByVersionId === 0)
            dependencyTraceObject.usedByVersionId =
              dependency.version.versionId;

          var isDuplicate = _.findWhere(bag.trace,
            {
              operation: dependencyTraceObject.operation,
              resourceId: dependencyTraceObject.resourceId,
              versionId: dependencyTraceObject.versionId,
              usedByVersionId: dependencyTraceObject.usedByVersionId
            }
          );

          if (!isDuplicate)
            bag.trace.push(dependencyTraceObject);
        }
      );
    }
  );

  return next();
}

function _getLatestJobStatus(bag, next) {
  var who = bag.who + '|' + _getLatestJobStatus.name;
  logger.verbose(who, 'Inside');

  bag.builderApiAdapter.getJobById(bag.jobId,
    function (err, job) {
      if (err) {
        var msg = util.format('%s, Failed to get job' +
          ' for jobId:%s, with err: %s', who, bag.jobId, err);
        logger.warn(msg);
        bag.jobStatusCode = getStatusCodeByName('FAILED');
      }

      if (job.statusCode ===
        getStatusCodeByName('CANCELED')) {
        bag.isJobCancelled = true;
        logger.warn(util.format('%s, Job with jobId:%s' +
          ' is cancelled', who, bag.jobId));
      }
      return next();
    }
  );
}

function _persistPreviousStateOnFailure(bag, next) {
  if (!bag.jobStatusCode) return next();

  var who = bag.who + '|' + _persistPreviousStateOnFailure.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Persisting Previous State');
  bag.consoleAdapter.publishMsg('Copy previous state to current state');

  var srcDir = bag.previousStateDir ;
  var destDir = bag.stateDir;
  fs.copy(srcDir, destDir,
    function (err) {
      if (err) {
        bag.consoleAdapter.publishMsg(
          'Failed to persist previous state of job');
        bag.consoleAdapter.closeCmd(false);
        bag.isCleanupGrpSuccess = false;
      }
      bag.consoleAdapter.publishMsg(
        'Successfully persisted previous state of job');
      bag.consoleAdapter.closeCmd(true);

      return next();
    }
  );
}

function _saveStepState(bag, next) {
  if (bag.isJobCancelled) return next();

  var who = bag.who + '|' + _saveStepState.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Saving Job Files');

  saveState(bag,
    function (err, sha) {
      if (err) {
        logger.error(who,
          util.format('Failed to save state for resource: %s',
            bag.inPayload.name), err
        );
        bag.isCleanupGrpSuccess = false;

        bag.jobStatusCode = getStatusCodeByName('FAILED');
      } else {
        bag.versionSha = sha;
        bag.consoleAdapter.closeCmd(true);
      }
      return next();
    }
  );
}

function _getOutputVersion(bag, next) {
  if (bag.isJobCancelled) return next();
  if (bag.jobStatusCode) return next();

  var who = bag.who + '|' + _getOutputVersion.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Saving resource version');

  fs.readJson(bag.outputVersionFilePath,
    function (err, outputVersion) {
      // don't throw an error if this file doesn't exist
      var msg;
      if (err)
        msg = util.format('Failed to read %s', bag.outputVersionFilePath);
      else
        msg = 'Successfully read output version';

      bag.outputVersion = outputVersion || {};

      bag.consoleAdapter.publishMsg(msg);

      return next();
    }
  );
}

function _extendOutputVersionWithEnvs(bag, next) {
  if (bag.isJobCancelled) return next();
  if (bag.jobStatusCode) return next();

  var who = bag.who + '|' + _extendOutputVersionWithEnvs.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.publishMsg('Reading additional job properties');
  var envFilePath = path.join(bag.stateDir, util.format('%s.env',
    bag.inPayload.name));
  var newVersionName = '';
  var propertyBag = {};
  try {
    var envFile = fs.readFileSync(envFilePath).toString();
    var lines = envFile.split('\n');
    bag.consoleAdapter.publishMsg(
      util.format('found file %s.  Checking for additional properties.',
      envFilePath)
    );
    _.each(lines,
      function (line) {
        var nameAndValue = line.split('=');
        var key = nameAndValue[0];
        var value = nameAndValue[1];
        if (key) {
          bag.consoleAdapter.publishMsg('found a key: ' + key);
          if (key === 'versionName')
            newVersionName = value;
          else
            propertyBag[key] = value;
        }
      }
    );
  } catch (err) {
    bag.consoleAdapter.publishMsg(
      util.format('Could not parse file %s. Hence Skipping.',
        envFilePath));
    bag.consoleAdapter.publishMsg(
      util.format('unable to read file %s.env', bag.inPayload.name));
    return next();
  }
  var extraVersionInfo = {};
  if (newVersionName) {
    bag.consoleAdapter.publishMsg(
      util.format('Found versionName %s', newVersionName));
    extraVersionInfo.versionName = newVersionName;
  }
  if (!_.isEmpty(propertyBag))
    extraVersionInfo.propertyBag = propertyBag;

  _.extend(bag.outputVersion, extraVersionInfo);
  return next();
}

function _postTaskVersion(bag, next) {
  if (bag.isJobCancelled) return next();
  if (!bag.resourceId) return next();

  var who = bag.who + '|' + _postTaskVersion.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.publishMsg('Updating resource version');

  // jobStatusCode is only set to FAILED, so if we reach this
  // function without any code we know job has succeeded
  if (!bag.jobStatusCode)
    bag.jobStatusCode = getStatusCodeByName('SUCCESS');

  var version = {
    resourceId: bag.resourceId,
    projectId: bag.projectId,
    propertyBag: {},
    versionTrigger: false
  };

  if (bag.outputVersion)
    _.extend(version,  bag.outputVersion);

  version.propertyBag.sha = bag.versionSha;
  version.propertyBag.trace = bag.trace;
  if (!_.isEmpty(bag.rawMessage.jobId))
    version.jobId = bag.rawMessage.jobId;

  var msg;
  bag.builderApiAdapter.postVersion(version,
    function (err, newVersion) {
      if (err) {
        msg = util.format('%s, Failed to post version for ' +
          'resourceId: %s with err: %s', who, bag.resourceId, err);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        bag.isCleanupGrpSuccess = false;
      } else {
        bag.version = newVersion;
        msg = util.format('Successfully posted version:%s for ' +
          'resourceId: %s', newVersion.id, bag.resourceId);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(true);
      }

      return next();
    }
  );
}

function _postOutResourceVersions(bag, next) {
  if (bag.isJobCancelled) return next();
  if (!bag.resourceId) return next();
  if (bag.jobStatusCode !== getStatusCodeByName('SUCCESS'))
    return next();

  var who = bag.who + '|' + _postOutResourceVersions.name;
  logger.verbose(who, 'Inside');

  bag.updatedOUTResources = [];
  async.eachSeries(bag.inPayload.propertyBag.yml.steps,
    function (step, nextStep) {

      var operation = _.find(_.keys(step),
        function (key) {
          return key === bag.operation.OUT;
        }
      );
      if (!operation) return nextStep();

      var name = step[operation];
      logger.verbose('Processing OUT:', name);

      var dependency = _.find(bag.inPayload.dependencies,
        function (dependency) {
          return dependency.name === name && dependency.operation === operation;
        }
      );

      if (!dependency) {
        bag.consoleAdapter.openCmd('Step Errors');

        var msg = util.format('%s, Missing dependency for: %s %s',
          who, operation, name);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        bag.isCleanupGrpSuccess = false;

        return nextStep(true);
      }

      var replicate = dependency.versionDependencyPropertyBag &&
        dependency.versionDependencyPropertyBag.replicate;

      var replicateOnPullRequest = true;
      if (_.has(dependency.versionDependencyPropertyBag, 'replicateOnPullRequest'))
        replicateOnPullRequest =
          dependency.versionDependencyPropertyBag.replicateOnPullRequest;

      // currently ciRepo version comparision and creation is done
      // in its outStep.js file. This is handled separately, as .env file
      // only allows string values and we need json support
      // currently state version comparison and creation is done in
      // its outStep.js file

      if (dependency.type === 'ciRepo' && !replicate) {
        return nextStep();
      }

      var innerBag = {
        who: bag.who,
        consoleAdapter: bag.consoleAdapter,
        jobName: bag.inPayload.name,
        jobType: bag.inPayload.type,
        jobVersionId: bag.version.id,
        jobVersion: bag.version,
        outRootDir: bag.outRootDir,
        inRootDir: bag.inRootDir,
        stateDir: bag.stateDir,
        stepMessageFilename: bag.stepMessageFilename,
        builderApiAdapter: bag.builderApiAdapter,
        dependency: dependency,
        replicate: replicate,
        replicateOnPullRequest: replicateOnPullRequest,
        skipPostingReplicateVersion: false,
        versionJson: null,
        versionEnv: null,
        versionName: null,
        hasVersion: true,
        hasEnv: true,
        isChanged: false,
        isCmdSuccess: true
      };

      bag.consoleAdapter.openCmd('Processing version for ' + dependency.name);
      async.series([
          __readVersionJson.bind(null, innerBag),
          __readReplicatedVersionJson.bind(null, innerBag),
          __readVersionEnv.bind(null, innerBag),
          __compareVersions.bind(null, innerBag),
          __createTrace.bind(null, innerBag),
          __postVersion.bind(null, innerBag),
          __triggerJob.bind(null, innerBag)
        ],
        function (err) {
          if (innerBag.isCmdSuccess) {
            bag.consoleAdapter.closeCmd(true);
          } else {
            bag.consoleAdapter.closeCmd(false);
            bag.isCleanupGrpSuccess = false;
          }
          if (innerBag.outVersion && innerBag.outVersion.id)
            bag.updatedOUTResources.push({
              resourceId: innerBag.outVersion.resourceId,
              versionId: innerBag.outVersion.id
            });

          return nextStep(err);
        }
      );
    },
    function (err) {
      if (err)
        bag.jobStatusCode = getStatusCodeByName('FAILED');
      return next();
    }
  );
}

function __readVersionJson(bag, next) {
  if (bag.dependency.isJob) return next();

  var who = bag.who + '|' + __readVersionJson.name;
  logger.verbose(who, 'Inside');

  var dependencyPath = path.join(bag.outRootDir, bag.dependency.name);

  bag.consoleAdapter.publishMsg('Reading dependency metadata from file');
  bag.consoleAdapter.publishMsg('the path is: ' + dependencyPath + '/');
  var checkFile = path.join(dependencyPath, bag.stepMessageFilename);
  fs.readJson(checkFile,
    function (err, resource) {
      if (err) {
        bag.consoleAdapter.publishMsg(util.format('Failed to read file %s.' +
          ' Hence skipping.', checkFile));
        bag.isCmdSuccess = false;
        bag.hasVersion = false;
        return next();
      }

      bag.versionJson = resource.version || {};
      bag.resourceId = resource.resourceId;
      bag.projectId = resource.projectId;
      if (_.isEmpty(bag.versionJson.propertyBag))
        bag.versionJson.propertyBag = {};

      if (_.has(bag.dependency.versionDependencyPropertyBag, 'overwrite') &&
        bag.dependency.versionDependencyPropertyBag.overwrite === true) {

        var freshPropertyBag = {};

        // params are always stored in a "params" property in the bag
        // This needs to be initialized here so merging the env works later
        if (bag.dependency.type === 'params')
          freshPropertyBag.params = {};

        // shaData is set on OUTs by ciRepo and state
        if (resource.version && resource.version.propertyBag &&
            _.has(resource.version.propertyBag, 'shaData'))
          freshPropertyBag.shaData =
            resource.version.propertyBag.shaData;

        // webhookRequestHeaders is set on OUTs by ciRepo
        if (resource.version && resource.version.propertyBag &&
          _.has(resource.version.propertyBag, 'webhookRequestHeaders'))
          freshPropertyBag.webhookRequestHeaders =
            resource.version.propertyBag.webhookRequestHeaders;

        // webhookRequestBody is set on OUTs by ciRepo
        if (resource.version && resource.version.propertyBag &&
          _.has(resource.version, 'webhookRequestBody'))
          freshPropertyBag.webhookRequestBody =
            resource.version.propertyBag.webhookRequestBody;

        bag.versionJson.propertyBag = freshPropertyBag;
      }

      bag.consoleAdapter.publishMsg(
        'Successfully read dependency metadata file');
      return next();
    }
  );
}

function __readReplicatedVersionJson(bag, next) {
  if (bag.dependency.isJob) return next();
  if (!bag.replicate) return next();

  var who = bag.who + '|' + __readReplicatedVersionJson.name;
  logger.verbose(who, 'Inside');

  var dependencyPath = path.join(bag.inRootDir, bag.replicate);

  bag.consoleAdapter.publishMsg('Reading replicated metadata from file');
  bag.consoleAdapter.publishMsg('the path is: ' + dependencyPath + '/');
  var checkFile = path.join(dependencyPath, bag.stepMessageFilename);
  fs.readJson(checkFile,
    function (err, resource) {
      if (err) {
        bag.consoleAdapter.publishMsg(util.format(
          'Failed to find resource %s. Is it an input to this job?',
          bag.replicate));
        bag.isCmdSuccess = false;
        bag.hasVersion = false;
        return next();
      }

      bag.versionJson.versionName = resource.version.versionName;

      if (bag.dependency.type === 'gitRepo' ||
        bag.dependency.type === 'syncRepo' ||
        bag.dependency.type === 'ciRepo') {
        var propertyBag = resource.version.propertyBag || {};
        bag.versionJson.propertyBag = {
          shaData: propertyBag.shaData,
          webhookRequestHeaders: propertyBag.webhookRequestHeaders,
          webhookRequestBody: propertyBag.webhookRequestBody
        };
     } else {
       bag.versionJson.propertyBag = resource.version.propertyBag || {};
     }

      if (bag.versionJson.propertyBag &&
        _.has(bag.versionJson.propertyBag, 'shaData') &&
        bag.versionJson.propertyBag.shaData.isPullRequest &&
        !bag.replicateOnPullRequest)
        bag.skipPostingReplicateVersion = true;

      bag.consoleAdapter.publishMsg(
        'Successfully read replicated metadata file');
      return next();
    }
  );
}

function __readVersionEnv(bag, next) {
  if (bag.dependency.isJob) return next();
  if (!bag.hasVersion) return next();
  if (bag.skipPostingReplicateVersion) return next();

  var who = bag.who + '|' + __readVersionEnv.name;
  logger.debug(who, 'Inside');

  bag.consoleAdapter.publishMsg('Reading resource env file');

  var envFilePath = path.join(bag.stateDir, util.format('%s.env',
    bag.dependency.name));
  try {
    var envFile = fs.readFileSync(envFilePath).toString();
    var lines = envFile.split('\n');

    _.each(lines,
      function (line) {
        var nameAndValue = line.split('=');
        var key = nameAndValue[0];
        var value = nameAndValue[1];
        if (key) {
          bag.consoleAdapter.publishMsg('found a key: ' + key);
          if (key === 'versionName')
            bag.versionJson.versionName = value;
          else {
            if (bag.dependency.type === 'params') {
              bag.versionJson.propertyBag.params[key] = value;
            } else {
              bag.versionJson.propertyBag[key] = value;
            }
          }
        }
      }
    );
  } catch (err) {
    bag.consoleAdapter.publishMsg(
      util.format('Could not parse file %s. Hence Skipping.',
        envFilePath));
    bag.consoleAdapter.publishMsg(
      util.format('unable to read file %s.env', bag.dependency.name));
    bag.consoleAdapter.closeCmd(false);
    bag.hasEnv = false;
  }
  bag.consoleAdapter.publishMsg('Successfully parsed .env file.');

  return next();
}

function __compareVersions(bag, next) {
  if (bag.dependency.isJob) return next();
  if (!bag.hasVersion) return next();
  if (bag.skipPostingReplicateVersion) return next();

  var who = bag.who + '|' + __compareVersions.name;
  logger.debug(who, 'Inside');

  bag.consoleAdapter.publishMsg('comparing current version to original');
  var originalVersion = bag.dependency.version;

  // Don't compare the trace
  if (originalVersion.propertyBag) {
    if (originalVersion.propertyBag.trace)
      delete originalVersion.propertyBag.trace;
    if (originalVersion.propertyBag.sourceObjectId)
      delete originalVersion.propertyBag.sourceObjectId;
    if (originalVersion.propertyBag.sourceObjectType)
      delete originalVersion.propertyBag.sourceObjectType;
  }

  if (bag.versionJson.propertyBag) {
    if (bag.versionJson.propertyBag.trace)
      delete bag.versionJson.propertyBag.trace;
    if (bag.versionJson.propertyBag.sourceObjectId)
      delete bag.versionJson.propertyBag.sourceObjectId;
    if (bag.versionJson.propertyBag.sourceObjectType)
      delete bag.versionJson.propertyBag.sourceObjectType;
  }

  if (originalVersion.versionName !== bag.versionJson.versionName) {
    bag.isChanged = true;
    bag.consoleAdapter.publishMsg('versionName has changed');

  } else if (!_.isEqual(originalVersion.propertyBag,
    bag.versionJson.propertyBag)) {

    bag.isChanged = true;
    bag.consoleAdapter.publishMsg('propertyBag has changed');
  }

  if (!bag.isChanged)
    bag.consoleAdapter.publishMsg('version has NOT changed');
  return next();
}

function __createTrace(bag, next) {
  if (bag.dependency.isJob) return next();
  if (!bag.isChanged) return next();
  if (bag.skipPostingReplicateVersion) return next();

  var who = bag.who + '|' + __createTrace.name;
  logger.verbose(who, 'Inside');

  bag.versionJson.propertyBag.trace = [];

  var resourceType = _.findWhere(global.systemCodes,
    {name: bag.jobType, group: 'resource'});

  var traceObject = {
    operation: 'IN',
    resourceId: bag.jobVersion.resourceId,
    resourceName: bag.jobName,
    resourceTypeCode: (resourceType && resourceType.code) || null,
    versionId: bag.jobVersionId,
    versionNumber: bag.jobVersion.versionNumber,
    versionName: bag.jobVersion.versionName,
    versionCreatedAt: bag.jobVersion.createdAt,
    usedByVersionId: 0 // Save 0 for the current version
  };

  bag.versionJson.propertyBag.trace.push(traceObject);

  if (!bag.jobVersion.propertyBag) return;

  _.each(bag.jobVersion.propertyBag.trace,
    function (dependencyTraceObject) {
      if (dependencyTraceObject.operation !== 'IN')
        return;
      if (dependencyTraceObject.usedByVersionId === 0)
        dependencyTraceObject.usedByVersionId = bag.jobVersionId;
      bag.versionJson.propertyBag.trace.push(dependencyTraceObject);
    }
  );

  return next();
}

function __postVersion(bag, next) {
  if (bag.dependency.isJob) return next();
  if (!bag.isChanged) return next();
  if (bag.skipPostingReplicateVersion) return next();

  var who = bag.who + '|' + __postVersion.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.publishMsg('Posting new version');
  var newVersion = {
    resourceId: bag.resourceId,
    propertyBag: bag.versionJson.propertyBag,
    versionName: bag.versionJson.versionName,
    projectId: bag.projectId,
    versionTrigger: false
  };

  bag.builderApiAdapter.postVersion(newVersion,
    function (err, version) {
      var msg;
      if (err) {
        msg = util.format('%s, Failed to post version for resourceId: %s',
          who, bag.versionJson.resourceId, err);
        bag.consoleAdapter.publishMsg(msg);
        bag.isCmdSuccess = false;
        return next(true);
      }

      bag.outVersion = version;
      msg = util.format('Post version for resourceId: %s succeeded with ' +
        'version %s', version.resourceId,
        util.inspect(version.versionNumber)
      );
      bag.consoleAdapter.publishMsg(msg);
      return next();
    }
  );
}

function __triggerJob(bag, next) {
  if (!bag.dependency.isJob) return next();
  if (bag.skipPostingReplicateVersion) return next();

  var who = bag.who + '|' + __triggerJob.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.publishMsg('Triggering job: ' + bag.dependency.name);
  bag.builderApiAdapter.triggerNewBuildByResourceId(
    bag.dependency.resourceId, {},
    function (err) {
      if (err) {
        bag.consoleAdapter.publishMsg(util.format(
          'failed to trigger job: %s', err));
        bag.consoleAdapter.closeCmd(false);
        return next(true);
      }
      bag.consoleAdapter.publishMsg('Successfully triggered job.');
      return next();
    }
  );
}

function _updateJobStatus(bag, next) {
  if (bag.isJobCancelled) return next();

  bag.consoleAdapter.openCmd('Updating job status');

  var who = bag.who + '|' + _updateJobStatus.name;
  logger.verbose(who, 'Inside');

  var update = {};

  //jobStatusCode is only set to failed, so if we reach this
  // function without any code we know job has succeeded
  if (!bag.jobStatusCode)
    bag.jobStatusCode =
      getStatusCodeByName('SUCCESS');

  update.statusCode = bag.jobStatusCode;
  update.proxyBuildJobPropertyBag = {
    outData: bag.updatedOUTResources
  };

  bag.builderApiAdapter.putJobById(bag.jobId, update,
    function (err) {
      if (err) {
        var msg = util.format('%s, failed to :putJobById for ' +
          'jobId: %s with err: %s', who, bag.jobId, err);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        bag.isCleanupGrpSuccess = false;
      } else {
        bag.consoleAdapter.publishMsg('Successfully updated job status');
        bag.consoleAdapter.closeCmd(true);
      }
      return next();
    }
  );
}

function _closeCleanupGroup(bag, next) {
  var who = bag.who + '|' + _closeCleanupGroup.name;
  logger.verbose(who, 'Inside');

  if (bag.isCleanupGrpSuccess) {
    bag.consoleAdapter.closeGrp(true);
  } else {
    bag.consoleAdapter.closeGrp(false);
  }
  return next();
}

function _cleanBuildDirectory(bag, next) {
  var who = bag.who + '|' + _cleanBuildDirectory.name;
  logger.verbose(who, 'Inside');

    fs.emptyDir(bag.buildRootDir,
      function (err) {
        if (err) {
          var msg = util.format('%s, Failed to clean dir at path:' +
            '%s with err: %s',
              who, bag.buildRootDir, err);
          logger.warn(msg);
        }
        logger.debug(
          'Successfully cleaned directory at path: ' + bag.buildRootDir);
        return next();
      }
    );
}

///////////////////////////////////////////////

function __createDir(bag, next) {
  var who = bag.who + '|' + __createDir.name;
  logger.debug(who, 'Inside');

  fs.mkdirs(bag.path,
    function (err) {
      var msg = util.format('%s, Failed to create %s folder with ' +
        'err: %s', who, bag.path, err);
      if (err) {
        bag.consoleAdapter.publishMsg(msg);
        return next(true);
      }

      bag.consoleAdapter.publishMsg('Successfully created folder: ' + bag.path);
      return next();
    }
  );
}

function __saveFile(bag, next) {
  if (_.isEmpty(bag)) return next();

  var who = bag.who + '|' + __saveFile.name;
  logger.debug(who, 'Inside');

  var filePath = path.join(bag.path, bag.fileName);
  var data = bag.object;
  if (_.isObject(bag.object))
    data = JSON.stringify(bag.object);

  fs.writeFile(filePath, data, [],
    function (err) {
      if (err) {
        var msg = util.format('%s, Failed to save file:%s at %s with ' +
          'err: %s', who, bag.object, filePath, err);
        bag.consoleAdapter.publishMsg(msg);
        return next(true);
      }
      bag.consoleAdapter.publishMsg(
        'Successfully saved file: ' + bag.fileName);
      if (bag.permissions)
        fs.chmodSync(filePath, bag.permissions);

      return next();
    }
  );
}

function __appendFile(bag, next) {
  if (_.isEmpty(bag)) return next();

  var who = bag.who + '|' + __appendFile.name;
  logger.debug(who, 'Inside');

  var filePath = path.join(bag.path, bag.fileName);
  var data = bag.object;
  if (_.isObject(bag.object))
    data = JSON.stringify(bag.object);

  fs.appendFile(filePath, data, [],
    function (err) {
      if (err) {
        var msg = util.format('%s, Failed to append file: %s with ' +
          'err: %s', who, filePath, err);
        bag.consoleAdapter.publishMsg(msg);
        return next(true);
      }

      bag.consoleAdapter.publishMsg('Successfully appended file: ' + filePath);
      return next();
    }
  );
}

function ___createEnvironmentVariablesFromObject(commonEnvs, name, value) {
  if (!_.isObject(value)) {
    commonEnvs.push(util.format('%s="%s"',
      name, ___escapeEnvironmentVariable(value)
    ));
    return;
  }

  _.each(_.keys(value),
    function (key) {
      ___createEnvironmentVariablesFromObject(commonEnvs,
        util.format('%s_%s', name,
          key.replace(/[^A-Za-z0-9_]/g, '').toUpperCase()),
        value[key]);
    }
  );
}

function ___escapeEnvironmentVariable(value) {
  if (!value || !_.isString(value)) return value;

  var specialCharacters = ['\\\\', '\\\"', '\\\`', '\\\$'];

  _.each(specialCharacters,
    function (char) {
      var regex = new RegExp(char, 'g');
      value = value.replace(regex, char);
    }
  );

  return value;
}

function ___replaceSingleQuotes(value) {
  if (_.isEmpty(value) || !_.isString(value))
    return value;
  return value.replace(/'/g, '\'"\'"\'');
}
