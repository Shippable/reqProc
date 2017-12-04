'use strict';

var self = generateNodeInfoScript;
module.exports = self;

var path = require('path');
var fs = require('fs-extra');

function generateNodeInfoScript(externalBag, callback) {
  var bag = {
    scriptHeaderFileName: 'header.sh',
    nodeInfoFileName: 'node_info.sh',
    buildScriptsDir: externalBag.buildScriptsDir,
    consoleAdapter: externalBag.consoleAdapter,
    nodeInfoScript: '',
    scriptFilePermissions: '755'
  };

  bag.who = util.format('%s|job|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _getScriptHeader.bind(null, bag),
      _getScriptNodeInfo.bind(null, bag),
      _createNodeInfoScript.bind(null, bag)
    ],
    function (err) {
      var result = {};
      if (err) {
        logger.error(bag.who,
          util.format('Failed to create node info script'));
      } else {
        logger.info(bag.who, 'Successfully created node info script');
        result.nodeInfoScriptFilePath =
          path.join(bag.buildScriptsDir, bag.nodeInfoFileName);
      }

      return callback(err, result);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  return next();
}

function _getScriptHeader(bag, next) {
  var who = bag.who + '|' + _getScriptHeader.name;
  logger.verbose(who, 'Inside');

  var headerFile = path.join(global.config.execTemplatesDir, 'job',
  bag.scriptHeaderFileName);

  fs.readFile(headerFile, 'utf8',
    function (err, header) {
      if (err) {
        bag.consoleAdapter.openCmd('Failed to read file: ' + headerFile);
        bag.consoleAdapter.publishMsg('Failed to read file: ' + headerFile +
          'with err: ' + err);
        bag.consoleAdapter.closeCmd(true);
        logger.error(util.format('%s, Failed to read file: %s ' +
          'with err: %s', who, headerFile, err));
        return next(err);
      }
      bag.nodeInfoScript = bag.nodeInfoScript.concat(header);
      return next();
    }
  );
}

function _getScriptNodeInfo(bag, next) {
  var who = bag.who + '|' + _getScriptNodeInfo.name;
  logger.verbose(who, 'Inside');

  var nodeInfoFile = path.join(global.config.execTemplatesDir, 'job',
  bag.nodeInfoFileName);

  fs.readFile(nodeInfoFile, 'utf8',
    function (err, nodeInfo) {
      if (err) {
        bag.consoleAdapter.openCmd('Failed to read file: ' + nodeInfoFile);
        bag.consoleAdapter.publishMsg('Failed to read file: ' + nodeInfoFile +
          'with err: ' + err);
        bag.consoleAdapter.closeCmd(true);
        logger.error(util.format('%s, Failed to read file: %s ' +
          'with err: %s', who, nodeInfoFile, err));
        return next(err);
      }
      bag.nodeInfoScript = bag.nodeInfoScript.concat(nodeInfo);
      return next();
    }
  );
}

function _createNodeInfoScript(bag, next) {
  var who = bag.who + '|' + _createNodeInfoScript.name;
  logger.verbose(who, 'Inside');

  var scriptFilePath = path.join(bag.buildScriptsDir, bag.nodeInfoFileName);

  __writeScriptFile(bag.nodeInfoScript, scriptFilePath,
    bag.scriptFilePermissions,
    function (err) {
      if (err) {
        bag.consoleAdapter.openCmd('Failed to create file: nodeInfoScript');
        bag.consoleAdapter.publishMsg('Failed to create file: nodeInfoScript ' +
          'with err: ' + err);
        bag.consoleAdapter.closeCmd(true);
        return next(err);
      }
      else {
        return next();
      }
    }
  );
}

function __writeScriptFile(script, scriptFilePath, scriptFilePermissions,
  callback) {
  fs.writeFile(scriptFilePath, script,
    function (err) {
      if (err) {
        logger.error(util.format('Failed to write file: %s ' +
          'with err: %s', scriptFilePath, err));
        return callback(err);
      }
      fs.chmodSync(scriptFilePath, scriptFilePermissions);
      return callback();
    }
  );
}
