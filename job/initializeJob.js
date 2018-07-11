'use strict';

var self = initializeJob;
module.exports = self;

var getStatusCodeByName = require('../_common/getStatusCodeByName.js');
var getStatusByCode = require('../_common/getStatusByCode.js');

function initializeJob(externalBag, callback) {
  var bag = {
    consoleAdapter: externalBag.consoleAdapter,
    rawMessage: _.clone(externalBag.rawMessage),
    builderApiAdapter: externalBag.builderApiAdapter,
    nodeId: global.config.nodeId,
    isDockerOptionsBuild: false,
    isOnHostBuild: false,
    isInvalidDockerImageName: false,
    isRestrictedNode: false,
    hasPrivateGitReposAsIn: false,
    privateGitRepoResourceNames: []
  };
  bag.who = util.format('%s|job|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _validateIncomingMessage.bind(null, bag),
      _getBuildJobStatus.bind(null, bag),
      _validateDependencies.bind(null, bag),
      _updateNodeIdInBuildJob.bind(null, bag),
      _getBuildJobPropertyBag.bind(null, bag),
      _applySharedNodePoolRestrictions.bind(null, bag),
      _errorBuildDueToRestrictions.bind(null, bag),
      _logTimeout.bind(null, bag)
    ],
    function (err) {
      var result;
      if (err)
        logger.error(bag.who, util.format('Failed to initialize job'));
      else
        logger.info(bag.who, util.format('Successfully initialized job'));

      result = {
        inPayload: bag.inPayload,
        buildId: bag.buildId,
        jobId: bag.jobId,
        buildJobId: bag.buildJobId,
        resourceId: bag.resourceId,
        buildNumber: bag.buildNumber,
        buildJobPropertyBag: bag.buildJobPropertyBag,
        projectId: bag.projectId,
        nodeId: bag.nodeId,
        statusCode: bag.statusCode,
        isJobCancelled: bag.isJobCancelled
      };
      return callback(err, result);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  var systemCodesByCode = _.indexBy(global.systemCodes, 'code');
  var clusterType = systemCodesByCode[global.config.clusterTypeCode];
  var clusterTypeName = clusterType.name;
  if (clusterTypeName.startsWith('restricted'))
    bag.isRestrictedNode = true;

  var expectedParams = [
    'consoleAdapter',
    'rawMessage',
    'builderApiAdapter',
    'nodeId'
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

function _validateIncomingMessage(bag, next) {
  var who = bag.who + '|' + _validateIncomingMessage.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Validating incoming message');

  var consoleErrors = [];
  if (_.isEmpty(bag.rawMessage))
    consoleErrors.push(util.format('%s is missing: rawMessage', who));

  if (bag.rawMessage) {
    if (_.isEmpty(bag.rawMessage.payload))
      consoleErrors.push(util.format('%s is missing: payload', who));

    if (bag.rawMessage.payload) {
      bag.inPayload = bag.rawMessage.payload;

      if (!bag.inPayload.type)
        consoleErrors.push(util.format('%s is missing: payload.type', who));

      if (!bag.rawMessage.buildJobId)
        consoleErrors.push(util.format('%s is missing: buildJobId', who));
      bag.buildJobId = bag.rawMessage.buildJobId;

      if (!bag.inPayload.buildId)
        consoleErrors.push(
          util.format('%s is missing: payload.buildId', who)
        );
      bag.buildId = bag.inPayload.buildId;

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
    return next(true);
  } else {
    bag.consoleAdapter.publishMsg('Successfully validated incoming message');
    bag.consoleAdapter.closeCmd(true);
  }
  return next();
}

function _getBuildJobStatus(bag, next) {
  var who = bag.who + '|' + _getBuildJobStatus.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Obtaining latest job status');
  bag.builderApiAdapter.getBuildJobById(bag.buildJobId,
    function (err, buildJob) {
      if (err) {
        var msg = util.format('%s: failed to getBuildJobById' +
          ' for buildJobId:%s, with err: %s', who, bag.buildJobId, err);
        logger.warn(msg);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);

        bag.jobStatusCode = getStatusCodeByName('error');
      } else {
        bag.consoleAdapter.publishMsg(
          util.format('Successfully obtained latest job status: %s',
          getStatusByCode(buildJob.statusCode)));
        bag.consoleAdapter.closeCmd(true);

        bag.jobStatusCode = buildJob.statusCode;
      }

      return next(err);
    }
  );
}

function _validateDependencies(bag, next) {
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
    return next(true);
  } else {
    bag.consoleAdapter.publishMsg('Successfully validated ' +
      bag.inPayload.dependencies.length + ' dependencies');
    bag.consoleAdapter.closeCmd(true);
  }

  return next();
}

function _updateNodeIdInBuildJob(bag, next) {
  var who = bag.who + '|' + _updateNodeIdInBuildJob.name;
  logger.verbose(who, 'Inside');
  bag.consoleAdapter.openCmd('Updating job with nodeId');

  var update = {
    nodeId: bag.nodeId
  };
  bag.builderApiAdapter.putBuildJobById(bag.buildJobId, update,
    function (err, buildJob) {
      if (err) {
        var msg =
          util.format('%s: failed to :putBuildJobById for buildJobId: %s, %s',
            who, bag.buildJobId, err);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        return next(err);
      } else {
        bag.buildJob = buildJob;
        bag.consoleAdapter.publishMsg(
          'Successfully job with nodeId: ' + bag.nodeId);
        bag.consoleAdapter.closeCmd(true);
      }
      return next();
    }
  );
}

function _getBuildJobPropertyBag(bag, next) {
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

function _applySharedNodePoolRestrictions(bag, next) {
  if (!bag.isRestrictedNode) return next();
  if (_.isEmpty(bag.buildJobPropertyBag.yml)) return next();

  var who = bag.who + '|' + _applySharedNodePoolRestrictions.name;
  logger.verbose(who, 'Inside');

  var privateGitRepos = _.filter(bag.inPayload.dependencies,
    function (dependency) {
      if (dependency.operation !== 'IN') return;
      if (dependency.type !== 'gitRepo') return;
      return dependency.propertyBag && dependency.propertyBag.normalizedRepo &&
        dependency.propertyBag.normalizedRepo.isPrivateRepository;
    }
  );

  if (!_.isEmpty(privateGitRepos)) {
    bag.hasPrivateGitReposAsIn = true;
    bag.privateGitRepoResourceNames = _.pluck(privateGitRepos, 'name');
  }

  bag.isOnHostBuild = bag.buildJobPropertyBag.yml.runtime &&
    (bag.buildJobPropertyBag.yml.runtime.container === false);

  _.each(bag.buildJobPropertyBag.yml.steps,
    function (step) {
      if (step.TASK) {
        var task = step.TASK;
        if (!bag.isOnHostBuild)
          bag.isOnHostBuild = task.runtime &&
            (task.runtime.container === false);

        if (!bag.isDockerOptionsBuild) {
          bag.isDockerOptionsBuild = !!(task.runtime && task.runtime.options &&
            task.runtime.options.options);
        }

        if (!bag.isInvalidDockerImageName) {
          var imageName = task.runtime && task.runtime.options &&
            task.runtime.options.imageName;

          if (imageName) {
            var splitImageName = imageName.split(' ');
            if (splitImageName.length > 1)
              bag.isInvalidDockerImageName = true;
          }
        }
      }
    }
  );
  return next();
}

function _errorBuildDueToRestrictions(bag, next) {
  if (!bag.isRestrictedNode) return next();

  var who = bag.who + '|' + _errorBuildDueToRestrictions.name;
  logger.verbose(who, 'Inside');

  bag.errorBuild = bag.isOnHostBuild || bag.isDockerOptionsBuild ||
    bag.isInvalidDockerImageName || bag.hasPrivateGitReposAsIn;

  if (bag.errorBuild) {
    bag.consoleAdapter.openCmd('Restricted shared node pool limitations');
    if (bag.hasPrivateGitReposAsIn)
      bag.consoleAdapter.publishMsg('Private gitRepo resources cannot be ' +
        'added as IN to builds running on restricted shared node pools: ' +
        bag.privateGitRepoResourceNames.join(', ')
      );

    if (bag.isOnHostBuild)
      bag.consoleAdapter.publishMsg('Host builds are not allowed on ' +
        'restricted shared node pools.');

    if (bag.isDockerOptionsBuild)
      bag.consoleAdapter.publishMsg('Docker options are not allowed on ' +
        'restricted shared node pools.');

    if (bag.isInvalidDockerImageName)
      bag.consoleAdapter.publishMsg('Invalid Docker image name present in ' +
        'task section.');

    bag.consoleAdapter.closeCmd(false);
    return next(true);
  }
  return next();
}

function _logTimeout(bag, next) {
  var who = bag.who + '|' + _logTimeout.name;
  logger.verbose(who, 'Inside');

  if (bag.buildJob && bag.buildJob.timeoutMS && bag.buildJob.propertyBag &&
    bag.buildJob.propertyBag.payload &&
    bag.buildJob.propertyBag.payload.type === 'runSh') {
    bag.consoleAdapter.openCmd('Setting timeout');
    bag.consoleAdapter.publishMsg(util.format('timeout set to %s minutes',
      bag.buildJob.timeoutMS / (60 * 1000))
    );
    bag.consoleAdapter.closeCmd(true);
  }

  return next();
}
