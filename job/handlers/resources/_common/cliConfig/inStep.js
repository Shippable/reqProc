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
      path.join('{{masterName}}',
        util.format('init.%s', global.config.scriptExtension)),
    inDependencyCleanupTemplateFileNamePattern:
      path.join('{{masterName}}',
        util.format('cleanup.%s', global.config.scriptExtension)),
    buildScriptsDir: params.buildScriptsDir,
    scopes: []
  };

  bag.who = util.format('%s|job|handlers|resources|cliConfig|%s', msName,
    self.name);
  logger.verbose(bag.who, 'Starting');

  async.series([
      _copyIntegrationInitScript.bind(null, bag),
      _copyIntegrationCleanupScript.bind(null, bag)
    ],
    function (err) {
      logger.verbose(bag.who, 'Completed');
      if (err) {
        bag.consoleAdapter.publishMsg('No integration script found');
      } else {
        bag.dependency.integrationInitScriptCommand =
          bag.integrationInitScriptCommand;
        bag.dependency.integrationCleanupScriptCommand =
          bag.integrationCleanupScriptCommand;
        bag.consoleAdapter.publishMsg('Successfully copied integration script');
      }
      return callback();
  });
}

function _copyIntegrationInitScript(bag, next) {
  var who = bag.who + '|' + _copyIntegrationInitScript.name;
  logger.debug(who, 'Inside');

  var integrationScriptTemplate =
    path.join(global.config.execTemplatesDir, 'resources',
    bag.dependency.type,
    bag.inDependencyInitTemplateFileNamePattern.replace('{{masterName}}',
    bag.dependency.accountIntegration.masterName));

  if (!fs.existsSync(integrationScriptTemplate))
    return next(true);

  var templatesCommonFolderPath = path.join(global.config.execTemplatesDir,
    'resources', 'common');
  var destinationInitFilePath = path.join(bag.buildScriptsDir, 'resources',
    bag.dependency.type, bag.dependency.accountIntegration.masterName,
    util.format('init.%s', global.config.scriptExtension));

  try {
    fs.copySync(templatesCommonFolderPath, path.join(bag.buildScriptsDir,
      'resources', 'common'));
    fs.copySync(integrationScriptTemplate, destinationInitFilePath);
  } catch (e) {
    return next(e);
  }
  var scopes = ['configure'];
  bag.scopes = _.uniq(_.compact(scopes.concat(bag.dependency.step.scopes)));

  // escaping space for integration names with spaces. eg: Private Docker
  // Registry
  // TODO: fix spaces in filename in Windows
  destinationInitFilePath = destinationInitFilePath.replace(/ /g, '\\\ ');
  bag.integrationInitScriptCommand = util.format('%s %s %s',
  destinationInitFilePath, bag.dependency.name, bag.scopes.join(','));

  return next();
}

function _copyIntegrationCleanupScript(bag, next) {
  var who = bag.who + '|' + _copyIntegrationCleanupScript.name;
  logger.debug(who, 'Inside');

  var integrationScriptTemplate =
    path.join(global.config.execTemplatesDir, 'resources',
    bag.dependency.type,
    bag.inDependencyCleanupTemplateFileNamePattern.replace('{{masterName}}',
    bag.dependency.accountIntegration.masterName));
  var destinationCleanupFilePath = path.join(bag.buildScriptsDir, 'resources',
    bag.dependency.type, bag.dependency.accountIntegration.masterName,
    util.format('cleanup.%s', global.config.scriptExtension));

  try {
    fs.copySync(integrationScriptTemplate, destinationCleanupFilePath);
  } catch (e) {
    return next(e);
  }
  // escaping space for integration names with spaces. eg: Private Docker
  // Registry
  // TODO: fix spaces in filename in Windows
  destinationCleanupFilePath = destinationCleanupFilePath.replace(/ /g, '\\\ ');

  bag.integrationCleanupScriptCommand = util.format('%s %s %s',
    destinationCleanupFilePath, bag.dependency.name, bag.scopes.join(','));

  return next();
}
