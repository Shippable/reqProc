'use strict';

var self = MicroService;
module.exports = self;

var amqp = require('amqp');
var ShippableAdapter = require('../shippable/Adapter.js');

function MicroService(params) {
  logger.info('Starting', msName);
  this.AMQPConnection = {};
  this.queue = {};
  this.ackWaitTimeMS = 2 * 1000;  // 2 seconds
  this.timeoutLength = 1;
  this.timeoutLimit = 180;
  this.checkHealth = params.checkHealth;
  this.microWorker = params.microWorker;
  this.publicAdapter = new ShippableAdapter('');
  this.nodeId = config.nodeId;
  this.nodeTypeCode = config.nodeTypeCode;
  this.isSystemNode = config.isSystemNode;
  if (config.apiToken)
    this.suAdapter = new ShippableAdapter(config.apiToken);
}

MicroService.prototype.init = function () {
  logger.verbose('Initializing', msName);
  async.series([
      this.checkHealth.bind(this),
      this.getSystemSettings.bind(this),
      this.getSystemCodes.bind(this),
      this.establishQConnection.bind(this),
      this.connectExchange.bind(this),
      this.connectToQueue.bind(this)
    ],
    function (err) {
      if (err)
        return this.error(err);

    }.bind(this)
  );
};

MicroService.prototype.getSystemSettings = function (next) {
  logger.verbose(util.format('%s| getting systemSettings', msName));
  var bag = {
    suAdapter: this.suAdapter
  };

  async.series([
      this._getSystemSettings.bind(null, bag),
      this._setRunMode.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(
          util.format('failed to getSystemSettings with error %s', err)
        );
      return next();
    }
  );
};

MicroService.prototype._getSystemSettings = function (bag, nextStep) {
  if (!bag.suAdapter) return nextStep();

  bag.suAdapter.getSystemSettings(
    function (err, systemSettings) {
      if (err) {
        logger.warn('Failed to getSystemSettings');
        return nextStep(true);
      }
      if (_.isEmpty(systemSettings)) {
        logger.error('Empty systemSettings returned from DB');
        return nextStep(true);
      }

      global.systemSettings = _.first(systemSettings);
      return nextStep();
    }
  );
};

MicroService.prototype._setRunMode = function (bag, nextStep) {
  logger.verbose(util.format('%s| setting runMode', msName));

  var systemRunMode = 'production';
  if (global.systemSettings)
    systemRunMode = global.systemSettings.runMode;
  config.runMode = process.env.RUN_MODE || systemRunMode;

  if (config.runMode === 'dev')
    config.logLevel = 'debug';
  else if (config.runMode === 'beta')
    config.logLevel = 'verbose';
  else if (config.runMode === 'production')
    config.logLevel = 'warn';

  logger.level = config.logLevel;
  return nextStep();
};

MicroService.prototype.getSystemCodes = function (next) {
  logger.verbose(util.format('%s| getting systemCodes', msName));

  var query = '';
  this.publicAdapter.getSystemCodes(query,
    function (err, systemCodes) {
      if (err) {
        logger.warn('Failed to getSystemCodes with error: ' + err.message);
        return next(true);
      }

      if (_.isEmpty(systemCodes)) {
        logger.warn('No systemCodes found');
        return next(true);
      }

      global.systemCodes = systemCodes;
      return next();
    }
  );
};

MicroService.prototype.establishQConnection = function (next) {
  logger.verbose(util.format('Connecting %s to Q %s', msName, config.amqpUrl));
  this.AMQPConnection = amqp.createConnection({
      url: config.amqpUrl,
      heartbeat: 60
    }, {
      defaultExchangeName: config.amqpExchange,
      reconnect: false
    }
  );

  this.AMQPConnection.on('ready',
    function () {
      logger.verbose(
        util.format('Connected %s to Q %s', msName, config.amqpUrl)
      );
      return next();
    }.bind(this)
  );

  this.AMQPConnection.on('error',
    function (connection, err) {
      if (connection && !connection.closing) {
        logger.error(
          util.format('Failed to connect %s to Q %s', msName, config.amqpUrl)
        );
        return this.error(err);
      }
    }.bind(this, this.AMQPConnection)
  );

  this.AMQPConnection.on('close',
    function (connection) {
      logger.verbose(
        util.format('Closed connection from %s to Q %s', msName,
          config.amqpUrl)
      );

      // If this is not a close connection event initiated by us, we should try
      // to reconnect.
      if (!connection.closing) {
        this.timeoutLength = 1;
        this.timeoutLimit = 180;
        return this.init();
      }
    }.bind(this, this.AMQPConnection)
  );
};

MicroService.prototype.error = function (err) {
  logger.error(err);
  logger.verbose(
    util.format('Since an error occurred, re-connecting %s to Q %s',
      msName, config.amqpUrl)
  );
  async.series([
      this.disconnectQConnection.bind(this)
    ],
    function () {
      this.retry();
    }.bind(this)
  );
};

MicroService.prototype.disconnectQConnection = function (next) {
  try {
    this.AMQPConnection.closing = true;
    this.AMQPConnection.disconnect();
  } catch (ex) {
    logger.warn(
      util.format('Failed to close connection from %s to Q %s', msName,
        config.amqpUrl)
    );
  }
  this.AMQPConnection = {};
  return next();
};

MicroService.prototype.retry = function () {
  this.timeoutLength *= 2;
  if (this.timeoutLength > this.timeoutLimit)
    this.timeoutLength = 1;

  logger.verbose(
    util.format('Waiting for %s seconds before re-connecting %s to Q %s',
      this.timeoutLength, msName, config.amqpUrl)
  );
  setTimeout(this.init.bind(this), this.timeoutLength * 1000);
};

MicroService.prototype.connectExchange = function (next) {
  logger.verbose(
    util.format('Connecting %s to Exchange %s', msName, config.amqpExchange)
  );
  this.AMQPConnection.exchange(
    config.amqpExchange, {
      passive: true,
      confirm: true
    },
    function (exchange) {
      logger.verbose(
        util.format('Connected %s to Exchange %s', msName, exchange.name)
      );
      return next();
    }.bind(this)
  );
};

MicroService.prototype.connectToQueue = function (next) {
  logger.verbose(
    util.format('Connecting %s to Queue %s', msName, config.inputQueue)
  );
  var queueParams = {
    passive: true
  };

  this.AMQPConnection.queue(config.inputQueue, queueParams,
    function (queue) {
      queue.bind(config.amqpExchange, queue.name);
      logger.verbose(
        util.format('%s is listening to Queue %s', msName, queue.name)
      );
      var queueParams = {
        ack: true,
        prefetchCount: 1
      };
      this.queue = queue;

      queue.subscribe(queueParams, this.disconnectAndProcess.bind(this))
        .addCallback(
          function (ok) {
            this.consumerTag = ok.consumerTag;
          }.bind(this)
        );

      return next();
    }.bind(this)
  );
};

MicroService.prototype.disconnectAndProcess =
  function (message, headers, deliveryInfo, ack) {
    logger.verbose(
      util.format('Disconnecting from queue: %s and processing',
      config.inputQueue)
    );

    if (!this.consumerTag) {
      logger.warn('consumerTag not available yet, rejecting and listening.');
      ack.reject(true);
      return;
    }

    var bag = {
      who: util.format(msName + '|micro|%s', self.name),
      ack: ack,
      ackMessage: true,
      ackWaitTimeMS: this.ackWaitTimeMS,
      queue: this.queue,
      nodeId: this.nodeId,
      consumerTag: this.consumerTag,
      isSystemNode: this.isSystemNode,
      publicAdapter: this.publicAdapter,
      suAdapter: this.suAdapter
    };

    async.series([
        _validateClusterNode.bind(null, bag),
        _validateSystemNode.bind(null, bag),
        _unsubscribeFromQueue.bind(null, bag),
        _ackMessage.bind(null, bag),
        _rejectMessage.bind(null, bag)
      ],
      function () {
        if (bag.ackMessage) {
          this.AMQPConnection.closing = true;
          this.AMQPConnection.disconnect();
          this.microWorker(message);
        }
      }.bind(this)
    );
  };

function _validateClusterNode(bag, next) {
  if (!bag.nodeId || bag.isSystemNode) return next();

  var who = bag.who + '|' + _validateClusterNode.name;
  logger.debug(who, 'Inside');

  bag.publicAdapter.validateClusterNodeById(bag.nodeId,
    function (err, clusterNode) {
      if (err) {
        logger.warn(
          util.format(who, 'failed to :validateClusterNodeById for id: %s',
            bag.nodeId)
        );
        bag.ackMessage = false;
        return next();
      }

      if (clusterNode.action !== 'continue')
        bag.ackMessage = false;

      return next();
    }
  );
}

function _validateSystemNode(bag, next) {
  if (!bag.nodeId || !bag.isSystemNode) return next();

  var who = bag.who + '|' + _validateSystemNode.name;
  logger.debug(who, 'Inside');

  bag.publicAdapter.validateSystemNodeById(bag.nodeId,
    function (err, systemNode) {
      if (err) {
        logger.warn(
          util.format(who, 'failed to :validateSystemNodeById for id: %s',
            bag.nodeId)
        );
        bag.ackMessage = false;
        return next();
      }

      if (systemNode.action !== 'continue')
        bag.ackMessage = false;

      return next();
    }
  );
}

function _unsubscribeFromQueue(bag, next) {
  if (!bag.ackMessage) return next();

  var who = bag.who + '|' + _unsubscribeFromQueue.name;
  logger.debug(who, 'Inside');

  bag.queue.unsubscribe(bag.consumerTag)
    .addCallback(
      function () {
        return next();
      }
    );
}

function _ackMessage(bag, next) {
  if (!bag.ackMessage) return next();

  var who = bag.who + '|' + _ackMessage.name;
  logger.debug(who, 'Inside');

  bag.ack.acknowledge();
  setTimeout(
    function () {
      return next();
    },
    bag.ackWaitTimeMS
  );
}

function _rejectMessage(bag, next) {
  if (bag.ackMessage) return next();

  var who = bag.who + '|' + _rejectMessage.name;
  logger.debug(who, 'Inside');

  bag.ack.reject(true);
  setTimeout(
    function () {
      return next();
    },
    bag.ackWaitTimeMS
  );
}
