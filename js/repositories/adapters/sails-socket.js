"use strict";


var _ = require("lodash");
var Promise = require('es6-promise').Promise;

var cacheProxy = require("./cacheProxy");

/**
 * Batch format: 
 * id : {
 *   timer,
 *   size, 
 *   data: 
 * }
 * @type {Object}
 */
var serverSideBatches = {};

var initSocketLiveFeedHandler = function(col, endpoint, liveActions){
	
    var socket = io.socket;

    // send a request to todo.testSocket
    // Custom controller code will subscribe the current socket to the model 'todo' by calling `watch` on said model
    // https://github.com/balderdashy/sails-docs/blob/0.10/reference/ModelMethods.md#watchrequest
    // 
    // This will automatically subscribe to all future create/update/delete/add/remove messages by ANY instances of said model. 
    // The default CRUD blueprint messages send these messages.
    // 
    // An alternative (when going the filtered / authorized route) would be to use model.subscribe
    // to selective subscribe to certain instances. 
    // see: https://github.com/balderdashy/sails-docs/blob/0.10/reference/ModelMethods.md#subscriberequestrecordscontexts
    // 
    // questions: 
    // - does a socket get automatically subscribed to a model instance it creates? (or is there a way to config that?)
    // - what what be a good way to subscribe to events of all model instance a user is authorized to seeing?
    // 
    socket.get(endpoint + '/testSocket/');

    // socket.get('/firehose', function nowListeningToFirehose() {

    //     // Attach a listener which fires every time the server publishes
    //     // a message to the firehose:
    //     socket.on('firehose', function newMessageFromSails(message) {
    //         console.log('New message from firehose:\n', message);
    //     });
    // });


	socket.on(col, function(obj) {

		var batch,
			batchStore;

		if(obj.verb === "created"){

			//pass the newly created object
			liveActions.createFromServer(obj.data);

		}else if(obj.verb === "updated"){
			if(obj.previous === undefined){
				throw new Error("server updated event needs to defined obj.previous");
			}
			if(obj.previous.__batch){
				// a single update that is part of a batch
				// wait until batch complete and process the batch as a whole
				batch = obj.previous.__batch;
				delete obj.previous.__batch;

				batchStore = serverSideBatches[batch.batchid] = serverSideBatches[batch.batchid] || {
					size: batch.size, 
					data: []
				};

				batchStore.data.push(_.extend(obj.previous||{}, obj.data));
				if(batchStore.size === batchStore.data.length){
					liveActions.updateFromServer(batchStore.data);
					delete serverSideBatches[batch.batchid];
				}
			}else{
				//a single (non batched) update. 
				//This contains updated data in obj.data (which may be a partial)
				//This is mixed in with obj.previous (i.e.: the data before the update)
				//to arrive at the new object. 
				//This object is passed to the dispatcher
				liveActions.updateFromServer(_.extend(obj.previous||{}, obj.data));
			}
		}else if(obj.verb === "destroyed"){

			if(obj.previous === undefined){
				throw new Error("server updated event needs to defined obj.previous");
			}

			//pass the destroyed object
			if(obj.previous.__batch){
				// a single destroy that is part of a batch
				// wait until batch complete and process the batch as a whole
				batch = obj.previous.__batch;
				delete obj.previous.__batch;

				batchStore = serverSideBatches[batch.batchid] = serverSideBatches[batch.batchid] || {
					size: batch.size, 
					data: []
				};

				batchStore.data.push(obj.previous);
				if(batchStore.size === batchStore.data.length){
					liveActions.destroyFromServer(batchStore.data);
					delete serverSideBatches[batch.batchid];
				}
			}else{
				//a single (non batched) destroy. 
				//This object (the deleted object, i.e.: obj.previous) is passed to the dispatcher
				liveActions.destroyFromServer(obj.previous);	
			}
		}
		else{
			console.log("TBD: UNHANDLED STUFF FROM HERE");
			if(obj.verb === "messaged"){
				//https://github.com/balderdashy/sails-docs/blob/0.10/reference/ModelMethods.md#message-modelsdata-request-
				//
				//emits a socket message using the model identity as the event name. 
				//The message is broadcast to all sockets subscribed to the model instance via the .subscribe model method.
				//NOTE: this can be used to broadcast a custom message
			}else if(obj.verb === "addedTo"){
				//https://github.com/balderdashy/sails-docs/blob/0.10/reference/ModelMethods.md#publishadd-idattribute-idadded-request-options-
				//
				//Publishes a notification when an associated record is added to a model's collection.
				//
				//emits a socket message using the model identity as the event name. 
				//The message is broadcast to all sockets subscribed to the model instance via the .subscribe model method.
			}else if(obj.verb === "removedFrom"){
				//https://github.com/balderdashy/sails-docs/blob/0.10/reference/ModelMethods.md#publishremove-idattribute-idremoved-request-options-
				//
				//Publishes a notification when an associated record is removed to a model's collection. 
				//
				// emits a socket message using the model identity as the event name. 
				// The message is broadcast to all sockets subscribed to the model instance via the .subscribe model method.
			}else{
				console.log("Message with unexisting or not-modeled verb");
			}
			console.log(obj);
		}
	});
};

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
	
	this.adapterName = "sailsSocket";

	//endpoint, e.g.: /user
	var endpoint = "/"+col;

	//setup live feed with server, which enables client to receive realtime (pushed) updates from the server
	if(config.live){

		if(config.liveActions === undefined){
			throw new Error("'config.liveActions' is not defined for sails-socket adapter that is configured to receive live updates");
		}
		initSocketLiveFeedHandler(col, endpoint, config.liveActions);
	}

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
			if(id === undefined){
				return Promise.reject(new Error("'id' not specified"));
			}
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

		create: function(doc, isServerCall){
			console.log("isServerCall: " + isServerCall);
			if(!_.isObject(doc)){
				return Promise.reject(new Error("'doc' is not an object"));
			}
			return new Promise(function(resolve, reject) {
				if(isServerCall){
					return resolve(doc);
				}

				socket.post(endpoint, doc, function(response){
					if(response.statusCode || response.status){ //error?
						return reject(response.statusCode || response.status);
					}
					resolve(response);
				});
			});
		},

		update: function(id, partial, isServerCall){

			if (id === undefined) {
				return Promise.reject(new Error("'id' not specified"));
			} 
			if (!_.isObject(partial)) {
				return Promise.reject(new Error("'partial' is not an object"));
			} 

			return new Promise(function(resolve, reject) {

				if(isServerCall){
					//partial is entire doc
					return resolve(partial);
				}

				var url = endpoint + "/"+ id;
				socket.put(url, partial, function (response) {
					if(response.statusCode || response.status){ //error?
						return reject(response.statusCode || response.status);
					}
				  	resolve(response);
				});
			});
		},

		remove: function(id, isServerCall){

			if (id === undefined) {
				return Promise.reject(new Error("'id' not specified"));
			} 

			return new Promise(function(resolve, reject) {

				if(isServerCall){
					return resolve(id);
				}

				var url = endpoint + "/"+ id;
				socket.delete(url, function (response) {
					if(response.statusCode || response.status){ //error?
						return reject(response.statusCode || response.status);
					}
					//a bit ackward: it would be cool to be able to return deleted doc
					//but then that's not in line with serverCall
					//which is essential for all clients (the one hhaving initiated and the
					//other following) behaving in the exact same manner
					//
					//TODO: it would be possible for servercall upstream to 
					//return deleted object
				  	resolve(id); 
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
			
			if(!_.isArray(docs)){
				return Promise.reject(new Error("'docs' is not an array"));
			}

			if(!_.isObject(updates)){
				return Promise.reject(new Error("'updates' is not an object"));
			}

			if (!docs.length) {
				return Promise.resolve();
			}

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

		

		/**
		 * This implementation only uses ids to delete. 
		 * In the future we may implement optimistic versioning which would also need '_rev' per doc
		 * @param  {[type]} docs array of documents. 
		 * @return {[type]}      [description]
		 */
		removeMulti: function(docs){
			

			if(!_.isArray(docs)){
				return Promise.reject(new Error("'docs' is not an array"));
			}
			
			if (!docs.length) {
				return Promise.resolve();
			}

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

	//////////////////////
	console.log("** Registered Repository: " + config.name + " *************");
	console.log("**** adapter: " + this.adapterName + ((config.adapterIsDefault) ? " (default)": ""));
	console.log("**** live updates from server: " + ((config.live)? "yes": "no"));
	if(config.cache){
		console.log("**** cached: yes");
		return cacheProxy(adapter);
	}else{
		console.log("**** cached: no");
		return adapter;
	}

};

module.exports = sailsSocketFN;