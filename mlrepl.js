// var marklogic = require('marklogic');
var request = require('request');
var repl = require('repl');
var util = require('util');
var inherits = require('util').inherits;
var Stream = require('stream');
var vm = require('vm');
var path = require('path');
var fs = require('fs');
var rl = require('readline');
var Console = require('console').Console;
var domain = require('domain');
var debug = util.debuglog('mlrepl');

var mldbconfig = {
  database: 'Documents',
  user: 'admin',
  password: 'admin',
  completionGroups: ['cts','fn','math','rdf','sc','sem','spell','temporal','xdmp'],
  eval: function(cmd, cb){
    var scope = this;

    if(cmd === 'mldb'){

    } else {
      request.post('http://localhost:9010/repl', 
        {
          auth: {user:this.user, pass:this.password, sendImmediately:false},
          json: {cmd:cmd, mldb:this.database}
        }, 
        function(err,resp, body){
          // console.log(body);
          // if(body.datatype === 'function ValueIterator()'){
          //   console.log(mlobj);
          //   body.result = new ValueIterator(body.result);
          // }

          if(body.error){
            cb(util.inspect(body.error));
          }

          cb(body);
      });
    }
  },
  fetchObj: function(){
    request.get('http://localhost:9010/objs', 
      {auth: {user:this.user, pass:this.password, sendImmediately:false}}, 
      function(err,resp, body){
        // console.log(body);
        // vm.runInThisContext(body, 'mlobj.js');
    });
  },
  updateDb: function(dbname){
    console.log("please wait for the server config to finished updating")
    request.put('http://localhost:8002/manage/v2/servers/repl-http/properties?group-id=Default', 
        {
          auth: {user:this.user, pass:this.password, sendImmediately:false},
          json: {'content-database':dbname}
        }, 
        function(err,resp, body){
          if(err){
            console.log("something went wrong!: " + err);
          } else {
            console.log(".. done");  
          }
          
      });

  }

  
};

// If obj.hasOwnProperty has been overridden, then calling
// obj.hasOwnProperty(prop) will break.
// See: https://github.com/joyent/node/issues/1707
function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}


// hack for require.resolve("./relative") to work properly.
module.filename = path.resolve('repl');

// hack for repl require to work properly with node_modules folders
module.paths = require('module')._nodeModulePaths(module.filename);

// Can overridden with custom print functions, such as `probe` or `eyes.js`.
// This is the default "writer" value if none is passed in the REPL options.
exports.writer = util.inspect;

exports._builtinLibs = ['assert', 'buffer', 'child_process', 'cluster',
  'crypto', 'dgram', 'dns', 'domain', 'events', 'fs', 'http', 'https', 'net',
  'os', 'path', 'punycode', 'querystring', 'readline', 'stream',
  'string_decoder', 'tls', 'tty', 'url', 'util', 'vm', 'zlib', 'smalloc'];


function MLREPLServer(prompt, stream, eval_, useGlobal, ignoreUndefined) {
  if (!(this instanceof MLREPLServer)) {
    return new MLREPLServer(prompt, stream, eval_, useGlobal, ignoreUndefined);
  }

  var options, input, output, dom;
  if (util.isObject(prompt)) {
    // an options object was given
    options = prompt;
    stream = options.stream || options.socket;
    input = options.input;
    output = options.output;
    eval_ = options.eval;
    useGlobal = options.useGlobal;
    ignoreUndefined = options.ignoreUndefined;
    prompt = options.prompt;
    dom = options.domain;
  } else if (!util.isString(prompt)) {
    throw new Error('An options Object, or a prompt String are required');
  } else {
    options = {};
  }

  var self = this;

  self._domain = dom || domain.create();

  self.useGlobal = !!useGlobal;
  self.ignoreUndefined = !!ignoreUndefined;

  // just for backwards compat, see github.com/joyent/node/pull/7127
  self.rli = this;

  eval_ = eval_ || defaultEval;

  function defaultEval(code, context, file, cb) {
    var err, result;

    // first, create the Script object to check the syntax
    try {
      var script = vm.createScript(code, {
        filename: file,
        displayErrors: false
      });
    } catch (e) {
      // console.log('syntax error!!');
      debug('parse error %j', code, e);
      if (isRecoverableError(e))
        err = new Recoverable(e);
      else
        err = e;
    }


    if (!err && code.trim() != '') {
    	// try {

    		var cmd = this.lines.join('\n');

	    	cmd += '\n'+code;
	    	var local = this;

        self.context.mldbconfig.eval(cmd, function(resp){
          try{

            if(resp.error){
              throw new Recoverable(resp.error);
            }

            result = resp.result;
          } catch(e){
            console.log(e);
            err = e;
            if (err && process.domain) {
              debug('not recoverable, send to domain');
              process.domain.emit('error', err);
              process.domain.exit();
              return;
            }
          }
          cb(err, result);
        });  	
    } else{
      cb(err, result);
    }
    
  }

  self.eval = self._domain.bind(eval_);

  self._domain.on('error', function(e) {
    debug('domain error');
    self.outputStream.write((e.stack || e) + '\n');
    self.bufferedCommand = '';
    self.lines.level = [];
    self.displayPrompt();
  });

  if (!input && !output) {
    // legacy API, passing a 'stream'/'socket' option
    if (!stream) {
      // use stdin and stdout as the default streams if none were given
      stream = process;
    }
    if (stream.stdin && stream.stdout) {
      // We're given custom object with 2 streams, or the `process` object
      input = stream.stdin;
      output = stream.stdout;
    } else {
      // We're given a duplex readable/writable Stream, like a `net.Socket`
      input = stream;
      output = stream;
    }
  }

  self.inputStream = input;
  self.outputStream = output;

  self.resetContext();
  self.bufferedCommand = '';
  self.lines.level = [];

  function complete(text, callback) {
    self.complete(text, callback);
  }

  rl.Interface.apply(this, [
    self.inputStream,
    self.outputStream,
    complete,
    options.terminal
  ]);

  self.setPrompt(!util.isUndefined(prompt) ? prompt : '> ');

  this.commands = {};
  defineDefaultCommands(this);

  // figure out which "writer" function to use
  self.writer = options.writer || exports.writer;

  if (util.isUndefined(options.useColors)) {
    options.useColors = self.terminal;
  }
  self.useColors = !!options.useColors;

  if (self.useColors && self.writer === util.inspect) {
    // Turn on ANSI coloring.
    self.writer = function(obj, showHidden, depth) {
      return util.inspect(obj, showHidden, depth, true);
    };
  }

  self.setPrompt(self._prompt);

  self.on('close', function() {
    self.emit('exit');
  });

  var sawSIGINT = false;
  self.on('SIGINT', function() {
    var empty = self.line.length === 0;
    self.clearLine();

    if (!(self.bufferedCommand && self.bufferedCommand.length > 0) && empty) {
      if (sawSIGINT) {
        self.close();
        sawSIGINT = false;
        return;
      }
      self.output.write('(^C again to quit)\n');
      sawSIGINT = true;
    } else {
      sawSIGINT = false;
    }

    self.bufferedCommand = '';
    self.lines.level = [];
    self.displayPrompt();
  });

  self.on('line', function(cmd) {
    debug('line %j', cmd);
    sawSIGINT = false;
    var skipCatchall = false;
    cmd = trimWhitespace(cmd);

    // Check to see if a REPL keyword was used. If it returns true,
    // display next prompt and return.
    if (cmd && cmd.charAt(0) === '.' && isNaN(parseFloat(cmd))) {
      var matches = cmd.match(/^\.([^\s]+)\s*(.*)$/);
      var keyword = matches && matches[1];
      var rest = matches && matches[2];
      if (self.parseREPLKeyword(keyword, rest) === true) {
        return;
      } else {
        self.outputStream.write('Invalid REPL keyword\n');
        skipCatchall = true;
      }
    }

    if (!skipCatchall) {
      var evalCmd = self.bufferedCommand + cmd;
      if (/^\s*\{/.test(evalCmd) && /\}\s*$/.test(evalCmd)) {
        // It's confusing for `{ a : 1 }` to be interpreted as a block
        // statement rather than an object literal.  So, we first try
        // to wrap it in parentheses, so that it will be interpreted as
        // an expression.
        evalCmd = '(' + evalCmd + ')\n';
      } else {
        // otherwise we just append a \n so that it will be either
        // terminated, or continued onto the next expression if it's an
        // unexpected end of input.
        evalCmd = evalCmd + '\n';
      }

      debug('eval %j', evalCmd);
      self.eval(evalCmd, self.context, 'repl', finish);
    } else {
      finish(null);
    }

    function finish(e, ret) {
      debug('finish', e, ret);

  	  self.memory(cmd);	
      
      if (e && !self.bufferedCommand && cmd.trim().match(/^npm /)) {
        self.outputStream.write('npm should be run outside of the ' +
                                'node repl, in your normal shell.\n' +
                                '(Press Control-D to exit.)\n');
        self.bufferedCommand = '';
        self.displayPrompt();
        return;
      }

      // If error was SyntaxError and not JSON.parse error
      if (e) {
        if (e instanceof Recoverable) {
          // Start buffering data like that:
          // {
          // ...  x: 1
          // ... }
          self.bufferedCommand += cmd + '\n';
          self.displayPrompt();
          return;
        } else {
          self._domain.emit('error', e);
        }
      }

      // Clear buffer if no SyntaxErrors
      self.bufferedCommand = '';

      // If we got any output - print it (if no error)
      if (!e && (!self.ignoreUndefined || !util.isUndefined(ret))) {
        self.context._ = ret;
        self.outputStream.write(self.writer(ret) + '\n');
      }

      // Display prompt again
      self.displayPrompt();
    };
  });

  self.on('SIGCONT', function() {
    self.displayPrompt(true);
  });

  self.displayPrompt();
}
inherits(MLREPLServer, rl.Interface);
exports.MLREPLServer = MLREPLServer;


// prompt is a string to print on each line for the prompt,
// source is a stream to use for I/O, defaulting to stdin/stdout.
exports.start = function(prompt, source, eval_, useGlobal, ignoreUndefined) {
  var repl = new MLREPLServer(prompt, source, eval_, useGlobal, ignoreUndefined);
  if (!exports.repl) exports.repl = repl;
  return repl;
};

MLREPLServer.prototype.createContext = function() {
  var context;
  if (this.useGlobal) {
    context = global;
  } else {
    context = vm.createContext();
    for (var i in global) context[i] = global[i];
    context.console = new Console(this.outputStream);
    context.global = context;
    context.global.global = context;
  }

  context.module = module;
  context.require = require;
  // context.db = db;
  context.mldbconfig = mldbconfig;

  this.lines = [];
  this.lines.level = [];

  // make built-in modules available directly
  // (loaded lazily)
  exports._builtinLibs.forEach(function(name) {
    Object.defineProperty(context, name, {
      get: function() {
        var lib = require(name);
        context._ = context[name] = lib;
        return lib;
      },
      // allow the creation of other globals with this name
      set: function(val) {
        delete context[name];
        context[name] = val;
      },
      configurable: true
    });
  });

  return context;
};

MLREPLServer.prototype.resetContext = function() {
  this.context = this.createContext();

  // Allow REPL extensions to extend the new context
  this.emit('reset', this.context);
};

MLREPLServer.prototype.displayPrompt = function(preserveCursor) {
  var prompt = this._initialPrompt;
  if (this.bufferedCommand.length) {
    prompt = '...';
    var levelInd = new Array(this.lines.level.length).join('..');
    prompt += levelInd + ' ';
  }

  // Do not overwrite `_initialPrompt` here
  MLREPLServer.super_.prototype.setPrompt.call(this, prompt);
  this.prompt(preserveCursor);
};

// When invoked as an API method, overwrite _initialPrompt
MLREPLServer.prototype.setPrompt = function setPrompt(prompt) {
  this._initialPrompt = prompt;
  MLREPLServer.super_.prototype.setPrompt.call(this, prompt);
};

// A stream to push an array into a REPL
// used in MLREPLServer.complete
function ArrayStream() {
  Stream.call(this);

  this.run = function(data) {
    var self = this;
    data.forEach(function(line) {
      self.emit('data', line + '\n');
    });
  }
}
util.inherits(ArrayStream, Stream);
ArrayStream.prototype.readable = true;
ArrayStream.prototype.writable = true;
ArrayStream.prototype.resume = function() {};
ArrayStream.prototype.write = function() {};

var requireRE = /\brequire\s*\(['"](([\w\.\/-]+\/)?([\w\.\/-]*))/;
var simpleExpressionRE =
    /(([a-zA-Z_$](?:\w|\$)*)\.)*([a-zA-Z_$](?:\w|\$)*)\.?$/;


// Provide a list of completions for the given leading text. This is
// given to the readline interface for handling tab completion.
//
// Example:
//  complete('var foo = util.')
//    -> [['util.print', 'util.debug', 'util.log', 'util.inspect', 'util.pump'],
//        'util.' ]
//
// Warning: This eval's code like "foo.bar.baz", so it will run property
// getter code.
MLREPLServer.prototype.complete = function(line, callback) {
  // There may be local variables to evaluate, try a nested REPL
  if (!util.isUndefined(this.bufferedCommand) && this.bufferedCommand.length) {
    // Get a new array of inputed lines
    var tmp = this.lines.slice();
    // Kill off all function declarations to push all local variables into
    // global scope
    this.lines.level.forEach(function(kill) {
      if (kill.isFunction) {
        tmp[kill.line] = '';
      }
    });
    var flat = new ArrayStream();         // make a new "input" stream
    var magic = new MLREPLServer('', flat); // make a nested REPL
    magic.context = magic.createContext();
    flat.run(tmp);                        // eval the flattened code
    // all this is only profitable if the nested REPL
    // does not have a bufferedCommand
    if (!magic.bufferedCommand) {
      return magic.complete(line, callback);
    }
  }

  var completions;

  // list of completion lists, one for each inheritance "level"
  var completionGroups = [];

  var completeOn, match, filter, i, group, c;

  // REPL commands (e.g. ".break").
  var match = null;
  match = line.match(/^\s*(\.\w*)$/);
  if (match) {
    completionGroups.push(Object.keys(this.commands));
    completeOn = match[1];
    if (match[1].length > 1) {
      filter = match[1];
    }

    completionGroupsLoaded();
  } else if (match = line.match(requireRE)) {
    // require('...<Tab>')
    var exts = Object.keys(require.extensions);
    var indexRe = new RegExp('^index(' + exts.map(regexpEscape).join('|') +
                             ')$');

    completeOn = match[1];
    var subdir = match[2] || '';
    var filter = match[1];
    var dir, files, f, name, base, ext, abs, subfiles, s;
    group = [];
    var paths = module.paths.concat(require('module').globalPaths);
    for (i = 0; i < paths.length; i++) {
      dir = path.resolve(paths[i], subdir);
      try {
        files = fs.readdirSync(dir);
      } catch (e) {
        continue;
      }
      for (f = 0; f < files.length; f++) {
        name = files[f];
        ext = path.extname(name);
        base = name.slice(0, -ext.length);
        if (base.match(/-\d+\.\d+(\.\d+)?/) || name === '.npm') {
          // Exclude versioned names that 'npm' installs.
          continue;
        }
        if (exts.indexOf(ext) !== -1) {
          if (!subdir || base !== 'index') {
            group.push(subdir + base);
          }
        } else {
          abs = path.resolve(dir, name);
          try {
            if (fs.statSync(abs).isDirectory()) {
              group.push(subdir + name + '/');
              subfiles = fs.readdirSync(abs);
              for (s = 0; s < subfiles.length; s++) {
                if (indexRe.test(subfiles[s])) {
                  group.push(subdir + name);
                }
              }
            }
          } catch (e) {}
        }
      }
    }
    if (group.length) {
      completionGroups.push(group);
    }

    if (!subdir) {
      completionGroups.push(exports._builtinLibs);
    }

    completionGroupsLoaded();

  // Handle variable member lookup.
  // We support simple chained expressions like the following (no function
  // calls, etc.). That is for simplicity and also because we *eval* that
  // leading expression so for safety (see WARNING above) don't want to
  // eval function calls.
  //
  //   foo.bar<|>     # completions for 'foo' with filter 'bar'
  //   spam.eggs.<|>  # completions for 'spam.eggs' with filter ''
  //   foo<|>         # all scope vars with filter 'foo'
  //   foo.<|>        # completions for 'foo' with filter ''
  } else if (line.length === 0 || line[line.length - 1].match(/\w|\.|\$/)) {
    match = simpleExpressionRE.exec(line);
    if (line.length === 0 || match) {
      var expr;
      completeOn = (match ? match[0] : '');
      if (line.length === 0) {
        filter = '';
        expr = '';
      } else if (line[line.length - 1] === '.') {
        filter = '';
        expr = match[0].slice(0, match[0].length - 1);
      } else {
        var bits = match[0].split('.');
        filter = bits.pop();
        expr = bits.join('.');
      }

      // Resolve expr and get its completions.
      var memberGroups = [];
      if (!expr) {
        // If context is instance of vm.ScriptContext
        // Get global vars synchronously
        if (this.useGlobal ||
            this.context.constructor &&
            this.context.constructor.name === 'Context') {
          var contextProto = this.context;
          while (contextProto = Object.getPrototypeOf(contextProto)) {
            completionGroups.push(Object.getOwnPropertyNames(contextProto));
          }
          completionGroups.push(Object.getOwnPropertyNames(this.context));
          addStandardGlobals(completionGroups, filter);
          completionGroupsLoaded();
        } else {
          this.eval('.scope', this.context, 'repl', function(err, globals) {
            if (err || !globals) {
              addStandardGlobals(completionGroups, filter);
            } else if (util.isArray(globals[0])) {
              // Add grouped globals
              globals.forEach(function(group) {
                completionGroups.push(group);
              });
            } else {
              completionGroups.push(globals);
              addStandardGlobals(completionGroups, filter);
            }
            completionGroupsLoaded();
          });
        }
      } else {
        this.eval(expr, this.context, 'repl', function(e, obj) {
          // if (e) console.log(e);

          if (obj != null) {
            if (util.isObject(obj) || util.isFunction(obj)) {
              memberGroups.push(Object.getOwnPropertyNames(obj));
            }
            // works for non-objects
            try {
              var sentinel = 5;
              var p;
              if (util.isObject(obj) || util.isFunction(obj)) {
                p = Object.getPrototypeOf(obj);
              } else {
                p = obj.constructor ? obj.constructor.prototype : null;
              }
              while (!util.isNull(p)) {
                memberGroups.push(Object.getOwnPropertyNames(p));
                p = Object.getPrototypeOf(p);
                // Circular refs possible? Let's guard against that.
                sentinel--;
                if (sentinel <= 0) {
                  break;
                }
              }
            } catch (e) {
              //console.log("completion error walking prototype chain:" + e);
            }
          }

          if (memberGroups.length) {
            for (i = 0; i < memberGroups.length; i++) {
              completionGroups.push(memberGroups[i].map(function(member) {
                return expr + '.' + member;
              }));
            }
            if (filter) {
              filter = expr + '.' + filter;
            }
          }

          completionGroupsLoaded();
        });
      }
    } else {
      completionGroupsLoaded();
    }
  } else {
    completionGroupsLoaded();
  }

  // Will be called when all completionGroups are in place
  // Useful for async autocompletion
  function completionGroupsLoaded(err) {
    if (err) throw err;

    // Filter, sort (within each group), uniq and merge the completion groups.
    if (completionGroups.length && filter) {
      var newCompletionGroups = [];
      for (i = 0; i < completionGroups.length; i++) {
        group = completionGroups[i].filter(function(elem) {
          return elem.indexOf(filter) == 0;
        });
        if (group.length) {
          newCompletionGroups.push(group);
        }
      }
      completionGroups = newCompletionGroups;
    }

    if (completionGroups.length) {
      var uniq = {};  // unique completions across all groups
      completions = [];
      // Completion group 0 is the "closest"
      // (least far up the inheritance chain)
      // so we put its completions last: to be closest in the REPL.
      for (i = completionGroups.length - 1; i >= 0; i--) {
        group = completionGroups[i];
        group.sort();
        for (var j = 0; j < group.length; j++) {
          c = group[j];
          if (!hasOwnProperty(uniq, c)) {
            completions.push(c);
            uniq[c] = true;
          }
        }
        completions.push(''); // separator btwn groups
      }
      while (completions.length && completions[completions.length - 1] === '') {
        completions.pop();
      }
    }

    callback(null, [completions || [], completeOn]);
  }
};


/**
 * Used to parse and execute the Node REPL commands.
 *
 * @param {keyword} keyword The command entered to check.
 * @return {Boolean} If true it means don't continue parsing the command.
 */
MLREPLServer.prototype.parseREPLKeyword = function(keyword, rest) {
  var cmd = this.commands[keyword];
  if (cmd) {
    cmd.action.call(this, rest);
    return true;
  }
  return false;
};


MLREPLServer.prototype.defineCommand = function(keyword, cmd) {
  if (util.isFunction(cmd)) {
    cmd = {action: cmd};
  } else if (!util.isFunction(cmd.action)) {
    throw new Error('bad argument, action must be a function');
  }
  this.commands[keyword] = cmd;
};

MLREPLServer.prototype.memory = function memory(cmd) {
  var self = this;

  self.lines = self.lines || [];
  self.lines.level = self.lines.level || [];

  // save the line so I can do magic later
  if (cmd) {
    // TODO should I tab the level?
    self.lines.push(new Array(self.lines.level.length).join('  ') + cmd);
  } else {
    // I don't want to not change the format too much...
    self.lines.push('');
  }

  // I need to know "depth."
  // Because I can not tell the difference between a } that
  // closes an object literal and a } that closes a function
  if (cmd) {
    // going down is { and (   e.g. function() {
    // going up is } and )
    var dw = cmd.match(/{|\(/g);
    var up = cmd.match(/}|\)/g);
    up = up ? up.length : 0;
    dw = dw ? dw.length : 0;
    var depth = dw - up;

    if (depth) {
      (function workIt() {
        if (depth > 0) {
          // going... down.
          // push the line#, depth count, and if the line is a function.
          // Since JS only has functional scope I only need to remove
          // "function() {" lines, clearly this will not work for
          // "function()
          // {" but nothing should break, only tab completion for local
          // scope will not work for this function.
          self.lines.level.push({
            line: self.lines.length - 1,
            depth: depth,
            isFunction: /\s*function\s*/.test(cmd)
          });
        } else if (depth < 0) {
          // going... up.
          var curr = self.lines.level.pop();
          if (curr) {
            var tmp = curr.depth + depth;
            if (tmp < 0) {
              //more to go, recurse
              depth += curr.depth;
              workIt();
            } else if (tmp > 0) {
              //remove and push back
              curr.depth += depth;
              self.lines.level.push(curr);
            }
          }
        }
      }());
    }

    // it is possible to determine a syntax error at this point.
    // if the REPL still has a bufferedCommand and
    // self.lines.level.length === 0
    // TODO? keep a log of level so that any syntax breaking lines can
    // be cleared on .break and in the case of a syntax error?
    // TODO? if a log was kept, then I could clear the bufferedComand and
    // eval these lines and throw the syntax error
  } else {
    self.lines.level = [];
  }
};

function addStandardGlobals(completionGroups, filter) {
  // Global object properties
  // (http://www.ecma-international.org/publications/standards/Ecma-262.htm)
  completionGroups.push(['NaN', 'Infinity', 'undefined',
    'eval', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'decodeURI',
    'decodeURIComponent', 'encodeURI', 'encodeURIComponent',
    'Object', 'Function', 'Array', 'String', 'Boolean', 'Number',
    'Date', 'RegExp', 'Error', 'EvalError', 'RangeError',
    'ReferenceError', 'SyntaxError', 'TypeError', 'URIError',
    'Math', 'JSON','cts','fn','math','rdf','sc','sem','spell','temporal','xdmp']);
  // Common keywords. Exclude for completion on the empty string, b/c
  // they just get in the way.
  if (filter) {
    completionGroups.push(['break', 'case', 'catch', 'const',
      'continue', 'debugger', 'default', 'delete', 'do', 'else',
      'export', 'false', 'finally', 'for', 'function', 'if',
      'import', 'in', 'instanceof', 'let', 'new', 'null', 'return',
      'switch', 'this', 'throw', 'true', 'try', 'typeof', 'undefined',
      'var', 'void', 'while', 'with', 'yield']);
  }
}

function defineDefaultCommands(repl) {
  // TODO remove me after 0.3.x
  repl.defineCommand('break', {
    help: 'Sometimes you get stuck, this gets you out',
    action: function() {
      this.bufferedCommand = '';
      this.displayPrompt();
    }
  });

  var clearMessage;
  if (repl.useGlobal) {
    clearMessage = 'Alias for .break';
  } else {
    clearMessage = 'Break, and also clear the local context';
  }
  repl.defineCommand('clear', {
    help: clearMessage,
    action: function() {
      this.bufferedCommand = '';
      if (!this.useGlobal) {
        this.outputStream.write('Clearing context...\n');
        this.resetContext();
      }
      this.displayPrompt();
    }
  });

  repl.defineCommand('exit', {
    help: 'Exit the repl',
    action: function() {
      this.close();
    }
  });

  repl.defineCommand('help', {
    help: 'Show repl options',
    action: function() {
      var self = this;
      Object.keys(this.commands).sort().forEach(function(name) {
        var cmd = self.commands[name];
        self.outputStream.write(name + '\t' + (cmd.help || '') + '\n');
      });
      this.displayPrompt();
    }
  });

  repl.defineCommand('save', {
    help: 'Save all evaluated commands in this REPL session to a file',
    action: function(file) {
      try {
        fs.writeFileSync(file, this.lines.join('\n') + '\n');
        this.outputStream.write('Session saved to:' + file + '\n');
      } catch (e) {
        this.outputStream.write('Failed to save:' + file + '\n');
      }
      this.displayPrompt();
    }
  });

  repl.defineCommand('load', {
    help: 'Load JS from a file into the REPL session',
    action: function(file) {
      try {
        var stats = fs.statSync(file);
        if (stats && stats.isFile()) {
          var self = this;
          var data = fs.readFileSync(file, 'utf8');
          var lines = data.split('\n');
          this.displayPrompt();
          lines.forEach(function(line) {
            if (line) {
              self.write(line + '\n');
            }
          });
        }
      } catch (e) {
        this.outputStream.write('Failed to load:' + file + '\n');
      }
      this.displayPrompt();
    }
  });

  repl.defineCommand('mldb', {
    help: 'Display / Modify the MarkLogic connection settings.',
    action: function(dbconfig) {
      if(dbconfig){
        var tok = dbconfig.split(/\s+/)
        
        if(tok.length == 2){
          if(this.context.mldbconfig[tok[0]]){
            if(tok[0] === 'database'){
              this.context.mldbconfig.updateDb(tok[1]);
            } else {
              this.context.mldbconfig[tok[0]] = tok[1];
            }
          }

        }

        
      } else {
        var tmp = {database:this.context.mldbconfig.database, user:this.context.mldbconfig.user, password:this.context.mldbconfig.password}
        console.log(util.inspect(tmp));
      }
      

      this.displayPrompt();
    }
  });
}


function trimWhitespace(cmd) {
  var trimmer = /^\s*(.+)\s*$/m,
      matches = trimmer.exec(cmd);

  if (matches && matches.length === 2) {
    return matches[1];
  }
  return '';
}


function regexpEscape(s) {
  return s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}


/**
 * Converts commands that use var and function <name>() to use the
 * local exports.context when evaled. This provides a local context
 * on the REPL.
 *
 * @param {String} cmd The cmd to convert.
 * @return {String} The converted command.
 */
MLREPLServer.prototype.convertToContext = function(cmd) {
  var self = this, matches,
      scopeVar = /^\s*var\s*([_\w\$]+)(.*)$/m,
      scopeFunc = /^\s*function\s*([_\w\$]+)/;

  // Replaces: var foo = "bar";  with: self.context.foo = bar;
  matches = scopeVar.exec(cmd);
  if (matches && matches.length === 3) {
    return 'self.context.' + matches[1] + matches[2];
  }

  // Replaces: function foo() {};  with: foo = function foo() {};
  matches = scopeFunc.exec(self.bufferedCommand);
  if (matches && matches.length === 2) {
    return matches[1] + ' = ' + self.bufferedCommand;
  }

  return cmd;
};


// If the error is that we've unexpectedly ended the input,
// then let the user try to recover by adding more input.
function isRecoverableError(e) {
  return e &&
      e.name === 'SyntaxError' &&
      /^(Unexpected end of input|Unexpected token :)/.test(e.message);
}

function Recoverable(err) {
  this.err = err;
}
inherits(Recoverable, SyntaxError);