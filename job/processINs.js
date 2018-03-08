'use strict';

var self = processINs;
module.exports = self;

var handleDependency = require('./handlers/handleDependency.js');

function processINs(externalBag, callback) {
  var bag = {
    rawMessage: _.clone(externalBag.rawMessage),
    inPayload: _.clone(externalBag.inPayload),
    operation: externalBag.operation,
    consoleAdapter: externalBag.consoleAdapter,
    builderApiAdapter: externalBag.builderApiAdapter,
    buildJobId: externalBag.buildJobId,
    buildInDir: externalBag.buildInDir,
    buildOutDir: externalBag.buildOutDir,
    stepMessageFilename: externalBag.stepMessageFilename,
    subPrivateKeyPath: externalBag.subPrivateKeyPath,
    buildScriptsDir: externalBag.buildScriptsDir,
    buildSecretsDir: externalBag.buildSecretsDir
  };
  bag.who = util.format('%s|job|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _processInSteps.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, util.format('Failed to process IN dependencies'));
      else
        logger.info(bag.who, 'Successfully processed IN dependencies');

      return callback(err);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  var expectedParams = [
    'rawMessage',
    'inPayload',
    'operation',
    'consoleAdapter',
    'builderApiAdapter',
    'buildJobId',
    'buildInDir',
    'buildOutDir',
    'stepMessageFilename',
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

function _processInSteps(bag, next) {
  var who = bag.who + '|' + _processInSteps.name;
  logger.verbose(who, 'Inside');

  async.eachSeries(bag.inPayload.propertyBag.yml.steps,
    function (step, nextStep) {
      var operation = _.find(_.keys(step),
        function (key) {
          return key === bag.operation.IN;
        }
      );
      if (!operation) return nextStep();
      logger.verbose('Executing step:', step);

      var name = step[operation];

      var dependency = _.find(bag.inPayload.dependencies,
        function (dependency) {
          return dependency.name === name && dependency.operation === operation;
        }
      );

      if (!dependency) {
        // bag.consoleAdapter.openGrp('Step Error');
        bag.consoleAdapter.openCmd('Errors');

        var msg = util.format('%s, Missing dependency for: %s %s',
          who, operation, name);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        // bag.consoleAdapter.closeGrp(false);

        return nextStep(true);
      }

      async.series([
          handleDependency.bind(null, bag, dependency),
        ],
        function (err) {
          if (err) {
            bag.consoleAdapter.closeCmd(false);
            bag.consoleAdapter.closeGrp(false);
          }
          // else {
          //   bag.consoleAdapter.closeGrp(true);
          // }
          return nextStep(err);
        }
      );
    },
    function (err) {
      return next(err);
    }
  );
}
