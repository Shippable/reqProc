'use strict';
var self = executeScript;
module.exports = self;

var spawn = require('child_process').spawn;

function executeScript(externalBag, callback) {
  var bag = {
    scriptPath: externalBag.scriptPath,
    args: externalBag.args || [],
    options: externalBag.options || {},
    exitCode: 1,
    consoleAdapter: externalBag.consoleAdapter
  };

  bag.who = util.format('%s|job|handlers|%s', msName, self.name);
  logger.verbose(bag.who, 'Starting');

  async.series([
      _checkInputParams.bind(null, bag),
      _executeTask.bind(null, bag)
    ],
    function () {
      logger.verbose(bag.who, 'Completed');
      return callback(bag.exitCode);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.debug(who, 'Inside');

  bag.consoleAdapter.openCmd('Validating script dependencies');
  var consoleErrors = [];
  bag.consoleAdapter.publishMsg('The path is: ' + bag.scriptPath);

  if (!bag.scriptPath)
    consoleErrors.push(util.format('%s is missing: scriptPath', who));

  if (consoleErrors.length > 0) {
    _.each(consoleErrors,
      function (e) {
        var msg = e;
        logger.error(e);
        bag.consoleAdapter.publishMsg(msg);
      }
    );
    return next(true);
  }
  bag.consoleAdapter.publishMsg('Successfully validated script dependencies');
  bag.consoleAdapter.closeCmd(true);
  return next();
}

function _executeTask(bag, next) {
  var who = bag.who + '|' + _executeTask.name;
  logger.debug(who, 'Inside');

  var exec;
  if (global.config.shippableNodeOperatingSystem === 'WindowsServer_2016')
    exec = spawn('powershell', [bag.scriptPath + ' 2>&1'], bag.options);
  else
    exec = spawn('/bin/bash', ['-c', bag.scriptPath + ' 2>&1'], bag.options);

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
    function (code)  {
      bag.exitCode = code;
      var msg = util.format('%s: exit code for %s is: %s',
        bag.who, bag.scriptPath, bag.exitCode);
      if (code)
        logger.warn(msg);
      else
        logger.debug(msg);
      return next();
    }
  );
}

function __parseLogLine(bag, line) {
  var cmdStartHeader = '__SH__CMD__START__';
  var cmdEndHeader = '__SH__CMD__END__';

  var lineSplit = line.split('|');

  var cmdJSON = null;

  if (lineSplit[0] === cmdStartHeader) {
    cmdJSON = JSON.parse(lineSplit[1]);
    bag.consoleAdapter.openCmd(lineSplit[2]);
  } else if (lineSplit[0] === cmdEndHeader) {
    cmdJSON = JSON.parse(lineSplit[1]);
    var isSuccess = cmdJSON.exitcode === '0';
    bag.consoleAdapter.closeCmd(isSuccess);
  } else {
    bag.consoleAdapter.publishMsg(line);
  }
}
