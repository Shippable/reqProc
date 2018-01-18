'use strict';

var self = generateSteps;
module.exports = self;

var fs = require('fs-extra');
var path = require('path');

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
      in: {
        reqKick: []
      },
      yml: {
        reqKick: []
      },
      out: {
        reqKick: []
      }
    },
    stepsFileNames: [],
    buildRootDir: externalBag.buildRootDir,
    commonEnvs: externalBag.commonEnvs
  };
  bag.who = util.format('%s|job|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _normalizeSteps.bind(null, bag),
      _generateScript.bind(null, bag),
      _writeJobSteps.bind(null, bag),
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
    bag.buildScriptsDir, bag.buildStatusDir, 'yml');

  bag.ymlTasks = _.filter(bag.ymlSteps,
    function (step) {
      return !!step.TASK;
    }
  );

  // concat in, out & yml tasks here
  bag.tasks = bag.ymlTasks;

  bag.inDependencies = _.filter(bag.inPayload.dependencies,
    function (dependency) {
      return dependency.operation === 'IN';
    }
  );

  return next();
}

function _generateScript(bag, next) {
  var who = bag.who + '|' + _generateScript.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Generating job steps');

  async.forEachOfSeries(bag.tasks,
    function (task, index, nextTask) {
      var taskObj = _.extend(task.TASK, {
        buildScriptsDir: bag.buildScriptsDir,
        buildRootDir: bag.buildRootDir,
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

          var step = {
            taskScript: resultBag.scriptFileName,
            killScript: resultBag.killContainerScriptFileName
          };
          bag.jobSteps[task.TASK.group].reqKick.push(step);
          return nextTask();
        }
      );
    },
    function (err) {
      if (err) {
        bag.consoleAdapter.closeCmd(false);
      } else {
        bag.consoleAdapter.publishMsg('Successfully generated job steps');
        bag.consoleAdapter.closeCmd(true);
      }
      return next(err);
    }
  );
}

function _writeJobSteps(bag, next) {
  var who = bag.who + '|' + _writeJobSteps.name;
  logger.verbose(who, 'Inside');

  async.forEachOfSeries(bag.jobSteps,
    function (steps, type, nextStep) {
      if (_.isEmpty(steps.reqKick)) return nextStep();
      bag.consoleAdapter.openCmd(util.format('Writing %s steps', type));

      var stepsFileName = util.format('%s.steps.json', type);
      var stepsPath = path.join(bag.buildStatusDir, stepsFileName);
      fs.writeFile(stepsPath, JSON.stringify(steps),
        function (err) {
          if (err) {
            var msg = util.format('%s, Failed to write file: %s ' +
              'with err: %s', who, stepsPath, err);
            bag.consoleAdapter.publishMsg(msg);
            bag.consoleAdapter.closeCmd(false);
            return nextStep(err);
          }

          bag.stepsFileNames.push(stepsFileName);
          bag.consoleAdapter.publishMsg(util.format('Updated %s', stepsPath));
          bag.consoleAdapter.closeCmd(true);
          return nextStep();
        }
      );
    },
    function (err) {
      return next(err);
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

  if (global.config.shippableNodeOperatingSystem === 'WindowsServer_2016')
    jobEnvs.push('REQEXEC_SHELL=powershell.exe');

  var envPath = path.join(bag.buildStatusDir, 'job.env');
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
