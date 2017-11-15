'use strict';

var self = setupDependencies;
module.exports = self;

var fs = require('fs-extra');

function setupDependencies(externalBag, callback) {
  var bag = {
    inPayload: _.clone(externalBag.inPayload),
    buildJobStatus: externalBag.buildJobStatus,
    consoleAdapter: externalBag.consoleAdapter,
    builderApiAdapter: externalBag.builderApiAdapter,
    buildJobId: externalBag.buildJobId,
    jobStatusCode: externalBag.jobStatusCode,
    operation: externalBag.operation,
    messageFilePath: externalBag.messageFilePath,
    buildRootDir: externalBag.buildRootDir,
    buildStateDir: externalBag.buildStateDir,
    buildPreviousStateDir: externalBag.buildPreviousStateDir,
    resourceId: externalBag.resourceId,
    buildId: externalBag.buildId,
    buildNumber: externalBag.buildNumber,
    secrets: externalBag.secrets,
    stepMessageFilename: externalBag.stepMessageFilename,
    buildSharedDir: externalBag.buildSharedDir
  };

  bag.who = util.format('%s|job|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _setUpDependencies.bind(null, bag),
      _saveTaskMessage.bind(null, bag)
    ],
    function (err) {
      var result;
      if (err)
        logger.error(bag.who, util.format('Failed to setup dependencies'));
      else {
        logger.info(bag.who, 'Successfully setup dependencies');
        result = {
          commonEnvs: bag.commonEnvs,
          paramEnvs: bag.paramEnvs,
          inPayload: bag.inPayload
        };
      }

      return callback(err, result);
    }
  );

}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  return next();
}

function _setUpDependencies(bag, next) {
  if (bag.isJobCancelled) return next();
  if (bag.jobStatusCode) return next();

  var who = bag.who + '|' + _setUpDependencies.name;
  logger.verbose(who, 'Inside');

  if (!bag.inPayload.propertyBag.yml) {
    bag.consoleAdapter.openGrp('Step Error');
    bag.consoleAdapter.openCmd('Errors');
    bag.consoleAdapter.publishMsg('No YML found for job steps');
    bag.consoleAdapter.closeCmd(false);
    bag.consoleAdapter.closeGrp(false);

    return next('No yml found for job steps');
  }

  var jobName = bag.inPayload.name.replace(/[^A-Za-z0-9_]/g, '').toUpperCase();

  bag.commonEnvs = [
    util.format('RESOURCE_ID=%s', bag.resourceId),
    util.format('BUILD_ID=%s', bag.buildId),
    util.format('BUILD_NUMBER=%s', bag.buildNumber),
    util.format('BUILD_JOB_ID=%s', bag.buildJobId),
    util.format('BUILD_JOB_NUMBER=%s', 1),
    util.format('SUBSCRIPTION_ID=%s', bag.inPayload.subscriptionId),
    util.format('JOB_NAME=%s', bag.inPayload.name),
    util.format('JOB_TYPE=%s', bag.inPayload.type),
    util.format('JOB_PATH="%s"', bag.buildRootDir),
    util.format('JOB_STATE="%s"', bag.buildStateDir),
    util.format('JOB_PREVIOUS_STATE="%s"', bag.buildPreviousStateDir),
    util.format('JOB_MESSAGE="%s"', bag.messageFilePath),
    util.format('%s_NAME=%s', jobName, bag.inPayload.name),
    util.format('%s_TYPE=%s', jobName, bag.inPayload.type),
    util.format('%s_PATH="%s"', jobName, bag.buildRootDir),
    util.format('%s_STATE="%s"', jobName, bag.buildStateDir),
    util.format('%s_PREVIOUS_STATE="%s"', jobName, bag.buildPreviousStateDir),
    util.format('%s_MESSAGE="%s"', jobName, bag.messageFilePath),
    util.format('JOB_TRIGGERED_BY_NAME=%s',
      bag.inPayload.triggeredByName),
    util.format('JOB_TRIGGERED_BY_ID=%s',
      bag.inPayload.triggeredById),
    util.format('SHARED_DIR=%s', bag.buildSharedDir),
    util.format('BUILD_DIR=%s', bag.buildRootDir)
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

  // We don't know where the group will end so need a flag
  var isGrpSuccess = true;

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
        bag.consoleAdapter.openGrp('Step Error');
        bag.consoleAdapter.openCmd('Errors');

        var msg = util.format('%s, Missing dependency for: %s %s',
          who, operation, name);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);

        return nextStep(true);
      }

      dependency.step = step;

      async.series([
          __createDataFile.bind(null, bag, dependency),
          __addDependencyEnvironmentVariables.bind(null, bag, dependency),
          __getDependencyIntegrations.bind(null, bag, dependency),
          __createStateDirectory.bind(null, bag, dependency),
          __getStateInformation.bind(null, bag, dependency),
          __createStateFiles.bind(null, bag, dependency),
          __setStateFilePermissions.bind(null, bag, dependency)
        ],
        function (err) {
          if (err) {
            bag.consoleAdapter.closeCmd(false);
            isGrpSuccess = false;
          } else {
            bag.consoleAdapter.closeCmd(true);
          }

          return nextStep(err);
        }
      );
    },
    function (err) {
      if (!isGrpSuccess)
        bag.isInitializingJobGrpSuccess = false;

      if (err)
        return next(err);

      // adding bag.paramEnvs to the beginning of bag.commonEnvs because
      // Shippable envs should always override user envs
      bag.commonEnvs = bag.paramEnvs.concat(bag.commonEnvs);
      return next();
    }
  );
}

function __createDataFile(bag, dependency, next) {
  if (dependency.operation === bag.operation.NOTIFY)
    return next();

  var who = bag.who + '|' + __createDataFile.name;
  logger.verbose(who, 'Inside');

  var path = bag.buildRootDir + '/' +
    dependency.operation + '/' + dependency.name;

  var innerBag = {
    who: who,
    path: path,
    fileName: bag.stepMessageFilename,
    object: dependency,
    consoleAdapter: bag.consoleAdapter
  };

  async.series([
      __createDir.bind(null, innerBag),
      __saveFile.bind(null, innerBag)
    ],
    function (err) {
      if (err)
        return next(true);
      return next();
    }
  );
}

function __addDependencyEnvironmentVariables(bag, dependency, next) {
  /* jshint maxstatements:60 */
  var who = bag.who + '|' + __addDependencyEnvironmentVariables.name;
  logger.verbose(who, 'Inside');

  var sanitizedDependencyName =
    dependency.name.replace(/[^A-Za-z0-9_]/g, '').toUpperCase();

  var dependencyPath = bag.buildRootDir + '/' +
    dependency.operation + '/' + dependency.name;

  bag.commonEnvs.push(
    util.format('%s_PATH="%s"', sanitizedDependencyName, dependencyPath)
  );

  bag.commonEnvs.push(
    util.format('%s_STATE="%s/%s"',
      sanitizedDependencyName, dependencyPath, dependency.type)
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
    if (dependency.type === 'params') {
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

  if (dependency.propertyBag.yml) {
    var pointer = dependency.propertyBag.yml.pointer;

    if (pointer) {
      if (pointer.sourceName)
        bag.commonEnvs.push(util.format('%s_SOURCENAME="%s"',
          sanitizedDependencyName,
          ___escapeEnvironmentVariable(pointer.sourceName)
        ));

      ___createEnvironmentVariablesFromObject(bag.commonEnvs,
        util.format('%s_POINTER', sanitizedDependencyName), pointer);
    }

    var seed = dependency.propertyBag.yml.seed;

    if (seed)
      ___createEnvironmentVariablesFromObject(bag.commonEnvs,
        util.format('%s_SEED', sanitizedDependencyName), seed);
  }

  bag.consoleAdapter.publishMsg('Successfully added environment variables ' +
    'for ' + dependency.name);

  return next();
}

function __getDependencyIntegrations(bag, dependency, next) {
  if (!dependency.subscriptionIntegrationId) return next();

  var who = bag.who + '|' + __getDependencyIntegrations.name;
  logger.verbose(who, 'Inside');

  var dependencyPath = bag.buildRootDir + '/' +
    dependency.operation + '/' + dependency.name;

  bag.builderApiAdapter.getSubscriptionIntegrationById(
    dependency.subscriptionIntegrationId,
    function (err, subInt) {
      if (err) {
        var msg = util.format('%s, Failed getSubscriptionIntegrationById for ' +
          'id: %s, with err: %s', who,
          dependency.subscriptionIntegrationId, err);

        bag.consoleAdapter.publishMsg(msg);
        return next(err);
      }
      bag.consoleAdapter.publishMsg('Successfully fetched integration');
      var accountIntegration = _.findWhere(bag.secrets.data.accountIntegrations,
       { id: subInt.accountIntegrationId });

      dependency.accountIntegration = {
        masterName: accountIntegration.masterName
      };

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
      var sanitizedDependencyName =
        dependency.name.replace(/[^A-Za-z0-9_]/g, '').toUpperCase();
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
        innerBagKey.fileName = dependency.name + '_key.pem';
        innerBagKey.object = accountIntegration.key;
        innerBagKey.hasKey = true;
      } else if (accountIntegration.masterName === 'ssh-key' ||
        accountIntegration.masterName === 'sshKey') {
        // private key
        innerBagKey.fileName = dependency.name + '_key';
        innerBagKey.object = accountIntegration.privateKey;
        innerBagKey.hasKey = true;
        bag.commonEnvs.push(util.format('%s_PRIVATE_KEY_PATH="%s"',
          sanitizedDependencyName, dependencyPath + '/' + innerBagKey.fileName
        ));

        // public key
        innerBagSshPublicKey.fileName = dependency.name + '_key.pub';
        innerBagSshPublicKey.object = accountIntegration.publicKey;
        innerBagSshPublicKey.hasKey = true;
        bag.commonEnvs.push(util.format('%s_PUBLIC_KEY_PATH="%s"',
          sanitizedDependencyName, dependencyPath + '/' +
          innerBagSshPublicKey.fileName
        ));
      }

      if (innerBagKey.hasKey)
        bag.commonEnvs.push(util.format('%s_KEYPATH="%s"',
          sanitizedDependencyName, dependencyPath + '/' + innerBagKey.fileName
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
            return next(true);
          }

          return next();
        }
      );
    }
  );
}

function __createStateDirectory(bag, dependency, next) {
  if (dependency.type === 'params') return next();
  var who = bag.who + '|' + __createStateDirectory.name;
  logger.verbose(who, 'Inside');

  var dependencyStatePath = bag.buildRootDir + '/' +
    dependency.operation + '/' + dependency.name + '/' + dependency.type;

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
          dependency.name);
        return next(true);
      }

      return next();
    }
  );
}

function __getStateInformation(bag, dependency, next) {
  if (!dependency.isJob) return next();

  if (dependency.operation === 'OUT' && (!dependency.version ||
    !dependency.version.propertyBag || !dependency.version.propertyBag.sha))
    return next();

  var who = bag.who + '|' + __getStateInformation.name;
  logger.verbose(who, 'Inside');

  // any job should have this value
  if (!dependency.version.propertyBag.sha) {
    bag.consoleAdapter.publishMsg(util.format(
      '%s is missing propertyBag.sha', dependency.name));
    return next(true);
  }
  var sha = dependency.version.propertyBag.sha;

  var query = 'sha=' + sha;
  bag.builderApiAdapter.getFilesByResourceId(dependency.resourceId, query,
    function (err, data) {
      var msg;
      if (err) {
        msg = util.format('%s :getFilesByResourceId failed for ' +
          'resourceId: %s with error %s', who, dependency.resourceId, err);
        bag.consoleAdapter.publishMsg(msg);
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

function __createStateFiles(bag, dependency, next) {
  if (!dependency.isJob) return next();
  if (_.isEmpty(bag.outputFileJSON)) return next();

  var who = bag.who + '|' + __createStateFiles.name;
  logger.verbose(who, 'Inside');

  var dependencyStatePath = bag.buildRootDir + '/' +
    dependency.operation + '/' + dependency.name + '/' + dependency.type;

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

function __setStateFilePermissions(bag, dependency, next) {
  if (!dependency.isJob) return next();

  var who = bag.who + '|' + __setStateFilePermissions.name;
  logger.verbose(who, 'Inside');

  var dependencyStatePath = bag.buildRootDir + '/' +
    dependency.operation + '/' + dependency.name + '/' + dependency.type;
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

  var path = bag.path + '/' + bag.fileName;
  var data = bag.object;
  if (_.isObject(bag.object))
    data = JSON.stringify(bag.object);

  fs.writeFile(path, data, [],
    function (err) {
      if (err) {
        var msg = util.format('%s, Failed to save file:%s at %s with ' +
          'err: %s', who, bag.object, path, err);
        bag.consoleAdapter.publishMsg(msg);
        return next(true);
      }
      bag.consoleAdapter.publishMsg(
        'Successfully saved file: ' + bag.fileName);
      if (bag.permissions)
        fs.chmodSync(path, bag.permissions);

      return next();
    }
  );
}

function __appendFile(bag, next) {
  if (_.isEmpty(bag)) return next();

  var who = bag.who + '|' + __appendFile.name;
  logger.debug(who, 'Inside');

  var path = bag.path + '/' + bag.fileName;
  var data = bag.object;
  if (_.isObject(bag.object))
    data = JSON.stringify(bag.object);

  fs.appendFile(path, data, [],
    function (err) {
      if (err) {
        var msg = util.format('%s, Failed to append file: %s with ' +
          'err: %s', who, path, err);
        bag.consoleAdapter.publishMsg(msg);
        return next(true);
      }

      bag.consoleAdapter.publishMsg('Successfully appended file: ' + path);
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
    dependencies: [],
    propertyBag: bag.inPayload.propertyBag
  };

  taskMessage.dependencies = _.map(bag.inPayload.dependencies,
    function (dep) {
      var depPath = bag.buildRootDir + '/' + dep.operation + '/' + dep.name;
      var taskMessageDependency = {
        operation: dep.operation,
        name: dep.name,
        resourceId: dep.resourceId,
        type: dep.type,
        path: depPath,
        propertyBag: dep.propertyBag,
        sourceName: dep.sourceName
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
      } else {
        bag.consoleAdapter.publishMsg(
          'Successfully saved message at: ' + bag.messageFilePath);
        bag.consoleAdapter.closeCmd(true);
      }
      return next(err);
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
