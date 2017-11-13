'use strict';

var self = pollBuildJobStatus;
module.exports = self;

var getStatusCodeByName = require('../_common/getStatusCodeByName.js');
var fs = require('fs-extra');

function pollBuildJobStatus(externalBag, callback) {
  var bag = {
    builderApiAdapter: externalBag.builderApiAdapter,
    buildJobId: externalBag.buildJobId,
    buildStatusDir: externalBag.buildStatusDir
  };
  bag.who = util.format('%s|job|%s', msName, self.name);

  async.series([
      _pollBuildJobStatus.bind(null, bag)
    ],
    function () {
      return callback();
    }
  );
}

function _pollBuildJobStatus(bag, next) {
  var who = bag.who + '|' + _pollBuildJobStatus.name;
  logger.verbose(who, 'Inside');

  var isCancelled = false;
  var cancelledStatusCode = getStatusCodeByName('cancelled');
  function poll(bag) {
    bag.builderApiAdapter.getBuildJobById(bag.buildJobId,
      function (err, buildJob) {
        if (err) {
          logger.warn(util.format('%s, Failed to get buildJob' +
            ' for buildJobId:%s, with err: %s', who, bag.buildJobId, err));
        } else if (buildJob.statusCode === cancelledStatusCode) {
          isCancelled = true;
          var statusPath = util.format('%s/job.status', bag.buildStatusDir);
          try {
            fs.writeFileSync(statusPath, 'cancelled\n');
          } catch (e) {
            logger.warn(who,
              'Failed to write status to status path with error: ', e
            );
            // Reset this so we can try again in the next poll.
            isCancelled = false;
          }
        }

        if (!isCancelled)
          setTimeout(
            function () {
              poll(bag);
            }, global.config.runShJobStatusPollIntervalMS
          );
      }
    );
  }

  poll(bag);
  return next();
}
