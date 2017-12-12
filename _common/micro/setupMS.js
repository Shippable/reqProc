'use strict';
var self = setupMS;
module.exports = self;

global.util = require('util');
global._ = require('underscore');
global.async = require('async');
var path = require('path');

function setupMS(params) {
  global.msName = params.msName;
  process.title = params.msName;
  global.config = {};

  global.logger = require('../logging/logger.js')();
  require('../handleErrors/ActErr.js');

  /* Env Set */
  global.config.amqpExchange = 'shippableEx';
  global.config.apiUrl = process.env.SHIPPABLE_API_URL;
  global.config.inputQueue = process.env.LISTEN_QUEUE;
  global.config.amqpUrl = process.env.SHIPPABLE_AMQP_URL;
  global.config.nodeId = process.env.NODE_ID;
  global.config.nodeTypeCode = parseInt(process.env.NODE_TYPE_CODE) || 7001;
  global.config.subscriptionId = process.env.SUBSCRIPTION_ID;
  global.config.apiToken = process.env.SHIPPABLE_API_TOKEN;
  global.config.execImage = process.env.EXEC_IMAGE;
  global.config.baseDir = process.env.BASE_DIR;
  global.config.reqProcDir = process.env.REQPROC_DIR;
  global.config.reqExecDir = process.env.REQEXEC_DIR;
  global.config.reqKickDir = process.env.REQKICK_DIR;
  global.config.buildDir = process.env.BUILD_DIR;
  global.config.reqProcContainerName = process.env.REQPROC_CONTAINER_NAME;
  global.config.defaultTaskContainerMounts =
    process.env.DEFAULT_TASK_CONTAINER_MOUNTS;
  global.config.defaultTaskContainerOptions =
    process.env.DEFAULT_TASK_CONTAINER_OPTIONS;
  global.config.taskContainerCommand = process.env.TASK_CONTAINER_COMMAND;
  global.config.shippableNodeArchitecture =
    process.env.SHIPPABLE_NODE_ARCHITECTURE;
  global.config.shippableNodeOperatingSystem =
    process.env.SHIPPABLE_NODE_OPERATING_SYSTEM;
  global.config.execTemplatesDir = path.join(
    process.env.IMAGE_EXEC_TEMPLATES_DIR,
    process.env.SHIPPABLE_NODE_OPERATING_SYSTEM
  );

  if (global.config.shippableNodeOperatingSystem === 'WindowsServer_2016') {
    global.config.scriptExtension = 'ps1';
  } else {
    global.config.scriptExtension = 'sh';
  }

  global.config.shippableReleaseVersion = process.env.SHIPPABLE_RELEASE_VERSION;

  /* Node Type Codes */
  global.nodeTypeCodes = {
    dynamic: 7000,
    custom: 7001,
    system: 7002,
    service: 7003
  };

  global.config.isSystemNode =
    config.nodeTypeCode === global.nodeTypeCodes.system;
  global.config.isProcessingRunShJob = false;
  // 15 seconds
  global.config.runShJobStatusPollIntervalMS = 15 * 1000;
}
