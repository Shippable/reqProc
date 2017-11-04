'use strict';

var self = generateScript;
module.exports = self;

var path = require('path');
var fs = require('fs-extra');

var generateScriptFromTemplate = require('./generateScriptFromTemplate.js');

function generateScript(externalBag, callback) {
  var bag = {
    script: externalBag.script,
    taskIndex: externalBag.taskIndex,
    name: externalBag.name,
    taskTemplateFileName: 'task.sh',
    scriptHeaderFileName: 'header.sh',
    container: externalBag.container,
    buildScriptsDir: externalBag.buildScriptsDir,
    taskScript: '',
    scriptFilePermissions: '755'
  };
  bag.who = util.format('%s|job|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _getScriptHeader.bind(null, bag),
      _generateScriptFromTemplate.bind(null, bag),
      _createScriptFile.bind(null, bag)
    ],
    function (err) {
      var result;
      if (err) {
        logger.error(bag.who,
          util.format('Failed to create script'));
      } else {
        logger.info(bag.who, 'Successfully created script');
        result = {
          scriptFileName: bag.scriptFileName
        };
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

  var headerFile = path.join(global.config.execTemplatesPath, 'job',
    bag.scriptHeaderFileName);

  fs.readFile(headerFile, 'utf8',
    function (err, header) {
      if (err) {
        logger.error(util.format('%s, Failed to read file: %s ' +
          'with err: %s', who, headerFile, err));
        return next(err);
      }
      bag.taskScript = bag.taskScript.concat(header);
      return next();
    }
  );
}

function _generateScriptFromTemplate(bag, next) {
  var who = bag.who + '|' + _generateScriptFromTemplate.name;
  logger.verbose(who, 'Inside');

  var templateBag = {
    filePath: path.join(global.config.execTemplatesPath, 'job',
      bag.taskTemplateFileName),
    object: {
      script: bag.script,
      name: bag.name || util.format('task_%s', bag.taskIndex)
    }
  };

  generateScriptFromTemplate(templateBag,
    function (err, resultBag) {
      if (err) {
        logger.error(util.format('%s, Generate script from template failed ' +
          'with err: %s', who, err));
        return next(err);
      }
      bag.taskScript = bag.taskScript.concat(resultBag.script);
      return next();
    }
  );
}

function _createScriptFile(bag, next) {
  var who = bag.who + '|' + _createScriptFile.name;
  logger.verbose(who, 'Inside');

  var scriptFileName = util.format('task_%s.sh', bag.taskIndex);
  var scriptFilePath = path.join(bag.buildScriptsDir, scriptFileName);

  fs.writeFile(scriptFilePath, bag.taskScript,
    function (err) {
      if (err) {
        logger.error(util.format('%s, Failed to write file: %s ' +
          'with err: %s', who, scriptFilePath, err));
        return next(err);
      }
      bag.scriptFileName = scriptFileName;
      fs.chmodSync(scriptFilePath, bag.scriptFilePermissions);
      return next();
    }
  );
}
