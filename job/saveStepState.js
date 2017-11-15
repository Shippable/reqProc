'use strict';

var self = saveStepState;
module.exports = self;

var saveState = require('./handlers/saveState.js');

function saveStepState(externalBag, callback) {
  var bag = {
    stateDir: externalBag.buildStateDir,
    resourceId: externalBag.resourceId,
    builderApiAdapter: externalBag.builderApiAdapter,
    consoleAdapter: externalBag.consoleAdapter,
    inPayload: _.clone(externalBag.inPayload)
  };
  bag.who = util.format('%s|job|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _saveStepState.bind(null, bag)
    ],
    function (err) {
      var result;
      if (err) {
        logger.error(bag.who, util.format('Failed to create step state'));
      } else{
        logger.info(bag.who, 'Successfully saved step state');
        result = {
          versionSha: bag.versionSha
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
    'stateDir',
    'resourceId',
    'builderApiAdapter',
    'consoleAdapter',
    'inPayload'
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

function _saveStepState(bag, next) {
  var who = bag.who + '|' + _saveStepState.name;
  logger.verbose(who, 'Inside');

  saveState(bag,
    function (err, sha) {
      if (err)
        logger.error(who,
          util.format('Failed to save state for resource: %s',
            bag.inPayload.name), err
        );
      else
        bag.versionSha = sha;
      return next(err);
    }
  );
}
