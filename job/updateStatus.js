'use strict';

var self = updateStatus;
module.exports = self;

var getStatusByCode = require('../_common/getStatusByCode.js');

function updateStatus(externalBag, callback) {
  var bag = {
    consoleAdapter: externalBag.consoleAdapter,
    builderApiAdapter: externalBag.builderApiAdapter,
    buildJobId: externalBag.buildJobId,
    jobStatusCode: externalBag.jobStatusCode,
    version: externalBag.version
  };
  bag.who = util.format('%s|job|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _updateBuildJobStatusAndVersion.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, util.format('Failed to update buildJob status'));
      else
        logger.info(bag.who, 'Successfully updated buildJob status');

      return callback(err);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  var expectedParams = [
    'consoleAdapter',
    'builderApiAdapter',
    'buildJobId',
    'jobStatusCode'
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

function _updateBuildJobStatusAndVersion(bag, next) {
  var who = bag.who + '|' + _updateBuildJobStatusAndVersion.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Updating build job status and version');
  var update = {};

  update.statusCode = bag.jobStatusCode;
  if (bag.version && bag.version.id)
    update.versionId = bag.version.id;

  bag.builderApiAdapter.putBuildJobById(bag.buildJobId, update,
    function (err) {
      if (err) {
        var msg = util.format('%s, failed to :putBuildJobById for ' +
          'buildJobId: %s with err: %s', who, bag.buildJobId, err);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
      } else {
        bag.consoleAdapter.publishMsg(
          util.format('Successfully updated job with status %s and' +
          ' versionId %s', getStatusByCode(update.statusCode), update.versionId)
        );
        bag.consoleAdapter.closeCmd(true);
      }
      return next(err);
    }
  );
}
