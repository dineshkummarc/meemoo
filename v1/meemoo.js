/*

Meemoo web media wiring
  by Forrest Oliphant
    at Sembiki Interactive http://sembiki.com/
    and Media Lab Helsinki http://mlab.taik.fi/
    with Mozilla WebFWD http://webfwd.org/

Copyright (c) 2012, Forrest Oliphant

This file is part of Meemoo.
  
  Meemoo is free software: you can redistribute it and/or modify 
  it under the terms of the GNU Affero General Public License as 
  published by the Free Software Foundation, either version 3 of 
  the License, or (at your option) any later version.
  
  Meemoo is distributed in the hope that it will be useful, but 
  WITHOUT ANY WARRANTY; without even the implied warranty of 
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the 
  GNU Affero General Public License for more details.
  
  You should have received a copy of the GNU Affero General 
  Public License along with Meemoo.  If not, see 
  <http://www.gnu.org/licenses/>.
  
*/


(function (window) {
  "use strict";
  
  if (window.Meemoo) {
    // Meemoo already loaded, don't bother
    return false;
  }
  
  var meemoo = {
    parentWindow: window.opener ? window.opener : window.parent ? window.parent : void 0,
    nodeid: undefined,
    connectedTo: [],
    setInfo: function (info) {
      var i = {};
      if (info.hasOwnProperty("title")) {
        i.title = info.title;
      } else if (document.title) {
        i.title = document.title;
      }
      if (info.hasOwnProperty("author")) {
        i.author = info.author;
      } else if (document.getElementsByName("author").length > 0 && document.getElementsByName("author")[0].content) {
        i.author = document.getElementsByName("author")[0].content;
      }
      if (info.hasOwnProperty("description")) {
        i.description = info.description;
      } else if (document.getElementsByName("description").length > 0 && document.getElementsByName("description")[0].content) {
        i.description = document.getElementsByName("description")[0].content;
      }
      meemoo.info = i;
      this.sendParent("info", i);
      return meemoo;
    },
    sendParent: function (action, message){
      if (this.parentWindow) {
        var o = {};
        o[action] = message ? message : action;
        o["nodeid"] = meemoo.nodeid;
        this.parentWindow.postMessage(o, "*");
      }
    },
    send: function (action, message) {
      if ( action === undefined || this.connectedTo.length < 1 ) { 
        return; 
      }
      if (message === undefined) { message = action; }
      for (var i=0; i<this.connectedTo.length; i++) {
        if (this.connectedTo[i].source[1] === action) {
          var m;
          // Sends an object: {actionName:data}
          m = {};
          m[this.connectedTo[i].target[1]] = message;
          var toFrame = this.parentWindow.frames[this.connectedTo[i].target[0]];
          if (toFrame) {
            toFrame.postMessage(m, "*");
          } else {
            console.error("module wat "+this.nodeid+" "+this.connectedTo[i].target[0]);
          }
        }
      }
    },
    recieve: function (e) {
      var fromParent = (e.source == meemoo.parentWindow);
      if (e.data.constructor === Object) {
        for (var name in e.data) {
          if ( meemoo.inputs.hasOwnProperty(name) ) {
            meemoo.inputs[name](e.data[name], e);
          } else if ( fromParent && meemoo.frameworkActions.hasOwnProperty(name) ) {
            // Only do frameworkActions from the parent, not sibling modules
            meemoo.frameworkActions[name](e.data[name], e);
          }
        }
      }
    },
    // Inputs are functions available for other modules to trigger
    addInput: function(name, input) {
      meemoo.inputs[name] = input.action;
      
      var portproperties = {};
      portproperties.name = name;
      portproperties.type = input.hasOwnProperty("type") ? input.type : "";
      portproperties.description = input.hasOwnProperty("description") ? input.description : "";
      portproperties.min = input.hasOwnProperty("min") ? input.min : "";
      portproperties.max = input.hasOwnProperty("max") ? input.max : "";
      portproperties.options = input.hasOwnProperty("options") ? input.options : "";
      portproperties.default = input.hasOwnProperty("default") ? input.default : "";
      
      if (input.port !== false) {
        // Expose port
        this.sendParent("addInput", portproperties);
      }
      return meemoo;
    },
    addInputs: function(inputs) {
      for (var name in inputs) {
        if (inputs.hasOwnProperty(name)) {
          meemoo.addInput(name, inputs[name]);
        }
      }
      // Set all inputs, then ask for state
      this.sendParent("stateReady");
      return meemoo;
    },
    inputs: {
      
    },
    // Outputs
    addOutput: function(name, output) {
      meemoo.outputs[name] = output;
      
      if (output.port !== false) {
        // Expose port
        this.sendParent("addOutput", {name:name, type:output.type});
      }
      return meemoo;
    },
    addOutputs: function(outputs) {
      for (var name in outputs) {
        if (outputs.hasOwnProperty(name)) {
          meemoo.addOutput(name, outputs[name]);
        }
      }
      return meemoo;
    },
    outputs: {
      
    },
    frameworkActions: {
      connect: function (edge) {
        // Make sure it is unique
        for(var i=0; i<meemoo.connectedTo.length; i++) {
          var thisEdge = meemoo.connectedTo[i];
          if (thisEdge.source[0] === edge.source[0] && thisEdge.source[1] === edge.source[1] && thisEdge.target[0] === edge.target[0] && thisEdge.target[1] === edge.target[1]) {
            // Not unique
            return false;
          }
        }
        meemoo.connectedTo.push(edge);
      },
      disconnect: function (edge) {
        var results = [];
        for(var i=0; i<meemoo.connectedTo.length; i++) {
          var thisEdge = meemoo.connectedTo[i];
          // Only keep it if something is different
          if (thisEdge.source[0] !== edge.source[0] || thisEdge.source[1] !== edge.source[1] || thisEdge.target[0] !== edge.target[0] || thisEdge.target[1] !== edge.target[1]) {
            results.push(thisEdge);
          }
        }
        meemoo.connectedTo = results;
      },
      getState: function () {
        //TODO save these as they are input?
        // Send a state to parent, called when saving composition
        var state = {};
        meemoo.sendParent("state", state);
      },
      setState: function (state) {
        // Setup module with saved data matching getState() returned object
        // Called when loading composition
        for (var name in state) {
          if (meemoo.inputs.hasOwnProperty(name)) {
            meemoo.inputs[name](state[name]);
          }
        }
      }
    }
  };
  
  window.addEventListener("message", meemoo.recieve, false);
  
  // Run this every 50ms to see if document is ready, then send info to parent
  // var checkLoaded = setInterval(function(){ 
  //   if(document.body && document.getElementById){
  //     clearInterval(checkLoaded);
  //     meemoo.ready();
  //   }
  // }, 50);
  
  // If no setInfo by module after 2 seconds, send defaults
  var autoInfo = setTimeout(function(){ 
    if(document.body && document.getElementById){
      if (!meemoo.info) {
        meemoo.setInfo({});
      }
    }
  }, 2000);
  
  var showNote = function(){
    if(document.body && document.getElementById){
      var note = document.createElement("div");
      note.innerHTML = '<div style="color: #666; background-color:#FFE87C; border: 1px dotted #7d95ff; text-align:center; font-size:15px; padding:20px;">'+
        'You are looking are a Meemoo module that should be loaded in a Meemoo app.<br />'+ 
        'Check out <a href="http://meemoo.org/iframework/">meemoo.org/iframework</a> to see how it works. &lt;3'+
        '</div>';
      document.body.appendChild(note);
    } else {
      // body isn't ready, try again
      setTimeout(showNote, 100);
    }
  };

  // Set id from frame name frame_id
  if(window.name) {
    var id = window.name.split("_")[1];
    id = parseInt(id, 10);
    meemoo.nodeid = id;
  } else {
    // not in iframework, display message
    setTimeout(showNote, 100);
  }

  
  // Expose Meemoo to the global object
  window.Meemoo = meemoo;
  
})(window);
