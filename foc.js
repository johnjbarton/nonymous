// See license.txt, BSD
// Copyright 2011 johnjbarton@google.com

/*
 * Implementation of Function-object Consumption algorithm for Naming Anonymous JavaScript Functions.
 *  
 */
var uglifoc = {
  foc: function(node, next) {
    if (node.type ==="function") {
      console.log("ulgifoc.foc "+node.type+" has parent:"+(node.parent?node.parent.type:"none"), node);
    }
    return next();
  }
};