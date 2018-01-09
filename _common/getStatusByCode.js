'use strict';

var self = getStatusByCode;
module.exports = self;

function getStatusByCode(statusCode) {
  return _.findWhere(global.systemCodes,
    { group: 'status', code: statusCode}).name;
}
