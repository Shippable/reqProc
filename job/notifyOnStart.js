'use strict';

var self = notifyOnStart;
module.exports = self;

function notifyOnStart(externalBag, callback) {
  var bag = {
    builderApiAdapter: externalBag.builderApiAdapter,
    buildJobId: externalBag.buildJobId,
    consoleAdapter: externalBag.consoleAdapter
  };
  bag.who = util.format('%s|job|%s', msName, self.name);

  async.series([
      _notifyOnStart.bind(null, bag)
    ],
    function (err) {
      return callback(err);
    }
  );
}

function _notifyOnStart(bag, next) {
  var who = bag.who + '|' + _notifyOnStart.name;
  logger.verbose(who, 'Inside');

  var message = {
    where: 'core.nf',
    payload: {
      objectType: 'buildJob',
      objectId: bag.buildJobId,
      event: 'on_start'
    }
  };

  bag.consoleAdapter.openCmd('Queuing on_start notifications');
  bag.builderApiAdapter.postToVortex(message,
    function (err) {
      if (err) {
        var msg =
          'Failed to queue on_start notifications with error: ' + err;
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
      } else {
        bag.consoleAdapter.publishMsg(
          'Successfully queued on_start notifications');
        bag.consoleAdapter.closeCmd(true);
      }

      return next(err);
    }
  );
}
