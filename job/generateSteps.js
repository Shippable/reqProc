'use strict';

var self = generateSteps;
module.exports = self;

var fs = require('fs-extra');

function generateSteps(externalBag, callback) {
  var bag = {
    buildStatusDir: externalBag.buildStatusDir,
    buildScriptsDir: externalBag.buildScriptsDir,
    builderApiToken: externalBag.builderApiToken,
    buildJobId: externalBag.buildJobId,
    consoleAdapter: externalBag.consoleAdapter
  };
  bag.who = util.format('%s|job|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _generateSteps.bind(null, bag),
      _writeJobSteps.bind(null, bag),
      _setJobEnvs.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, util.format('Failed to generate steps'));
      else
        logger.info(bag.who, util.format('Successfully generated steps'));

      return callback(err);
    }
  );

}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  if (_.isEmpty(bag.builderApiToken)) {
    logger.warn(util.format('%s, No builderApiToken present' +
      ' in incoming message', who));
    return next(true);
  }

  if (_.isEmpty(bag.buildJobId)) {
    logger.warn(util.format('%s, No buildJobId present' +
      ' in incoming message', who));
    return next(true);
  }

  if (_.isEmpty(bag.buildStatusDir)) {
    logger.warn(util.format('%s, Build status dir is empty.', who));
    return next(true);
  }

  return next();
}

function _generateSteps(bag, next) {
  var who = bag.who + '|' + _generateSteps.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Generating job steps');

  // TODO: job steps are being read from example file temporarily
  // This section will be replaced by actual generation of job steps in future

  var exampleSteps = util.format('%s/../_common/example/steps.json', __dirname);
  var exampleScriptsDir =
    util.format('%s/../_common/example/scripts', __dirname);
  fs.copySync(exampleScriptsDir, bag.buildScriptsDir);
  fs.readFile(exampleSteps, 'utf8',
    function (err, steps) {
      if (err) {
        var msg = util.format('%s, Failed to read file: %s ' +
          'with err: %s', who, exampleSteps, err);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        return next(err);
      }

      bag.jobSteps = steps;
      bag.consoleAdapter.publishMsg(
        util.format('Successfully read %s', exampleSteps)
      );
      bag.consoleAdapter.closeCmd(true);
      return next();
    }
  );
}

function _writeJobSteps(bag, next) {
  var who = bag.who + '|' + _writeJobSteps.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Writing job steps');

  var stepsPath = util.format('%s/job.steps.json', bag.buildStatusDir);
  fs.writeFile(stepsPath, bag.jobSteps,
    function (err) {
      if (err) {
        var msg = util.format('%s, Failed to write file: %s ' +
          'with err: %s', who, stepsPath, err);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        return next(err);
      }

      bag.consoleAdapter.publishMsg(
        util.format('Updated %s', stepsPath)
      );
      bag.consoleAdapter.closeCmd(true);
      return next();
    }
  );
}

function _setJobEnvs(bag, next) {
  var who = bag.who + '|' + _setJobEnvs.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Setting job envs');

  //TODO: use templates to set these values
  var jobEnvs = util.format('SHIPPABLE_API_URL=%s\nBUILDER_API_TOKEN=%s' +
    '\nBUILD_JOB_ID=%s', global.config.apiUrl, bag.builderApiToken,
    bag.buildJobId);

  var envPath = util.format('%s/job.env', bag.buildStatusDir);
  fs.writeFile(envPath, jobEnvs,
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
