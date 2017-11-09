'use strict';

var self = initJob;
module.exports = self;

function initJob(externalBag, callback) {
  var bag = {
    consoleAdapter: externalBag.consoleAdapter,
    rawMessage: _.clone(externalBag.rawMessage),
    builderApiAdapter: externalBag.builderApiAdapter,
    nodeId: global.config.nodeId
  };
  bag.who = util.format('%s|runCI|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
    ],
    function (err) {
      var result;
      if (err) {
        logger.error(bag.who, util.format('Failed to init job'));
      } else {
        logger.info(bag.who, util.format('Successfully init job'));
        result= {
        };
      }

      return callback(err, result);
    }
  );
}
