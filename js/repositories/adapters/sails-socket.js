"use strict";


var _ = require("lodash");
var Promise = require('es6-promise').Promise;

/**
 * A adapter to plug into a repository. 
 * This adapter is a facade around sails.socket.io
 *
 * For the latest (docs not up-to-date) on sails.socket.io in sails 0.10.x
 * see: https://github.com/balderdashy/sails-docs/blob/master/reference/Upgrading/Upgrading.md
 * and outdated: http://sailsjs.org/#!documentation/sockets
 * 
 * 
 * @param  {[type]} config [description]
 * @return {[type]}        [description]
 */
var sailsSocketFN = function(config){

	var socket = io.socket;

	var col = config.collection;
	if(col === undefined){
		throw new Error("collection is not defined for sails-socket adapter");
	}

	//endpoint, e.g.: /user
	var endpoint = "/"+col;

	socket.on(col, function(cometEvent) {
		console.log("################################");
		console.log("event received");
		console.log(cometEvent);
	});


	var adapter = {
		find: function(){
			return new Promise(function(resolve, reject) {
				socket.get(endpoint, function (response) {
					if(response.statusCode || response.status){ //error?
						return reject(response.statusCode || response.status);
					}
				  	resolve(response);
				});
			});
		},
		get: function(id){
			return new Promise(function(resolve, reject) {
				var url = endpoint + "/"+ id;
				socket.get(url, function (response) {
					if(response.statusCode || response.status){ //error?
						return reject(response.statusCode || response.status);
					}
				  	resolve(response);
				});
			});
		},
		create: function(doc){
			return new Promise(function(resolve, reject) {
				socket.post(endpoint, doc, function(response){
					if(response.statusCode || response.status){ //error?
						return reject(response.statusCode || response.status);
					}
					resolve(response);
				});
			});
		},
		update: function(id, doc, rev){
			return new Promise(function(resolve, reject) {
				var url = endpoint + "/"+ doc.id;
				socket.put(url, doc, function (response) {
					if(response.statusCode || response.status){ //error?
						return reject(response.statusCode || response.status);
					}
				  	resolve(response);
				});
			});
		},
		/**
		 * This implementation only uses ids to update. 
		 * In the future we may implement optimistic versioning which would also need '_rev' per doc
		 * @param  {[type]} docs array of documents. 
		 * @return {[type]}      [description]
		 */
		updateMulti: function(docs, updates){
			
			var payload = {
				ids: _.pluck(docs, "id"),
				partial: updates
			};
			return new Promise(function(resolve, reject) {
				socket.put(endpoint, payload, function (response) {
					if(response.statusCode || response.status){ //error?
						return reject(response.statusCode || response.status);
					}

					//response = array of updated objects
				  	resolve(response);
				});
			});
		},

		remove: function(id, rev){
			return new Promise(function(resolve, reject) {
				var url = endpoint + "/"+ id;
				socket.delete(url, function (response) {
					if(response.statusCode || response.status){ //error?
						return reject(response.statusCode || response.status);
					}
				  	resolve(response);
				});
			});
		},

		/**
		 * This implementation only uses ids to delete. 
		 * In the future we may implement optimistic versioning which would also need '_rev' per doc
		 * @param  {[type]} docs array of documents. 
		 * @return {[type]}      [description]
		 */
		removeMulti: function(docs){
			
			var payload = {
				ids:  _.pluck(docs, "id")
			};

			return new Promise(function(resolve, reject) {
				socket.delete(endpoint, payload, function (response) {
					//https://github.com/gebrits/flux-test/issues/24
					//TODO: are all errors guarenteed to pass 'statusCode'? 
					//http://stackoverflow.com/questions/24056059/whats-the-error-signature-from-a-socket-io-response-in-sailsjs
					if(response.statusCode || response.status){ //error?
						return reject(response.statusCode || response.status);
					}

					//response = array of deleted objects
				  	resolve(response);
				});
			});
		},
	};

	return adapter;

};

module.exports = sailsSocketFN;