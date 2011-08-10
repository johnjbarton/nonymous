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
    if (Uglifoc.debug) console.log("namingStack("+(namingStack.length+1)+") popped "+popped[0]);
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
      var msg = "setFunctionName found a function when naming stack depth "+namingStack.length;
      msg += " newest:";
      console.log(msg, namingStack[namingStack.length-1]);
    }
    Uglifoc.ExpressionNamer.foc(statement, namingStack.reverse());
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
  
  var LITERAL = function(val) {
    return val; 
  };
  
  var NODE = function(val) {
    if (Uglifoc.debug) debugger;
  };
  
  var ARRAY = function(val) {
    if (Uglifoc.debug) debugger;
  };
  
  var PAIRS = function(val) {
    if (Uglifoc.debug) debugger;
  };

  var CATCH = function(val) {
    if (Uglifoc.debug) debugger;
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
    // Rewrite as multiple decl entries
    for (var i = 0; i < declarations.length; i++) {
      var declaration = declarations[i];
      
      var statement = declaration[1];  // each decl has a name an
      if (statement) {
        var decl = ['decl'].concat(declaration);
        seekFunctionsInStatement(decl);
      }  // else declaration with no initializer, eg  var foo; 
    }
  };

  // ----------------------------------------------------------------------------------------------
  // To create a function name we need to convert expressions to strings. This table maps 
  // ast nodes into functions that generate names as we walk the expression node
  //
  
  var parentTypeToExpressionGenerator = {  // BranchName/NamingAction for each Uglify statement type
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
      return generateNameFromNameBranch(nameBranch);
    } else if (type === 'call' ) {     // 'call': ['left', NODE, 'args', ARRAY],
      // build name from 'left' node, see table 4, case 2
      var nameBranch = declFunctionCallOrAssignment[1]; 
      return generateNameFromNameBranch(nameBranch);
    } else {
      console.log("getNameExpression ERROR not decl, function call, or assignment "+declFunctionCallOrAssignment);
      return "ERROR";
    }
  }
  
  function generateNameFromNameBranch(nameBranch) {
    var name = "";
    var branches = parentTypeToExpressionGenerator[nameBranch[0]];
    // iterate the branches and statement parts in tandem
    var nameBranchPartIndex = 1; // [0] is the typeName
    for (var i = 0; i < branches.length; i += 2) {
      var nameBranchPart = nameBranch[nameBranchPartIndex++];
      if (nameBranchPart) {
        var branchName = branches[i];           // eg 'condition' for first branch of 'if'
        var branchAction = branches[i+1];       // eg NODE for first branch of 'if;'
        name = branchAction(name, nameBranchPart);
        if (typeof(name) !== 'string') {
          if (Uglifoc.debug) debugger;
        }
          
      }
    }
    return name;
  }
  
  var expressionNodeNames = [];
  
  function foc(node, parents) {
    var summary = [];
    for (var i = 0; i < parents.length; i++) {
      var parent = parents[i];  // need getNextNode
      var parentType = getType(parent);
      console.log("foc parent "+parentType, {parent:parent});
      if (expressionNodeNames.indexOf(parentType) === -1) {  // end of while loop
        break;        
      }
    }
    if (parentType === "assign" || parentType === "decl") {
      summary.push({isAssignment: true, id: getNameExpression(parent)})  
    }
    console.log("FOC summary ", summary);
  }
  
  return {foc: foc};
}();
