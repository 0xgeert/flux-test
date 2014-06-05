"use strict";


var _ = require("lodash");
var Promise = require('es6-promise').Promise;

var adapterFN = require("./sails-socket");

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
var cacheProxyFN = function(config){

	var col = config.collection;
	if(col === undefined){
		throw new Error("collection is not defined for sails-socket adapter");
	}

	//switch to signal if documents need revisions for UD updates.
	var revNeeded = config.revNeeded;

	var adapter = {

		adapter: adapterFN(_.extend({
			collection: config.collection
		}, config.adapter || {})),

		
		docs: undefined,

		// when adapter signals error -> repopulate in-mem todos
		// this effectively functions as a rollback 
		rollbackAfterConflict: function(err) {
			console.log(this);
			console.log(err);
			console.log("rolling back...");
			this.docs = undefined; //clear cache so fetchall is performed from remote
			return this.fetchAll();
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
			//always fetch on in-mem store
			return Promise.resolve(this.docs[id]);
		},

		/**
		 * create can be used to create doc WITHOUT id.
		 * @param  {[type]} doc [description]
		 * @return {[type]}     [description]
		 */
		create: function(doc){
			var that = this;
			return that.adapter.create(doc).then(function(result) {
				that.docs[result.id] = result;
			})["catch"](this.rollbackAfterConflict);
		},

		/**
		 * update existing doc (id should be passed)
		 * @param  {[type]} partial [description]
		 * @param  {[type]} id      [description]
		 * @param  {[type]} rev     [description]
		 * @return {[type]}         [description]
		 */
		update: function(id, partial) {
			
			if (!id) {
				throw new Error("update should define 'id'");
			} 

			var that = this,
				doc = that.docs[id];

			if (!doc) {
				return Promise.reject("doc not found");
			}
			
			doc = that.docs[id] = _.extend(doc, partial);

			if(revNeeded && doc._rev === undefined){
				return Promise.reject("'rev' should exist on doc when calling repo.update");
			}

			return that.adapter.update(id, doc, doc._rev).then(function(createdDoc) {
				
				//mixin some server generated props such as 'createdAt', etc.
				_.extend(doc, createdDoc);

				//NOTE: relic but may be useful again
				//update cache with changed/created rev
				//doc._rev = result.rev;
				
			})["catch"](this.rollbackAfterConflict);
		},


		updateMulti: function(docs, updates) {
			var that = this;

			if (!docs.length) {
				return Promise.resolve();
			}

			try{
				_.each(docs, function(doc) {
					if(revNeeded && doc._rev === undefined){
						throw new Error("'_rev' should exist on doc when passed to updateMulti");
					}
					_.extend(doc, updates);
				});
			}catch(err){
				return Promise.reject(err);
			}

			return that.adapter.updateMulti(docs, updates).then(function(result) {
				
				_.each(result, function(changedDoc) {
					var doc = that.docs[changedDoc.id];
					if (doc) {
						_.extend(doc, changedDoc);

						//update cache with changed rev
						//NOTE: relic, but may be useful in future
						//doc._rev = changedDoc.rev;
					}
				});
			})["catch"](this.rollbackAfterConflict);
		},

		remove: function(id, rev) {

			var doc =  this.docs[id];
			delete this.docs[id];

			if (!doc) {
				throw new Error("doc not found: " + id);
			}
			if (revNeeded &&  doc._rev === undefined) {
				throw new Error("'rev' should exist on doc when calling repo.remove");
			}
			return this.adapter.remove(id, doc._rev)["catch"](this.rollbackAfterConflict);

		},

		/**
		 * remove the documents passed by param 'docs'.
		 * First the docs are deleted locally after which the remote removeMulti is called.
		 * @param  {[type]} docs [description]
		 * @return {[type]}      [description]
		 */
		removeMulti: function(docs) {
			var that = this;
			if (!docs.length) {
				return Promise.resolve();
			}
			try{
				_.each(docs, function(doc) {
					if(revNeeded && doc._rev === undefined){
						throw new Error("'_rev' should exist on doc when passed to removeMulti");
					}
					delete that.docs[doc.id];
				});
			}catch(err){
				return Promise.reject(err);
			}
			
			return that.adapter.removeMulti(docs)["catch"](this.rollbackAfterConflict);
		}
	};
	_.bindAll(adapter);
	return adapter;

};

module.exports = cacheProxyFN;