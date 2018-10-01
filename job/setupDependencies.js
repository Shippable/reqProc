'use strict';

var self = setupDependencies;
module.exports = self;

var fs = require('fs-extra');
var path = require('path');

var executeScript = require('./handlers/executeScript.js');
var generateReplaceScript = require('./scriptsGen/generateReplaceScript.js');
var parseSecureVariable = require('../_common/parseSecureVariable.js');

function setupDependencies(externalBag, callback) {
  var bag = {
    inPayload: _.clone(externalBag.inPayload),
    wwwUrl: externalBag.wwwUrl,
    consoleAdapter: externalBag.consoleAdapter,
    builderApiAdapter: externalBag.builderApiAdapter,
    buildJobId: externalBag.buildJobId,
    operation: externalBag.operation,
    messageFilePath: externalBag.messageFilePath,
    buildRootDir: externalBag.buildRootDir,
    buildStateDir: externalBag.buildStateDir,
    buildPreviousStateDir: externalBag.buildPreviousStateDir,
    buildIntegrationsDir: externalBag.buildIntegrationsDir,
    resourceId: externalBag.resourceId,
    buildId: externalBag.buildId,
    buildNumber: externalBag.buildNumber,
    secrets: externalBag.secrets,
    stepMessageFilename: externalBag.stepMessageFilename,
    buildSharedDir: externalBag.buildSharedDir,
    subPrivateKeyPath: externalBag.subPrivateKeyPath,
    buildScriptsDir: externalBag.buildScriptsDir,
    buildSecretsDir: externalBag.buildSecretsDir
  };

  bag.who = util.format('%s|job|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _setUpDependencies.bind(null, bag),
      _setUpIntegrations.bind(null, bag),
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

  var expectedParams = [
    'inPayload',
    'consoleAdapter',
    'builderApiAdapter',
    'buildJobId',
    'operation',
    'messageFilePath',
    'buildRootDir',
    'buildStateDir',
    'buildPreviousStateDir',
    'buildIntegrationsDir',
    'resourceId',
    'buildId',
    'buildNumber',
    'secrets',
    'stepMessageFilename',
    'buildSharedDir'
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

function _setUpDependencies(bag, next) {
  var who = bag.who + '|' + _setUpDependencies.name;
  logger.verbose(who, 'Inside');

  if (!bag.inPayload.propertyBag.yml) {
    bag.consoleAdapter.openCmd('Step Errors');
    bag.consoleAdapter.publishMsg('No YML found for job steps');
    bag.consoleAdapter.closeCmd(false);

    return next('No yml found for job steps');
  }

  var jobName = bag.inPayload.name.replace(/[^A-Za-z0-9_]/g, '').
    replace(/^[0-9]+/g, '').toUpperCase();

  bag.commonEnvs = [
    {
      key: 'RESOURCE_ID',
      value: bag.resourceId
    },
    {
      key: 'BUILD_ID',
      value: bag.buildId
    },
    {
      key: 'BUILD_NUMBER',
      value: bag.buildNumber
    },
    {
      key: 'BUILD_JOB_ID',
      value: bag.buildJobId
    },
    {
      key: 'BUILD_JOB_NUMBER',
      value: 1
    },
    {
      key: 'SUBSCRIPTION_ID',
      value: bag.inPayload.subscriptionId
    },
    {
      key: 'JOB_NAME',
      value: bag.inPayload.name
    },
    {
      key: 'JOB_TYPE',
      value: bag.inPayload.type
    },
    {
      key: 'JOB_PATH',
      value: bag.buildRootDir
    },
    {
      key: 'JOB_STATE',
      value: bag.buildStateDir
    },
    {
      key: 'JOB_PREVIOUS_STATE',
      value: bag.buildPreviousStateDir
    },
    {
      key: 'JOB_INTEGRATIONS',
      value: bag.buildIntegrationsDir
    },
    {
      key: 'JOB_MESSAGE',
      value: bag.messageFilePath
    },
    {
      key: util.format('%s_NAME', jobName),
      value: bag.inPayload.name
    },
    {
      key: util.format('%s_TYPE', jobName),
      value: bag.inPayload.type
    },
    {
      key: util.format('%s_PATH', jobName),
      value: bag.buildRootDir
    },
    {
      key: util.format('%s_STATE', jobName),
      value: bag.buildStateDir
    },
    {
      key: util.format('%s_PREVIOUS_STATE', jobName),
      value: bag.buildPreviousStateDir
    },
    {
      key: util.format('%s_INTEGRATIONS', jobName),
      value: bag.buildIntegrationsDir
    },
    {
      key: util.format('%s_MESSAGE', jobName),
      value: bag.messageFilePath
    },
    {
      key: 'JOB_TRIGGERED_BY_NAME',
      value: bag.inPayload.triggeredByName
    },
    {
      key: 'JOB_TRIGGERED_BY_ID',
      value: bag.inPayload.triggeredById
    },
    {
      key: 'JOB_TRIGGERED_BY_USER',
      value: (bag.inPayload.triggeredByUser &&
        bag.inPayload.triggeredByUser.login) || ''
    },
    {
      key: 'SHARED_DIR',
      value: bag.buildSharedDir
    },
    {
      key: 'BUILD_DIR',
      value: bag.buildRootDir
    },
    {
      key: 'BUILD_SECRETS_DIR',
      value: bag.buildSecretsDir
    },
    {
      key: 'SUBSCRIPTION_PRIVATE_KEY',
      value: bag.subPrivateKeyPath
    },
    {
      key: 'SHIPPABLE_INTEGRATION_ENVS_PATH',
      value: path.join(bag.buildScriptsDir, 'integration_envs.env')
    },
    {
      key: 'SHIPPABLE_AMI_VERSION',
      value: global.config.shippableAMIVersion
    },
    {
      key: 'SHIPPABLE_WWW_URL',
      value: bag.wwwUrl
    },
    {
      key: 'BUILD_URL',
      value: util.format('%s/subscriptions/%s/pipelines/builds/%s/consoles',
        bag.wwwUrl, bag.inPayload.subscriptionId, bag.buildId)
    }
  ];

  bag.paramEnvs = [];

  if (bag.inPayload.injectedGlobalEnv) {
    _.each(bag.inPayload.injectedGlobalEnv,
      function (value, key) {
        bag.commonEnvs.push(
          {
            key: key,
            value: value
          }
        );
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
        bag.consoleAdapter.publishMsg('Errors');

        var msg = util.format('%s, Missing dependency for: %s %s',
          who, operation, name);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);

        return nextStep(true);
      }

      dependency.step = step;

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
          if (!err)
            bag.consoleAdapter.closeCmd(true);

          return nextStep(err);
        }
      );
    },
    function (err) {
      if (err){
        return next(err);
      }

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

  var templateObject = {
    versionPath: path.join(dependencyPath, bag.stepMessageFilename),
    scriptFileName:  util.format('replace_placeholders.%s',
      global.config.scriptExtension),
    directory: dependencyPath,
    commonEnvs: bag.paramEnvs.concat(bag.commonEnvs)
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
    },
    ignoreCmd: true
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

  var dependencyPath = path.join(bag.buildRootDir, dependency.operation,
    dependency.name);

  bag.commonEnvs.push({
    key: util.format('%s_PATH', sanitizedDependencyName),
    value: dependencyPath
  });

  bag.commonEnvs.push({
    key: util.format('%s_STATE', sanitizedDependencyName),
    value: path.join(dependencyPath, dependency.type)
  });

  bag.commonEnvs.push({
    key: util.format('%s_META', sanitizedDependencyName),
    value: dependencyPath
  });

  bag.commonEnvs.push({
    key: util.format('%s_NAME', sanitizedDependencyName),
    value: dependency.name
  });

  bag.commonEnvs.push({
    key: util.format('%s_TYPE', sanitizedDependencyName),
    value: dependency.type
  });

  bag.commonEnvs.push({
    key: util.format('%s_OPERATION', sanitizedDependencyName),
    value: dependency.operation
  });

  bag.commonEnvs.push({
    key: util.format('%s_ID', sanitizedDependencyName),
    value: dependency.resourceId
  });

  if (dependency.version) {
    if (dependency.type === 'params' && dependency.operation === 'IN') {
      _.each(dependency.version.propertyBag.params,
        function (value, key) {
          if (_.isObject(value)) {
            value = JSON.stringify(value);
            // Escape spaces and everything else
            value = value.replace(/ /g, '\\ ');
            value = ___escapeEnvironmentVariable(value);

            bag.commonEnvs.push({
              key: util.format('%s_PARAMS_%s',
                sanitizedDependencyName,
                key.replace(/[^A-Za-z0-9_]/g, '').toUpperCase()),
              value: value
            });

            bag.paramEnvs.push({
              key: key.replace(/[^A-Za-z0-9_]/g, ''),
              value: value
            });
          } else if (key === 'secure') {
            var parsedVariable = parseSecureVariable(value);
            _.each(parsedVariable,
              function (secureValue, secureKey) {
                secureValue = ___escapeEnvironmentVariable(secureValue);

                bag.commonEnvs.push({
                  key: util.format('%s_PARAMS_%s',
                    sanitizedDependencyName,
                    secureKey.replace(/[^A-Za-z0-9_]/g, '').toUpperCase()),
                  value: secureValue
                });
                bag.paramEnvs.push({
                  key: secureKey.replace(/[^A-Za-z0-9_]/g, ''),
                  value: secureValue
                });
              }
            );
          } else {
            value = ___escapeEnvironmentVariable(value);
            bag.commonEnvs.push({
              key: util.format('%s_PARAMS_%s',
                sanitizedDependencyName,
                key.replace(/[^A-Za-z0-9_]/g, '').toUpperCase()),
              value: value
            });
            bag.paramEnvs.push({
              key: key.replace(/[^A-Za-z0-9_]/g, ''),
              value: value
            });
          }
        }
      );
    } else if (dependency.type === 'gitRepo') {
      if (dependency.version.propertyBag &&
        dependency.version.propertyBag.shaData) {
        var shaData = dependency.version.propertyBag.shaData;

        bag.commonEnvs.push({
          key: util.format('%s_BRANCH', sanitizedDependencyName),
          value: ___escapeEnvironmentVariable(shaData.branchName)
        });
        bag.commonEnvs.push({
          key: util.format('%s_BASE_BRANCH', sanitizedDependencyName),
          value: ___escapeEnvironmentVariable(shaData.baseCommitRef)
        });
        bag.commonEnvs.push({
          key: util.format('%s_HEAD_BRANCH', sanitizedDependencyName),
          value: ___escapeEnvironmentVariable(shaData.headCommitRef || '')
        });
        bag.commonEnvs.push({
          key: util.format('%s_PULL_REQUEST', sanitizedDependencyName),
          value: shaData.pullRequestNumber || false
        });
        bag.commonEnvs.push({
          key: util.format('%s_COMMIT', sanitizedDependencyName),
          value: shaData.commitSha
        });
        bag.commonEnvs.push({
          key: util.format('%s_COMMITTER', sanitizedDependencyName),
          value: ___escapeEnvironmentVariable(shaData.committer &&
            shaData.committer.displayName)
        });
        bag.commonEnvs.push({
          key: util.format('%s_COMMIT_MESSAGE', sanitizedDependencyName),
          value: ___escapeEnvironmentVariable(shaData.commitMessage)
        });
        bag.commonEnvs.push({
          key: util.format('%s_IS_GIT_TAG', sanitizedDependencyName),
          value: shaData.isGitTag
        });
        bag.commonEnvs.push({
          key: util.format('%s_GIT_TAG_NAME', sanitizedDependencyName),
          value: ___escapeEnvironmentVariable(shaData.gitTagName)
        });
        bag.commonEnvs.push({
          key: util.format('%s_IS_RELEASE', sanitizedDependencyName),
          value: shaData.isRelease
        });
        bag.commonEnvs.push({
          key: util.format('%s_RELEASE_NAME', sanitizedDependencyName),
          value: ___escapeEnvironmentVariable(shaData.releaseName)
        });
        bag.commonEnvs.push({
          key: util.format('%s_RELEASED_AT', sanitizedDependencyName),
          value: ___escapeEnvironmentVariable(shaData.releasedAt)
        });
        bag.commonEnvs.push({
          key: util.format('%s_KEYPATH', sanitizedDependencyName),
          value: path.join(bag.buildSecretsDir, dependency.name + '_key.pem')
        });
        bag.commonEnvs.push({
          key: util.format('%s_IS_PULL_REQUEST', sanitizedDependencyName),
          value: ___escapeEnvironmentVariable(shaData.isPullRequest)
        });
        bag.commonEnvs.push({
          key: util.format('%s_IS_PULL_REQUEST_CLOSE', sanitizedDependencyName),
          value: ___escapeEnvironmentVariable(shaData.isPullRequestClose)
        });
        var pullRequestRepoFullName = shaData.pullRequestRepoFullName || '';
        bag.commonEnvs.push({
          key: util.format('%s_PULL_REQUEST_REPO_FULL_NAME',
            sanitizedDependencyName),
          value: ___escapeEnvironmentVariable(pullRequestRepoFullName)
        });
      }
      if (dependency.propertyBag.normalizedRepo) {
        var normalizedRepo = dependency.propertyBag.normalizedRepo;
        bag.commonEnvs.push({
          key: util.format('%s_SSH_URL', sanitizedDependencyName),
          value: ___escapeEnvironmentVariable(normalizedRepo.repositorySshUrl)
        });
        bag.commonEnvs.push({
          key: util.format('%s_HTTPS_URL', sanitizedDependencyName),
          value: ___escapeEnvironmentVariable(normalizedRepo.repositoryHttpsUrl)
        });
        bag.commonEnvs.push({
          key: util.format('%s_IS_FORK', sanitizedDependencyName),
          value: ___escapeEnvironmentVariable(normalizedRepo.isFork)
        });
        bag.commonEnvs.push({
          key: util.format('%s_REPO_FULL_NAME', sanitizedDependencyName),
          value: ___escapeEnvironmentVariable(normalizedRepo.fullName)
        });
      }
    }

    var versionName = dependency.version.versionName || '';
    versionName = ___escapeEnvironmentVariable(versionName);
    bag.commonEnvs.push({
      key: util.format('%s_VERSIONNAME', sanitizedDependencyName),
      value: versionName
    });
    bag.commonEnvs.push({
      key: util.format('%s_VERSIONNUMBER', sanitizedDependencyName),
      value: dependency.version.versionNumber
    });
    bag.commonEnvs.push({
      key: util.format('%s_VERSIONID', sanitizedDependencyName),
      value: dependency.version.versionId
    });
  }

  if (dependency.version && dependency.version.propertyBag) {
    if (dependency.version.propertyBag.sourceName)
      bag.commonEnvs.push({
        key: util.format('%s_SOURCENAME', sanitizedDependencyName),
        value: ___escapeEnvironmentVariable(
          dependency.version.propertyBag.sourceName)
      });
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
      var integration = {};
      if (subInt.isIntegration)
        integration = _.findWhere(bag.secrets.data.subscriptionIntegrations,
          { id: subInt.id });
      else
        integration = _.findWhere(bag.secrets.data.accountIntegrations,
          { id: subInt.accountIntegrationId });

      seriesParams.dependency.accountIntegration = {
        masterName: integration.masterName
      };

      var stringData = {};
      var arrayData = {};
      var objectData = {};
      _.each(integration,
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
          bag.commonEnvs.push({
            key: util.format('%s_INTEGRATION_%s',
              sanitizedDependencyName,
              key.replace(/[^A-Za-z0-9_]/g, '').toUpperCase()),
            value: value
          });
        }
      );
      _.each(objectData,
        function (value, key) {
          value  = ___replaceSingleQuotes(value);
          bag.commonEnvs.push({
            key: key,
            value: value,
            surroundWithSingleQuotes: true
          });
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

      if (integration.masterName === 'pem-key' ||
        integration.masterName === 'pemKey') {
        innerBagKey.fileName = seriesParams.dependency.name + '_key.pem';
        innerBagKey.object = integration.key;
        innerBagKey.hasKey = true;
      } else if (integration.masterName === 'ssh-key' ||
        integration.masterName === 'sshKey') {
        // private key
        innerBagKey.fileName = seriesParams.dependency.name + '_key';
        innerBagKey.object = integration.privateKey;
        innerBagKey.hasKey = true;
        bag.commonEnvs.push({
          key: util.format('%s_PRIVATE_KEY_PATH', sanitizedDependencyName),
          value: path.join(dependencyPath, innerBagKey.fileName)
        });

        // public key
        innerBagSshPublicKey.fileName =
          seriesParams.dependency.name + '_key.pub';
        innerBagSshPublicKey.object = integration.publicKey;
        innerBagSshPublicKey.hasKey = true;
        bag.commonEnvs.push({
          key: util.format('%s_PUBLIC_KEY_PATH',
          sanitizedDependencyName),
          value: path.join(dependencyPath, innerBagSshPublicKey.fileName)
        });
      }

      if (innerBagKey.hasKey)
        bag.commonEnvs.push({
          key: util.format('%s_KEYPATH', sanitizedDependencyName),
          value: path.join(dependencyPath, innerBagKey.fileName)
        });
      else
        innerBagKey = {};

      if (!innerBagSshPublicKey.hasKey)
        innerBagSshPublicKey = {};

      var innerBagGitCredential = {};
      if (integration.masterName === 'gitCredential') {
        // Git credentials need to be saved in a specific location.
        innerBagGitCredential = {
          who: who,
          consoleAdapter: bag.consoleAdapter,
          path: process.env.HOME,
          fileName: '.git-credentials'
        };

        // Save credentials with and without port in case the port is implicit.
        var keyWithoutPort = util.format('https://%s:%s@%s',
          integration.username, integration.password,
          integration.host);
        var keyWithPort = util.format('%s:%s', keyWithoutPort,
          integration.port);
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
    seriesParams.dependency.operation,
    seriesParams.dependency.name, seriesParams.dependency.type);

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

  // any job with state should have this value
  if (!seriesParams.dependency.version.propertyBag.sha) {
    bag.consoleAdapter.publishMsg(util.format(
      '%s is missing propertyBag.sha', seriesParams.dependency.name));
    bag.consoleAdapter.closeCmd(false);
    return next();
  }
  var sha = seriesParams.dependency.version.propertyBag.sha;

  var query = 'sha=' + sha;
  bag.builderApiAdapter.getFilesByResourceId(seriesParams.dependency.resourceId,
    query,
    function (err, data) {
      var msg;
      if (err) {
        if (data.id === ActErr.NoSystemIntegration) {
          msg = util.format('No system state is enabled. ' +
            'State cannot be saved.');
          bag.consoleAdapter.publishMsg(msg);
          bag.consoleAdapter.closeCmd(false);
          return next();
        }
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
      var data = file.contents;
      var buffer = new Buffer(data, 'base64');
      if (buffer.toString('base64') === data)
        data = buffer;
      fs.outputFile(path, data,
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
      var outputFilePath = path.join(dependencyStatePath, file.path);
      fs.chmod(outputFilePath, file.permissions,
        function (err) {
          if (err) {
            var msg = util.format('%s, Failed to set permissions for ' +
              'file:%s with err:%s', who, outputFilePath, err);
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

function _setUpIntegrations(bag, next) {
  var who = bag.who + '|' + _setUpIntegrations.name;
  logger.verbose(who, 'Inside');

  if (!(bag.inPayload.propertyBag && bag.inPayload.propertyBag.yml &&
    bag.inPayload.propertyBag.yml.type === 'runSh' &&
    _.isArray(bag.inPayload.propertyBag.yml.integrations)))
    return next();

  async.eachSeries(bag.inPayload.propertyBag.yml.integrations,
    function (integration, nextIntegrations) {
      logger.verbose('Setting up Integration: ', integration);

      bag.consoleAdapter.openCmd('Setting up integration: ' + integration);

      var seriesParams = {
        integration: integration
      };

      async.series([
          __getDirectIntegrations.bind(null, bag, seriesParams)
        ],
        function (err) {
          if (!err)
            bag.consoleAdapter.closeCmd(true);

          return nextIntegrations(err);
        }
      );
    },
    function (err) {
      return next(err);
    }
  );
}

function __getDirectIntegrations(bag, seriesParams, next) {
  if (!seriesParams.integration) return next();

  var who = bag.who + '|' + __getDirectIntegrations.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.publishMsg('Getting integration');

  var dependencyPath = path.join(bag.buildIntegrationsDir,
    seriesParams.integration);

  var query = util.format('subscriptionIds=%s&names=%s',
    bag.inPayload.subscriptionId, seriesParams.integration);
  bag.builderApiAdapter.getSubscriptionIntegrations(query,
    function (err, subInts) {
      if (err || _.isEmpty(subInts)) {
        var msg = util.format('%s, Failed getSubscriptionIntegrations for ' +
          'query: %s, with err: %s', who, query, err);

        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);

        return next(err);
      }

      bag.consoleAdapter.publishMsg('Successfully fetched integration');

      var subInt = _.first(subInts);
      var integration = {};
      if (subInt.isIntegration)
        integration = _.findWhere(bag.secrets.data.subscriptionIntegrations,
          { id: subInt.id });
      else
        integration = _.findWhere(bag.secrets.data.accountIntegrations,
          { id: subInt.accountIntegrationId });

      var stringData = {};
      var arrayData = {};
      var objectData = {};
      _.each(integration,
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
      var sanitizedIntegrationName = seriesParams.integration.
        replace(/[^A-Za-z0-9_]/g, '').replace(/^[0-9]+/g, '').toUpperCase();
      var stringAndArrayData = _.extend(_.clone(stringData), arrayData);

      // environment variables should have objects flattened
      // arrays should be same as integration.env
      // and, special characters should be escaped in all the values
      stringAndArrayData = _.omit(stringAndArrayData, ['id', 'masterName']);
      _.each(stringAndArrayData,
        function (value, key) {
          value = ___escapeEnvironmentVariable(value);
          bag.commonEnvs.push({
            key: util.format('%s_INTEGRATION_%s',
              sanitizedIntegrationName,
              key.replace(/[^A-Za-z0-9_]/g, '').toUpperCase()),
            value: value
          });
        }
      );
      _.each(objectData,
        function (value, key) {
          value  = ___replaceSingleQuotes(value);
          bag.commonEnvs.push({
            key: key,
            value: value,
            surroundWithSingleQuotes: true
          });
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

      if (integration.masterName === 'pem-key' ||
        integration.masterName === 'pemKey') {
        innerBagKey.fileName = seriesParams.integration + '_key.pem';
        innerBagKey.object = integration.key;
        innerBagKey.hasKey = true;
      } else if (integration.masterName === 'ssh-key' ||
        integration.masterName === 'sshKey') {
        // private key
        innerBagKey.fileName = seriesParams.integration + '_key';
        innerBagKey.object = integration.privateKey;
        innerBagKey.hasKey = true;
        bag.commonEnvs.push({
          key: util.format('%s_PRIVATE_KEY_PATH', sanitizedIntegrationName),
          value: path.join(dependencyPath, innerBagKey.fileName)
        });

        // public key
        innerBagSshPublicKey.fileName =
          seriesParams.integration + '_key.pub';
        innerBagSshPublicKey.object = integration.publicKey;
        innerBagSshPublicKey.hasKey = true;
        bag.commonEnvs.push({
          key: util.format('%s_PUBLIC_KEY_PATH',
          sanitizedIntegrationName),
          value: path.join(dependencyPath, innerBagSshPublicKey.fileName)
        });
      }

      if (innerBagKey.hasKey)
        bag.commonEnvs.push({
          key: util.format('%s_KEYPATH', sanitizedIntegrationName),
          value: path.join(dependencyPath, innerBagKey.fileName)
        });
      else
        innerBagKey = {};

      if (!innerBagSshPublicKey.hasKey)
        innerBagSshPublicKey = {};

      var innerBagGitCredential = {};
      if (integration.masterName === 'gitCredential') {
        // Git credentials need to be saved in a specific location.
        innerBagGitCredential = {
          who: who,
          consoleAdapter: bag.consoleAdapter,
          path: process.env.HOME,
          fileName: '.git-credentials'
        };

        // Save credentials with and without port in case the port is implicit.
        var keyWithoutPort = util.format('https://%s:%s@%s',
          integration.username, integration.password,
          integration.host);
        var keyWithPort = util.format('%s:%s', keyWithoutPort,
          integration.port);
        innerBagGitCredential.object = util.format('%s\n%s\n',
          keyWithoutPort, keyWithPort);
      }

      async.series([
          __createDir.bind(null, innerBag),
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

function _saveTaskMessage(bag, next) {
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
    commonEnvs.push({
      key: name,
      value: ___escapeEnvironmentVariable(value)
    });
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
  // TODO: move escaping logic to respective execTemplates
  if (global.config.shippableNodeOperatingSystem === 'WindowsServer_2016')
    return value;
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
  // TODO: move escaping logic to respective execTemplates
  if (global.config.shippableNodeOperatingSystem === 'WindowsServer_2016')
    return value;
  if (_.isEmpty(value) || !_.isString(value))
    return value;
  return value.replace(/'/g, '\'"\'"\'');
}
