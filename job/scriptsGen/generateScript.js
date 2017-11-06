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
    containerTemplateFileName: 'container.sh',
    envTemplateFileName: 'envs.sh',
    runtime: externalBag.runtime,
    buildScriptsDir: externalBag.buildScriptsDir,
    taskScript: '',
    dockerScript: '',
    scriptFilePermissions: '755',
    buildRootDir: externalBag.buildRootDir,
    reqExecDir: externalBag.reqExecDir,
    buildJobId: externalBag.buildJobId,
    envs: externalBag.commonEnvs,
    buildStatusDir: externalBag.buildStatusDir
  };
  bag.defaultDockerVolumeMounts = util.format('-v %s:%s -v %s:/reqExec',
    bag.buildRootDir, bag.buildRootDir, bag.reqExecDir);
  bag.defaultDockerOptions = '-d --rm';
  bag.defaultDockerEnvs = '';

  bag.who = util.format('%s|job|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _getScriptHeader.bind(null, bag),
      _generateEnvScriptFromTemplate.bind(null, bag),
      _generateScriptFromTemplate.bind(null, bag),
      _createScriptFile.bind(null, bag),
      _generateDockerBootScriptFromTemplate.bind(null, bag),
      _createDockerScriptFile.bind(null, bag)
    ],
    function (err) {
      var result;
      if (err) {
        logger.error(bag.who,
          util.format('Failed to create script'));
      } else {
        logger.info(bag.who, 'Successfully created script');
        result = {};
        if (bag.runtime.container)
          result.scriptFileName = bag.dockerScriptFileName;
        else
          result.scriptFileName = bag.scriptFileName;
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
      bag.dockerScript = bag.dockerScript.concat(header);
      return next();
    }
  );
}

function _generateEnvScriptFromTemplate(bag, next) {
  var who = bag.who + '|' + _generateEnvScriptFromTemplate.name;
  logger.verbose(who, 'Inside');

  var templateBag = {
    filePath: path.join(global.config.execTemplatesPath, 'job',
      bag.envTemplateFileName),
    object: {
      envs: bag.envs
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
      bag.dockerScript = bag.dockerScript.concat(resultBag.script);
      return next();
    }
  );
}

function _generateScriptFromTemplate(bag, next) {
  var who = bag.who + '|' + _generateScriptFromTemplate.name;
  logger.verbose(who, 'Inside');

  bag.taskName = bag.name || util.format('task_%s', bag.taskIndex);
  var templateBag = {
    filePath: path.join(global.config.execTemplatesPath, 'job',
      bag.taskTemplateFileName),
    object: {
      script: bag.script,
      name: bag.taskName,
      container: bag.runtime.container
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

  __writeScriptFile(bag.taskScript, scriptFilePath, bag.scriptFilePermissions,
    function (err) {
      if (err) {
        logger.error(util.format('%s, Failed to write file: %s ' +
          'with err: %s', who, scriptFilePath, err));
        return next(err);
      }
      bag.scriptFileName = scriptFileName;
      return next();
    }
  );
}

function _generateDockerBootScriptFromTemplate(bag, next) {
  if (!bag.runtime.container) return next();

  var who = bag.who + '|' + _generateDockerBootScriptFromTemplate.name;
  logger.verbose(who, 'Inside');

  var dockerContainerName = util.format('reqExec.%s.%s', bag.buildJobId,
    bag.taskIndex);
  var dockerExecCommand = util.format('bash -c \'/reqExec/bin/dist/main/main ' +
    '%s/%s %s/job.env\'', bag.buildScriptsDir, bag.scriptFileName,
    bag.buildStatusDir);
  var dockerOptions = util.format('%s --name %s', bag.defaultDockerOptions,
    dockerContainerName);
  var dockerImage = util.format('%s:%s', bag.runtime.options.imageName,
    bag.runtime.options.imageTag);

  var templateBag = {
    filePath: path.join(global.config.execTemplatesPath, 'job',
      bag.containerTemplateFileName),
    object: {
      options: dockerOptions,
      envs: bag.defaultDockerEnvs,
      volumes: bag.defaultDockerVolumeMounts,
      image: dockerImage,
      containerName: dockerContainerName,
      command: dockerExecCommand
    }
  };

  generateScriptFromTemplate(templateBag,
    function (err, resultBag) {
      if (err) {
        logger.error(util.format('%s, Generate script from template failed ' +
          'with err: %s', who, err));
        return next(err);
      }
      bag.dockerScript = bag.dockerScript.concat(resultBag.script);
      return next();
    }
  );
}

function _createDockerScriptFile(bag, next) {
  if (!bag.runtime.container) return next();

  var who = bag.who + '|' + _createDockerScriptFile.name;
  logger.verbose(who, 'Inside');

  var scriptFileName = util.format('container_%s.sh', bag.taskIndex);
  var scriptFilePath = path.join(bag.buildScriptsDir, scriptFileName);

  __writeScriptFile(bag.dockerScript, scriptFilePath, bag.scriptFilePermissions,
    function (err) {
      if (err) {
        logger.error(util.format('%s, Failed to write file: %s ' +
          'with err: %s', who, scriptFilePath, err));
        return next(err);
      }
      bag.dockerScriptFileName = scriptFileName;
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
