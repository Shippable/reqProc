'use strict';

var self = generateSteps;
module.exports = self;

var fs = require('fs-extra');
var generateScript = require('./scriptsGen/generateScript.js');
var normalizeSteps = require('./scriptsGen/normalizeSteps.js');

function generateSteps(externalBag, callback) {
  var bag = {
    inPayload: _.clone(externalBag.inPayload),
    buildStatusDir: externalBag.buildStatusDir,
    buildScriptsDir: externalBag.buildScriptsDir,
    builderApiToken: externalBag.builderApiToken,
    buildJobId: externalBag.buildJobId,
    consoleAdapter: externalBag.consoleAdapter,
    jobSteps: {
      reqKick: []
    },
    stepsFileNames: [],
    buildRootDir: externalBag.buildRootDir,
    reqExecDir: externalBag.reqExecDir,
    commonEnvs: externalBag.commonEnvs
  };
  bag.who = util.format('%s|job|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _normalizeSteps.bind(null, bag),
      _generateSteps.bind(null, bag),
      _setJobEnvs.bind(null, bag)
    ],
    function (err) {
      var result;
      if (err) {
        logger.error(bag.who, util.format('Failed to generate steps'));
      } else {
        result = {
          stepsFileNames: bag.stepsFileNames
        };
        logger.info(bag.who, util.format('Successfully generated steps'));
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
    'buildStatusDir',
    'buildScriptsDir',
    'builderApiToken',
    'buildJobId',
    'consoleAdapter',
    'jobSteps',
    'buildRootDir',
    'reqExecDir',
    'commonEnvs'
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

function _normalizeSteps(bag, next) {
  var who = bag.who + '|' + _normalizeSteps.name;
  logger.verbose(who, 'Inside');

  bag.ymlSteps = normalizeSteps(bag.inPayload.propertyBag.yml, bag.buildJobId,
    bag.buildScriptsDir, bag.buildStatusDir);

  bag.ymlTasks = _.filter(bag.ymlSteps,
    function (step) {
      return !!step.TASK;
    }
  );

  bag.inDependencies = _.filter(bag.inPayload.dependencies,
    function (dependency) {
      return dependency.operation === 'IN';
    }
  );

  return next();
}

function _generateSteps(bag, next) {
  var who = bag.who + '|' + _generateSteps.name;
  logger.verbose(who, 'Inside');

  var tasks = {
    yml: bag.ymlTasks
  };
  var stepsFileNames = [];

  async.forEachOf(tasks,
    function (value, key, nextTask) {
      var innerBag = {
        type: key,
        tasks: value
      };
      _.extend(innerBag, bag);
      bag.jobSteps.reqKick = [];
      async.series([
          __generateScript.bind(null, innerBag),
          __writeJobSteps.bind(null, innerBag)
        ],
        function (err) {
          if (!err)
            stepsFileNames.push(innerBag.stepsFileName);
          return nextTask(err);
        }
      );
    },
    function (err) {
      if (!err)
        bag.stepsFileNames = stepsFileNames;
      return next(err);
    }
  );
}

function __generateScript(bag, nextStep) {
  var who = bag.who + '|' + __generateScript.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd(util.format('Generating %s steps', bag.type));

  async.forEachOfSeries(bag.tasks,
    function (task, index, nextTask) {
      var taskObj = _.extend(task.TASK, {
        buildScriptsDir: bag.buildScriptsDir,
        buildRootDir: bag.buildRootDir,
        reqExecDir: bag.reqExecDir,
        buildStatusDir: bag.buildStatusDir,
        buildJobId: bag.buildJobId,
        commonEnvs: bag.commonEnvs,
        inDependencies: bag.inDependencies
      });
      generateScript(taskObj,
        function (err, resultBag) {
          if (err) {
            var msg = util.format('%s, Failed to generate script for task '+
              ': %s with err: %s', who, index, err);
            bag.consoleAdapter.publishMsg(msg);
            logger.error(msg);
            return nextTask(err);
          }
          bag.jobSteps.reqKick.push(resultBag.scriptFileName);
          return nextTask();
        }
      );
    },
    function (err) {
      if (err) {
        bag.consoleAdapter.closeCmd(false);
      } else {
        bag.consoleAdapter.publishMsg(util.format('Successfully generated %s '+
          'steps', bag.type));
        bag.consoleAdapter.closeCmd(true);
      }
      return nextStep(err);
    }
  );
}

function __writeJobSteps(bag, nextStep) {
  var who = bag.who + '|' + __writeJobSteps.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd(util.format('Writing %s steps', bag.type));

  var stepsFileName = util.format('%s.steps.json', bag.type);
  var stepsPath = util.format('%s/%s', bag.buildStatusDir, stepsFileName);
  fs.writeFile(stepsPath, JSON.stringify(bag.jobSteps),
    function (err) {
      if (err) {
        var msg = util.format('%s, Failed to write file: %s ' +
          'with err: %s', who, stepsPath, err);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        return nextStep(err);
      }

      bag.stepsFileName = stepsFileName;
      bag.consoleAdapter.publishMsg(util.format('Updated %s', stepsPath));
      bag.consoleAdapter.closeCmd(true);
      return nextStep();
    }
  );
}

function _setJobEnvs(bag, next) {
  var who = bag.who + '|' + _setJobEnvs.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Setting job envs');

  // TODO: use templates to set these values
  var jobEnvs = [];
  jobEnvs.push(util.format('SHIPPABLE_API_URL=%s', global.config.apiUrl));
  jobEnvs.push(util.format('BUILDER_API_TOKEN=%s', bag.builderApiToken));
  jobEnvs.push(util.format('BUILD_JOB_ID=%s', bag.buildJobId));
  jobEnvs.push(util.format('RUN_MODE=%s', global.config.runMode));
  jobEnvs.push(util.format('BUILD_DIR=%s', bag.buildRootDir));

  var envPath = util.format('%s/job.env', bag.buildStatusDir);
  fs.writeFile(envPath, jobEnvs.join('\n'),
    function (err) {
      if (err) {
        var msg = util.format('%s, Failed to write file: %s ' +
          'with err: %s', who, envPath, err);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        return next(err);
      }

      bag.consoleAdapter.publishMsg(
        util.format('Updated %s', envPath)
      );
      bag.consoleAdapter.closeCmd(true);
      return next();
    }
  );
}
