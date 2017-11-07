'use strict';

var self = updateStatus;
module.exports = self;

var getStatusCodeByName = require('../_common/getStatusCodeByName.js');

function updateStatus(externalBag, callback) {
  var bag = {
    buildJobStatus: externalBag.buildJobStatus,
    consoleAdapter: externalBag.consoleAdapter,
    builderApiAdapter: externalBag.builderApiAdapter,
    buildJobId: externalBag.buildJobId,
    jobStatusCode: externalBag.jobStatusCode
  };
  bag.who = util.format('%s|job|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _updateBuildJobStatus.bind(null, bag)
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

  return next();
}

function _updateBuildJobStatus(bag, next) {
  var who = bag.who + '|' + _updateBuildJobStatus.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Updating build job status');
  var update = {};

  // bag.jobStatusCode is set in previous functions
  // only for states other than success
  if (!bag.jobStatusCode)
    bag.jobStatusCode = getStatusCodeByName('success', bag.isCI);

  update.statusCode = bag.jobStatusCode;

  bag.builderApiAdapter.putBuildJobById(bag.buildJobId, update,
    function (err) {
      if (err) {
        var msg = util.format('%s, failed to :putBuildJobById for ' +
          'buildJobId: %s with err: %s', who, bag.buildJobId, err);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
      } else {
        bag.consoleAdapter.publishMsg('Successfully updated buildJob status');
        bag.consoleAdapter.closeCmd(true);
      }
      return next(err);
    }
  );
}
