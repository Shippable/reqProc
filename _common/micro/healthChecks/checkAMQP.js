'use strict';
var self = amqpMonitor;
module.exports = self;

var amqp = require('amqp');

function amqpMonitor(params, callback) {
  var bag = {
    params: params,
    rabbitMQ: {}
  };

  bag.who = util.format('%s|micro|_healthCheck|%s', msName, self.name);
  logger.verbose('Checking health of', bag.who);

  async.series([
      _checkInputParams.bind(null, bag),
      _testAMQPConn.bind(null, bag),
      _disconnectAMQP.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, 'Failed health checks');
      else
        logger.verbose(bag.who, 'Successful health checks');
      return callback(err);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.debug(who, 'Inside');

  var consoleErrors = [];
  if (!bag.params)
    consoleErrors.push(util.format('%s is missing: params', who));

  if (!bag.params.amqpExchange)
    consoleErrors.push(
      util.format('%s is missing: params.amqpExchange', who)
    );

  if (!bag.params.amqpUrl)
    consoleErrors.push(util.format('%s is missing: params.amqpUrl', who));

  if (consoleErrors.length > 0) {
    _.each(consoleErrors,
      function (e) {
        logger.error(e);
      }
    );
    return next(true);
  }
  return next();
}

function _testAMQPConn(bag, next) {
  var who = bag.who + '|' + _testAMQPConn.name;
  logger.debug(who, 'Inside');

  bag.rabbitMQ.connection = amqp.createConnection({
    url: bag.params.amqpUrl,
    heartbeat: 60
  }, {
    defaultExchangeName: bag.params.amqpExchange,
    reconnect: false
  });

  bag.rabbitMQ.connection.on('ready',
    function () {
      logger.verbose(
        util.format('Connected from %s to Q %s', msName, bag.params.amqpUrl)
      );
      return next();
    }
  );

  bag.rabbitMQ.connection.on('error',
    function (err) {
      if (bag.rabbitMQ.connection) {
        logger.error(
          util.format('Failed to connect %s to Q %s with error:', msName,
            bag.params.amqpUrl, err)
        );
        return next(err);
      }
    }
  );
}

function _disconnectAMQP(bag, next) {
  var who = bag.who + '|' + _disconnectAMQP.name;
  logger.debug(who, 'Inside');
  var hadException = false;
  try {
    bag.rabbitMQ.connection.closing = true;
    bag.rabbitMQ.connection.disconnect();
  } catch (ex) {
    hadException = true;
    logger.warn(
      util.format('Failed to close connection from %s to Q %s', msName,
        bag.params.amqpUrl)
    );
  }
  if (hadException)
    return next();

  bag.rabbitMQ.connection = null;
  logger.verbose(
    util.format('Closed connection from %s to Q %s', msName,
      bag.params.amqpUrl)
  );
  return next();
}
