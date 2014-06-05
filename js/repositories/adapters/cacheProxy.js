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
 * @return {[type]}        [description]
 */
var cacheProxyFN = function(adapterToWrap){

	var adapter = {

		adapter: adapterToWrap,

		docs: undefined,

		// when adapter signals error -> repopulate in-mem todos
		// this effectively functions as a rollback 
		_rollbackAfterConflict: function(err) {
			console.log(this);
			console.log(err);
			console.log("rolling back...");
			this.docs = undefined; //clear cache so fetchall is performed from remote
			return this.find();
		},

		/**
		 * This wraps a call to the proxied adapter into the body of a promise. 
		 * This ensures rejects (as well as throws on the current tick) are correctly 
		 * caught so a rollback can be performed
		 * @param  {[type]} thenFN [description]
		 * @return {[type]}        [description]
		 */
		_wrapWithPromise: function(thenFN){
			return new Promise(function(resolve, reject){
				thenFN().then(function(result){
					resolve(result);
				})["catch"](function(err){
					reject(err);
				});
			})["catch"](this._rollbackAfterConflict);
		},


		find: function() {
			var that = this;
			var orderById = function(result) {
				result = _.sortBy(result, function(row) {
					return row.id;
				});
				// result.reverse();
				return result;
			};

			if (!this.docs) {
				return that.adapter.find().then(function(result) {
					var docs = result;
					that.docs = _.zipObject(_.pluck(docs, 'id'), docs);

					result = orderById(result);
					return result;
				});
			} else {
				var result = _.map(_.values(that.docs));

				result = orderById(result);
				return Promise.resolve(result);
			}
		},

		//requires in-mem store to be populated!
		get: function(id) {
			if(id === undefined){
				return Promise.reject(new Error("'id' not specified"));
			}
			return Promise.resolve(this.docs[id]);
		},

		/**
		 * create can be used to create doc WITHOUT id.
		 * @param  {[type]} doc [description]
		 * @return {[type]}     [description]
		 */
		create: function(doc, isServerCall){
			if(!_.isObject(doc)){
				return Promise.reject(new Error("'doc' is not an object"));
			}
			var that = this;

			return this._wrapWithPromise(function(){
				return that.adapter.create(doc, isServerCall);
			}).then(function(result) {
				that.docs[result.id] = result;
			});
		},
		

		/**
		 * update existing doc (id should be passed)
		 * @param  {[type]} partial [description]
		 * @param  {[type]} id      [description]
		 * @param  {[type]} rev     [description]
		 * @return {[type]}         [description]
		 */
		update: function(id, partial, isServerCall) {
			
			if (id === undefined) {
				return Promise.reject(new Error("'id' not specified"));
			} 
			if (!_.isObject(partial)) {
				return Promise.reject(new Error("'partial' is not an object"));
			} 

			var doc = this.docs[id];

			if (doc === undefined) {
				return Promise.reject(new Error("doc not found"));
			}
			
			doc = this.docs[id] = _.extend(doc, partial);

			var that = this;
			return this._wrapWithPromise(function(){
				return that.adapter.update(id, partial, isServerCall);
			}).then(function(createdDoc) {
				
				//mixin some server generated props such as 'createdAt', etc.
				_.extend(doc, createdDoc);

			});
		},

		remove: function(id, isServerCall) {

			if (id === undefined) {
				return Promise.reject(new Error("'id' not specified"));
			} 

			var that = this;
			delete this.docs[id];

			return this._wrapWithPromise(function(){
				return that.adapter.remove(id, isServerCall);
			});
		},



		updateMulti: function(docs, updates) {
			var that = this;

			if(!_.isArray(docs)){
				return Promise.reject(new Error("'docs' is not an array"));
			}

			if(!_.isObject(updates)){
				return Promise.reject(new Error("'updates' is not an object"));
			}

			if (!docs.length) {
				return Promise.resolve();
			}

			_.each(docs, function(doc) {
				_.extend(doc, updates);
			});

			return this._wrapWithPromise(function(){
				return that.adapter.updateMulti(docs, updates);
			}).then(function(result) {
				
				_.each(result, function(changedDoc) {
					_.extend(docs[changedDoc.id], changedDoc);
				});

			});
		},

		

		/**
		 * remove the documents passed by param 'docs'.
		 * First the docs are deleted locally after which the remote removeMulti is called.
		 * @param  {[type]} docs [description]
		 * @return {[type]}      [description]
		 */
		removeMulti: function(docs) {

			
			if(!_.isArray(docs)){
				return Promise.reject(new Error("'docs' is not an array"));
			}

			if (!docs.length) {
				return Promise.resolve();
			}

			var that = this;
			_.each(docs, function(doc) {
				delete that.docs[doc.id];
			});
			
			return this._wrapWithPromise(function(){
				return that.adapter.removeMulti(docs);
			});
		}
	};
	_.bindAll(adapter);
	return adapter;

};

module.exports = cacheProxyFN;