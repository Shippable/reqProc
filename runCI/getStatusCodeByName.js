'use strict';

var self = getStatusCodeByName;
module.exports = self;

function getStatusCodeByName(codeName) {
  return _.findWhere(global.systemCodes,
    { group: 'statusCodes', name: codeName}).code;
}
