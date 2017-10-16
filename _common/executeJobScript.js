'use strict';
var self = executeJobScript;
module.exports = self;

var spawn = require('child_process').spawn;
var fs = require('fs-extra');
var path = require('path');

function executeJobScript(externalBag, callback) {
  var bag = {
    consoleAdapter: externalBag.consoleAdapter,
    builderApiAdapter: externalBag.builderApiAdapter,
    steps: externalBag.steps,
    mexecFileNameWithPath: externalBag.mexecFileNameWithPath,
    isFailedJob: false,
    continueNextStep: true,
    ciJob: externalBag.ciJob,
    jobEnvDir: externalBag.jobEnvDir,
    readOnStartJobEnvs: false,
    putOnStartJobEnvs: false,
    onStartJobEnvs: [],
    rawMessage: externalBag.rawMessage,
    cexecMessageNameWithLocation: externalBag.cexecMessageNameWithLocation,
    sshDir: externalBag.sshDir,
    tmpFile: '/tmp/mexec/tmp-script.sh',
    sshAddFragment: ''
  };

  bag.who = msName + '|_common|' + self.name;
  logger.verbose(bag.who, 'Starting');

  async.series([
      _checkInputParams.bind(null, bag),
      _executeSteps.bind(null, bag)
    ],
    function () {
      logger.verbose(bag.who, 'Completed');
      //Force pushing all the debug messages
      bag.consoleAdapter.publishDebugMessages();
      return callback(bag.isFailedJob);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  return next();
}

function _executeSteps(bag, next) {
  var who = bag.who + '|' + _executeSteps.name;
  logger.verbose(who, 'Inside');

  async.eachOfSeries(bag.steps,
    function (step, index, nextStep) {
      bag.currentStep = step;
      bag.currentStepIndex = index;
      async.series([
          __writeCexecStepsToFile.bind(null, bag),
          __writeStepToFile.bind(null, bag),
          __readSSHKeys.bind(null, bag),
          __generateExecScript.bind(null, bag),
          __executeTask.bind(null, bag),
          __readOnStartEnvs.bind(null, bag),
          __putOnStartEnvsInJob.bind(null, bag)
        ],
        function (err) {
          return nextStep(err);
        }
      );
    },
    function (err) {
      return next(err);
    }
  );
}

function __writeCexecStepsToFile(bag, done) {
  bag.consoleAdapter.setCurrentScriptType(bag.currentStep.scriptType);

  if (!bag.continueNextStep) return done();
  if (bag.currentStep.who !== 'mexec') return done();
  if (bag.currentStepIndex + 1 === bag.steps.length) return done();
  if (bag.steps[bag.currentStepIndex + 1].who !== 'cexec') return done();

  var who = bag.who + '|' + __writeCexecStepsToFile.name;
  logger.debug(who, 'Inside');

  var messageClone = _.clone(bag.rawMessage);

  messageClone.steps =
    messageClone.steps.splice(bag.currentStepIndex + 1, bag.steps.length);

  fs.writeFile(bag.cexecMessageNameWithLocation, JSON.stringify(messageClone),
    function (err) {
      if (err) {
        var msg = util.format('%s, Failed with err:%s', who, err);
        bag.consoleAdapter.publishMsg(msg);
        return done(err);
      }
      fs.chmodSync(bag.cexecMessageNameWithLocation, '755');
      return done();
    }
  );
}

function __writeStepToFile(bag, done) {
  if (!bag.continueNextStep) return done();
  if (bag.currentStep.who !== 'mexec') return done();

  var who = bag.who + '|' + __writeStepToFile.name;
  logger.debug(who, 'Inside');

  fs.writeFile(bag.tmpFile,
    bag.currentStep.script,
    function (err) {
      if (err) {
        var msg = util.format('%s, Failed with err:%s', who, err);
        bag.consoleAdapter.publishMsg(msg);
        return done(err);
      }
      fs.chmodSync(bag.tmpFile, '755');
      return done();
    }
  );
}

function __readSSHKeys(bag, done) {
  if (!bag.continueNextStep) return done();
  if (bag.currentStep.who !== 'mexec') return done();

  var who = bag.who + '|' + __readSSHKeys.name;
  logger.debug(who, 'Inside');

  fs.readdir(bag.sshDir,
    function (err, fileNames) {
      if (err) {
        var msg = util.format('%s, Failed with err:%s', who, err);
        bag.consoleAdapter.publishMsg(msg);
        return done(err);
      }
      var fileNameWithLocation = _.map(fileNames,
        function (fileName) {
          return path.join(bag.sshDir, fileName);
        }
      );

      fileNameWithLocation = fileNameWithLocation.sort();
      bag.sshAddFragment = '';

      _.each(fileNameWithLocation,
        function (fileName) {
          bag.sshAddFragment = bag.sshAddFragment + 'ssh-add ' + fileName + ';';
        }
      );

      return done();
    }
  );
}

function __generateExecScript(bag, done) {
  if (!bag.continueNextStep) return done();
  if (bag.currentStep.who !== 'mexec') return done();

  var who = bag.who + '|' + __generateExecScript.name;
  logger.debug(who, 'Inside');

  var scriptContent =
    util.format('ssh-agent /bin/bash -c \'%s %s \'',
      bag.sshAddFragment, bag.tmpFile);

  fs.outputFile(bag.mexecFileNameWithPath, scriptContent,
    function (err) {
      if (err) {
        var msg = util.format('%s, Failed with err:%s', who, err);
        bag.consoleAdapter.publishMsg(msg);
        return done(err);
      }
      fs.chmodSync(bag.mexecFileNameWithPath, '755');
      return done();
    }
  );
}

function __executeTask(bag, done) {
  if (!bag.continueNextStep) return done();
  if (bag.currentStep.who !== 'mexec') return done();

  var who = bag.who + '|' + __executeTask.name;
  logger.debug(who, 'Inside');

  var exec = spawn('/bin/bash', ['-c', bag.mexecFileNameWithPath + ' 2>&1'],
    {});
  exec.stdout.on('data',
    function (data)  {
      _.each(data.toString().split('\n'),
        function (consoleLine) {
          if (!_.isEmpty(consoleLine))
            __parseLogLine(bag, consoleLine);
        }
      );
    }
  );

  exec.on('close',
    function (exitCode)  {
      if (exitCode) {
        bag.isFailedJob = true;
        bag.continueNextStep = false;
      }
      return done();
    }
  );
}

function __readOnStartEnvs(bag, done) {
  if (!bag.continueNextStep) return done();
  if (bag.currentStep.who !== 'mexec') return done();
  if (!bag.readOnStartJobEnvs) return done();

  var who = bag.who + '|' + __readOnStartEnvs.name;
  logger.debug(who, 'Inside');

  if (!fs.existsSync(bag.jobEnvDir)) {
    bag.readOnStartJobEnvs = false;
    return done();
  }

  bag.putOnStartJobEnvs = true;
  var fileNames = fs.readdirSync(bag.jobEnvDir);
  if (_.isEmpty(fileNames)) {
    bag.readOnStartJobEnvs = false;
    return done();
  }

  var validJSONFiles = [];

  _.each(fileNames,
    function (fileName) {
      if (path.extname(fileName) === '.json')
        validJSONFiles.push(path.join(bag.jobEnvDir, fileName));
    }
  );

  if (_.isEmpty(validJSONFiles)) {
    bag.readOnStartJobEnvs = false;
    return done();
  }

  _.each(validJSONFiles,
    function (fileName) {
      var json = fs.readFileSync(fileName, 'utf8');
      var parsedJSON = __parseBody(json);
      bag.onStartJobEnvs.push(parsedJSON);
    }
  );
  bag.readOnStartJobEnvs = false;
  return done();
}

function __putOnStartEnvsInJob(bag, done) {
  if (!bag.continueNextStep) return done();
  if (bag.currentStep.who !== 'mexec') return done();
  if (!bag.putOnStartJobEnvs) return done();

  var who = bag.who + '|' + __putOnStartEnvsInJob.name;
  logger.debug(who, 'Inside');

  bag.ciJob.onStartJobEnvs = bag.onStartJobEnvs;

  bag.builderApiAdapter.putJobById(bag.ciJob.id, bag.ciJob,
    function (err, job) {
      if (err) {
        var msg = util.format('%s, Failed to save onStartJobEnvs ' +
          'for job:%s with error:%s', who, bag.ciJob.id, err);
        bag.consoleAdapter.publishMsg(msg);
      }
      bag.ciJob = job;
      bag.putOnStartJobEnvs = false;
      return done();
    }
  );
}

function __parseLogLine(bag, line) {
  var lineSplit = line.split('|');

  var cmdJSON = null;
  var grpJSON = null;
  var isSuccess = null;
  var messagesNotToBePosted = ['__SH__SHOULD_CONTINUE__',
    '__SH__SCRIPT_END_SUCCESS__'];

  if (lineSplit[0] === '__SH__GROUP__START__') {
    grpJSON = JSON.parse(lineSplit[1]);
    bag.consoleAdapter.openGrp(lineSplit[2], grpJSON.is_shown);
  } else if (lineSplit[0] === '__SH__GROUP__END__') {
    grpJSON = JSON.parse(lineSplit[1]);
    isSuccess = grpJSON.exitcode === '0';
    bag.consoleAdapter.closeGrp(isSuccess, grpJSON.is_shown);
  } else if (lineSplit[0] === '__SH__CMD__START__') {
    bag.consoleAdapter.openCmd(lineSplit[2]);
  } else if (lineSplit[0] === '__SH__CMD__END__') {
    cmdJSON = JSON.parse(lineSplit[1]);
    isSuccess = cmdJSON.exitcode === '0';
    bag.consoleAdapter.closeCmd(isSuccess);
  } else if (lineSplit[0] === '__SH__SCRIPT_END_FAILURE__') {
    bag.isFailedJob = true;
  } else if (lineSplit[0] === '__SH__SHOULD_NOT_CONTINUE__') {
    bag.continueNextStep = false;
    bag.isFailedJob = true;
  } else if (lineSplit[0] === '__SH_ON_START_JOB_ENV_SCRIPT_COMPLETE__') {
    bag.readOnStartJobEnvs = true;
  } else if (!_.contains(messagesNotToBePosted, lineSplit[0])) {
    bag.consoleAdapter.publishMsg(line);
  }
}

function __parseBody(body) {
  var parsedBody = {};
  if (typeof body === 'object') {
    parsedBody = body;
  } else {
    try {
      parsedBody = JSON.parse(body);
    } catch (e) {
      parsedBody.message = 'Could not parse body';
    }
  }
  return parsedBody;
}
