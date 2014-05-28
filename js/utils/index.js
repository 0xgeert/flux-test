"use strict";

var utils = {
	getFunctionSignature: function(fn){
		var reg = /\(([\s\S]*?)\)/;
		var params = reg.exec(fn);
		return params ? params[1].split(',') : undefined;
	}
};

module.exports = utils;