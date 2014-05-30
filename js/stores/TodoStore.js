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

var TodoConstants = require('../constants/TodoConstants');

var TodoRepo = require("../repositories/TodoRepository");

var TodoStore = merge(AbstractStore, {

  CHANGE_EVENT:'change',

  name: "todo",
  
  constants: TodoConstants,

  /**
   * Tests whether all the remaining TODO items are marked as completed.
   * @return {booleam}
   */
  areAllComplete: function(cb) {
    return TodoRepo.getDocs().then(function(docs){
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
    TodoRepo.getDocs().then(function(docs){
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
      async: true,
      optimistic: true
    },
    "TODO_TOGGLE_COMPLETE_ALL":{
      fn:  "onTodoToggleCompleteAll",
      async: true,
      optimistic: true
    },
    "TODO_UNDO_COMPLETE": {
      fn: "onTodoUndoComplete",
      async: true,
      optimistic: true
    },
    "TODO_COMPLETE": {
      fn: "onTodoComplete",
      async: true,
      optimistic: true
    },
    "TODO_UPDATE_TEXT": {
      fn: "onTodoUpdateText",
      async: true,
      optimistic: true
    },
    "TODO_DESTROY": {
      fn: "onTodoDestroy",
      async: true,
      optimistic: true
    },
    "TODO_DESTROY_COMPLETED": {
      fn: "onTodoDestroyCompleted",
      async: true,
      optimistic: true
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
    return TodoRepo.create(text);
  },

  onTodoToggleCompleteAll: function(action){
    return TodoStore.areAllComplete(function(err, allComplete){
      if(err) throw err;
      if (allComplete) {
        return TodoRepo.updateAll({complete: false});
      } else {
        return TodoRepo.updateAll({complete: true});
      }
    });
  },

  onTodoUndoComplete: function(action){
    return TodoRepo.update(action.id, {complete: false});
  },

  onTodoComplete: function(action){
    return TodoRepo.update(action.id, {complete: true});
  },

  onTodoUpdateText: function(action){
    var text = action.text.trim();
    if (text !== '') {
      return TodoRepo.update(action.id, {text: text});
    }
  },

  onTodoDestroy: function(action){
    return TodoRepo.destroy(action.id);
  },

  onTodoDestroyCompleted: function(action){
    return TodoRepo.destroyMulti({complete: true});
  },
});

_.bindAll(TodoStore);

module.exports = TodoStore;
