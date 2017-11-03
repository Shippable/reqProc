'use strict';
var self = inStep;
module.exports = self;

function inStep(params, callback) {
  var bag = {
    dependency: params.dependency,
    consoleAdapter: params.consoleAdapter
  };

  bag.who = util.format('%s|job|handlers|resources|dockerOptions|%s', msName,
    self.name);
  logger.verbose(bag.who, 'Starting');

  async.series([
      _setDefaultValues.bind(null, bag)
    ],
    function (err) {
      logger.verbose(bag.who, 'Completed');
      return callback(err);
  });
}

function _setDefaultValues(bag, next) {
  if (_.isNumber(bag.dependency.version.propertyBag.memory)) return next();

  var who = bag.who + '|' + _setDefaultValues.name;
  logger.debug(who, 'Inside');

  bag.consoleAdapter.openCmd('Setting default values');
  bag.dependency.version.propertyBag.memory = 400;
  bag.consoleAdapter.publishMsg('Successfully set default values');
  bag.consoleAdapter.closeCmd(true);

  return next();
}
