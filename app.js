'use strict';
var checkHealth = require('./_common/micro/checkHealth.js');
var GenExecMS = require('./_common/micro/MicroService.js');
var setupMS = require('./_common/micro/setupMS.js');
var microWorker = require('./microWorker.js');

var msParams = {
  checkHealth: checkHealth,
  microWorker: microWorker
};

var params = {
  msName: 'genExec'
};

var consoleErrors = [];
setupMS(params);

var who = util.format('msName:%s', msName);
logger.info(util.format('Checking system config for %s', who));

if (!global.config.amqpUrl)
  consoleErrors.push(util.format('%s is missing: amqpUrl', who));

if (!global.config.amqpExchange)
  consoleErrors.push(util.format('%s is missing: amqpExchange', who));

if (!global.config.inputQueue)
  consoleErrors.push(util.format('%s is missing: inputQueue', who));

if (!global.config.apiUrl)
  consoleErrors.push(util.format('%s is missing: apiUrl', who));

if (consoleErrors.length > 0) {
  _.each(consoleErrors,
    function (err) {
      logger.error(who, err);
    }
  );
  return process.exit(1);
}

logger.info(util.format('system config checks for %s succeeded', who));
var service = new GenExecMS(msParams);
// This is where micro service starts
service.init();
