"use strict";

/**
 * Copyright 2013-2014 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * TodoStore
 */

var _ = require("lodash");

var merge = require('react/lib/merge');

var AbstractStore = require('./AbstractStore');

var Promise = require('es6-promise').Promise;

var TodoConstants = require('../constants/TodoConstants');

var PouchDB = require('pouchdb');
var db = new PouchDB('todos');
var remoteCouch = false;

//simple implementation to check if bad performance is indeed due to pouchDB
// var todos = {};
// var db = {
//   allDocs: function(){
//     var result = {
//       rows : _.map(_.values(todos), function(todo){
//         return {doc: todo};
//       })
//     };
//     return Promise.resolve(result);
//   },
//   put: function(partial, id){
//     if(!id){
//       //new
//       todos[partial._id] = partial;
//       return Promise.resolve(partial);
//     }else{
//       //change existing
//       var todo = todos[id];
//       if(!todo){
//         return Promise.reject("doc not found");
//       }
//       todos[id] = _.merge(todo, partial);
//       return Promise.resolve(todos[id]);
//     }
//   },
//   get: function(id){
//     return Promise.resolve(todos[id]);
//   },
//   remove: function(id){
//     var todo =  todos[id];
//     delete todos[id];
//     return Promise.resolve(todo);
//   },
//   bulkDocs: function(docs){
//     if(!docs.length){
//       return Promise.resolve();
//     }
//     _.each(docs, function(doc){
//       if(doc._deleted){
//         delete todos[doc.id];
//       }else{
//         todos[doc.id] = doc;
//       }
//     }); 
//     return Promise.resolve(docs);
//   }
// };


//allDocsCache cache
var allDocsCache;

/**
 * Create a TODO item.
 * @param  {string} text The content of the TODO
 */
function create(text) {
  allDocsCache = undefined;
  var todo = {
    _id: new Date().toString('T'), //time now in string
    complete: false,
    text: text
  };
 
  return db.put(todo); //put requires a new _id

  //return db.post(todo);
}

/**
 * Update a TODO item.
 * @param  {string} id 
 * @param {object} updates An object literal containing only the data to be 
 *     updated.
 */
function update(id, updates) {

  allDocsCache = undefined;

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
}

/**
 * Update all of the TODO items with the same object. 
 *     the data to be updated.  Used to mark all TODOs as completed.
 * @param  {object} updates An object literal containing only the data to be 
 *     updated.

 */
function updateAll(updates) {

  allDocsCache = undefined;

  return getAllDocs().then(function(docs){
    docs = _.map(docs, function(doc){
      return _.merge(doc, updates);
    });
    return db.bulkDocs(docs);
  });
}

//Get the doc given id. This is needed because we need to specify a _rev of optimistic versioning.
//Use the _rev and id to remove the document.
//If doc not found OR anything goes wrong -> handled upstream by promise catch
function destroy(id) {
  allDocsCache = undefined;

  return db.get(id).then(function(todo){
    if(!todo){
      throw new Error("doc not found: " + id);
    }
    return db.remove(id, todo._rev);
  });
}

/**
 * Delete all the completed items.
 */
function destroyMulti(where) {
  allDocsCache = undefined;

  var deleteObj =  {_deleted: true};
  return (where ? getDocs(where) : getAllDocs()).then(function(docs){
    docs = _.map(docs, function(doc){
      return _.merge(doc,deleteObj);
    });
    return db.bulkDocs(docs);
  });
}


function getAllDocs(){

  //if cache not dirty -> return cache
  if(allDocsCache) {
    console.log("serving getAllDocs from cache");
    return Promise.resolve(allDocsCache);
  }

  //if cache empty -> getDocs and fill cache
  return getDocs().then(function(docs){
    allDocsCache = docs;
    return docs;
  });
}

function getDocs(where){
  var start = Date.now();
  return db.allDocs({include_docs: true}).then(function(result){
    console.log((where ? "getDocs" : "getAllDocs") + " took " + (Date.now() - start) + " millis");
    var docs =  _.map(_.pluck(result.rows, "doc"), function(doc){
      return _.merge(doc, {id: doc._id});
    });
    if(where){
      docs = _.where(docs, where);
    }
    return docs;
  });
}

function getDocsMap(where){
  return (where ? getDocs(where) : getAllDocs()).then(function(docs){
    return _.zipObject(_.pluck(docs, '_id'), docs);
  });
}


var TodoStore = merge(AbstractStore, {

  CHANGE_EVENT:'change',

  name: "todo",
  
  constants: TodoConstants,

  /**
   * Tests whether all the remaining TODO items are marked as completed.
   * @return {booleam}
   */
  areAllComplete: function(cb) {
    return getAllDocs().then(function(docs){
      var allComplete = docs.length === _.where(docs, {complete: true}).length;
      return cb(undefined, allComplete);
    })["catch"](function(err){
      cb(err);
    });
  },

  /**
   * Get the entire collection of TODOs.
   * @return {object}
   */
  getAll: function(cb) {
    getAllDocs().then(function(docs){
      var docsMap =  _.zipObject(_.pluck(docs, '_id'), docs);
      cb(undefined,docsMap);
    }).catch(function(err){
      cb(err);
    });
  },

  //declarative actions. 
  //These are checked to exist (both the keys as the values)
  //values be also be of format function
  //or may be an object which in turn must contain a `fn` property
  //which must be a string or a function
  //
  //The object notation allows for more elaborate things to be declared
  //such as async and optimistic operation.
  actions: {
    "TODO_CREATE": {
      fn: "onTodoCreate",
      async: true
    },
    "TODO_TOGGLE_COMPLETE_ALL":{
      fn:  "onTodoToggleCompleteAll",
      async: true
    },
    "TODO_UNDO_COMPLETE": {
      fn: "onTodoUndoComplete",
      async: true,
    },
    "TODO_COMPLETE": {
      fn: "onTodoComplete",
      async: true
    },
    "TODO_UPDATE_TEXT": {
      fn: "onTodoUpdateText",
      async: true
    },
    "TODO_DESTROY": {
      fn: "onTodoDestroy",
      async: true
    },
    "TODO_DESTROY_COMPLETED": {
      fn: "onTodoDestroyCompleted",
      async: true
    }
  },

  ////////////////////
  // Action methods 
  // 
  // Action methods may be sync or async
  // If async, they need to return a promise
  // This is checked on init (as part of AbstractStore)
  ////////////////////
  
  onTodoCreate: function(action){
    var text = action.text.trim();
    if (text === '') {
      throw new Error("onTodoCreate shouldn't be called with empty text!");
    }
    return create(text);
  },

  onTodoToggleCompleteAll: function(action){
    return TodoStore.areAllComplete(function(err, allComplete){
      if(err) throw err;
      if (allComplete) {
        return updateAll({complete: false});
      } else {
        return updateAll({complete: true});
      }
    });
  },

  onTodoUndoComplete: function(action){
    return update(action.id, {complete: false});
  },

  onTodoComplete: function(action){
    return update(action.id, {complete: true});
  },

  onTodoUpdateText: function(action){
    var text = action.text.trim();
    if (text !== '') {
      return update(action.id, {text: text});
    }
  },

  onTodoDestroy: function(action){
    return destroy(action.id);
  },

  onTodoDestroyCompleted: function(action){
    return destroyMulti({complete: true});
  },
});

//NOTE: don't do bindAll for action methods (onX), since this 
//fails inspection when testing for nr of params (async vs sync check)
_.bindAll(TodoStore,["successCb","optimisticCb","failCb","emitChange"]);

module.exports = TodoStore;
