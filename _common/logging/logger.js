'use strict';
var self = logger;
module.exports = self;

var winston = require('winston');

function logger() {
  var logger = winston;
  // Once systemConfigs are obtained from the API, this will be overwritten.
  var defaultLogLevel = 'verbose';

  logger.clear();

  logger.add(winston.transports.Console, {
      timestamp: true,
      colorize: true,
      level: defaultLogLevel
    }
  );

  logger.add(winston.transports.File, {
      name: 'file#out',
      timestamp: true,
      colorize: true,
      filename: util.format('logs/%s.log', global.msName),
      maxsize: 10 * 1024 * 1024,  // 10 MB
      maxFiles: 20,
      level: defaultLogLevel,
      json: false
    }
  );

  logger.add(winston.transports.File, {
      name: 'file#err',
      timestamp: true,
      colorize: true,
      filename: util.format('logs/%s_err.log', global.msName),
      maxsize: 10 * 1024 * 1024, // 10 MB
      maxFiles: 20,
      level: 'error',
      json: false
    }
  );

  logger.add(winston.transports.File, {
      name: 'file#warn',
      timestamp: true,
      colorize: true,
      filename: util.format('logs/%s_warn.log', global.msName),
      maxsize: 5 * 1024 * 1024, // 5 MB
      maxFiles: 20,
      level: 'warn',
      json: false
    }
  );

  logger.add(winston.transports.File, {
      name: 'file#info',
      timestamp: true,
      colorize: true,
      filename: util.format('logs/%s_info.log', global.msName),
      maxsize: 5 * 1024 * 1024, // 5 MB
      maxFiles: 20,
      level: 'info',
      json: false
    }
  );

  logger.add(winston.transports.File, {
      name: 'file#debug',
      timestamp: true,
      colorize: true,
      filename: util.format('logs/%s_debug.log', global.msName),
      maxsize: 5 * 1024 * 1024, // 5 MB
      maxFiles: 20,
      level: 'debug',
      json: false
    }
  );

  return logger;
}
