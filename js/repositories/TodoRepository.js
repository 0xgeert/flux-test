"use strict";

var Promise = require('es6-promise').Promise;

var _ = require("lodash");

var PouchDB = require('pouchdb');
var dbPouch = new PouchDB('todos');
var remoteCouch = false;


// when pouch signals error -> repopulate in-mem todos
// this effectively functions as a rollback 
var rollbackAfterConflict = function(err){
	console.log(err);
	console.log("rolling back...");
	todos = undefined; //clear cache
	return db.allDocs({include_docs: true});
};

//simple implementation to check if bad performance is indeed due to pouchDB
var db = dbPouch;
var todos;
db = {

  allDocs: function(opts){
  	if(!todos){
  		// console.log("remote lookup");
  		return dbPouch.allDocs(opts).then(function(result){
  			console.log(result);
  			var docs = _.pluck(result.rows, "doc");
  			todos = _.zipObject(_.pluck(docs, '_id'), docs);
  			console.log(todos);
  			return result;
  		});
  	}else{
  		// console.log("local lookup");
  		var result = {
	      rows : _.map(_.values(todos), function(todo){
	        return {doc: todo};
	      })
	    };
	    return Promise.resolve(result);
  	}
  },

  put: function(partial, id, rev){

  	var doc;
    if(!id){
      //new
      todos[partial._id] = partial;
      doc = partial; 
    }else{
      //change existing
      var todo = todos[id];
      if(!todo){
        return Promise.reject("doc not found");
      }
      doc = todos[id] = _.merge(todo, partial);
    }

    console.log("local create/put done");
    //in all cases update pouch
    return dbPouch.put(doc, id, rev).then(function(result){
    	console.log("remote create/put done");
    	//update cache with changed/created rev and id which may not yet exist
    	doc._rev = result.rev;
    	doc.id = result.id;
    })["catch"](rollbackAfterConflict);
  },
  //requires in-mem store to be populated!
  get: function(id){
  	//always fetch on in-mem store
    return Promise.resolve(todos[id]);
  },

  remove: function(id, rev){
  	if(rev === undefined){
  		throw new Error("rev needs to be defined when calling store.remove");
  	}
    delete todos[id];
    console.log("local remove done");
    return dbPouch.remove(id, rev)["catch"](rollbackAfterConflict);
  },

  bulkDocs: function(docs){
    if(!docs.length){
      return Promise.resolve();
    }
    _.each(docs, function(doc){
      if(doc._deleted){
      	//delete
        delete todos[doc.id];
      }else{
      	//update
        todos[doc.id] = doc;
      }
    }); 

    console.log("local bulk done");
    return dbPouch.bulkDocs(docs).then(function(result){
    	//update cache with changed rev
    	_.each(result, function(changedDoc){
    		var doc = todos[changedDoc.id];
    		if(doc){
    			doc._rev = changedDoc.rev;
    		}
    	});
    })["catch"](rollbackAfterConflict);
  }
};

var TodoRepo = {

	/**
	 * Create a TODO item.
	 * @param  {string} text The content of the TODO
	 */
	create: function(text) {
	  var todo = {
	    _id: new Date().toString('T'), //time now in string
	    complete: false,
	    text: text
	  };
	 
	  return db.put(todo); //put requires a new _id

	  //return db.post(todo);
	},

	/**
	 * Update a TODO item.
	 * @param  {string} id 
	 * @param {object} updates An object literal containing only the data to be 
	 *     updated.
	 */
	update: function(id, updates) {


	  //Get the doc given id. This is needed because we need to specify a _rev of optimistic versioning.
	  //Use the _rev and id to update the document.
	  //If doc not found OR anything goes wrong -> handled upstream by promise catch
	  return db.get(id).then(function(todo){
	    if(!todo){
	      throw new Error("doc not found: " + id);
	    }
	    todo = _.merge(todo, updates);
	    return db.put(todo, id, todo._rev);
	  });
	},

	/**
	 * Update all of the TODO items with the same object. 
	 *     the data to be updated.  Used to mark all TODOs as completed.
	 * @param  {object} updates An object literal containing only the data to be 
	 *     updated.

	 */
	updateAll: function(updates) {

	  return this.getDocs().then(function(docs){
	    docs = _.map(docs, function(doc){
	      return _.merge(doc, updates);
	    });
	    return db.bulkDocs(docs);
	  });
	},

	//Get the doc given id. This is needed because we need to specify a _rev of optimistic versioning.
	//Use the _rev and id to remove the document.
	//If doc not found OR anything goes wrong -> handled upstream by promise catch
	destroy: function(id) {

	  return db.get(id).then(function(todo){
	    if(!todo){
	      throw new Error("doc not found: " + id);
	    }
	    return db.remove(id, todo._rev);
	  });
	},

	/**
	 * Delete all the completed items.
	 */
	destroyMulti: function(where) {

	  var deleteObj =  {_deleted: true};
	  return this.getDocs(where).then(function(docs){
	    docs = _.map(docs, function(doc){
	      return _.merge(doc,deleteObj);
	    });
	    return db.bulkDocs(docs);
	  });
	},

	getDocs: function(where){
	  // var start = Date.now();
	  return db.allDocs({include_docs: true}).then(function(result){
	    // console.log("getDocs took " + (Date.now() - start) + " millis");
	    var docs =  _.map(_.pluck(result.rows, "doc"), function(doc){
	      return _.merge(doc, {id: doc._id});
	    });
	    if(where){
	      docs = _.where(docs, where);
	    }
	    return docs;
	  });
	},

	getDocsMap: function(where){
	  return this.getDocs(where).then(function(docs){
	    return _.zipObject(_.pluck(docs, '_id'), docs);
	  });
	}

};

module.exports = TodoRepo;

