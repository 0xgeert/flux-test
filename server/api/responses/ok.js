"use strict";

/**
 * Custom 200 (OK) Handler which filters json output bsaed on authorization
 * 
 * @param  {Object} data
 * @param  {Boolean|String} viewOrRedirect
 *         [optional]
 *          - pass `true` to render default view
 *          - pass string to render specified view
 *          - pass string with leading slash or http:// or https:// to do redirect
 */

var _ = require("lodash");

module.exports = function sendOK (data, viewOrRedirect) {
	
	var req = this.req;
	var res = this.res;

	var callbackFN = function(){
		if ( req.options.jsonp && !req.isSocket ) {
			return res.jsonp(data);
		}
		else {
			return res.json(data);
		}
	};

	// Serve JSON (with optional JSONP support)
	if (req.wantsJSON || !viewOrRedirect) {
		if(req.authz){
			console.log("auth z touched");
			setTimeout(callbackFN, 300);
		}else{
			return callbackFN();
		}
	}else{
		// Serve HTML view or redirect to specified URL
		if (typeof viewOrRedirect === 'string') {
			if (viewOrRedirect.match(/^(\/|http:\/\/|https:\/\/)/)) {
				return res.redirect(viewOrRedirect);
			}
			else {
				return res.view(viewOrRedirect, data);
			}
		}
		else {
			return res.view(data);
		}
	}

	
};