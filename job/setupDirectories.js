'use strict';

var self = setupDirectories;
module.exports = self;

var fs = require('fs-extra');
var path = require('path');

function setupDirectories(externalBag, callback) {
  var bag = {
    reqProcDir: externalBag.reqProcDir,
    reqKickDir: externalBag.reqKickDir,
    reqExecDir: externalBag.reqExecDir,
    reqKickScriptsDir: externalBag.reqKickScriptsDir,
    buildInDir: externalBag.buildInDir,
    buildOutDir: externalBag.buildOutDir,
    buildStateDir: externalBag.buildStateDir,
    buildStatusDir: externalBag.buildStatusDir,
    buildSharedDir: externalBag.buildSharedDir,
    buildScriptsDir: externalBag.buildScriptsDir,
    buildSecretsDir: externalBag.buildSecretsDir,
    buildPreviousStateDir: externalBag.buildPreviousStateDir,
    consoleAdapter: externalBag.consoleAdapter,
    inPayload: _.clone(externalBag.inPayload)
  };
  bag.who = util.format('%s|job|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _setupDirectories.bind(null, bag),
      _setupFiles.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, util.format('Failed to setup dirs'));
      else
        logger.info(bag.who, util.format('Successfully setup dirs'));

      return callback(err);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  var expectedParams = [
    'reqProcDir',
    'reqKickDir',
    'reqExecDir',
    'reqKickScriptsDir',
    'buildInDir',
    'buildOutDir',
    'buildStateDir',
    'buildStatusDir',
    'buildSharedDir',
    'buildScriptsDir',
    'buildSecretsDir',
    'buildPreviousStateDir',
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

function _setupDirectories(bag, next) {
  var who = bag.who + '|' + _setupDirectories.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Creating required directories');
  var dirsToBeCreated = [
    bag.reqKickScriptsDir, bag.buildInDir, bag.buildOutDir, bag.buildStateDir,
    bag.buildStatusDir, bag.buildSharedDir, bag.buildScriptsDir,
    bag.buildSecretsDir, bag.buildPreviousStateDir
  ];

  async.eachLimit(dirsToBeCreated, 10,
    function (dir, nextDir) {
      fs.ensureDir(dir,
        function (err) {
          if (err) {
            var msg = util.format('%s, Failed to create directory: %s ' +
              'with err: %s', who, dir, err);
            bag.consoleAdapter.publishMsg(msg);
            return nextDir(err);
          }

          bag.consoleAdapter.publishMsg(
            util.format('Created directory: %s', dir)
          );
          return nextDir();
        }
      );
    },
    function (err) {
      if (err) {
        bag.consoleAdapter.closeCmd(false);
        return next(err);
      }

      bag.consoleAdapter.closeCmd(true);
      return next();
    }
  );
}

function _setupFiles(bag, next) {
  var who = bag.who + '|' + _setupFiles.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Creating required files');

  var filesToBeCreated = [
    path.join(bag.buildStatusDir, 'job.env'),
    path.join(bag.buildStatusDir, 'job.status'),
    path.join(bag.buildStatusDir, 'job.who'),
    path.join(bag.reqProcDir, 'version'),
    path.join(bag.reqProcDir, 'status'),
    path.join(bag.reqKickDir, 'version'),
    path.join(bag.reqKickDir, 'status'),
    path.join(bag.reqExecDir, 'version')
  ];

  var fileList = _.map(bag.inPayload.dependencies,
    function (dependency) {
      return path.join(bag.buildStateDir, util.format('%s.env',
      dependency.name));
    }
  );
  fileList.push(path.join(bag.buildStateDir, util.format('%s.env',
    bag.inPayload.name)));
  filesToBeCreated = _.uniq(filesToBeCreated.concat(fileList));

  async.eachLimit(filesToBeCreated, 10,
    function (file, nextFile) {
      fs.ensureFile(file,
        function (err) {
          if (err) {
            var msg = util.format('%s, Failed to create file: %s ' +
              'with err: %s', who, file, err);
            bag.consoleAdapter.publishMsg(msg);
            return nextFile(err);
          }

          bag.consoleAdapter.publishMsg(
            util.format('Created file: %s', file)
          );
          return nextFile();
        }
      );
    },
    function (err) {
      if (err) {
        bag.consoleAdapter.closeCmd(false);
        return next(err);
      }

      bag.consoleAdapter.closeCmd(true);
      return next();
    }
  );
}
