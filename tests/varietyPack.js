// see ../license.txt, BSD
// Copyright 2001 Google, Inc. johnjbarton@google.com
  var main = function() {        // 1. main
   var foo = new Foo(
      function(){                // 2. main/foo<
        this.welcome = "Hi!";
      });
   var bar = new Bar("GoodBye.");
   console.log(foo.welcome);
   console.log(bar.message);
  };
  var Foo = function(){          // 3. Foo<
    var instances;
    return function(initializer){     // 4. Foo
        instances++;
        initializer.apply(this);
      };
  }();
  var Baz = Bar = function(msg){  // 5. Bar
    this.message = msg;
  }


// Case 1: Object Property Initializer

var anObject = {
  aPropertyInitialized: function() {
    return true;
  }
};



var x = 1;
x = function(){};
// x

x = window.addEventListener("something", {onFoo: function(){}});
// x<onFoo

x = window.addEventListener('load', function(event) {}, false);
// x<(load-fal)

addEventListener('load', function(event) {}, false);
// addEventListener(load-fals);

