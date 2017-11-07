'use strict';

var self = Adapter;
module.exports = self;

var uuid = require('node-uuid');
var ShippableAdapter = require('./shippable/Adapter.js');

function Adapter(apiToken, jobId, consoleBatchSize, consoleBufferTimeInMS) {
  this.who = util.format('%s|micro|_common|jobConsoleAdapter|jobId:%s',
    msName, jobId);
  this.jobId = jobId;
  this.startTimeInMicroSec = new Date().getTime() * 1000;
  var processStartTime = process.hrtime();
  this.processStartTimeInMicroSec =
    processStartTime[0] * 1e6 + processStartTime[1] / 1e3;
  this.ShippableAdapter = new ShippableAdapter(apiToken);
  this.batchSize = consoleBatchSize || 20;
  this.buffer = [];
  this.bufferTimeInterval = consoleBufferTimeInMS || 3000;
  this.bufferTimer = null;
  this.pendingApiCalls = 0;
  this.messageWithNoParentConsole = [];
  this.scriptType = null;
}

Adapter.prototype.openGrp = function (consoleGrpName, isShown) {
  var that = this;
  var who = that.who + '|_openGrp';
  var showGrp = true;

  if (!consoleGrpName) {
    that.pushMessageToDebug(who + ' missing consoleGrpName');
    return;
  }

  if ((_.isBoolean(isShown) && !isShown) || isShown === 'false')
    showGrp = false;

  that.consoleGrpName = consoleGrpName;
  that.consoleGrpId = uuid.v4();

  var consoleGrp = {
    jobId: that.jobId,
    consoleId: that.consoleGrpId,
    parentConsoleId: 'root',
    type: 'grp',
    message: that.consoleGrpName,
    timestamp: that._getTimestamp(),
    isShown: showGrp
  };

  that.buffer.push(consoleGrp);
  that._postToJobConsole(true);
};

Adapter.prototype.closeGrp = function (isSuccess, isShown) {
  var that = this;
  var showGrp = true;

  if ((_.isBoolean(isShown) && !isShown) || isShown === 'false')
    showGrp = false;

  //The grp is already closed
  if (!that.consoleGrpName)
    return;

  if (!_.isBoolean(isSuccess)) isSuccess = true;

  that.closeCmd();

  var consoleGrp = {
    jobId: that.jobId,
    consoleId: that.consoleGrpId,
    parentConsoleId: 'root',
    type: 'grp',
    message: that.consoleGrpName,
    timestamp: that._getTimestamp(),
    timestampEndedAt: that._getTimestamp(),
    isSuccess: isSuccess,
    isShown: showGrp
  };

  that.buffer.push(consoleGrp);
  that._postToJobConsole(true);
  that.consoleGrpName = null;
  that.consoleGrpId = null;
};

Adapter.prototype.openCmd = function (consoleCmdName) {
  var that = this;
  var who = that.who + '|_openCmd';

  if (!consoleCmdName) {
    that.pushMessageToDebug(who + ' missing consoleCmdName');
    return;
  }

  if (!that.consoleGrpId) {
    that.pushMessageToDebug(consoleCmdName);
    return;
  }

  that.consoleCmdName = consoleCmdName;
  that.consoleCmdId = uuid.v4();

  var consoleGrp = {
    jobId: that.jobId,
    consoleId: that.consoleCmdId,
    parentConsoleId: that.consoleGrpId,
    type: 'cmd',
    message: that.consoleCmdName,
    timestamp: that._getTimestamp(),
    isShown: true
  };

  that.buffer.push(consoleGrp);
  that._postToJobConsole(true);
};

Adapter.prototype.closeCmd = function (isSuccess) {
  var that = this;

  // The cmd is already closed
  if (!that.consoleCmdName)
    return;

  if (!_.isBoolean(isSuccess)) isSuccess = true;

  var consoleGrp = {
    jobId: that.jobId,
    consoleId: that.consoleCmdId,
    parentConsoleId: that.consoleGrpId,
    type: 'cmd',
    message: that.consoleCmdName,
    timestamp: that._getTimestamp(),
    timestampEndedAt: that._getTimestamp(),
    isSuccess: isSuccess,
    isShown: false
  };

  that.buffer.push(consoleGrp);
  that._postToJobConsole(true);
  that.consoleCmdName = null;
  that.consoleCmdId = null;
};

Adapter.prototype.publishMsg = function (message) {
  var that = this;

  if (!that.consoleCmdId) {
    that.pushMessageToDebug(message);
    return;
  }

  var consoleGrp = {
    jobId: that.jobId,
    consoleId: uuid.v4(),
    parentConsoleId: that.consoleCmdId,
    type: 'msg',
    message: message + '\n',
    timestamp: that._getTimestamp(),
    isShown: true
  };

  that.buffer.push(consoleGrp);
  that._postToJobConsole(false);
};

Adapter.prototype._postToJobConsole = function (forced) {
  var that = this;
  var who = that.who + '|_postToJobConsole';

  if (that.buffer.length > that.batchSize || forced) {
    if (that.bufferTimer) {
      // If a timeout has been set for the buffer, clear it.
      clearTimeout(that.bufferTimer);
      that.bufferTimer = null;
    }

    var consoles = that.buffer.splice(0, that.buffer.length);

    if (consoles.length === 0)
      return;

    var body = {
      jobId: that.jobId,
      jobConsoleModels: consoles
    };

    that.pendingApiCalls ++;
    that.ShippableAdapter.postJobConsoleByJobId(that.jobId, body,
      function (err) {
        that.pendingApiCalls --;
        if (err)
          logger.error(who, 'postJobConsoleByJobId Failed', err);
        logger.debug(who, 'Succeeded');
      }
    );
  } else if (!that.bufferTimer) {
    // Set a timeout that will clear the buffer in three seconds if nothing has.
    that.bufferTimer = setTimeout(
      function () {
        this._postToJobConsole(true);
      }.bind(that),
      that.bufferTimeInterval);
  }
};

Adapter.prototype.getPendingApiCallCount = function () {
  var that = this;
  return that.pendingApiCalls;
};

Adapter.prototype._getTimestamp = function () {
  var that = this;
  var currentProcessTime = process.hrtime();

  return that.startTimeInMicroSec +
    (currentProcessTime[0] * 1e6 + currentProcessTime[1]/1e3) -
    that.processStartTimeInMicroSec;
};

Adapter.prototype.setCurrentScriptType = function (scriptType) {
  var that = this;
  that.scriptType = scriptType;
};

Adapter.prototype.pushMessageToDebug = function (msg) {
  var that = this;
  var debugMsg = 'ScriptType:' + that.scriptType + '|msg:' + msg;
  that.messageWithNoParentConsole.push(debugMsg);
};

Adapter.prototype.publishDebugMessages = function () {
  var that = this;

  if (_.isEmpty(that.messageWithNoParentConsole)) return;

  that.openGrp('Debug');
  that.openCmd('Debug logs');
  _.each(that.messageWithNoParentConsole,
    function (message) {
      that.publishMsg(message);
    }
  );
  that.closeCmd(true);
  that.closeGrp(true);
};
