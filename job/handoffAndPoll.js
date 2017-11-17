'use strict';

var self = handoffAndPoll;
module.exports = self;

var fs = require('fs-extra');
var path = require('path');

function handoffAndPoll(externalBag, callback) {
  var bag = {
    buildStatusDir: externalBag.buildStatusDir,
    consoleAdapter: externalBag.consoleAdapter,
    stepsFileNames: externalBag.stepsFileNames
  };
  bag.who = util.format('%s|job|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _handOffAndPoll.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, util.format('Failed to handoff and poll'));
      else
        logger.info(bag.who, util.format('Successfully received handoff from '+
        'reqKick'));

      return callback(err);
    }
  );

}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  var expectedParams = [
    'buildStatusDir',
    'consoleAdapter'
  ];

  var paramErrors = [];
  _.each(expectedParams,
    function (expectedParam) {
      if (_.isNull(bag[expectedParam]) || _.isUndefined(bag[expectedParam]))
        paramErrors.push(
          util.format('%s: missing param :%s', who, expectedParam)
        );
    }
  );

  var hasErrors = !_.isEmpty(paramErrors);
  if (hasErrors) {
    logger.error(paramErrors.join('\n'));
    bag.consoleAdapter.publishMsg(paramErrors.join('\n'));
  }

  return next(hasErrors);
}

function _handOffAndPoll(bag, next) {
  var who = bag.who + '|' + _handOffAndPoll.name;
  logger.verbose(who, 'Inside');

  async.eachSeries(bag.stepsFileNames,
    function (stepsFileName, nextStepFile) {
      var innerBag = {
        stepsFileName: stepsFileName
      };
      _.extend(innerBag, bag);
      async.series([
          __setStepsFileName.bind(null, innerBag),
          __setExecutorAsReqKick.bind(null, innerBag),
          __pollExecutorForReqProc.bind(null, innerBag)
        ],
        function (err) {
          return nextStepFile(err);
        }
      );
    },
    function (err) {
      return next(err);
    }
  );
}

function __setStepsFileName(bag, next) {
  var who = bag.who + '|' + __setStepsFileName.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Setting executor as reqKick');
  var whoPath = path.join(bag.buildStatusDir, 'job.steps.path');
  fs.writeFile(whoPath, bag.stepsFileName,
    function (err) {
      if (err) {
        var msg = util.format('%s, Failed to write file: %s ' +
          'with err: %s', who, whoPath, err);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        return next(err);
      }

      bag.consoleAdapter.publishMsg(
        util.format('Updated %s', whoPath)
      );
      bag.consoleAdapter.closeCmd(true);
      return next();
    }
  );
}

function __setExecutorAsReqKick(bag, next) {
  var who = bag.who + '|' + __setExecutorAsReqKick.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Setting executor as reqKick');
  var whoPath = path.join(bag.buildStatusDir, 'job.who');
  fs.writeFile(whoPath, 'reqKick\n',
    function (err) {
      if (err) {
        var msg = util.format('%s, Failed to write file: %s ' +
          'with err: %s', who, whoPath, err);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        return next(err);
      }

      bag.consoleAdapter.publishMsg(
        util.format('Updated %s', whoPath)
      );
      bag.consoleAdapter.closeCmd(true);
      return next();
    }
  );
}

function __pollExecutorForReqProc(bag, next) {
  var who = bag.who + '|' + __pollExecutorForReqProc.name;
  logger.verbose(who, 'Inside');

  function checkForReqProc(bag, callback) {
    var whoPath = path.join(bag.buildStatusDir, 'job.who');
    var isReqProc = false;

    try {
      var executor = fs.readFileSync(whoPath, {encoding: 'utf8'});
      isReqProc = executor.trim() === 'reqProc';
    } catch (err) {
      isReqProc = false;
    }

    if (isReqProc)
      return callback();

    setTimeout(function () {
      checkForReqProc(bag, callback);
    }, 5000);
  }

  checkForReqProc(bag, next);
}
