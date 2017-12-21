'use strict';

var self = pollBuildJobStatus;
module.exports = self;

var getStatusCodeByName = require('../_common/getStatusCodeByName.js');
var fs = require('fs-extra');
var path = require('path');

function pollBuildJobStatus(externalBag, callback) {
  var bag = {
    builderApiAdapter: externalBag.builderApiAdapter,
    buildJobId: externalBag.buildJobId,
    buildStatusDir: externalBag.buildStatusDir,
    consoleAdapter: externalBag.consoleAdapter
  };
  bag.who = util.format('%s|job|%s', msName, self.name);

  async.series([
      _checkInputParams.bind(null, bag),
      _pollBuildJobStatus.bind(null, bag)
    ],
    function () {
      return callback();
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  var expectedParams = [
    'builderApiAdapter',
    'buildJobId',
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
  if (hasErrors)
    logger.error(paramErrors.join('\n'));
  return next(hasErrors);
}

function _pollBuildJobStatus(bag, next) {
  var who = bag.who + '|' + _pollBuildJobStatus.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Starting job status poll');
  var isTerminated = false;
  var cancelledStatusCode = getStatusCodeByName('cancelled');
  var timeoutStatusCode = getStatusCodeByName('timeout');
  var statusPath = path.join(bag.buildStatusDir, 'job.status');
  function poll(bag) {
    bag.builderApiAdapter.getBuildJobById(bag.buildJobId,
      function (err, buildJob) {
        if (err) {
          logger.warn(util.format('%s, Failed to get buildJob' +
            ' for buildJobId:%s, with err: %s', who, bag.buildJobId, err));
          return;
        }
        var statusName = _.findWhere(global.systemCodes,
          { code: buildJob.statusCode}).name;
        if (buildJob.statusCode === cancelledStatusCode ||
          buildJob.statusCode === timeoutStatusCode) {
          isTerminated = true;
          try {
            fs.writeFileSync(statusPath, util.format('%s\n', statusName));
          } catch (e) {
            logger.warn(who,
              'Failed to write status to status path with error: ', e
            );
            // Reset this so we can try again in the next poll.
            isTerminated = false;
          }
        }

        if (!isTerminated)
          setTimeout(
            function () {
              poll(bag);
            }, global.config.runShJobStatusPollIntervalMS
          );
      }
    );
  }

  poll(bag);
  bag.consoleAdapter.publishMsg(
    'Configured job status poll for every ' +
    global.config.runShJobStatusPollIntervalMS / 1000 + ' seconds');
  bag.consoleAdapter.closeCmd(true);
  return next();
}
