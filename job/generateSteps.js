'use strict';

var self = generateSteps;
module.exports = self;

var fs = require('fs-extra');

var Adapter = require('../_common/shippable/Adapter.js');
var getStatusCodeByName = require('../_common/getStatusCodeByName.js');

var BuildJobConsoleAdapter = require('./_common/buildJobConsoleAdapter.js');

function generateSteps(externalBag, callback) {
  var bag = {
    reqProcDir: externalBag.reqProcDir,
    reqKickDir: externalBag.reqKickDir,
    reqExecDir: externalBag.reqExecDir,
    buildDir: externalBag.buildDir,
    reqKickScriptsDir: externalBag.reqKickScriptsDir,
    buildInDir: externalBag.buildInDir,
    buildOutDir: externalBag.buildOutDir,
    buildStateDir: externalBag.buildStatusDir,
    buildStatusDir: externalBag.buildStatusDir,
    buildSharedDir: externalBag.buildStatusDir,
    isCI: externalBag.isCI
  };
  bag.who = util.format('%s|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _initializeConsoleAdapter.bind(null, bag),
      _generateSteps.bind(null, bag),
      _writeJobSteps.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, util.format('Failed to process message'));
      else
        logger.info(bag.who, util.format('Successfully processed message'));

      return callback();
    }
  );

}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  if (_.isEmpty(bag.rawMessage)) {
    logger.warn(util.format('%s, Message is empty.', who));
    return next(true);
  }

  if (_.isEmpty(bag.rawMessage.builderApiToken)) {
    logger.warn(util.format('%s, No builderApiToken present' +
      ' in incoming message', who));
    return next(true);
  }

  if (_.isEmpty(bag.rawMessage.buildJobId)) {
    logger.warn(util.format('%s, No buildJobId present' +
      ' in incoming message', who));
    return next(true);
  }

  bag.builderApiAdapter = new Adapter(bag.rawMessage.builderApiToken);
  return next();
}

function _initializeConsoleAdapter(bag, next) {
  var who = bag.who + '|' + _initializeConsoleAdapter.name;
  logger.verbose(who, 'Inside');

  var batchSize = bag.consoleBatchSize ||
    (global.systemSettings && global.systemSettings.jobConsoleBatchSize);
  var timeInterval = bag.consoleBufferTimeIntervalInMS ||
    (global.systemSettings &&
    global.systemSettings.jobConsoleBufferTimeIntervalInMS);

  bag.consoleAdapter = new BuildJobConsoleAdapter(
    bag.builderApiToken, bag.buildJobId,
    batchSize, timeInterval);

  return next();
}

function _generateSteps(bag, next) {
  if (bag.jobStatusCode) return next();

  var who = bag.who + '|' + _generateSteps.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Generating job steps');

  // TODO: job steps are being read from example file temporarily
  // This section will be replaced by actual generation of job steps in future

  var exampleSteps = util.format('%s/_common/example/steps.json', __dirname);
  fs.readFile(exampleSteps, 'utf8',
    function (err, steps) {
      if (err) {
        var msg = util.format('%s, Failed to read file: %s ' +
          'with err: %s', who, exampleSteps, err);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        bag.consoleAdapter.closeGrp(false);
        bag.jobStatusCode = getStatusCodeByName('error', bag.isCI);
        return next();
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
  if (bag.jobStatusCode) return next();

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
        bag.consoleAdapter.closeGrp(false);
        bag.jobStatusCode = getStatusCodeByName('error', bag.isCI);
        return next();
      }

      bag.consoleAdapter.publishMsg(
        util.format('Updated %s', stepsPath)
      );
      bag.consoleAdapter.closeCmd(true);
      return next();
    }
  );
}
