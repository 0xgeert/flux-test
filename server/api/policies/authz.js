"use strict";

var _ = require("lodash");

module.exports = function(req, res, next) {

	req.authz = true;

	if (next){
		next();
	}

	// User is not allowed
	// (default res.forbidden() behavior can be overridden in `config/403.js`)
	// return res.forbidden('You are not permitted to perform this action.');
};