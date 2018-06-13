'use strict';
var self = checkHealth;
module.exports = self;

var checkAMQP = require('./healthChecks/checkAMQP.js');
var checkShippableApi = require('./healthChecks/checkShippableApi.js');
var validateNode = require('./healthChecks/validateNode.js');
var updateNodeStatus = require('./healthChecks/updateNodeStatus.js');
var postNodeStats = require('./healthChecks/postNodeStats.js');

function checkHealth(callback) {
  var bag = {};
  bag.who = util.format('%s|_common|%s', msName, self.name);
  logger.verbose('Checking health of', bag.who);

  var params = {
    amqpExchange: config.amqpExchange,
    amqpUrl: config.amqpUrl
  };

  async.series([
      checkAMQP.bind(null, params),
      checkShippableApi.bind(null, params),
      updateNodeStatus.bind(null, params),
      postNodeStats.bind(null, params),
      validateNode.bind(null, params)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, 'Failed health checks', err);
      else
        logger.verbose(bag.who, 'Successful health checks');
      return callback(err);
    }
  );
}
