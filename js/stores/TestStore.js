

var merge = require('react/lib/merge');

var Promise = require('es6-promise').Promise;

var AbstractStore = require('./AbstractStore');

var TestStore = merge(AbstractStore, {

  CHANGE_EVENT:'change',

  callbackFN: function(payload) {
    var action = payload.action;

    return new Promise(function(resolve, reject) {

      //testing store dependency: TodoStore waiting on this store to finish
      switch(action.actionType) {
        default:
          setTimeout(function(){
            resolve();
          },10);
      }
    });

  }
});


module.exports = TestStore;
