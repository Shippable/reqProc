'use strict';
var self = runSh;

module.exports = self;

var async = require('async');
var fs = require('fs-extra');
var _ = require('underscore');
var spawn = require('child_process').spawn;
var util = require('util');
var path = require('path');

var pathPlaceholder = '{{MASTER_NAME}}';
var integrationHandlerPath =
  '../../_common/integrationHandlers/' + pathPlaceholder + '.js';
var execTemplatesPath = process.env.EXEC_TEMPLATES_PATH;
var execTemplatesIntegrationInitPath =
  path.join(execTemplatesPath, 'integrations', pathPlaceholder,
    'cli', 'init.sh'
  );
var execTemplatesIntegrationCleanUpPath =
  path.join(execTemplatesPath, 'integrations', pathPlaceholder,
    'cli', 'cleanup.sh'
  );

function runSh(callback) {
  var bag = {
    buildRootDir: '/build',
    subscriptionKeyPath: '/tmp/00_sub',
    scriptsTemplatePath:
      path.join(__dirname, '..', '..', '_common', 'templates', 'scripts.sh'),
    scriptsPath: '/build/managed/scripts.sh',
    executeScriptPath: '/build/managed/exec.sh',
    integrationScripts: [],
    integrationsToCleanUp: []
  };
  bag.messageFilePath = bag.buildRootDir + '/message.json';

  async.series([
      _readMessage.bind(null, bag),
      _setUpIntegrations.bind(null, bag),
      _getTask.bind(null, bag),
      _getScripts.bind(null, bag),
      _readScriptsTemplate.bind(null, bag),
      _writeScripts.bind(null, bag),
      _generateExecScript.bind(null, bag),
      _executeScripts.bind(null, bag)
    ],
    function (err) {
      // We need clean up to run irrespective of the failure in other steps.
      async.series([
          _cleanUpIntegrations.bind(null, bag)
        ],
        function (cleanUpErr) {
          if (err)
            console.log('runSh failed with error:', err);

          if (cleanUpErr)
            console.log('runSh failed to clean up with error:', cleanUpErr);

          callback(err);
        }
      );
    }
  );
}

function _readMessage(bag, next) {
  fs.readJson(bag.messageFilePath,
    function (err, message) {
      bag.message = message;
      return next(err);
    }
  );
}

function _setUpIntegrations(bag, next) {
  async.eachSeries(bag.message.steps,
    function (step, nextStep) {
      if (!step.IN) return nextStep();

      var dependency = _.find(bag.message.dependencies,
        function (dependency) {
          return dependency.name === step.IN && dependency.operation === 'IN';
        }
      );

      if (!dependency || dependency.type !== 'cliConfig')
        return nextStep();

      var seriesBag = {
        dependency: dependency,
        scopes: step.scopes,
        integration: null,
        integrationScript: [],
        integrationsToCleanUp: bag.integrationsToCleanUp,
        buildRootDir: bag.buildRootDir,
        useExecTemplate: false,
        execTemplatePath: null
      };

      async.series([
          __readAccountIntegration.bind(null, seriesBag),
          __checkIfExecTemplateExists.bind(null, seriesBag),
          __handleIntegrationWithExecTemplate.bind(null, seriesBag),
          __handleIntegration.bind(null, seriesBag)
        ],
        function (err) {
          if (err)
            return nextStep(err);

          bag.integrationScripts =
            bag.integrationScripts.concat(seriesBag.integrationScript);
          return nextStep();
        }
      );
    },
    function (err) {
      return next(err);
    }
  );
}

function __readAccountIntegration(seriesBag, next) {
  fs.readJson('/build/IN/' + seriesBag.dependency.name + '/integration.json',
    function (err, accountIntegration) {
      if (err) {
        console.log(
          util.format('Failed to read account integration for %s due to %s',
            seriesBag.dependency.name, err)
        );
        return next(
          util.format('Failed to read account integration for %s',
            seriesBag.dependency.name)
        );
      }

      seriesBag.accountIntegration = accountIntegration;
      return next();
    }
  );
}

function __checkIfExecTemplateExists(seriesBag, next) {
  var masterName = seriesBag.accountIntegration.masterName;
  var handlerPath =
    execTemplatesIntegrationInitPath.replace(pathPlaceholder, masterName);

  fs.stat(handlerPath,
    function (err) {
      if (!err) {
        seriesBag.useExecTemplate = true;
        seriesBag.execTemplatePath = handlerPath;
        seriesBag.integrationsToCleanUp.push(
          {
            masterName: masterName,
            dependencyName: seriesBag.dependency.name,
            scopes: seriesBag.scopes
          }
        );
      }

      return next();
    }
  );
}

function __handleIntegrationWithExecTemplate(seriesBag, next) {
  if (!seriesBag.useExecTemplate) return next();

  var opts = [seriesBag.dependency.name];
  if (!_.isEmpty(seriesBag.scopes))
    opts.push(seriesBag.scopes.join(','));
  var exec = spawn(seriesBag.execTemplatePath, opts);

  exec.stdout.on('data',
    function (data)  {
      console.log(data.toString());
    }
  );

  exec.stderr.on('data',
    function (data)  {
      console.log(data.toString());
    }
  );

  exec.on('close',
    function (exitCode)  {
      return next(exitCode);
    }
  );
}

function __handleIntegration(seriesBag, next) {
  if (seriesBag.useExecTemplate) return next();

  var masterName = seriesBag.accountIntegration.masterName;
  var handlerPath = integrationHandlerPath.replace(pathPlaceholder, masterName);
  var integrationHandler;

  try {
    integrationHandler = require(handlerPath);
  } catch (e) {
    console.log(
      util.format('No handler available to configure CLI utilities ' +
        'for integration type: %s', masterName)
    );
  }

  if (!integrationHandler)
    return next();

  var params = {
    dependency: seriesBag.dependency,
    accountIntegration: seriesBag.accountIntegration,
    buildRootDir: seriesBag.buildRootDir,
    scopes: seriesBag.scopes
  };

  integrationHandler(params,
    function (err, integrationScript) {
      seriesBag.integrationScript = integrationScript;
      return next(err);
    }
  );
}

function _getTask(bag, next) {
  bag.task = _.find(bag.message.steps,
    function (step) {
      return !_.isUndefined(step.TASK);
    }
  );

  return next();
}

function _getScripts(bag, next) {
  if (!bag.task) return next();

  bag.scriptTaskSteps = _.filter(bag.task.TASK,
    function (taskStep) {
      return !_.isUndefined(taskStep.script);
    }
  );

  return next();
}

function _readScriptsTemplate(bag, next) {
  if (!bag.scriptTaskSteps) return next();

  var templateString = fs.readFileSync(bag.scriptsTemplatePath).toString();
  var template = _.template(templateString);
  var templateData = {
    integrationScripts: bag.integrationScripts,
    scripts: _.pluck(bag.scriptTaskSteps, 'script')
  };
  bag.scriptsScript = template(templateData);

  return next();
}

function _writeScripts(bag, next) {
  if (!bag.scriptTaskSteps) return next();

  fs.outputFile(bag.scriptsPath, bag.scriptsScript,
    function (err) {
      if (err)
        console.log(err);
      else
        fs.chmodSync(bag.scriptsPath, '755');
      return next(err);
    }
  );
}

function _generateExecScript(bag, next) {
  if (!bag.scriptTaskSteps) return next();

  var scriptContent =
    util.format('ssh-agent /bin/bash -c \'ssh-add %s; %s \'',
      bag.subscriptionKeyPath, bag.scriptsPath);

  fs.outputFile(bag.executeScriptPath, scriptContent,
    function (err) {
      if (err)
        console.log(err);
      else
        fs.chmodSync(bag.executeScriptPath, '755');
      return next(err);
    }
  );
}

function _executeScripts(bag, next) {
  if (!bag.scriptTaskSteps) return next();

  var exec = spawn('/bin/bash',
    ['-c', bag.executeScriptPath],
    { cwd: bag.buildRootDir }
  );

  exec.stdout.on('data',
    function (data)  {
      console.log(data.toString());
    }
  );

  exec.stderr.on('data',
    function (data)  {
      console.log(data.toString());
    }
  );

  exec.on('close',
    function (exitCode)  {
      return next(exitCode);
    }
  );
}

function _cleanUpIntegrations(bag, next) {
  if (_.isEmpty(bag.integrationsToCleanUp)) return next();

  async.eachSeries(bag.integrationsToCleanUp,
    function (integration, nextIntegration) {
      var seriesBag = {
        integration: integration,
        execTemplatePath: null
      };
      async.series([
          __checkCleanUpTemplateExists.bind(null, seriesBag),
          __handleCleanUp.bind(null, seriesBag)
        ],
        function (err) {
          return nextIntegration(err);
        }
      );
    },
    function (err) {
      return next(err);
    }
  );
}

function __checkCleanUpTemplateExists(seriesBag, next) {
  var masterName = seriesBag.integration.masterName;
  var handlerPath =
    execTemplatesIntegrationCleanUpPath.replace(pathPlaceholder, masterName);

  fs.stat(handlerPath,
    function (err) {
      if (!err)
        seriesBag.execTemplatePath = handlerPath;
      return next();
    }
  );
}

function __handleCleanUp(seriesBag, next) {
  if (!seriesBag.execTemplatePath) return next();

  var opts = [seriesBag.integration.dependencyName];
  if (!_.isEmpty(seriesBag.integration.scopes))
    opts.push(seriesBag.integration.scopes.join(','));
  var exec = spawn(seriesBag.execTemplatePath, opts);

  exec.stdout.on('data',
    function (data)  {
      console.log(data.toString());
    }
  );

  exec.stderr.on('data',
    function (data)  {
      console.log(data.toString());
    }
  );

  exec.on('close',
    function (exitCode)  {
      return next(exitCode);
    }
  );
}

if (require.main === module) {
  runSh(
    function (err) {
      if (err)
        process.exit(1);
      process.exit(0);
    }
  );
}
