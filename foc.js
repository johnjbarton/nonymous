// See license.txt, BSD
// Copyright 2011 johnjbarton@google.com

/*
 * Implementation of Function-object Consumption algorithm for Naming Anonymous JavaScript Functions.
 *  
 */
var Uglifoc = {
    debug: true,
};

function getType(statement) {
  return statement[0];
}

// ------------------------------------------------------------------------------------------------
// Root to leaf pass, from statements to branches looking for functions

Uglifoc.FunctionNamer = function() {
  
  // ----------------------------------------------------------------------------------------------
  // As we descend we record the path back to the root. When reversed this gives the 
  // parents of the function node at the time we find it. That way we don't need to 
  // make a pass over the tree to set the parent points and we don't have to store them.
  //
  var namingStack = [];  
  
  function pushParent(uglyArray) {
    namingStack.push(uglyArray);
    if (Uglifoc.debug) {
      console.log("namingStack("+namingStack.length+") pushed "+uglyArray[0]);
    }
  }

  function popParent() {
    var popped = namingStack.pop();
    if (Uglifoc.debug) console.log("namingStack("+(namingStack.length)+") popped "+popped[0]);
  }
  
  // ----------------------------------------------------------------------------------------------
  // BranchActions
  
  var LITERAL = function(val) {
    // Literal nodes have no functions
    return;   
  };
  
  var NODE = function(val) {
    // recurse in to children
    seekFunctionsInStatement(val);
  };
  
  var ARRAY = function(val) {
    // recurse into entries
    seekFunctionsInStatements(val);
  };
  
  var PAIRS = function(val) {
    // recurse into children
    seekFunctionsInStatements(val);
  };

  var CATCH = function(val) {
    // TODO rewrite as ['catch', 'name', 'block']
    pushParent(val[0]);
    seekFunctionsInStatements(val[1]);
    popParent();
  };
  
  var CASES = function(cases) {
    // re-write the node to expand it
    var caseStatements = [];
    for (var i = 0; i < cases.length; i++) {
      var aCase = cases[i];
      // ['case', 'condition',  'block']
      var caseStatement = ['case', aCase[0], aCase[1]];
      caseStatements.push(caseStatement);
    }
    seekFunctionsStatements(caseStatements);
  };
  
  var DECLS = function(declarations) {
    // eg: var Baz = Bar = function() {};
    for (var i = 0; i < declarations.length; i++) {
      var declaration = declarations[i];
      
      var statement = declaration[1];  // each decl has a name an
      if (statement) {
        var decl = ['decl'].concat(declaration);
        seekFunctionsInStatement(decl);
      }  // else declaration with no initializer, eg  var foo; 
    }
  };
  //-----------------------------------------------------------------------------------------------
  // To find functions we walk the syntax tree from the root downward.
  // For each node in the syntax tree we look up the node type (cell 0) in the typeToBranch table
  // and then operate on the node's branch data (cell 1,...) based on the entry. Each entry has two 
  // values for each branch data value: a label for the branch and an action for that branch.
  // Blocks, array entries, declaration lists, switch cases, and catch clauses are all special 
  // cases. The listy special cases are array of arrays (.length but no type at [0]).
  // This entire approach copies https://github.com/joehewitt/transformjs/lib/transformjs.js
  
  var typeToBranch = {  // BranchName/BranchAction for each Uglify statement type
    'num': ['value', LITERAL],
    'string': ['value', LITERAL],
    'regexp': ['value', LITERAL, 'flags', LITERAL],
    'array': ['items', ARRAY],
    'object': ['items', PAIRS],
    'name': ['name', LITERAL],
    'stat': ['expr', NODE],
    'block': ['statements', ARRAY],
    'var': ['decls', DECLS],
    'decl': ['left', LITERAL, 'right', NODE],
    'pair': ['left', LITERAL, 'right', NODE],
    'assign': ['um', LITERAL, 'left', NODE, 'right', NODE],
    'unary-prefix': ['op', LITERAL, 'expr', NODE],
    'unary-postfix': ['op', LITERAL, 'expr', NODE],
    'binary': ['op', LITERAL, 'left', NODE, 'right', NODE],
    'conditional': ['condition', NODE, 'ifBlock', NODE, 'elseBlock', NODE],
    'call': ['left', NODE, 'args', ARRAY],
    'new': ['expr', NODE, 'args', ARRAY],
    'dot': ['left', NODE, 'right', LITERAL],
    'sub': ['left', NODE, 'right', NODE],
    'defun': ['name', LITERAL, 'args', LITERAL, 'block', ARRAY],
    'function': ['name', LITERAL, 'args', LITERAL, 'block', ARRAY],
    'return': ['expr', NODE],
    'continue': [],
    'break': [],
    'if': ['condition', NODE, 'ifBlock', NODE, 'elseBlock', NODE],
    'for-in': ['iter', NODE, 'left', NODE, 'right', NODE, 'block', NODE],
    'for': ['init', NODE, 'condition', NODE, 'increment', NODE, 'block', NODE],
    'while': ['condition', NODE, 'block', NODE],
    'try': ['try', ARRAY, 'catch', CATCH, 'finally', ARRAY],
    'switch': ['expr', NODE, 'cases', CASES],
    'label': ['name', LITERAL],
    'case': ['condition', NODE, 'block', NODE],  // ast is dynamically extended to add this node
   };

  //-----------------------------------------------------------------------------------------------

  // As we walk down we find functions and process them into names here.
  //
  function setFunctionName(statement) {
    if (Uglifoc.debug) {
      var msg = "setFunctionName found a function when naming stack depth "+namingStack.length+"[";
      namingStack.forEach(function pushName(uglyArray){
        msg += uglyArray[0]+", ";
      });
      msg += "]";
      console.log(msg, {namingStack:namingStack});
    }
    var name = Uglifoc.ExpressionNamer.foc(statement, namingStack.slice(0).reverse());
    console.log(" and the name is.... "+name);
  }
  
  function getBranches(statement) {
    return typeToBranch[getType(statement)];
  }
 
  function seekFunctionsInStatement(statement) {
    if (getType(statement) === 'function') {
      setFunctionName(statement);
    }

    var branches = getBranches(statement);
    if (!branches) {
      console.log("Uglifoc ERROR: no branches for statement "+statement);
      if (Uglifoc.debug) debugger;
      return;
    }
    
    // establish the current parent for the branch processing
    pushParent(statement);  
    
    // iterate the branches and statement parts in tandem
    var statementPartIndex = 1; // [0] is the typeName
    for (var i = 0; i < branches.length; i += 2)
    {
      var statementPart = statement[statementPartIndex++];
      if (statementPart) {
        var branchName = branches[i];           // eg 'condition' for first branch of 'if'
        var branchAction = branches[i+1];       // eg NODE for first branch of 'if;'
        branchAction(statementPart);
      } // else null function name or var without initiailizer...
    }
    // all branches at this level are done.
    popParent();
  }
  
  // Blocks, decls, case switch statements
  function seekFunctionsInStatements(statements) {
    for (var i = 0; i < statements.length; i++) {
      var statement = statements[i];
      seekFunctionsInStatement(statement);
    }
  }
  
  // ----------------------------------------------------------------------------------------------
  
  function getNames(ast) {
    seekFunctionsInStatements(ast[1]); // "toplevel" is one statement
  }

  return {getNames: getNames};
}();

Uglifoc.ExpressionNamer = function() {
  //------------------------------------------------------------------------------------------------
  // Code generation: walk a node to convert an expression to a name for an expression
  //
  // BranchActions
  
  var getLiteral = function(uglyArray) {
    return uglyArray[1];
  }
  
  var reportError = function(uglyArray) {
    console.error("Function naming algorithm error, no expression algorithm for node ", uglyArray[0]);
    throw new Error("Function naming algorithm error, no expression algorithm for node "+uglyArray[0]);
    // or just return 'failed'
  }
  
  var unaryPrefix = function(uglyArray) {
    return uglyArray[1] + generateName(uglyArray[2]);
  }
  
  var unaryPostfix = function(uglyArray) {
    return generateName(uglyArray[2]) + uglyArray[1];
  }
  
  var binary = function(uglyArray) {
    return generateName(uglyArray[2]) + uglyArray[1] + generateName(uglyArray[3]);
  }
  
  var conditional = function(uglyArray) {
    return generateName(uglyArray[2]) + ":" + generateName(uglyArray[3]);
  }
  
  var callFunction = function(uglyArray) {
    return generateName(uglyArray[1]) + "(" + generateName(uglyArray[2]) + ")";
  }
  
  var getProp = function(uglyArray) {
    return generateName(uglyArray[1]) + uglyArray[2];
  }
  
  var getElem = function(uglyArray) {
    return generateName(uglyArray[1]) + generateName(uglyArray[2]);
  }
  
  // ----------------------------------------------------------------------------------------------
  // To create a function name we need to convert expressions to strings. This table maps 
  // ast nodes into functions that generate names as we walk the expression node
  //
  
  var parentTypeToExpressionGenerator = {  // BranchName/NamingAction for each Uglify statement type
    'num': getLiteral,
    'string': getLiteral,
    'regexp': reportError,
    'array': reportError,
    'object': reportError,
    'name': getLiteral,
    'stat': reportError,
    'block': reportError,
    'var': reportError,
    'decl': reportError,
    'pair': reportError,
    'assign': reportError,
    'unary-prefix': unaryPrefix,
    'unary-postfix': unaryPostfix,
    'binary': binary,
    'conditional': conditional,
    'call': callFunction,
    'new': reportError,
    'dot': getProp,
    'sub': getElem,
    'defun': reportError,
    'function': reportError,
    'return': reportError,
    'continue': reportError,
    'break': reportError,
    'if': reportError,
    'for-in': reportError,
    'for': reportError,
    'while': reportError,
    'try': reportError,
    'switch': reportError,
    'label': reportError,
    'case': reportError,  // ast is dynamically extended to add this node
  };

  // Section 5.3 Identifiers for Assignments and Function Calls.
  // Uglify defines declarations with '=' operators as 'decl' rather than 'assign', 
  // so we add a case
  function getNameExpression(declFunctionCallOrAssignment) {
    var name = "";
    var type = declFunctionCallOrAssignment[0];
    if (type === 'decl') { // 'decl': ['left', LITERAL, 'right', NODE],
      // 'left node is literal, just return it as name
      var name = declFunctionCallOrAssignment[1];   
      return name;
    } else if (type === 'assign') {     // 'assign': ['um', LITERAL, 'left', NODE, 'right', NODE],
      // build name from 'left' node, see table 4, case 3
      var nameBranch = declFunctionCallOrAssignment[2]; 
      return generateName(nameBranch);
    } else if (type === 'call' ) {     // 'call': ['left', NODE, 'args', ARRAY],
      // build name from 'left' node, see table 4, case 2
      var nameBranch = declFunctionCallOrAssignment[1]; 
      return generateName(nameBranch);
    } else {
      console.log("getNameExpression ERROR not decl, function call, or assignment "+declFunctionCallOrAssignment);
      return "ERROR";
    }
  }
  
  function generateName(uglyArray) {
    var generator = parentTypeToExpressionGenerator[uglyArray[0]];
    return generator(uglyArray);
  }

  function getArgSummary(node) {
    return "we should implement getArgSummary";
  }
  
  // The possible parent node types for forming expression-names
  // The order and format of this array is intended to follow the typeMaps for documentation
  var expressionNodeNames = [
    // 'num': ['value', LITERAL],  can't be a parent 
    // 'string': ['value', LITERAL], can't be a parent
    // 'regexp': ['value', LITERAL, 'flags', LITERAL], can't be a parent 
    'array', //: ['items', ARRAY],
    // 'object': ['items', PAIRS], can't be a parent, pair can be. 
    // 'name': ['name', LITERAL], can't be a parent 
    // 'stat', // : ['expr', NODE], statement not expression 
    // 'block', // : ['statements', ARRAY], can't be parent
    // 'var': ['decls', DECLS], can't be a parent, decl can be. 
    'decl', // : ['left', LITERAL, 'right', NODE],
    'pair', // : ['left', LITERAL, 'right', NODE],
    // 'assign': ['um', LITERAL, 'left', NODE, 'right', NODE], statement not expression 
    'unary-prefix', // : ['op', LITERAL, 'expr', NODE],
    'unary-postfix', // : ['op', LITERAL, 'expr', NODE],
    'binary', // : ['op', LITERAL, 'left', NODE, 'right', NODE],
    'conditional', // : ['condition', NODE, 'ifBlock', NODE, 'elseBlock', NODE],
    'call', // : ['left', NODE, 'args', ARRAY],
    'new', // : ['expr', NODE, 'args', ARRAY],
    'dot', // : ['left', NODE, 'right', LITERAL],
    'sub', // : ['left', NODE, 'right', NODE],
    // 'defun', // : ['name', LITERAL, 'args', LITERAL, 'block', ARRAY], function declarations are statements
    // 'function', // : ['name', LITERAL, 'args', LITERAL, 'block', ARRAY], can't be a parent. 
    // 'return': ['expr', NODE], statement not expression
    // can't be a parent 'continue': [],
    // can't be a parent 'break': [],
    // 'if': ['condition', NODE, 'ifBlock', NODE, 'elseBlock', NODE], statement not expression
    // 'for-in': ['iter', NODE, 'left', NODE, 'right', NODE, 'block', NODE], statement not expression 
    // 'for': ['init', NODE, 'condition', NODE, 'increment', NODE, 'block', NODE], statement not expression 
    // 'while': ['condition', NODE, 'block', NODE], statement not expression
    // 'try': ['try', ARRAY, 'catch', CATCH, 'finally', ARRAY], statement not expression
    // 'switch': ['expr', NODE, 'cases', CASES], statement not expression  
    // 'label': ['name', LITERAL], can't be a parent 
    // 'case': ['condition', NODE, 'block', NODE],  statement not expression 
  ];
  
  var NodeIterator = function(node, parents) {
    this.nodes = [node].concat(parents);
    this.index = 0;
  }
  
  NodeIterator.prototype = {
          
    hasNextNode: function() {
      var parentIndex = this.index + 1;
      if (parentIndex < this.nodes.length) {
        var parent = this.nodes[parentIndex];
        var parentType = getType(parent);
        if (expressionNodeNames.indexOf(parentType) === -1) {  // end of while loop
          return false;
        }
      } else {
        // We should never run out of parents because the toplevel is a statement
        // and thus should have failed the expression test.
        if (debug) {
          console.error("Uglifoc NodeIterater ran out of parents while looking at expressions", this);
        }
        throw new Error("Function naming algorithm or parser error");
      }
      return (this.index < this.nodes.length);
    },
    
    getNextNode: function() {
      var nextNode = this.nodes[this.index++]; 
      console.log("foc next node "+getType(nextNode), {nextNode: nextNode});
      
      return nextNode;
    },
    
    getParentNode: function(node) {
      var index = this.nodes.indexOf(node);
      if (index === -1 || index === (this.nodes.length - 2) ) {
        if (debug) {
          console.error("Uglifoc no parent for node", {NodeIterator: this, node: node}); 
        }
        throw new Error("Function naming algorithm error, no parent for node");
      }
      var parentNode = this.nodes[index + 1];
      if (parentNode) {
        var parentType = getType(parentNode);
        if (parentType === 'return') {  
          // special case immediate function. Are we in a function being called?
          var maybeImmediate = this.getParentNode(parentNode);
          var maybeImmediateType = getType(maybeImmediate);
          if (maybeImmediateType === "function") {
            maybeImmediate = this.getParentNode(maybeImmediate);
            maybeImmediateType = getType(maybeImmediate);
            if (maybeImmediateType === "call") {
              return this.getParentNode(maybeImmediate);
            }
          }
        } 
        return parentNode;  
      }
      if (Uglifoc.debug) {
        console.error("Uglifoc null parent for node", {NodeIterator: this, node: node}); 
      }
      throw new Error("Function naming algorithm error, null parent for node");
    }
  };
  
  function convertToName(infos) {
    
    var name = "";
    for(var i = 0; i < infos.length; i++) {
      var info = infos[i];
      if (info.isCall) {
         console.log("FOC found isCall");
      }
      if (name.isSameAs) 
        continue;
      
      name += info.id || "";
      name += info.isPartOf ? "." : "";
      name += info.isContributesTo ? "<" : "";
    }
    
    return name;
  }
  
  var FunctionInfo = function(parent) {
    this.parent = parent;
    this.parentType = getType(parent);
  }
  
  function foc(node, parents) {
    var summary = [];
    
    var iter = new NodeIterator(node, parents);
    while (iter.hasNextNode()) {
      
      var functionInfo = new FunctionInfo(iter.getParentNode(node));
      
      if (functionInfo.parentType === 'conditional') {
        functionInfo.isSameAs = true;
      } else if (functionInfo.parentType === 'array' || functionInfo.parentType === 'pair') {
        functionInfo.isPartOf = true;
      } else {
        functionInfo.isContributesTo = true;
      }
      
      if (functionInfo.parentType === 'call' && functionInfo.parent[1] !== node) {
        // then the node must be in args
        functionInfo.isCall = true;
        functionInfo.id = getNameExpression(parent);
        functionInfo.argSummary = getArgSummary(parent);
      }
      
      summary.push(functionInfo);
      node = iter.getNextNode();
    }
    // At this point the node parent is not an expression
    var functionInfo = new FunctionInfo(iter.getParentNode(node));
    if (functionInfo.parentType === "assign" || functionInfo.parentType === "decl") {
      functionInfo.isAssignment = true;
      functionInfo.id = getNameExpression(functionInfo.parent);
      summary.push(functionInfo);
    }
    console.log("FOC summary ", summary);
    
    return convertToName(summary.reverse());
  }
  
  return {foc: foc};
}();
