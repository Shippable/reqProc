'use strict';

var self = generateNodeInfoSteps;
module.exports = self;

var generateNodeInfoScript = require('./scriptsGen/generateNodeInfoScript.js');
var executeScript = require('./handlers/executeScript.js');

function generateNodeInfoSteps(externalBag, callback) {
  var bag = {
    buildScriptsDir: externalBag.buildScriptsDir,
    consoleAdapter: externalBag.consoleAdapter,
    nodeInfoScriptPath: ''
  };
  bag.who = util.format('%s|job|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _generateNodeInfoScript.bind(null, bag),
      _executeNodeInfoScript.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who,
          util.format('Failed to generate node info steps'));
      else
        logger.info(bag.who,
          util.format('Successfully generated node info steps'));

      return callback(err);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  var expectedParams = [
    'buildScriptsDir',
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

function _generateNodeInfoScript(bag, next) {
  var who = bag.who + '|' + _generateNodeInfoScript.name;
  logger.verbose(who, 'Inside');

  var params = {};
  params.buildScriptsDir = bag.buildScriptsDir;
  params.consoleAdapter = bag.consoleAdapter;
  generateNodeInfoScript(params,
    function (err, resultBag) {
      if (err) {
        var msg = util.format('%s, Failed to generate node info script '+
          'with err: %s', who, err);
        logger.error(msg);
        return next(err);
      }
      bag.nodeInfoScriptPath = resultBag.nodeInfoScriptFilePath;
      return next();
    }
  );
}

function _executeNodeInfoScript(bag, next) {
  var who = bag.who + '|' + _executeNodeInfoScript.name;
  logger.verbose(who, 'Inside');

  var scriptBag = {
    scriptPath: bag.nodeInfoScriptPath,
    args: [],
    options: {},
    consoleAdapter: bag.consoleAdapter,
    ignoreCmd: false
  };

  executeScript(scriptBag,
    function (err) {
      if (err) {
        var msg = util.format('%s, Failed to execute node info script '+
          'with err: %s', who, err);
        return next(msg);
      } else {
        return next();
      }
    }
  );
}
