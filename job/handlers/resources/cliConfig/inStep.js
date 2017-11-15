'use strict';
var self = inStep;
module.exports = self;

var path = require('path');
var fs = require('fs-extra');

function inStep(params, callback) {
  var bag = {
    dependency: params.dependency,
    consoleAdapter: params.consoleAdapter,
    inDependencyInitTemplateFileNamePattern:
      path.join('{{masterName}}', 'init.sh'),
    inDependencyCleanupTemplateFileNamePattern:
      path.join('{{masterName}}', 'cleanup.sh'),
    buildScriptsDir: params.buildScriptsDir,
    scopes: []
  };

  bag.who = util.format('%s|job|handlers|resources|cliConfig|%s', msName,
    self.name);
  logger.verbose(bag.who, 'Starting');

  bag.consoleAdapter.openCmd(util.format('Copying integration script for %s',
    bag.dependency.name));
  async.series([
      _copyIntegrationInitScript.bind(null, bag),
      _copyIntegrationCleanupScript.bind(null, bag)
    ],
    function (err) {
      logger.verbose(bag.who, 'Completed');
      if (err)
        bag.consoleAdapter.publishMsg('No integration script found');
      else
        bag.consoleAdapter.publishMsg('Successfully copied integration script');
      return callback();
  });
}

function _copyIntegrationInitScript(bag, next) {
  var who = bag.who + '|' + _copyIntegrationInitScript.name;
  logger.debug(who, 'Inside');

  var integrationScriptTemplate =
    path.join(global.config.execTemplatesPath, 'resources',
    bag.dependency.type,
    bag.inDependencyInitTemplateFileNamePattern.replace('{{masterName}}',
    bag.dependency.accountIntegration.masterName));

  if (!fs.existsSync(integrationScriptTemplate))
    return next(true);

  var templatesCommonFolderPath = path.join(global.config.execTemplatesPath,
    'resources', 'common');
  var destinationInitFilePath = path.join(bag.buildScriptsDir, 'resources',
    bag.dependency.type, bag.dependency.accountIntegration.masterName,
    'init.sh');

  fs.copySync(templatesCommonFolderPath, path.join(bag.buildScriptsDir,
    'resources', 'common'));
  fs.copySync(integrationScriptTemplate, destinationInitFilePath);
  fs.chmodSync(destinationInitFilePath, '755');

  var scopes = ['configure'];
  bag.scopes = scopes.concat(bag.dependency.step.scopes);

  bag.dependency.integrationInitScriptCommand = util.format('%s %s %s',
  destinationInitFilePath, bag.dependency.name, bag.scopes.join(','));

  return next();
}

function _copyIntegrationCleanupScript(bag, next) {
  var who = bag.who + '|' + _copyIntegrationCleanupScript.name;
  logger.debug(who, 'Inside');

  var integrationScriptTemplate =
    path.join(global.config.execTemplatesPath, 'resources',
    bag.dependency.type,
    bag.inDependencyCleanupTemplateFileNamePattern.replace('{{masterName}}',
    bag.dependency.accountIntegration.masterName));
  var destinationCleanupFilePath = path.join(bag.buildScriptsDir, 'resources',
    bag.dependency.type, bag.dependency.accountIntegration.masterName,
    'cleanup.sh');

  fs.copySync(integrationScriptTemplate, destinationCleanupFilePath);
  fs.chmodSync(destinationCleanupFilePath, '755');

  bag.dependency.integrationCleanupScriptCommand = util.format('%s %s %s',
    destinationCleanupFilePath, bag.dependency.name, bag.scopes.join(','));

  return next();
}
