'use strict';

// ANY CHANGES MADE TO THIS MUST BE DOCUMENTED HERE:
// https://github.com/Shippable/slack/wiki/Build-status-codes

/** Status Codes:
 * 00 -- WAITING -------- Initial state.
 * 10 -- QUEUED --------- Between initial state and in progress state.
 * 20 -- PROCESSING ----- In progress state.
 * 30 -- SUCCESS ----+
 * 40 -- SKIPPED     |
 * 50 -- UNSTABLE    +--- Completed states.
 * 60 -- TIMEOUT     |
 * 70 -- CANCELED    |
 * 80 -- FAILED -----+
 **/

// Incomplete states:
exports.WAITING    =   0;
exports.QUEUED     =  10;
exports.PROCESSING =  20;

// Completed states:
exports.SUCCESS    =  30;
exports.SKIPPED    =  40;
exports.UNSTABLE   =  50;
exports.TIMEOUT    =  60;
exports.CANCELED   =  70;
exports.FAILED     =  80;
exports.STOPPED    =  90;

//Not Initialized:
exports.NOTINITIALIZED = 100;

//Not Deployed:
exports.NOTDEPLOYED = 101;

exports.colourCodes = {
  '20':'#5183a0',
  '30':'#65cea7',
  '40':'#f8a97d',
  '50':'#f3ce85',
  '60':'#a87073',
  '70':'#6bafbd',
  '80':'#fc8675',
  '90':'#6bafbd',
  '101':'#6bafbd',
  '4001':'#5183a0',
  '4002':'#65cea7',
  '4003':'#fc8675',
  '4004':'#fc8675',
  '4006':'#6bafbd'
};

// This adds grammatical changes to the status text
exports.statusMessages = {
  '20':'STARTED',
  '30':'SUCCEEDED',
  '40':'SKIPPED',
  '50':'UNSTABLE',
  '60':'TIMEOUT',
  '70':'CANCELED',
  '80':'FAILED',
  '90':'STOPPED'
};

exports.names = [
  'WAITING', 'QUEUED', 'PROCESSING',
  'SUCCESS', 'SKIPPED', 'UNSTABLE',
  'TIMEOUT', 'CANCELED', 'FAILED',
  'STOPPED', 'NOTINITIALIZED', 'NOTDEPLOYED'
];

// Lookup status code name from code.
exports.lookup = function (code, subset) {
  var statusCodes = (subset || this || exports),
      matchingName = null;
  statusCodes.names.some(function (statusCodeName) {
    if (statusCodes[statusCodeName] === code) {
      return (matchingName = statusCodeName);
    }
  });
  return matchingName;
};

// Subset of idle status codes.
exports.idle = createSubset('WAITING', 'QUEUED');

exports.processing = createSubset('PROCESSING');

// Subset of incomplete status codes.
exports.incomplete = createSubset(
  'WAITING', 'QUEUED', 'PROCESSING', 'NOTINITIALIZED', 'NOTDEPLOYED'
);

exports.started = createSubset('QUEUED', 'PROCESSING');

// Subset of complete status codes.
exports.complete = createSubset(
  'SUCCESS', 'SKIPPED', 'UNSTABLE',
  'TIMEOUT', 'CANCELED', 'FAILED',
  'STOPPED'
);

// Subset of successfully completed status code.
exports.successful = createSubset('SUCCESS', 'SKIPPED');

// Subset of unsuccessfully completed status codes.
exports.unsuccessful =
  createSubset('UNSTABLE', 'TIMEOUT', 'CANCELED', 'FAILED');

// Subset of valid build group status codes.
exports.buildGroup = createSubset(
  'WAITING', 'PROCESSING',
  'SUCCESS', 'SKIPPED',
  'CANCELED', 'FAILED'
);

// Subset of valid build item status codes. (All)
exports.buildItem = exports;

// Subset of valid status code for build item steps.
exports.buildItemStep = createSubset(
  'WAITING', 'QUEUED', 'PROCESSING',
  'SUCCESS', 'FAILED'
);

exports.activeCellStates = createSubset(
  'QUEUED', 'PROCESSING', 'SUCCESS'
);

// Check if status code is a in progress or pending code.
exports.pendingLookup = function (code) {
  return !!exports.incomplete.lookup(code);
};

exports.idleLookup = function (code) {
  return !!exports.idle.lookup(code);
};

exports.processingLookup = function (code) {
  return !!exports.processing.lookup(code);
};

// Check if status code can represent an 'active' cell state
exports.activeLookup = function (code) {
  return !!exports.activeCellStates.lookup(code);
};
// Check if status code is a complete status code.
exports.completedLookup = function (code) {
  return !!exports.complete.lookup(code);
};

// Check if status code is a failed status code.
exports.failedLookup = function (code) {
  return !!exports.unsuccessful.lookup(code);
};

// Check if status code is a successful status code.
exports.successLookup = function (code) {
  return !!exports.successful.lookup(code);
};

// Get a list of status codes from their names.
exports.extractList = function (statusNames) {
  var statusCodes = [];
  statusNames.forEach(function (statusName) {
    if (typeof exports[statusName] === 'number') {
      statusCodes.push(exports[statusName]);
    }
  });
  return statusCodes;
};

// Creates a status code subset.
function createSubset(/*subsetStatusCodeNames...*/) {
  var statusCodeSubset = {},
      statusNames = Array.prototype.slice.call(arguments, 0);
  statusCodeSubset.names = statusNames;
  statusNames.forEach(function (statusName) {
    statusCodeSubset[statusName] = exports[statusName];
  });
  statusCodeSubset.lookup = exports.lookup;
  return statusCodeSubset;
}
