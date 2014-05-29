

/**
 * This mixin can be pased to a Controller-View 
 * (i.e: the toplevel view communicating with stores and passing down state)
 *
 * With this mixin the Controller-view <--> Store communication is abstracted away as such: 
 *
 * - A function `getStoreState` is needed on the Controller view
 * - A prop `stores` (single obj or array) is needed on the Controller view
 * - A function `_onChange` is  needed on the Controller view
 *
 * - This `getStoreState` is called on `getInitialState`
 * - `getStoreState` may contain properties from every store in `this.stores`
 * - the Controller-View registers a ChangeListener on every store defined in `this.stores`
 * - this ChangeListener does a `setState(getStoreState())`
 *
 * This is useful for stores to automatically register ChangeListener events. 
 * 
 * NOTE: if a store implements other notifications besides 'change' these may be registered in addition
 * by implementing addXListnerner / removeXListener in componentDidMount and componentWillUnmount respectively.
 * 
 * @type {Object}
 */
var SimpleChangeControllerViewMixin = {

  getInitialStateAsync: function(cb) {
    this.getStoreState(cb);
  },

  componentDidMount: function() {
    var that = this;
    this.stores.forEach(function(store){
      store.addChangeListener(that._onChange);
    });
  },

  componentWillUnmount: function() {
    var that = this;
    this.stores.forEach(function(store){
      store.removeChangeListener(that._onChange);
    });
  },

  /**
   * Event handler for 'change' events coming from the TodoStore
   */
  _onChange: function() {
    var that = this;
    this.getStoreState(function(err, data){
      if(err) throw err;
      that.setState(data);
    });
  }
};

module.exports = SimpleChangeControllerViewMixin;

