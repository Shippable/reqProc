'use strict';

var self = readJobStatus;
module.exports = self;

var fs = require('fs-extra');
var path = require('path');

var getStatusCodeByName = require('../_common/getStatusCodeByName.js');
var getStatusByCode = require('../_common/getStatusByCode.js');

function readJobStatus(externalBag, callback) {
  var bag = {
    buildJobId: externalBag.buildJobId,
    builderApiAdapter: externalBag.builderApiAdapter,
    buildStatusDir: externalBag.buildStatusDir,
    jobStatusCode: externalBag.jobStatusCode,
    consoleAdapter: externalBag.consoleAdapter
  };
  bag.who = util.format('%s|job|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _getBuildJobStatus.bind(null, bag),
      _readJobStatus.bind(null, bag)
    ],
    function (err) {
      var result;
      if (err) {
        logger.error(bag.who, util.format('Failed to read buildJob status'));
      } else {
        logger.info(bag.who, 'Successfully read buildJob status');
        result = {
          jobStatusCode: bag.jobStatusCode
        };
      }
      return callback(err, result);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  var expectedParams = [
    'buildJobId',
    'builderApiAdapter',
    'buildStatusDir',
    'jobStatusCode',
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


function _getBuildJobStatus(bag, next) {
  var who = bag.who + '|' + _getBuildJobStatus.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Obtaining latest job status');
  bag.builderApiAdapter.getBuildJobById(bag.buildJobId,
    function (err, buildJob) {
      if (err) {
        var msg = util.format('%s: failed to getBuildJobById' +
          ' for buildJobId:%s, with err: %s', who, bag.buildJobId, err);
        logger.warn(msg);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);

        bag.jobStatusCode = getStatusCodeByName('error');
      } else {
        bag.consoleAdapter.publishMsg(
          util.format('Successfully obtained latest job status: %s',
          getStatusByCode(buildJob.statusCode)));
        bag.consoleAdapter.closeCmd(true);

        bag.jobStatusCode = buildJob.statusCode;
      }

      return next(err);
    }
  );
}

function _readJobStatus(bag, next) {
  if (bag.jobStatusCode === getStatusCodeByName('cancelled')) return next();

  var who = bag.who + '|' + _readJobStatus.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Reading job status');

  var statusPath = path.join(bag.buildStatusDir, 'job.status');
  fs.readFile(statusPath, 'utf8',
    function (err, status) {
      var msg;
      if (err) {
        msg = util.format('%s, failed to read file: %s for ' +
          'buildJobId: %s with err: %s', who, statusPath,
          bag.rawMessage.buildJobId, err);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        return next();
      }

      var jobStatusSystemCode = _.findWhere(global.systemCodes,
        { name: status.trim() });
      if (_.isEmpty(jobStatusSystemCode)) {
        msg = util.format('%s, failed to find status code for ' +
          'status: %s', who, status.trim());
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        return next();
      }

      bag.jobStatusCode = jobStatusSystemCode.code;
      bag.consoleAdapter.publishMsg(
        'Successfully read job status: ' + getStatusByCode(bag.jobStatusCode));
      bag.consoleAdapter.closeCmd(true);
      return next();
    }
  );
}
