'use strict';

var self = getSecrets;
module.exports = self;

var fs = require('fs-extra');

function getSecrets(externalBag, callback) {
  var bag = {
    inPayload: _.clone(externalBag.inPayload),
    consoleAdapter: externalBag.consoleAdapter,
    builderApiAdapter: externalBag.builderApiAdapter,
    buildJobId: externalBag.buildJobId,
    subPrivateKeyPath: externalBag.subPrivateKeyPath
  };
  bag.who = util.format('%s|job|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _getPipelineSecrets.bind(null, bag),
      _extractSecrets.bind(null, bag),
      _saveSubPrivateKey.bind(null, bag)
    ],
    function (err) {
      var result;
      if (err) {
        logger.error(bag.who, util.format('Failed to get secrets'));
      } else {
        logger.info(bag.who, 'Successfully got secrets');
        result = {
          secrets: bag.secrets,
          inPayload: bag.inPayload
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
    'inPayload',
    'consoleAdapter',
    'builderApiAdapter',
    'buildJobId',
    'subPrivateKeyPath'
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

function _getPipelineSecrets(bag, next) {
  var who = bag.who + '|' + _getPipelineSecrets.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Fetching job secrets');
  bag.builderApiAdapter.headers['X-SECRETS-TOKEN'] =
    bag.inPayload.secretsToken;
  bag.builderApiAdapter.getBuildJobById(bag.buildJobId,
    function (err, buildJob) {
      if (err) {
        var msg = util.format('%s, Failed to get buildJob secrets' +
          ' for buildJobId:%s, with err: %s', who, bag.buildJobId, err);
        logger.warn(msg);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
      } else {
        bag.consoleAdapter.publishMsg('Successfully obtained job secrets');
        bag.secrets = buildJob.secrets;
      }

      delete bag.builderApiAdapter.headers['X-SECRETS-TOKEN'];
      return next(err);
    }
  );
}

function _extractSecrets(bag, next) {
  var who = bag.who + '|' + _extractSecrets.name;
  logger.verbose(who, 'Inside');

  _.each(bag.inPayload.dependencies,
    function (dependency) {
      if (dependency.type === 'params') {
        var decryptedParams =
          _.findWhere(bag.secrets.data.steps, { name: dependency.name });
        if (decryptedParams)
          dependency.version.propertyBag.params = decryptedParams.params;
      }
    }
  );

  return next();
}

function _saveSubPrivateKey(bag, next) {
  var who = bag.who + '|' + _saveSubPrivateKey.name;
  logger.verbose(who, 'Inside');

  fs.outputFile(bag.subPrivateKeyPath,
    bag.secrets.data.subscription.sshPrivateKey,
    function (err) {
      if (err) {
        var msg = util.format('%s, Failed to save subscription private key, %s',
          who, err);
        logger.warn(msg);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        return next(err);
      } else {
        bag.consoleAdapter.publishMsg(
          'Successfully saved subscription private key');
        bag.consoleAdapter.closeCmd(true);
        fs.chmodSync(bag.subPrivateKeyPath, '600');
      }
      return next();
    }
  );
}
