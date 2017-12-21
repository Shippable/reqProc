'use strict';

var self = generateReplaceScript;
module.exports = self;

var path = require('path');
var fs = require('fs-extra');

var generateScriptFromTemplate = require('./generateScriptFromTemplate.js');

function generateReplaceScript(externalBag, callback) {
  var bag = {
    versionPath: externalBag.versionPath,
    scriptFileName: externalBag.scriptFileName,
    replacePlaceholdersTemplateFileName: util.format('replace_placeholders.%s',
      global.config.scriptExtension),
    scriptHeaderFileName: util.format('header.%s',
      global.config.scriptExtension),
    envTemplateFileName: util.format('envs.%s', global.config.scriptExtension),
    directory: externalBag.directory,
    script: '',
    scriptFilePermissions: '755',
    commonEnvs: externalBag.commonEnvs
  };

  bag.who = util.format('%s|job|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _getScriptHeader.bind(null, bag),
      _generateEnvScriptFromTemplate.bind(null, bag),
      _generateReplaceScriptFromTemplate.bind(null, bag),
      _createReplaceScriptFile.bind(null, bag)
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

  var headerFile = path.join(global.config.execTemplatesDir, 'job',
    bag.scriptHeaderFileName);

  fs.readFile(headerFile, 'utf8',
    function (err, header) {
      if (err) {
        logger.error(util.format('%s, Failed to read file: %s ' +
          'with err: %s', who, headerFile, err));
        return next(err);
      }
      bag.script = bag.script.concat(header);
      return next();
    }
  );
}

function _generateEnvScriptFromTemplate(bag, next) {
  var who = bag.who + '|' + _generateEnvScriptFromTemplate.name;
  logger.verbose(who, 'Inside');

  var templateBag = {
    filePath: path.join(global.config.execTemplatesDir, 'job',
      bag.envTemplateFileName),
    object: {
      commonEnvs: bag.commonEnvs,
      taskEnvs: [],
      shippableRuntimeEnvs: []
    }
  };

  generateScriptFromTemplate(templateBag,
    function (err, resultBag) {
      if (err) {
        logger.error(util.format('%s, Generate script from template failed ' +
          'with err: %s', who, err));
        return next(err);
      }
      bag.script = bag.script.concat(resultBag.script);
      return next();
    }
  );
}

function _generateReplaceScriptFromTemplate(bag, next) {
  var who = bag.who + '|' + _generateReplaceScriptFromTemplate.name;
  logger.verbose(who, 'Inside');

  var templateBag = {
    filePath: path.join(global.config.execTemplatesDir, 'job',
      bag.replacePlaceholdersTemplateFileName),
    object: {
      versionPath: bag.versionPath
    }
  };

  generateScriptFromTemplate(templateBag,
    function (err, resultBag) {
      if (err) {
        logger.error(util.format('%s, Generate script from template failed ' +
          'with err: %s', who, err));
        return next(err);
      }
      bag.script = bag.script.concat(resultBag.script);
      return next();
    }
  );
}

function _createReplaceScriptFile(bag, next) {
  var who = bag.who + '|' + _createReplaceScriptFile.name;
  logger.verbose(who, 'Inside');

  var scriptFilePath = path.join(bag.directory, bag.scriptFileName);

  __writeScriptFile(bag.script, scriptFilePath, bag.scriptFilePermissions,
    function (err) {
      if (err) {
        logger.error(util.format('%s, Failed to write file: %s ' +
          'with err: %s', who, scriptFilePath, err));
        return next(err);
      }
      return next();
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
