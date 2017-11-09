'use strict';

var self = generateKillScript;
module.exports = self;

var path = require('path');
var fs = require('fs-extra');

var generateScriptFromTemplate = require('./generateScriptFromTemplate.js');

function generateKillScript(externalBag, callback) {
  var bag = {
    killScriptTemplatePath:
      path.join(global.config.execTemplatesPath, 'job', 'kill_task.sh'),
    killScriptPath: path.join(externalBag.buildScriptsDir, 'kill_task.sh'),
    jobInfoPath: path.join(externalBag.buildStatusDir, 'job.info'),
    scriptHeaderFileName: 'header.sh',
    killScript: '',
    scriptFilePermissions: '755'
  };

  bag.who = util.format('%s|job|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _getScriptHeader.bind(null, bag),
      _generateKillScript.bind(null, bag),
      _createKillScript.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, util.format('Failed to create script'));
      else
        logger.info(bag.who, 'Successfully created script');
      return callback(err);
    }
  );
}

function _getScriptHeader(bag, next) {
  var who = bag.who + '|' + _getScriptHeader.name;
  logger.verbose(who, 'Inside');

  var headerFile = path.join(global.config.execTemplatesPath, 'job',
    bag.scriptHeaderFileName);

  fs.readFile(headerFile, 'utf8',
    function (err, headerScript) {
      if (err) {
        logger.error(util.format('%s, Failed to read file: %s ' +
          'with err: %s', who, headerFile, err));
        return next(err);
      }
      bag.killScript = bag.killScript.concat(headerScript);
      return next();
    }
  );
}


function _generateKillScript(bag, next) {
  var who = bag.who + '|' + _generateKillScript.name;
  logger.verbose(who, 'Inside');

  var templateBag = {
    filePath: bag.killScriptTemplatePath,
    object: {
      jobInfoPath: bag.jobInfoPath
    }
  };

  generateScriptFromTemplate(templateBag,
    function (err, resultBag) {
      if (err) {
        logger.error(util.format('%s, Generate script from template failed ' +
          'with err: %s', who, err));
        return next(err);
      }
      bag.killScript = bag.killScript.concat(resultBag.script);
      return next();
    }
  );
}

function _createKillScript(bag, next) {
  var who = bag.who + '|' + _createKillScript.name;
  logger.verbose(who, 'Inside');

  fs.writeFile(bag.killScriptPath, bag.killScript,
    function (err) {
      if (err) {
        logger.error(util.format('Failed to write file: %s ' +
          'with err: %s', bag.killScriptPath, err));
        return next(err);
      }
      fs.chmodSync(bag.killScriptPath, bag.scriptFilePermissions);
      return next();
    }
  );
}
