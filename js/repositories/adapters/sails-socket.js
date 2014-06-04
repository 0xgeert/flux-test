"use strict";

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
				  	resolve(response);
				});
			});
		},
		get: function(id){
			return new Promise(function(resolve, reject) {
				var url = endpoint + "/"+ id;
				socket.get(url, function (response) {
				  	resolve(response);
				});
			});
		},
		create: function(doc){
			return new Promise(function(resolve, reject) {
				var timer = setTimeout(function(){ //testing 
					reject(new Error("timeout"));
				}, 1000);
				socket.post(endpoint, doc, function(response){
					console.log("adapter: create");
					clearTimeout(timer);
					resolve(response);
				});
			});
		},
		update: function(id, doc, rev){
			return new Promise(function(resolve, reject) {
				var url = endpoint + "/"+ doc.id;
				socket.put(url, doc, function (response) {
				  	resolve(response);
				});
			});
		},
		remove: function(id, rev){
			return new Promise(function(resolve, reject) {
				var url = endpoint + "/"+ id;
				socket.delete(url, function (response) {
				  	resolve(response);
				});
			});
		},
	};

	return adapter;

};

module.exports = sailsSocketFN;