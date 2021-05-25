
var __CAT = (function() {
  var _scriptDir = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : undefined;
  if (typeof __filename !== 'undefined') _scriptDir = _scriptDir || __filename;
  return (
function(__CAT) {
  __CAT = __CAT || {};

// Copyright 2010 The Emscripten Authors.  All rights reserved.
// Emscripten is available under two separate licenses, the MIT license and the
// University of Illinois/NCSA Open Source License.  Both these licenses can be
// found in the LICENSE file.

// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
// if (!Module)` is crucial for Closure Compiler here as it will otherwise replace every `Module` occurrence with a string
var Module;
if (!Module) Module = typeof __CAT !== 'undefined' ? __CAT : {};

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
// {{PRE_JSES}}

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
var key;
for (key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

var arguments_ = [];
var thisProgram = './this.program';
var quit_ = function(status, toThrow) {
  throw toThrow;
};

// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).

var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_HAS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;
ENVIRONMENT_IS_WEB = typeof window === 'object';
ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
// A web environment like Electron.js can have Node enabled, so we must
// distinguish between Node-enabled environments and Node environments per se.
// This will allow the former to do things like mount NODEFS.
// Extended check using process.versions fixes issue #8816.
// (Also makes redundant the original check that 'require' is a function.)
ENVIRONMENT_HAS_NODE = typeof process === 'object' && typeof process.versions === 'object' && typeof process.versions.node === 'string';
ENVIRONMENT_IS_NODE = ENVIRONMENT_HAS_NODE && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

if (Module['ENVIRONMENT']) {
  throw new Error('Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -s ENVIRONMENT=web or -s ENVIRONMENT=node)');
}



// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = '';
function locateFile(path) {
  if (Module['locateFile']) {
    return Module['locateFile'](path, scriptDirectory);
  }
  return scriptDirectory + path;
}

// Hooks that are implemented differently in different runtime environments.
var read_,
    readAsync,
    readBinary,
    setWindowTitle;

var nodeFS;
var nodePath;

if (ENVIRONMENT_IS_NODE) {
  scriptDirectory = __dirname + '/';


  read_ = function shell_read(filename, binary) {
    var ret = tryParseAsDataURI(filename);
    if (ret) {
      return binary ? ret : ret.toString();
    }
    if (!nodeFS) nodeFS = require('fs');
    if (!nodePath) nodePath = require('path');
    filename = nodePath['normalize'](filename);
    return nodeFS['readFileSync'](filename, binary ? null : 'utf8');
  };

  readBinary = function readBinary(filename) {
    var ret = read_(filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };




  if (process['argv'].length > 1) {
    thisProgram = process['argv'][1].replace(/\\/g, '/');
  }

  arguments_ = process['argv'].slice(2);

  // MODULARIZE will export the module in the proper place outside, we don't need to export here

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });

  process['on']('unhandledRejection', abort);

  quit_ = function(status) {
    process['exit'](status);
  };

  Module['inspect'] = function () { return '[Emscripten Module object]'; };


} else
if (ENVIRONMENT_IS_SHELL) {


  if (typeof read != 'undefined') {
    read_ = function shell_read(f) {
      var data = tryParseAsDataURI(f);
      if (data) {
        return intArrayToString(data);
      }
      return read(f);
    };
  }

  readBinary = function readBinary(f) {
    var data;
    data = tryParseAsDataURI(f);
    if (data) {
      return data;
    }
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    arguments_ = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    arguments_ = arguments;
  }

  if (typeof quit === 'function') {
    quit_ = function(status) {
      quit(status);
    };
  }

  if (typeof print !== 'undefined') {
    // Prefer to use print/printErr where they exist, as they usually work better.
    if (typeof console === 'undefined') console = {};
    console.log = print;
    console.warn = console.error = typeof printErr !== 'undefined' ? printErr : print;
  }
} else

// Note that this includes Node.js workers when relevant (pthreads is enabled).
// Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
// ENVIRONMENT_HAS_NODE.
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  if (ENVIRONMENT_IS_WORKER) { // Check worker, not web, since window could be polyfilled
    scriptDirectory = self.location.href;
  } else if (document.currentScript) { // web
    scriptDirectory = document.currentScript.src;
  }
  // When MODULARIZE (and not _INSTANCE), this JS may be executed later, after document.currentScript
  // is gone, so we saved it, and we use it here instead of any other info.
  if (_scriptDir) {
    scriptDirectory = _scriptDir;
  }
  // blob urls look like blob:http://site.com/etc/etc and we cannot infer anything from them.
  // otherwise, slice off the final part of the url to find the script directory.
  // if scriptDirectory does not contain a slash, lastIndexOf will return -1,
  // and scriptDirectory will correctly be replaced with an empty string.
  if (scriptDirectory.indexOf('blob:') !== 0) {
    scriptDirectory = scriptDirectory.substr(0, scriptDirectory.lastIndexOf('/')+1);
  } else {
    scriptDirectory = '';
  }


  // Differentiate the Web Worker from the Node Worker case, as reading must
  // be done differently.
  {


  read_ = function shell_read(url) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      return xhr.responseText;
    } catch (err) {
      var data = tryParseAsDataURI(url);
      if (data) {
        return intArrayToString(data);
      }
      throw err;
    }
  };

  if (ENVIRONMENT_IS_WORKER) {
    readBinary = function readBinary(url) {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);
        xhr.responseType = 'arraybuffer';
        xhr.send(null);
        return new Uint8Array(xhr.response);
      } catch (err) {
        var data = tryParseAsDataURI(url);
        if (data) {
          return data;
        }
        throw err;
      }
    };
  }

  readAsync = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
        return;
      }
      var data = tryParseAsDataURI(url);
      if (data) {
        onload(data.buffer);
        return;
      }
      onerror();
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };




  }

  setWindowTitle = function(title) { document.title = title };
} else
{
  throw new Error('environment detection error');
}


// Set up the out() and err() hooks, which are how we can print to stdout or
// stderr, respectively.
var out = Module['print'] || console.log.bind(console);
var err = Module['printErr'] || console.warn.bind(console);

// Merge back in the overrides
for (key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = null;

// Emit code to handle expected values on the Module object. This applies Module.x
// to the proper local x. This has two benefits: first, we only emit it if it is
// expected to arrive, and second, by using a local everywhere else that can be
// minified.
if (Module['arguments']) arguments_ = Module['arguments'];if (!Object.getOwnPropertyDescriptor(Module, 'arguments')) Object.defineProperty(Module, 'arguments', { configurable: true, get: function() { abort('Module.arguments has been replaced with plain arguments_') } });
if (Module['thisProgram']) thisProgram = Module['thisProgram'];if (!Object.getOwnPropertyDescriptor(Module, 'thisProgram')) Object.defineProperty(Module, 'thisProgram', { configurable: true, get: function() { abort('Module.thisProgram has been replaced with plain thisProgram') } });
if (Module['quit']) quit_ = Module['quit'];if (!Object.getOwnPropertyDescriptor(Module, 'quit')) Object.defineProperty(Module, 'quit', { configurable: true, get: function() { abort('Module.quit has been replaced with plain quit_') } });

// perform assertions in shell.js after we set up out() and err(), as otherwise if an assertion fails it cannot print the message
// Assertions on removed incoming Module JS APIs.
assert(typeof Module['memoryInitializerPrefixURL'] === 'undefined', 'Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['pthreadMainPrefixURL'] === 'undefined', 'Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['cdInitializerPrefixURL'] === 'undefined', 'Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['filePackagePrefixURL'] === 'undefined', 'Module.filePackagePrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['read'] === 'undefined', 'Module.read option was removed (modify read_ in JS)');
assert(typeof Module['readAsync'] === 'undefined', 'Module.readAsync option was removed (modify readAsync in JS)');
assert(typeof Module['readBinary'] === 'undefined', 'Module.readBinary option was removed (modify readBinary in JS)');
assert(typeof Module['setWindowTitle'] === 'undefined', 'Module.setWindowTitle option was removed (modify setWindowTitle in JS)');
if (!Object.getOwnPropertyDescriptor(Module, 'read')) Object.defineProperty(Module, 'read', { configurable: true, get: function() { abort('Module.read has been replaced with plain read_') } });
if (!Object.getOwnPropertyDescriptor(Module, 'readAsync')) Object.defineProperty(Module, 'readAsync', { configurable: true, get: function() { abort('Module.readAsync has been replaced with plain readAsync') } });
if (!Object.getOwnPropertyDescriptor(Module, 'readBinary')) Object.defineProperty(Module, 'readBinary', { configurable: true, get: function() { abort('Module.readBinary has been replaced with plain readBinary') } });
// TODO: add when SDL2 is fixed if (!Object.getOwnPropertyDescriptor(Module, 'setWindowTitle')) Object.defineProperty(Module, 'setWindowTitle', { configurable: true, get: function() { abort('Module.setWindowTitle has been replaced with plain setWindowTitle') } });
var IDBFS = 'IDBFS is no longer included by default; build with -lidbfs.js';
var PROXYFS = 'PROXYFS is no longer included by default; build with -lproxyfs.js';
var WORKERFS = 'WORKERFS is no longer included by default; build with -lworkerfs.js';
var NODEFS = 'NODEFS is no longer included by default; build with -lnodefs.js';


// TODO remove when SDL2 is fixed (also see above)



// Copyright 2017 The Emscripten Authors.  All rights reserved.
// Emscripten is available under two separate licenses, the MIT license and the
// University of Illinois/NCSA Open Source License.  Both these licenses can be
// found in the LICENSE file.

// {{PREAMBLE_ADDITIONS}}

var STACK_ALIGN = 16;

// stack management, and other functionality that is provided by the compiled code,
// should not be used before it is ready
stackSave = stackRestore = stackAlloc = function() {
  abort('cannot use the stack before compiled code is ready to run, and has provided stack access');
};

function staticAlloc(size) {
  abort('staticAlloc is no longer available at runtime; instead, perform static allocations at compile time (using makeStaticAlloc)');
}

function dynamicAlloc(size) {
  assert(DYNAMICTOP_PTR);
  var ret = HEAP32[DYNAMICTOP_PTR>>2];
  var end = (ret + size + 15) & -16;
  if (end > _emscripten_get_heap_size()) {
    abort('failure to dynamicAlloc - memory growth etc. is not supported there, call malloc/sbrk directly');
  }
  HEAP32[DYNAMICTOP_PTR>>2] = end;
  return ret;
}

function alignMemory(size, factor) {
  if (!factor) factor = STACK_ALIGN; // stack alignment (16-byte) by default
  return Math.ceil(size / factor) * factor;
}

function getNativeTypeSize(type) {
  switch (type) {
    case 'i1': case 'i8': return 1;
    case 'i16': return 2;
    case 'i32': return 4;
    case 'i64': return 8;
    case 'float': return 4;
    case 'double': return 8;
    default: {
      if (type[type.length-1] === '*') {
        return 4; // A pointer
      } else if (type[0] === 'i') {
        var bits = parseInt(type.substr(1));
        assert(bits % 8 === 0, 'getNativeTypeSize invalid bits ' + bits + ', type ' + type);
        return bits / 8;
      } else {
        return 0;
      }
    }
  }
}

function warnOnce(text) {
  if (!warnOnce.shown) warnOnce.shown = {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    err(text);
  }
}





// Wraps a JS function as a wasm function with a given signature.
function convertJsFunctionToWasm(func, sig) {

  // If the type reflection proposal is available, use the new
  // "WebAssembly.Function" constructor.
  // Otherwise, construct a minimal wasm module importing the JS function and
  // re-exporting it.
  if (typeof WebAssembly.Function === "function") {
    var typeNames = {
      'i': 'i32',
      'j': 'i64',
      'f': 'f32',
      'd': 'f64'
    };
    var type = {
      parameters: [],
      results: sig[0] == 'v' ? [] : [typeNames[sig[0]]]
    };
    for (var i = 1; i < sig.length; ++i) {
      type.parameters.push(typeNames[sig[i]]);
    }
    return new WebAssembly.Function(type, func);
  }

  // The module is static, with the exception of the type section, which is
  // generated based on the signature passed in.
  var typeSection = [
    0x01, // id: section,
    0x00, // length: 0 (placeholder)
    0x01, // count: 1
    0x60, // form: func
  ];
  var sigRet = sig.slice(0, 1);
  var sigParam = sig.slice(1);
  var typeCodes = {
    'i': 0x7f, // i32
    'j': 0x7e, // i64
    'f': 0x7d, // f32
    'd': 0x7c, // f64
  };

  // Parameters, length + signatures
  typeSection.push(sigParam.length);
  for (var i = 0; i < sigParam.length; ++i) {
    typeSection.push(typeCodes[sigParam[i]]);
  }

  // Return values, length + signatures
  // With no multi-return in MVP, either 0 (void) or 1 (anything else)
  if (sigRet == 'v') {
    typeSection.push(0x00);
  } else {
    typeSection = typeSection.concat([0x01, typeCodes[sigRet]]);
  }

  // Write the overall length of the type section back into the section header
  // (excepting the 2 bytes for the section id and length)
  typeSection[1] = typeSection.length - 2;

  // Rest of the module is static
  var bytes = new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, // magic ("\0asm")
    0x01, 0x00, 0x00, 0x00, // version: 1
  ].concat(typeSection, [
    0x02, 0x07, // import section
      // (import "e" "f" (func 0 (type 0)))
      0x01, 0x01, 0x65, 0x01, 0x66, 0x00, 0x00,
    0x07, 0x05, // export section
      // (export "f" (func 0 (type 0)))
      0x01, 0x01, 0x66, 0x00, 0x00,
  ]));

   // We can compile this wasm module synchronously because it is very small.
  // This accepts an import (at "e.f"), that it reroutes to an export (at "f")
  var module = new WebAssembly.Module(bytes);
  var instance = new WebAssembly.Instance(module, {
    'e': {
      'f': func
    }
  });
  var wrappedFunc = instance.exports['f'];
  return wrappedFunc;
}

// Add a wasm function to the table.
function addFunctionWasm(func, sig) {
  var table = wasmTable;
  var ret = table.length;

  // Grow the table
  try {
    table.grow(1);
  } catch (err) {
    if (!(err instanceof RangeError)) {
      throw err;
    }
    throw 'Unable to grow wasm table. Use a higher value for RESERVED_FUNCTION_POINTERS or set ALLOW_TABLE_GROWTH.';
  }

  // Insert new element
  try {
    // Attempting to call this with JS function will cause of table.set() to fail
    table.set(ret, func);
  } catch (err) {
    if (!(err instanceof TypeError)) {
      throw err;
    }
    assert(typeof sig !== 'undefined', 'Missing signature argument to addFunction');
    var wrapped = convertJsFunctionToWasm(func, sig);
    table.set(ret, wrapped);
  }

  return ret;
}

function removeFunctionWasm(index) {
  // TODO(sbc): Look into implementing this to allow re-using of table slots
}

// 'sig' parameter is required for the llvm backend but only when func is not
// already a WebAssembly function.
function addFunction(func, sig) {
  assert(typeof func !== 'undefined');

  return addFunctionWasm(func, sig);
}

function removeFunction(index) {
  removeFunctionWasm(index);
}

var funcWrappers = {};

function getFuncWrapper(func, sig) {
  if (!func) return; // on null pointer, return undefined
  assert(sig);
  if (!funcWrappers[sig]) {
    funcWrappers[sig] = {};
  }
  var sigCache = funcWrappers[sig];
  if (!sigCache[func]) {
    // optimize away arguments usage in common cases
    if (sig.length === 1) {
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func);
      };
    } else if (sig.length === 2) {
      sigCache[func] = function dynCall_wrapper(arg) {
        return dynCall(sig, func, [arg]);
      };
    } else {
      // general case
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func, Array.prototype.slice.call(arguments));
      };
    }
  }
  return sigCache[func];
}


function makeBigInt(low, high, unsigned) {
  return unsigned ? ((+((low>>>0)))+((+((high>>>0)))*4294967296.0)) : ((+((low>>>0)))+((+((high|0)))*4294967296.0));
}

function dynCall(sig, ptr, args) {
  if (args && args.length) {
    assert(args.length == sig.length-1);
    assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
    return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
  } else {
    assert(sig.length == 1);
    assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
    return Module['dynCall_' + sig].call(null, ptr);
  }
}

var tempRet0 = 0;

var setTempRet0 = function(value) {
  tempRet0 = value;
};

var getTempRet0 = function() {
  return tempRet0;
};

function getCompilerSetting(name) {
  throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for getCompilerSetting or emscripten_get_compiler_setting to work';
}

var Runtime = {
  // helpful errors
  getTempRet0: function() { abort('getTempRet0() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
  staticAlloc: function() { abort('staticAlloc() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
  stackAlloc: function() { abort('stackAlloc() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
};

// The address globals begin at. Very low in memory, for code size and optimization opportunities.
// Above 0 is static memory, starting with globals.
// Then the stack.
// Then 'dynamic' memory for sbrk.
var GLOBAL_BASE = 1024;




// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html


var wasmBinary;if (Module['wasmBinary']) wasmBinary = Module['wasmBinary'];if (!Object.getOwnPropertyDescriptor(Module, 'wasmBinary')) Object.defineProperty(Module, 'wasmBinary', { configurable: true, get: function() { abort('Module.wasmBinary has been replaced with plain wasmBinary') } });
var noExitRuntime;if (Module['noExitRuntime']) noExitRuntime = Module['noExitRuntime'];if (!Object.getOwnPropertyDescriptor(Module, 'noExitRuntime')) Object.defineProperty(Module, 'noExitRuntime', { configurable: true, get: function() { abort('Module.noExitRuntime has been replaced with plain noExitRuntime') } });


if (typeof WebAssembly !== 'object') {
  abort('No WebAssembly support found. Build with -s WASM=0 to target JavaScript instead.');
}


// In MINIMAL_RUNTIME, setValue() and getValue() are only available when building with safe heap enabled, for heap safety checking.
// In traditional runtime, setValue() and getValue() are always available (although their use is highly discouraged due to perf penalties)

/** @type {function(number, number, string, boolean=)} */
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math_min((+(Math_floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}

/** @type {function(number, string, boolean=)} */
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for getValue: ' + type);
    }
  return null;
}





// Wasm globals

var wasmMemory;

// In fastcomp asm.js, we don't need a wasm Table at all.
// In the wasm backend, we polyfill the WebAssembly object,
// so this creates a (non-native-wasm) table for us.
var wasmTable = new WebAssembly.Table({
  'initial': 6,
  'maximum': 6 + 0,
  'element': 'anyfunc'
});


//========================================
// Runtime essentials
//========================================

// whether we are quitting the application. no code should run after this.
// set in exit() and abort()
var ABORT = false;

// set by exit() and abort().  Passed to 'onExit' handler.
// NOTE: This is also used as the process return code code in shell environments
// but only when noExitRuntime is false.
var EXITSTATUS = 0;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  assert(func, 'Cannot call unknown function ' + ident + ', make sure it is exported');
  return func;
}

// C calling interface.
function ccall(ident, returnType, argTypes, args, opts) {
  // For fast lookup of conversion functions
  var toC = {
    'string': function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) { // null string
        // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
        var len = (str.length << 2) + 1;
        ret = stackAlloc(len);
        stringToUTF8(str, ret, len);
      }
      return ret;
    },
    'array': function(arr) {
      var ret = stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    }
  };

  function convertReturnValue(ret) {
    if (returnType === 'string') return UTF8ToString(ret);
    if (returnType === 'boolean') return Boolean(ret);
    return ret;
  }

  var func = getCFunc(ident);
  var cArgs = [];
  var stack = 0;
  assert(returnType !== 'array', 'Return type should not be "array".');
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]];
      if (converter) {
        if (stack === 0) stack = stackSave();
        cArgs[i] = converter(args[i]);
      } else {
        cArgs[i] = args[i];
      }
    }
  }
  var ret = func.apply(null, cArgs);
  var asyncMode = opts && opts.async;
  var runningAsync = typeof Asyncify === 'object' && Asyncify.currData;
  var prevRunningAsync = typeof Asyncify === 'object' && Asyncify.asyncFinalizers.length > 0; 
  assert(!asyncMode || !prevRunningAsync, 'Cannot have multiple async ccalls in flight at once');
  // Check if we started an async operation just now.
  if (runningAsync && !prevRunningAsync) {
    // If so, the WASM function ran asynchronous and unwound its stack.
    // We need to return a Promise that resolves the return value
    // once the stack is rewound and execution finishes.
    assert(asyncMode, 'The call to ' + ident + ' is running asynchronously. If this was intended, add the async option to the ccall/cwrap call.');
    return new Promise(function(resolve) {
      Asyncify.asyncFinalizers.push(function(ret) {
        if (stack !== 0) stackRestore(stack);
        resolve(convertReturnValue(ret));
      });
    });
  }

  ret = convertReturnValue(ret);
  if (stack !== 0) stackRestore(stack);
  // If this is an async ccall, ensure we return a promise
  if (opts && opts.async) return Promise.resolve(ret);
  return ret;
}

function cwrap(ident, returnType, argTypes, opts) {
  return function() {
    return ccall(ident, returnType, argTypes, arguments, opts);
  }
}

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_DYNAMIC = 2; // Cannot be freed except through sbrk
var ALLOC_NONE = 3; // Do not allocate

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
/** @type {function((TypedArray|Array<number>|number), string, number, number=)} */
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [_malloc,
    stackAlloc,
    dynamicAlloc][allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var stop;
    ptr = ret;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(/** @type {!Uint8Array} */ (slab), ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }
    assert(type, 'Must know what type to store in allocate!');

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!runtimeInitialized) return dynamicAlloc(size);
  return _malloc(size);
}




// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAPU8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}


// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;

/**
 * @param {number} idx
 * @param {number=} maxBytesToRead
 * @return {string}
 */
function UTF8ArrayToString(u8Array, idx, maxBytesToRead) {
  var endIdx = idx + maxBytesToRead;
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  // (As a tiny code save trick, compare endPtr against endIdx using a negation, so that undefined means Infinity)
  while (u8Array[endPtr] && !(endPtr >= endIdx)) ++endPtr;

  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
  } else {
    var str = '';
    // If building with TextDecoder, we have already computed the string length above, so test loop end condition against that
    while (idx < endPtr) {
      // For UTF8 byte structure, see:
      // http://en.wikipedia.org/wiki/UTF-8#Description
      // https://www.ietf.org/rfc/rfc2279.txt
      // https://tools.ietf.org/html/rfc3629
      var u0 = u8Array[idx++];
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      var u1 = u8Array[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      var u2 = u8Array[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        if ((u0 & 0xF8) != 0xF0) warnOnce('Invalid UTF-8 leading byte 0x' + u0.toString(16) + ' encountered when deserializing a UTF-8 string on the asm.js/wasm heap to a JS string!');
        u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (u8Array[idx++] & 63);
      }

      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
  return str;
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns a
// copy of that string as a Javascript String object.
// maxBytesToRead: an optional length that specifies the maximum number of bytes to read. You can omit
//                 this parameter to scan the string until the first \0 byte. If maxBytesToRead is
//                 passed, and the string at [ptr, ptr+maxBytesToReadr[ contains a null byte in the
//                 middle, then the string will cut short at that byte index (i.e. maxBytesToRead will
//                 not produce a string of exact length [ptr, ptr+maxBytesToRead[)
//                 N.B. mixing frequent uses of UTF8ToString() with and without maxBytesToRead may
//                 throw JS JIT optimizations off, so it is worth to consider consistently using one
//                 style or the other.
/**
 * @param {number} ptr
 * @param {number=} maxBytesToRead
 * @return {string}
 */
function UTF8ToString(ptr, maxBytesToRead) {
  return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : '';
}

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array.
//                    This count should include the null terminator,
//                    i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) {
      var u1 = str.charCodeAt(++i);
      u = 0x10000 + ((u & 0x3FF) << 10) | (u1 & 0x3FF);
    }
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 3 >= endIdx) break;
      if (u >= 0x200000) warnOnce('Invalid Unicode code point 0x' + u.toString(16) + ' encountered when serializing a JS string to an UTF-8 string on the asm.js/wasm heap! (Valid unicode code points should be in range 0-0x1FFFFF).');
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.
function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) ++len;
    else if (u <= 0x7FF) len += 2;
    else if (u <= 0xFFFF) len += 3;
    else len += 4;
  }
  return len;
}


// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
function UTF16ToString(ptr) {
  assert(ptr % 2 == 0, 'Pointer passed to UTF16ToString must be aligned to two bytes!');
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  while (HEAP16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var i = 0;

    var str = '';
    while (1) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) return str;
      ++i;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 2 == 0, 'Pointer passed to stringToUTF16 must be aligned to two bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}

function UTF32ToString(ptr) {
  assert(ptr % 4 == 0, 'Pointer passed to UTF32ToString must be aligned to four bytes!');
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 4 == 0, 'Pointer passed to stringToUTF32 must be aligned to four bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}

// Allocate heap space for a JS string, and write it there.
// It is the responsibility of the caller to free() that memory.
function allocateUTF8(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = _malloc(size);
  if (ret) stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Allocate stack space for a JS string, and write it there.
function allocateUTF8OnStack(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated */
function writeStringToMemory(string, buffer, dontAddNull) {
  warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var /** @type {number} */ lastChar, /** @type {number} */ end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}

function writeArrayToMemory(array, buffer) {
  assert(array.length >= 0, 'writeArrayToMemory array must have a length (should be an array or typed array)')
  HEAP8.set(array, buffer);
}

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert(str.charCodeAt(i) === str.charCodeAt(i)&0xff);
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}




// Memory management

var PAGE_SIZE = 16384;
var WASM_PAGE_SIZE = 65536;
var ASMJS_PAGE_SIZE = 16777216;

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}

var HEAP,
/** @type {ArrayBuffer} */
  buffer,
/** @type {Int8Array} */
  HEAP8,
/** @type {Uint8Array} */
  HEAPU8,
/** @type {Int16Array} */
  HEAP16,
/** @type {Uint16Array} */
  HEAPU16,
/** @type {Int32Array} */
  HEAP32,
/** @type {Uint32Array} */
  HEAPU32,
/** @type {Float32Array} */
  HEAPF32,
/** @type {Float64Array} */
  HEAPF64;

function updateGlobalBufferAndViews(buf) {
  buffer = buf;
  Module['HEAP8'] = HEAP8 = new Int8Array(buf);
  Module['HEAP16'] = HEAP16 = new Int16Array(buf);
  Module['HEAP32'] = HEAP32 = new Int32Array(buf);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buf);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buf);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buf);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buf);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buf);
}

var STATIC_BASE = 1024,
    STACK_BASE = 5248016,
    STACKTOP = STACK_BASE,
    STACK_MAX = 5136,
    DYNAMIC_BASE = 5248016,
    DYNAMICTOP_PTR = 4976;

assert(STACK_BASE % 16 === 0, 'stack must start aligned');
assert(DYNAMIC_BASE % 16 === 0, 'heap must start aligned');



var TOTAL_STACK = 5242880;
if (Module['TOTAL_STACK']) assert(TOTAL_STACK === Module['TOTAL_STACK'], 'the stack size can no longer be determined at runtime')

var INITIAL_TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;if (!Object.getOwnPropertyDescriptor(Module, 'TOTAL_MEMORY')) Object.defineProperty(Module, 'TOTAL_MEMORY', { configurable: true, get: function() { abort('Module.TOTAL_MEMORY has been replaced with plain INITIAL_TOTAL_MEMORY') } });

assert(INITIAL_TOTAL_MEMORY >= TOTAL_STACK, 'TOTAL_MEMORY should be larger than TOTAL_STACK, was ' + INITIAL_TOTAL_MEMORY + '! (TOTAL_STACK=' + TOTAL_STACK + ')');

// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && Int32Array.prototype.subarray !== undefined && Int32Array.prototype.set !== undefined,
       'JS engine does not provide full typed array support');






// In standalone mode, the wasm creates the memory, and the user can't provide it.
// In non-standalone/normal mode, we create the memory here.

// Create the main memory. (Note: this isn't used in STANDALONE_WASM mode since the wasm
// memory is created in the wasm, not in JS.)

  if (Module['wasmMemory']) {
    wasmMemory = Module['wasmMemory'];
  } else
  {
    wasmMemory = new WebAssembly.Memory({
      'initial': INITIAL_TOTAL_MEMORY / WASM_PAGE_SIZE
      ,
      'maximum': INITIAL_TOTAL_MEMORY / WASM_PAGE_SIZE
    });
  }


if (wasmMemory) {
  buffer = wasmMemory.buffer;
}

// If the user provides an incorrect length, just use that length instead rather than providing the user to
// specifically provide the memory length with Module['TOTAL_MEMORY'].
INITIAL_TOTAL_MEMORY = buffer.byteLength;
assert(INITIAL_TOTAL_MEMORY % WASM_PAGE_SIZE === 0);
updateGlobalBufferAndViews(buffer);

HEAP32[DYNAMICTOP_PTR>>2] = DYNAMIC_BASE;




// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  assert((STACK_MAX & 3) == 0);
  // The stack grows downwards
  HEAPU32[(STACK_MAX >> 2)+1] = 0x2135467;
  HEAPU32[(STACK_MAX >> 2)+2] = 0x89BACDFE;
  // Also test the global address 0 for integrity.
  // We don't do this with ASan because ASan does its own checks for this.
  HEAP32[0] = 0x63736d65; /* 'emsc' */
}

function checkStackCookie() {
  var cookie1 = HEAPU32[(STACK_MAX >> 2)+1];
  var cookie2 = HEAPU32[(STACK_MAX >> 2)+2];
  if (cookie1 != 0x2135467 || cookie2 != 0x89BACDFE) {
    abort('Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x2135467, but received 0x' + cookie2.toString(16) + ' ' + cookie1.toString(16));
  }
  // Also test the global address 0 for integrity.
  // We don't do this with ASan because ASan does its own checks for this.
  if (HEAP32[0] !== 0x63736d65 /* 'emsc' */) abort('Runtime error: The application has corrupted its heap memory area (address zero)!');
}

function abortStackOverflow(allocSize) {
  abort('Stack overflow! Attempted to allocate ' + allocSize + ' bytes on the stack, but stack has only ' + (STACK_MAX - stackSave() + allocSize) + ' bytes available!');
}




// Endianness check (note: assumes compiler arch was little-endian)
(function() {
  var h16 = new Int16Array(1);
  var h8 = new Int8Array(h16.buffer);
  h16[0] = 0x6373;
  if (h8[0] !== 0x73 || h8[1] !== 0x63) throw 'Runtime error: expected the system to be little-endian!';
})();

function abortFnPtrError(ptr, sig) {
	abort("Invalid function pointer " + ptr + " called with signature '" + sig + "'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this). Build with ASSERTIONS=2 for more info.");
}



function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Module['dynCall_v'](func);
      } else {
        Module['dynCall_vi'](func, callback.arg);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the main() is called

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {

  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }

  callRuntimeCallbacks(__ATPRERUN__);
}

function initRuntime() {
  checkStackCookie();
  assert(!runtimeInitialized);
  runtimeInitialized = true;
  
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  checkStackCookie();
  
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  checkStackCookie();
  runtimeExited = true;
}

function postRun() {
  checkStackCookie();

  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }

  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}

function addOnExit(cb) {
}

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}


assert(Math.imul, 'This browser does not support Math.imul(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.fround, 'This browser does not support Math.fround(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.clz32, 'This browser does not support Math.clz32(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.trunc, 'This browser does not support Math.trunc(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');

var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_round = Math.round;
var Math_min = Math.min;
var Math_max = Math.max;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;



// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// Module.preRun (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
  return id;
}

function addRunDependency(id) {
  runDependencies++;

  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }

  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            err('still waiting on run dependencies:');
          }
          err('dependency: ' + dep);
        }
        if (shown) {
          err('(end of list)');
        }
      }, 10000);
    }
  } else {
    err('warning: run dependency added without ID');
  }
}

function removeRunDependency(id) {
  runDependencies--;

  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }

  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    err('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data


function abort(what) {
  if (Module['onAbort']) {
    Module['onAbort'](what);
  }

  what += '';
  out(what);
  err(what);

  ABORT = true;
  EXITSTATUS = 1;

  var output = 'abort(' + what + ') at ' + stackTrace();
  what = output;

  // Throw a wasm runtime error, because a JS error might be seen as a foreign
  // exception, which means we'd run destructors on it. We need the error to
  // simply make the program stop.
  throw new WebAssembly.RuntimeError(what);
}


var memoryInitializer = null;



// show errors on likely calls to FS when it was not included
var FS = {
  error: function() {
    abort('Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with  -s FORCE_FILESYSTEM=1');
  },
  init: function() { FS.error() },
  createDataFile: function() { FS.error() },
  createPreloadedFile: function() { FS.error() },
  createLazyFile: function() { FS.error() },
  open: function() { FS.error() },
  mkdev: function() { FS.error() },
  registerDevice: function() { FS.error() },
  analyzePath: function() { FS.error() },
  loadFilesFromDB: function() { FS.error() },

  ErrnoError: function ErrnoError() { FS.error() },
};
Module['FS_createDataFile'] = FS.createDataFile;
Module['FS_createPreloadedFile'] = FS.createPreloadedFile;



// Copyright 2017 The Emscripten Authors.  All rights reserved.
// Emscripten is available under two separate licenses, the MIT license and the
// University of Illinois/NCSA Open Source License.  Both these licenses can be
// found in the LICENSE file.

// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = 'data:application/octet-stream;base64,';

// Indicates whether filename is a base64 data URI.
function isDataURI(filename) {
  return String.prototype.startsWith ?
      filename.startsWith(dataURIPrefix) :
      filename.indexOf(dataURIPrefix) === 0;
}




var wasmBinaryFile = 'data:application/octet-stream;base64,AGFzbQEAAAABnQEXYAF/AX9gA39/fwF/YAF/AGAAAX9gAABgAn9/AGACf38Bf2AGf3x/f39/AX9gA39+fwF+YAN/f38AYAR/fn5/AGAEf39/fwF/YAV/f39/fwF/YAJ+fwF/YAR/f39/AGAFf39/f38AYAd/f39/f39/AX9gB39/fH9/f38Bf2ADfn9/AX9gBH9/fn8BfmABfAF+YAJ+fgF8YAJ8fwF8AvcBDANlbnYHc3RhcnR1cAAEA2VudgpnZXRjaGFyX2pzAAMDZW52CnB1dGNoYXJfanMAABZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxCGZkX3dyaXRlAAsDZW52Bl9fbG9jawACA2VudghfX3VubG9jawACA2VudhVlbXNjcmlwdGVuX21lbWNweV9iaWcAAQNlbnYWZW1zY3JpcHRlbl9yZXNpemVfaGVhcAAAA2VudhdfX2hhbmRsZV9zdGFja19vdmVyZmxvdwAEA2VudgtzZXRUZW1wUmV0MAACA2VudgZtZW1vcnkCAYACgAIDZW52BXRhYmxlAXAABgM/PgMEAwYBAAgAAgMEAAEMEAkADg8NEg0BBwUUBgMABgMBAxYBAAoKFQEBAAACBQAAAgMAAgAGCxMRCQwCBAIEBh4FfwFB8KbAAgt/AEHwJgt/AUEAC38BQQALfwFBAAsH2AIWEV9fd2FzbV9jYWxsX2N0b3JzAAsEbWFpbgANBmZmbHVzaAA3EF9fZXJybm9fbG9jYXRpb24AJQhzZXRUaHJldwA2Bm1hbGxvYwA0BGZyZWUANQpfX2RhdGFfZW5kAwERX19zZXRfc3RhY2tfbGltaXQAOQlzdGFja1NhdmUAOgpzdGFja0FsbG9jADsMc3RhY2tSZXN0b3JlADwQX19ncm93V2FzbU1lbW9yeQA9CmR5bkNhbGxfaWkAPgxkeW5DYWxsX2lpaWkAPwxkeW5DYWxsX2ppamkAQw9keW5DYWxsX2lpZGlpaWkAQQtkeW5DYWxsX3ZpaQBCFWFzeW5jaWZ5X3N0YXJ0X3Vud2luZABEFGFzeW5jaWZ5X3N0b3BfdW53aW5kAEUVYXN5bmNpZnlfc3RhcnRfcmV3aW5kAEYUYXN5bmNpZnlfc3RvcF9yZXdpbmQARwkLAQBBAQsFDw4QISIKhJ0DPgwBAX8jAyEAQfAmDwsLAQF/IwMhAAJACwvmDgFUfyMDQQJGBEAjBCMEKAIAQcR9ajYCACMEKAIAIVIgUigCACEAIFIoAgQhASBSKAIIIQIgUigCDCEDIFIoAhAhBCBSKAIUIQUgUigCGCEGIFIoAhwhByBSKAIgIQggUigCJCEJIFIoAighCiBSKAIsIQsgUigCMCEMIFIoAjQhDSBSKAI4IQ4gUigCPCEPIFIoAkAhECBSKAJEIREgUigCSCESIFIoAkwhEyBSKAJQIRQgUigCVCEVIFIoAlghFiBSKAJcIRcgUigCYCEYIFIoAmQhGSBSKAJoIRogUigCbCEbIFIoAnAhHCBSKAJ0IR0gUigCeCEeIFIoAnwhHyBSKAKAASEgIFIoAoQBISEgUigCiAEhIiBSKAKMASEjIFIoApABISQgUigClAEhJSBSKAKYASEmIFIoApwBIScgUigCoAEhKCBSKAKkASEpIFIoAqgBISogUigCrAEhKyBSKAKwASEsIFIoArQBIS0gUigCuAEhLiBSKAK8ASEvIFIoAsABITAgUigCxAEhMSBSKALIASEyIFIoAswBITMgUigC0AEhNCBSKALUASE1IFIoAtgBITYgUigC3AEhNyBSKALgASE4IFIoAuQBITkgUigC6AEhOiBSKALsASE7IFIoAvABITwgUigC9AEhPSBSKAL4ASE+IFIoAvwBIT8gUigCgAIhQCBSKAKEAiFBIFIoAogCIUIgUigCjAIhQyBSKAKQAiFEIFIoApQCIUUgUigCmAIhRiBSKAKcAiFHIFIoAqACIUggUigCpAIhSSBSKAKoAiFKIFIoAqwCIUsgUigCsAIhTCBSKAK0AiFNIFIoArgCIU4LAn8CQAJAIwNBAkYEQCMEIwQoAgBBfGo2AgAjBCgCACgCACFQCwJAIwNBAEYEQCMAIRkgGSEAQRAhASAAIRogASEbIBogG2shHCAcIQICQAJAIAIhHSAdIRcgFyEeIwIhHyAeIB9JISAgIARAEAgLCyAXISEgISQAC0EAIQMgAiEiIAMhIyAiICM2AgwQAAsBAQEBAQEBAQEBAQECQANAIwNBAEYEQEF/IQQLIwNBAEYEf0EBBSBQQQBGCwRAEAEhUSMDQQFGBEBBAAwHBSBRISQLCyMDQQBGBEAgJCEFIAIhJSAFISYgJSAmOgALQRghBiAFIScgBiEoICcgKHQhKSApIQcgByEqIAYhKyAqICt1ISwgLCEIIAghLSAtIQkgBCEuIC4hCiAJIS8gCiEwIC8gMEchMSAxIQtBASEMIAshMiAMITMgMiAzcSE0IDQhDSANITUgNUUhNiA2DQIgAiE3IDctAAshOCA4IQ5BGCEPIA4hOSAPITogOSA6dCE7IDshECAQITwgDyE9IDwgPXUhPiA+IREgESE/ID8QAiFAIEAaDAELAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQELCyMDQQBGBEBB2xIhEkEAIRMgEiFBIBMhQiBBIEIQJCFDIEMaQQAhFEEQIRUgAiFEIBUhRSBEIEVqIUYgRiEWAkACQCAWIUcgRyEYIBghSCMCIUkgSCBJSSFKIEoEQBAICwsgGCFLIEskAAsgFCFMIEwPCwEBAQEBAQEBAQEBAQEBCwAACwAAAAsACyFPAkAjBCgCACBPNgIAIwQjBCgCAEEEajYCAAsCQCMEKAIAIVMgUyAANgIAIFMgATYCBCBTIAI2AgggUyADNgIMIFMgBDYCECBTIAU2AhQgUyAGNgIYIFMgBzYCHCBTIAg2AiAgUyAJNgIkIFMgCjYCKCBTIAs2AiwgUyAMNgIwIFMgDTYCNCBTIA42AjggUyAPNgI8IFMgEDYCQCBTIBE2AkQgUyASNgJIIFMgEzYCTCBTIBQ2AlAgUyAVNgJUIFMgFjYCWCBTIBc2AlwgUyAYNgJgIFMgGTYCZCBTIBo2AmggUyAbNgJsIFMgHDYCcCBTIB02AnQgUyAeNgJ4IFMgHzYCfCBTICA2AoABIFMgITYChAEgUyAiNgKIASBTICM2AowBIFMgJDYCkAEgUyAlNgKUASBTICY2ApgBIFMgJzYCnAEgUyAoNgKgASBTICk2AqQBIFMgKjYCqAEgUyArNgKsASBTICw2ArABIFMgLTYCtAEgUyAuNgK4ASBTIC82ArwBIFMgMDYCwAEgUyAxNgLEASBTIDI2AsgBIFMgMzYCzAEgUyA0NgLQASBTIDU2AtQBIFMgNjYC2AEgUyA3NgLcASBTIDg2AuABIFMgOTYC5AEgUyA6NgLoASBTIDs2AuwBIFMgPDYC8AEgUyA9NgL0ASBTID42AvgBIFMgPzYC/AEgUyBANgKAAiBTIEE2AoQCIFMgQjYCiAIgUyBDNgKMAiBTIEQ2ApACIFMgRTYClAIgUyBGNgKYAiBTIEc2ApwCIFMgSDYCoAIgUyBJNgKkAiBTIEo2AqgCIFMgSzYCrAIgUyBMNgKwAiBTIE02ArQCIFMgTjYCuAIjBCMEKAIAQbwCajYCAAtBAAulAgEKfyMDQQJGBEAjBCMEKAIAQWRqNgIAIwQoAgAhCiAKKAIAIQAgCigCBCEBIAooAgghAiAKKAIMIQMgCigCECEEIAooAhQhBSAKKAIYIQYLAn8CQAJAIwNBAkYEQCMEIwQoAgBBfGo2AgAjBCgCACgCACEICwJAIwNBAEYEf0EBBSAIQQBGCwRAEAwhCSMDQQFGBEBBAAwFBSAJIQMLCyMDQQBGBEAgAyECIAIhBCAEDwsBAQsAAAsAAAALAAshBwJAIwQoAgAgBzYCACMEIwQoAgBBBGo2AgALAkAjBCgCACELIAsgADYCACALIAE2AgQgCyACNgIIIAsgAzYCDCALIAQ2AhAgCyAFNgIUIAsgBjYCGCMEIwQoAgBBHGo2AgALQQAL2gYBe38jAyF7AkACQAJAIwAhCyALQSBrIQwgDCEDIAMhDSANIQkgCSEOIwIhDyAOIA9JIRAgEARAEAgjAyB7RwRAAAsLCyAJIREgESQACyADIRIgACETIBMoAhwhFCAUIQQgBCEVIBIgFTYCECAAIRYgFigCFCEXIBchBSADIRggAiEZIBggGTYCHCADIRogASEbIBogGzYCGCADIRwgBSEdIAQhHiAdIB5rIR8gHyEBIAEhICAcICA2AhQgASEhIAIhIiAhICJqISMgIyEGQQIhBSADISQgJEEQaiElICUhAQNAAkACQCAAISYgJigCPCEnIAEhKCAFISkgAyEqICpBDGohKwJ/ICcgKCApICsQAyF8IwMge0cEQAALIHwLISwCfyAsEC0hfSMDIHtHBEAACyB9CyEtIC1FIS4gLg0AQX8hBCADIS8gL0F/NgIMDAELIAMhMCAwKAIMITEgMSEECwJAAkACQCAGITIgBCEzIDIgM0chNCA0DQAgACE1IAAhNiA2KAIsITcgNyEBIAEhOCA1IDg2AhwgACE5IAEhOiA5IDo2AhQgACE7IAEhPCAAIT0gPSgCMCE+IDwgPmohPyA7ID82AhAgAiFAIEAhBAwBCyAEIUEgQUF/SiFCIEINAUEAIQQgACFDIENBADYCHCAAIUQgREIANwMQIAAhRSAAIUYgRigCACFHIEdBIHIhSCBFIEg2AgAgBSFJIElBAkYhSiBKDQAgAiFLIAEhTCBMKAIEIU0gSyBNayFOIE4hBAsCQAJAIAMhTyBPQSBqIVAgUCEKIAohUSMCIVIgUSBSSSFTIFMEQBAIIwMge0cEQAALCwsgCiFUIFQkAAsgBCFVIFUPCyABIVYgVkEIaiFXIAEhWCAEIVkgASFaIFooAgQhWyBbIQcgByFcIFkgXEshXSBdIQggCCFeIFcgWCBeGyFfIF8hASABIWAgASFhIGEoAgAhYiAEIWMgByFkIAghZSBkQQAgZRshZiBjIGZrIWcgZyEHIAchaCBiIGhqIWkgYCBpNgIAIAEhaiABIWsgaygCBCFsIAchbSBsIG1rIW4gaiBuNgIEIAYhbyAEIXAgbyBwayFxIHEhBiAFIXIgCCFzIHIgc2shdCB0IQUMAAALAAALAAsLAQF/IwMhAUEADwsLAQF/IwMhA0IADwsLAQF/IwMhAUEBDwsLAQF/IwMhAQJACwstAQN/IwMhAgJAAkACQEGoIhAEIwMgAkcEQAALC0GwIiEACyAAIQEgAQ8ACwALGQEBfyMDIQACQEGoIhAFIwMgAEcEQAALCwvjAQEffyMDIR8CQAJAIAAhAiAAIQMgAy0ASiEEIAQhASABIQUgBUF/aiEGIAEhByAGIAdyIQggAiAIOgBKAkAgACEJIAkoAgAhCiAKIQEgASELIAtBCHEhDCAMRSENIA0NACAAIQ4gASEPIA9BIHIhECAOIBA2AgBBfw8LIAAhESARQgA3AgQgACESIAAhEyATKAIsIRQgFCEBIAEhFSASIBU2AhwgACEWIAEhFyAWIBc2AhQgACEYIAEhGSAAIRogGigCMCEbIBkgG2ohHCAYIBw2AhBBACEdCyAdIR4gHg8ACwALpgQBTH8jAyFKAkACQAJAAkAgAiEHIAcoAhAhCCAIIQMgAyEJIAkNAEEAIQQgAiEKAn8gChAVIUsjAyBKRwRAAAsgSwshCyALDQEgAiEMIAwoAhAhDSANIQMLAkAgAyEOIAIhDyAPKAIUIRAgECEFIAUhESAOIBFrIRIgASETIBIgE08hFCAUDQAgAiEVIAAhFiABIRcgAiEYIBgoAiQhGQJ/IBUgFiAXIBkRAQAhTCMDIEpHBEAACyBMCyEaIBoPC0EAIQYCQCACIRsgGywASyEcIBxBAEghHSAdDQAgASEeIB4hBANAIAQhHyAfIQMgAyEgICBFISEgIQ0BIAAhIiADISMgI0F/aiEkICQhBCAEISUgIiAlaiEmICYtAAAhJyAnQQpHISggKA0ACyACISkgACEqIAMhKyACISwgLCgCJCEtAn8gKSAqICsgLREBACFNIwMgSkcEQAALIE0LIS4gLiEEIAQhLyADITAgLyAwSSExIDENASABITIgAyEzIDIgM2shNCA0IQEgACE1IAMhNiA1IDZqITcgNyEAIAIhOCA4KAIUITkgOSEFIAMhOiA6IQYLIAUhOyAAITwgASE9An8gOyA8ID0QMSFOIwMgSkcEQAALIE4LIT4gPhogAiE/IAIhQCBAKAIUIUEgASFCIEEgQmohQyA/IEM2AhQgBiFEIAEhRSBEIEVqIUYgRiEECyAEIUcgRyFICyBIIUkgSQ8ACwALoAgBgQF/IwMhfwJAAkACQAJAIwAhCiAKQdABayELIAshBSAFIQwgDCEIIAghDSMCIQ4gDSAOSSEPIA8EQBAIIwMgf0cEQAALCwsgCCEQIBAkAAsgBSERIAIhEiARIBI2AswBQQAhAiAFIRMgE0GgAWohFAJ/IBRBAEEoEDIhgAEjAyB/RwRAAAsggAELIRUgFRogBSEWIAUhFyAXKALMASEYIBYgGDYCyAECQAJAIAEhGSAFIRogGkHIAWohGyAFIRwgHEHQAGohHSAFIR4gHkGgAWohHyADISAgBCEhAn9BACAZIBsgHSAfICAgIRAYIYEBIwMgf0cEQAALIIEBCyEiICJBAE4hIyAjDQBBfyEBDAELAkAgACEkICQoAkwhJSAlQQBIISYgJg0AIAAhJwJ/ICcQESGCASMDIH9HBEAACyCCAQshKCAoIQILIAAhKSApKAIAISogKiEGAkAgACErICssAEohLCAsQQBKIS0gLQ0AIAAhLiAGIS8gL0FfcSEwIC4gMDYCAAsgBiExIDFBIHEhMiAyIQYCQAJAIAAhMyAzKAIwITQgNEUhNSA1DQAgACE2IAEhNyAFITggOEHIAWohOSAFITogOkHQAGohOyAFITwgPEGgAWohPSADIT4gBCE/An8gNiA3IDkgOyA9ID4gPxAYIYMBIwMgf0cEQAALIIMBCyFAIEAhAQwBCyAAIUEgQUHQADYCMCAAIUIgBSFDIENB0ABqIUQgQiBENgIQIAAhRSAFIUYgRSBGNgIcIAAhRyAFIUggRyBINgIUIAAhSSBJKAIsIUogSiEHIAAhSyAFIUwgSyBMNgIsIAAhTSABIU4gBSFPIE9ByAFqIVAgBSFRIFFB0ABqIVIgBSFTIFNBoAFqIVQgAyFVIAQhVgJ/IE0gTiBQIFIgVCBVIFYQGCGEASMDIH9HBEAACyCEAQshVyBXIQEgByFYIFhFIVkgWQ0AIAAhWiAAIVsgWygCJCFcAn8gWkEAQQAgXBEBACGFASMDIH9HBEAACyCFAQshXSBdGiAAIV4gXkEANgIwIAAhXyAHIWAgXyBgNgIsIAAhYSBhQQA2AhwgACFiIGJBADYCECAAIWMgYygCFCFkIGQhAyAAIWUgZUEANgIUIAEhZiADIWcgZkF/IGcbIWggaCEBCyAAIWkgACFqIGooAgAhayBrIQMgAyFsIAYhbSBsIG1yIW4gaSBuNgIAIAEhbyADIXAgcEEgcSFxQX8gbyBxGyFyIHIhASACIXMgc0UhdCB0DQAgACF1AkAgdRASIwMgf0cEQAALCwsCQAJAIAUhdiB2QdABaiF3IHchCSAJIXgjAiF5IHggeUkheiB6BEAQCCMDIH9HBEAACwsLIAkheyB7JAALIAEhfCB8IX0LIH0hfiB+DwALAAu/MgP7BH8TfgF8IwMh9AQCQAJAAkACQCMAIRggGEHQAGshGSAZIQcgByEaIBohFiAWIRsjAiEcIBsgHEkhHSAdBEAQCCMDIPQERwRAAAsLCyAWIR4gHiQACyAHIR8gASEgIB8gIDYCTCAHISEgIUE3aiEiICIhCCAHISMgI0E4aiEkICQhCUEAIQpBACELQQAhAQJAA0ACQCALISUgJUEASCEmICYNAAJAIAEhJyALIShB/////wcgKGshKSAnIClMISogKg0AAn8QJSH1BCMDIPQERwRAAAsg9QQLISsgK0E9NgIAQX8hCwwBCyABISwgCyEtICwgLWohLiAuIQsLIAchLyAvKAJMITAgMCEMIAwhMSAxIQECQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkAgDCEyIDItAAAhMyAzIQ0gDSE0IDRFITUgNQ0AAkADQAJAAkACQCANITYgNkH/AXEhNyA3IQ0gDSE4IDgNACABITkgOSENDAELIA0hOiA6QSVHITsgOw0BIAEhPCA8IQ0DQCABIT0gPS0AASE+ID5BJUchPyA/DQEgByFAIAEhQSBBQQJqIUIgQiEOIA4hQyBAIEM2AkwgDSFEIERBAWohRSBFIQ0gASFGIEYtAAIhRyBHIQ8gDiFIIEghASAPIUkgSUElRiFKIEoNAAsLIA0hSyAMIUwgSyBMayFNIE0hAQJAIAAhTiBORSFPIE8NACAAIVAgDCFRIAEhUgJAIFAgUSBSEBkjAyD0BEcEQAALCwsgASFTIFMNEiAHIVQgVCgCTCFVIFUsAAEhVgJ/IFYQJiH2BCMDIPQERwRAAAsg9gQLIVcgVyEOQX8hEEEBIQ0gByFYIFgoAkwhWSBZIQECQCAOIVogWkUhWyBbDQAgASFcIFwtAAIhXSBdQSRHIV4gXg0AIAEhXyBfLAABIWAgYEFQaiFhIGEhEEEBIQpBAyENCyAHIWIgASFjIA0hZCBjIGRqIWUgZSEBIAEhZiBiIGY2AkxBACENAkACQCABIWcgZywAACFoIGghESARIWkgaUFgaiFqIGohDyAPIWsga0EfTSFsIGwNACABIW0gbSEODAELIAEhbiBuIQ4gDyFvQQEgb3QhcCBwIQ8gDyFxIHFBidEEcSFyIHJFIXMgcw0AA0AgByF0IAEhdSB1QQFqIXYgdiEOIA4hdyB0IHc2AkwgDyF4IA0heSB4IHlyIXogeiENIAEheyB7LAABIXwgfCERIBEhfSB9QWBqIX4gfiEPIA8hfyB/QR9LIYABIIABDQEgDiGBASCBASEBIA8hggFBASCCAXQhgwEggwEhDyAPIYQBIIQBQYnRBHEhhQEghQENAAsLAkACQCARIYYBIIYBQSpHIYcBIIcBDQACQAJAIA4hiAEgiAEsAAEhiQECfyCJARAmIfcEIwMg9ARHBEAACyD3BAshigEgigFFIYsBIIsBDQAgByGMASCMASgCTCGNASCNASEOIA4hjgEgjgEtAAIhjwEgjwFBJEchkAEgkAENACAOIZEBIJEBLAABIZIBIJIBQQJ0IZMBIAQhlAEgkwEglAFqIZUBIJUBQcB+aiGWASCWAUEKNgIAIA4hlwEglwFBA2ohmAEgmAEhASAOIZkBIJkBLAABIZoBIJoBQQN0IZsBIAMhnAEgmwEgnAFqIZ0BIJ0BQYB9aiGeASCeASgCACGfASCfASESQQEhCgwBCyAKIaABIKABDQdBACEKQQAhEgJAIAAhoQEgoQFFIaIBIKIBDQAgAiGjASACIaQBIKQBKAIAIaUBIKUBIQEgASGmASCmAUEEaiGnASCjASCnATYCACABIagBIKgBKAIAIakBIKkBIRILIAchqgEgqgEoAkwhqwEgqwFBAWohrAEgrAEhAQsgByGtASABIa4BIK0BIK4BNgJMIBIhrwEgrwFBf0ohsAEgsAENASASIbEBQQAgsQFrIbIBILIBIRIgDSGzASCzAUGAwAByIbQBILQBIQ0MAQsgByG1ASC1AUHMAGohtgECfyC2ARAaIfgEIwMg9ARHBEAACyD4BAshtwEgtwEhEiASIbgBILgBQQBIIbkBILkBDQUgByG6ASC6ASgCTCG7ASC7ASEBC0F/IRMCQCABIbwBILwBLQAAIb0BIL0BQS5HIb4BIL4BDQACQCABIb8BIL8BLQABIcABIMABQSpHIcEBIMEBDQACQCABIcIBIMIBLAACIcMBAn8gwwEQJiH5BCMDIPQERwRAAAsg+QQLIcQBIMQBRSHFASDFAQ0AIAchxgEgxgEoAkwhxwEgxwEhASABIcgBIMgBLQADIckBIMkBQSRHIcoBIMoBDQAgASHLASDLASwAAiHMASDMAUECdCHNASAEIc4BIM0BIM4BaiHPASDPAUHAfmoh0AEg0AFBCjYCACABIdEBINEBLAACIdIBINIBQQN0IdMBIAMh1AEg0wEg1AFqIdUBINUBQYB9aiHWASDWASgCACHXASDXASETIAch2AEgASHZASDZAUEEaiHaASDaASEBIAEh2wEg2AEg2wE2AkwMAgsgCiHcASDcAQ0GAkACQCAAId0BIN0BDQBBACETDAELIAIh3gEgAiHfASDfASgCACHgASDgASEBIAEh4QEg4QFBBGoh4gEg3gEg4gE2AgAgASHjASDjASgCACHkASDkASETCyAHIeUBIAch5gEg5gEoAkwh5wEg5wFBAmoh6AEg6AEhASABIekBIOUBIOkBNgJMDAELIAch6gEgASHrASDrAUEBaiHsASDqASDsATYCTCAHIe0BIO0BQcwAaiHuAQJ/IO4BEBoh+gQjAyD0BEcEQAALIPoECyHvASDvASETIAch8AEg8AEoAkwh8QEg8QEhAQtBACEOA0AgDiHyASDyASEPQX8hFCABIfMB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ESARIRogGCAahiEbIBcgG4QhHCAcIQIgASEdIBEhHiAdIB6GIR8gHyEBCyACISAgIEIAhCEhICEhAgsgACEOIAEhIiAOICI3AwAgACEPIAIhIyAPICM3AwgLC58IAy5/SH4DfCMDIS8CQAJAAkACQCMAIQYgBkEgayEHIAchAiACIQggCCEEIAQhCSMCIQogCSAKSSELIAsEQBAIIwMgL0cEQAALCwsgBCEMIAwkAAsCQAJAIAEhMiAyQv///////////wCDITMgMyEwIDAhNCA0QoCAgICAgMD/Q3whNSAwITYgNkKAgICAgIDAgLx/fCE3IDUgN1ohDSANDQAgACE4IDhCPIghOSABITogOkIEhiE7IDkgO4QhPCA8ITACQCAAIT0gPUL//////////w+DIT4gPiEAIAAhPyA/QoGAgICAgICACFQhDiAODQAgMCFAIEBCgYCAgICAgIDAAHwhQSBBITEMAgsgMCFCIEJCgICAgICAgIDAAHwhQyBDITEgACFEIERCgICAgICAgIAIhSFFIEVCAFIhDyAPDQEgMSFGIEZCAYMhRyAxIUggRyBIfCFJIEkhMQwBCwJAIAAhSiBKUCEQIDAhSyBLQoCAgICAgMD//wBUIREgMCFMIExCgICAgICAwP//AFEhEiAQIBEgEhshEyATDQAgACFNIE1CPIghTiABIU8gT0IEhiFQIE4gUIQhUSBRQv////////8DgyFSIFJCgICAgICAgPz/AIQhUyBTITEMAQtCgICAgICAgPj/ACExIDAhVCBUQv///////7//wwBWIRQgFA0AQgAhMSAwIVUgVUIwiCFWIFanIRUgFSEDIAMhFiAWQZH3AEkhFyAXDQAgAiEYIAAhVyABIVggWEL///////8/gyFZIFlCgICAgICAwACEIVogWiEwIDAhWyADIRlBgfgAIBlrIRoCQCAYIFcgWyAaEC4jAyAvRwRAAAsLIAIhGyAbQRBqIRwgACFcIDAhXSADIR0gHUH/iH9qIR4CQCAcIFwgXSAeEC8jAyAvRwRAAAsLIAIhHyAfKQMAIV4gXiEwIDAhXyBfQjyIIWAgAiEgICBBCGohISAhKQMAIWEgYUIEhiFiIGAgYoQhYyBjITECQCAwIWQgZEL//////////w+DIWUgAiEiICIpAxAhZiACISMgI0EQaiEkICRBCGoh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IAUhnwEgnwFBFGohoAEgAiGhASCgASChATYCACACIaIBIAUhowEgogEgowE2AhgMAQsgAyGkASCkASgCBCGlASClASECIAIhpgEgpgFBA3EhpwEgpwFBA0chqAEgqAENACAAIakBQQAgqQE2AoAjIAMhqgEgAiGrASCrAUF+cSGsASCqASCsATYCBCABIa0BIAAhrgEgrgFBAXIhrwEgrQEgrwE2AgQgASGwASAAIbEBILABILEBaiGyASAAIbMBILIBILMBNgIADwsgAyG0ASABIbUBILQBILUBTSG2ASC2AQ0AIAMhtwEgtwEoAgQhuAEguAEhAiACIbkBILkBQQFxIboBILoBRSG7ASC7AQ0AAkACQCACIbwBILwBQQJxIb0BIL0BDQACQEEAKAKQIyG+ASADIb8BIL4BIL8BRyHAASDAAQ0AIAEhwQFBACDBATYCkCNBACgChCMhwgEgACHDASDCASDDAWohxAEgxAEhACAAIcUBQQAgxQE2AoQjIAEhxgEgACHHASDHAUEBciHIASDGASDIATYCBCABIckBQQAoAowjIcoBIMkBIMoBRyHLASDLAQ0DQQBBADYCgCNBAEEANgKMIw8LAkBBACgCjCMhzAEgAyHNASDMASDNAUchzgEgzgENACABIc8BQQAgzwE2AowjQQAoAoAjIdABIAAh0QEg0AEg0QFqIdIBINIBIQAgACHTAUEAINMBNgKAIyABIdQBIAAh1QEg1QFBAXIh1gEg1AEg1gE2AgQgASHXASAAIdgBINcBINgBaiHZASAAIdoBINkBINoBNgIADwsgAiHbASDbAUF4cSHcASAAId0BINwBIN0BaiHeASDeASEAAkACQCACId8BIN8BQf8BSyHgASDgAQ0AIAMh4QEg4QEoAgwh4gEg4gEhBAJAIAMh4wEg4wEoAggh5AEg5AEhBSAFIeUBIAIh5gEg5gFBA3Yh5wEg5wEhAyADIegBIOgBQQN0IekBIOkBQaAjaiHqASDqASECIAIh6wEg5QEg6wFGIewBIOwBDQBBACgCiCMh7QEgBSHuASDtASDuAUsh7wEg7wEaCwJAIAQh8AEgBSHxASDwASDxAUch8gEg8gENAEEAKAL4IiHzASADIfQBQX4g9AF3IfUBIPMBIPUBcSH2AUEAIPYBNgL4IgwCCwJAIAQh9wEgAiH4ASD3ASD4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eyBwcm9jZXNzLmJ1ZmZlckNvbmNhdCA9IChhLCBiKSA9PiB7IHZhciByZXN1bHQgPSBuZXcgKGEuY29uc3RydWN0b3IpKGEubGVuZ3RoICsgYi5sZW5ndGgpOyByZXN1bHQuc2V0KGEpOyByZXN1bHQuc2V0KGIsIGEubGVuZ3RoKTsgcmV0dXJuIHJlc3VsdDsgfTsgcHJvY2Vzcy5fX2luU3RhdGUgPSB7aW5wdXQ6IG5ldyBVaW50OEFycmF5KDApLCBwb3M6IDAsIHJlc29sdmVyOiBudWxsLCBjbG9zZWQ6IGZhbHNlfTsgcHJvY2Vzcy5fX2luU3RhdGUucG9sbCA9ICgpID0+IHsgaWYgKHByb2Nlc3MuX19pblN0YXRlLnBvcyA8IHByb2Nlc3MuX19pblN0YXRlLmlucHV0Lmxlbmd0aCkgeyBwcm9jZXNzLl9faW5TdGF0ZS5yZXNvbHZlcihwcm9jZXNzLl9faW5TdGF0ZS5pbnB1dFtwcm9jZXNzLl9faW5TdGF0ZS5wb3MrK10pOyBwcm9jZXNzLl9faW5TdGF0ZS5yZXNvbHZlciA9IG51bGw7IH0gZWxzZSB7IGlmIChwcm9jZXNzLl9faW5TdGF0ZS5jbG9zZWQpIHsgcHJvY2Vzcy5fX2luU3RhdGUucmVzb2x2ZXIoLTEpOyByZXR1cm47IH0gaWYgKHByb2Nlc3MuX19pblN0YXRlLmlucHV0Lmxlbmd0aCA+IDUpIHsgcHJvY2Vzcy5fX2luU3RhdGUuaW5wdXQgPSBuZXcgVWludDhBcnJheSgwKTsgcHJvY2Vzcy5fX2luU3RhdGUucG9zID0gMDsgcHJvY2Vzcy5zdGRpbi5yZXN1bWUoKTsgfSBzZXRUaW1lb3V0KCgpID0+IHByb2Nlc3MuX19pblN0YXRlLnBvbGwoKSwgNTApOyB9IH07IHByb2Nlc3Muc3RkaW4ub24oImRhdGEiLCBmdW5jdGlvbiAoY2h1bmspIHsgcHJvY2Vzcy5fX2luU3RhdGUuaW5wdXQgPSBwcm9jZXNzLmJ1ZmZlckNvbmNhdChwcm9jZXNzLl9faW5TdGF0ZS5pbnB1dCwgY2h1bmspOyBpZiAocHJvY2Vzcy5fX2luU3RhdGUuaW5wdXQubGVuZ3RoID4gNSkgeyBwcm9jZXNzLnN0ZGluLnBhdXNlKCk7IH0gfSk7IHByb2Nlc3Muc3RkaW4ub24oImVuZCIsIGZ1bmN0aW9uICgpIHsgcHJvY2Vzcy5fX2luU3RhdGUuY2xvc2VkID0gdHJ1ZTsgfSk7IHByb2Nlc3Muc3RkaW4ucmVzdW1lKCk7IH0AKGNoYXIgYyk8Ojo+eyBwcm9jZXNzLnN0ZG91dC53cml0ZShTdHJpbmcuZnJvbUNoYXJDb2RlKGMpKTsgfQAoaW50IGZkKTw6Oj57IHJldHVybiByZXF1aXJlKCd0dHknKS5pc2F0dHkoZmQpOyB9AApkb25lIHdpdGggQwoAAAAAmAsAAC0rICAgMFgweAAobnVsbCkAAAAAAAAAAAAAAAAAAAAAEQAKABEREQAAAAAFAAAAAAAACQAAAAALAAAAAAAAAAARAA8KERERAwoHAAETCQsLAAAJBgsAAAsABhEAAAAREREAAAAAAAAAAAAAAAAAAAAACwAAAAAAAAAAEQAKChEREQAKAAACAAkLAAAACQALAAALAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAwAAAAADAAAAAAJDAAAAAAADAAADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOAAAAAAAAAAAAAAANAAAABA0AAAAACQ4AAAAAAA4AAA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAADwAAAAAPAAAAAAkQAAAAAAAQAAAQAAASAAAAEhISAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABIAAAASEhIAAAAAAAAJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALAAAAAAAAAAAAAAAKAAAAAAoAAAAACQsAAAAAAAsAAAsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAAAAAADAAAAAAMAAAAAAkMAAAAAAAMAAAMAAAwMTIzNDU2Nzg5QUJDREVGLTBYKzBYIDBYLTB4KzB4IDB4AGluZgBJTkYAbmFuAE5BTgAuAABBmBcL/AIFAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAwAAACgNAAAABAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAK/////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACYCwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABgEQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABBoBoL0AwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
if (!isDataURI(wasmBinaryFile)) {
  wasmBinaryFile = locateFile(wasmBinaryFile);
}

function getBinary() {
  try {
    if (wasmBinary) {
      return new Uint8Array(wasmBinary);
    }

    var binary = tryParseAsDataURI(wasmBinaryFile);
    if (binary) {
      return binary;
    }
    if (readBinary) {
      return readBinary(wasmBinaryFile);
    } else {
      throw "both async and sync fetching of the wasm failed";
    }
  }
  catch (err) {
    abort(err);
  }
}

function getBinaryPromise() {
  // if we don't have the binary yet, and have the Fetch api, use that
  // in some environments, like Electron's render process, Fetch api may be present, but have a different context than expected, let's only use it on the Web
  if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && typeof fetch === 'function') {
    return fetch(wasmBinaryFile, { credentials: 'same-origin' }).then(function(response) {
      if (!response['ok']) {
        throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
      }
      return response['arrayBuffer']();
    }).catch(function () {
      return getBinary();
    });
  }
  // Otherwise, getBinary should be able to get it synchronously
  return new Promise(function(resolve, reject) {
    resolve(getBinary());
  });
}



// Create the wasm instance.
// Receives the wasm imports, returns the exports.
function createWasm() {
  // prepare imports
  var info = {
    'env': asmLibraryArg,
    'wasi_snapshot_preview1': asmLibraryArg
  };
  // Load the wasm module and create an instance of using native support in the JS engine.
  // handle a generated wasm instance, receiving its exports and
  // performing other necessary setup
  function receiveInstance(instance, module) {
    var exports = instance.exports;
    exports = Asyncify.instrumentWasmExports(exports);
    Module['asm'] = exports;
    removeRunDependency('wasm-instantiate');
  }
   // we can't run yet (except in a pthread, where we have a custom sync instantiator)
  addRunDependency('wasm-instantiate');


  // Async compilation can be confusing when an error on the page overwrites Module
  // (for example, if the order of elements is wrong, and the one defining Module is
  // later), so we save Module and check it later.
  var trueModule = Module;
  function receiveInstantiatedSource(output) {
    // 'output' is a WebAssemblyInstantiatedSource object which has both the module and instance.
    // receiveInstance() will swap in the exports (to Module.asm) so they can be called
    assert(Module === trueModule, 'the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?');
    trueModule = null;
      // TODO: Due to Closure regression https://github.com/google/closure-compiler/issues/3193, the above line no longer optimizes out down to the following line.
      // When the regression is fixed, can restore the above USE_PTHREADS-enabled path.
    receiveInstance(output['instance']);
  }


  function instantiateArrayBuffer(receiver) {
    return getBinaryPromise().then(function(binary) {
      return WebAssembly.instantiate(binary, info);
    }).then(receiver, function(reason) {
      err('failed to asynchronously prepare wasm: ' + reason);
      abort(reason);
    });
  }

  // Prefer streaming instantiation if available.
  function instantiateAsync() {
    if (!wasmBinary &&
        typeof WebAssembly.instantiateStreaming === 'function' &&
        !isDataURI(wasmBinaryFile) &&
        typeof fetch === 'function') {
      fetch(wasmBinaryFile, { credentials: 'same-origin' }).then(function (response) {
        var result = WebAssembly.instantiateStreaming(response, info);
        return result.then(receiveInstantiatedSource, function(reason) {
            // We expect the most common failure cause to be a bad MIME type for the binary,
            // in which case falling back to ArrayBuffer instantiation should work.
            err('wasm streaming compile failed: ' + reason);
            err('falling back to ArrayBuffer instantiation');
            instantiateArrayBuffer(receiveInstantiatedSource);
          });
      });
    } else {
      return instantiateArrayBuffer(receiveInstantiatedSource);
    }
  }
  // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
  // to manually instantiate the Wasm module themselves. This allows pages to run the instantiation parallel
  // to any other async startup actions they are performing.
  if (Module['instantiateWasm']) {
    try {
      var exports = Module['instantiateWasm'](info, receiveInstance);
      exports = Asyncify.instrumentWasmExports(exports);
      return exports;
    } catch(e) {
      err('Module.instantiateWasm callback failed with error: ' + e);
      return false;
    }
  }

  instantiateAsync();
  return {}; // no exports yet; we'll fill them in later
}


// Globals used by JS i64 conversions
var tempDouble;
var tempI64;

// === Body ===

var ASM_CONSTS = {
  
};
function isatty_js(fd){ return require('tty').isatty(fd); }
function startup(){ process.bufferConcat = (a, b) => { var result = new (a.constructor)(a.length + b.length); result.set(a); result.set(b, a.length); return result; }; process.__inState = {input: new Uint8Array(0), pos: 0, resolver: null, closed: false}; process.__inState.poll = () => { if (process.__inState.pos < process.__inState.input.length) { process.__inState.resolver(process.__inState.input[process.__inState.pos++]); process.__inState.resolver = null; } else { if (process.__inState.closed) { process.__inState.resolver(-1); return; } if (process.__inState.input.length > 5) { process.__inState.input = new Uint8Array(0); process.__inState.pos = 0; process.stdin.resume(); } setTimeout(() => process.__inState.poll(), 50); } }; process.stdin.on("data", function (chunk) { process.__inState.input = process.bufferConcat(process.__inState.input, chunk); if (process.__inState.input.length > 5) { process.stdin.pause(); } }); process.stdin.on("end", function () { process.__inState.closed = true; }); process.stdin.resume(); }
function getchar_js(){ return Asyncify.handleSleep(function(wakeUp) { if (process.__inState.resolver) { wakeUp(-1); } else { new Promise(resolve => { process.__inState.resolver = resolve; process.__inState.poll(); }).then(ret => wakeUp(ret)); } }); }
function putchar_js(c){ process.stdout.write(String.fromCharCode(c)); }



// STATICTOP = STATIC_BASE + 4112;
/* global initializers */  __ATINIT__.push({ func: function() { ___wasm_call_ctors() } });




/* no memory initializer */
// {{PRE_LIBRARY}}


  function demangle(func) {
      warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
      return func;
    }

  function demangleAll(text) {
      var regex =
        /\b_Z[\w\d_]+/g;
      return text.replace(regex,
        function(x) {
          var y = demangle(x);
          return x === y ? x : (y + ' [' + x + ']');
        });
    }

  function jsStackTrace() {
      var err = new Error();
      if (!err.stack) {
        // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
        // so try that as a special-case.
        try {
          throw new Error(0);
        } catch(e) {
          err = e;
        }
        if (!err.stack) {
          return '(no stack trace available)';
        }
      }
      return err.stack.toString();
    }

  function stackTrace() {
      var js = jsStackTrace();
      if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
      return demangleAll(js);
    }

  function ___handle_stack_overflow() {
      abort('stack overflow')
    }

  function ___lock() {}

  function ___unlock() {}

  function _emscripten_get_heap_size() {
      return HEAP8.length;
    }

  function _emscripten_get_sbrk_ptr() {
      return 4976;
    }

  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
    }

  
  function abortOnCannotGrowMemory(requestedSize) {
      abort('Cannot enlarge memory arrays to size ' + requestedSize + ' bytes (OOM). Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + HEAP8.length + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
    }function _emscripten_resize_heap(requestedSize) {
      abortOnCannotGrowMemory(requestedSize);
    }

  
  function flush_NO_FILESYSTEM() {
      // flush anything remaining in the buffers during shutdown
      var fflush = Module["_fflush"];
      if (fflush) fflush(0);
      var buffers = SYSCALLS.buffers;
      if (buffers[1].length) SYSCALLS.printChar(1, 10);
      if (buffers[2].length) SYSCALLS.printChar(2, 10);
    }
  
  
  var PATH={splitPath:function(filename) {
        var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
        return splitPathRe.exec(filename).slice(1);
      },normalizeArray:function(parts, allowAboveRoot) {
        // if the path tries to go above the root, `up` ends up > 0
        var up = 0;
        for (var i = parts.length - 1; i >= 0; i--) {
          var last = parts[i];
          if (last === '.') {
            parts.splice(i, 1);
          } else if (last === '..') {
            parts.splice(i, 1);
            up++;
          } else if (up) {
            parts.splice(i, 1);
            up--;
          }
        }
        // if the path is allowed to go above the root, restore leading ..s
        if (allowAboveRoot) {
          for (; up; up--) {
            parts.unshift('..');
          }
        }
        return parts;
      },normalize:function(path) {
        var isAbsolute = path.charAt(0) === '/',
            trailingSlash = path.substr(-1) === '/';
        // Normalize the path
        path = PATH.normalizeArray(path.split('/').filter(function(p) {
          return !!p;
        }), !isAbsolute).join('/');
        if (!path && !isAbsolute) {
          path = '.';
        }
        if (path && trailingSlash) {
          path += '/';
        }
        return (isAbsolute ? '/' : '') + path;
      },dirname:function(path) {
        var result = PATH.splitPath(path),
            root = result[0],
            dir = result[1];
        if (!root && !dir) {
          // No dirname whatsoever
          return '.';
        }
        if (dir) {
          // It has a dirname, strip trailing slash
          dir = dir.substr(0, dir.length - 1);
        }
        return root + dir;
      },basename:function(path) {
        // EMSCRIPTEN return '/'' for '/', not an empty string
        if (path === '/') return '/';
        var lastSlash = path.lastIndexOf('/');
        if (lastSlash === -1) return path;
        return path.substr(lastSlash+1);
      },extname:function(path) {
        return PATH.splitPath(path)[3];
      },join:function() {
        var paths = Array.prototype.slice.call(arguments, 0);
        return PATH.normalize(paths.join('/'));
      },join2:function(l, r) {
        return PATH.normalize(l + '/' + r);
      }};var SYSCALLS={buffers:[null,[],[]],printChar:function(stream, curr) {
        var buffer = SYSCALLS.buffers[stream];
        assert(buffer);
        if (curr === 0 || curr === 10) {
          (stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0));
          buffer.length = 0;
        } else {
          buffer.push(curr);
        }
      },varargs:0,get:function(varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function() {
        var ret = UTF8ToString(SYSCALLS.get());
        return ret;
      },get64:function() {
        var low = SYSCALLS.get(), high = SYSCALLS.get();
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      },getZero:function() {
        assert(SYSCALLS.get() === 0);
      }};function _fd_write(fd, iov, iovcnt, pnum) {try {
  
      // hack to support printf in SYSCALLS_REQUIRE_FILESYSTEM=0
      var num = 0;
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[(((iov)+(i*8))>>2)];
        var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
        for (var j = 0; j < len; j++) {
          SYSCALLS.printChar(fd, HEAPU8[ptr+j]);
        }
        num += len;
      }
      HEAP32[((pnum)>>2)]=num
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return e.errno;
  }
  }

  
  function _memcpy(dest, src, num) {
      dest = dest|0; src = src|0; num = num|0;
      var ret = 0;
      var aligned_dest_end = 0;
      var block_aligned_dest_end = 0;
      var dest_end = 0;
      // Test against a benchmarked cutoff limit for when HEAPU8.set() becomes faster to use.
      if ((num|0) >= 8192) {
        _emscripten_memcpy_big(dest|0, src|0, num|0)|0;
        return dest|0;
      }
  
      ret = dest|0;
      dest_end = (dest + num)|0;
      if ((dest&3) == (src&3)) {
        // The initial unaligned < 4-byte front.
        while (dest & 3) {
          if ((num|0) == 0) return ret|0;
          HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
          dest = (dest+1)|0;
          src = (src+1)|0;
          num = (num-1)|0;
        }
        aligned_dest_end = (dest_end & -4)|0;
        block_aligned_dest_end = (aligned_dest_end - 64)|0;
        while ((dest|0) <= (block_aligned_dest_end|0) ) {
          HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
          HEAP32[(((dest)+(4))>>2)]=((HEAP32[(((src)+(4))>>2)])|0);
          HEAP32[(((dest)+(8))>>2)]=((HEAP32[(((src)+(8))>>2)])|0);
          HEAP32[(((dest)+(12))>>2)]=((HEAP32[(((src)+(12))>>2)])|0);
          HEAP32[(((dest)+(16))>>2)]=((HEAP32[(((src)+(16))>>2)])|0);
          HEAP32[(((dest)+(20))>>2)]=((HEAP32[(((src)+(20))>>2)])|0);
          HEAP32[(((dest)+(24))>>2)]=((HEAP32[(((src)+(24))>>2)])|0);
          HEAP32[(((dest)+(28))>>2)]=((HEAP32[(((src)+(28))>>2)])|0);
          HEAP32[(((dest)+(32))>>2)]=((HEAP32[(((src)+(32))>>2)])|0);
          HEAP32[(((dest)+(36))>>2)]=((HEAP32[(((src)+(36))>>2)])|0);
          HEAP32[(((dest)+(40))>>2)]=((HEAP32[(((src)+(40))>>2)])|0);
          HEAP32[(((dest)+(44))>>2)]=((HEAP32[(((src)+(44))>>2)])|0);
          HEAP32[(((dest)+(48))>>2)]=((HEAP32[(((src)+(48))>>2)])|0);
          HEAP32[(((dest)+(52))>>2)]=((HEAP32[(((src)+(52))>>2)])|0);
          HEAP32[(((dest)+(56))>>2)]=((HEAP32[(((src)+(56))>>2)])|0);
          HEAP32[(((dest)+(60))>>2)]=((HEAP32[(((src)+(60))>>2)])|0);
          dest = (dest+64)|0;
          src = (src+64)|0;
        }
        while ((dest|0) < (aligned_dest_end|0) ) {
          HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
          dest = (dest+4)|0;
          src = (src+4)|0;
        }
      } else {
        // In the unaligned copy case, unroll a bit as well.
        aligned_dest_end = (dest_end - 4)|0;
        while ((dest|0) < (aligned_dest_end|0) ) {
          HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
          HEAP8[(((dest)+(1))>>0)]=((HEAP8[(((src)+(1))>>0)])|0);
          HEAP8[(((dest)+(2))>>0)]=((HEAP8[(((src)+(2))>>0)])|0);
          HEAP8[(((dest)+(3))>>0)]=((HEAP8[(((src)+(3))>>0)])|0);
          dest = (dest+4)|0;
          src = (src+4)|0;
        }
      }
      // The remaining unaligned < 4 byte tail.
      while ((dest|0) < (dest_end|0)) {
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        dest = (dest+1)|0;
        src = (src+1)|0;
      }
      return ret|0;
    }

  function _memset(ptr, value, num) {
      ptr = ptr|0; value = value|0; num = num|0;
      var end = 0, aligned_end = 0, block_aligned_end = 0, value4 = 0;
      end = (ptr + num)|0;
  
      value = value & 0xff;
      if ((num|0) >= 67 /* 64 bytes for an unrolled loop + 3 bytes for unaligned head*/) {
        while ((ptr&3) != 0) {
          HEAP8[((ptr)>>0)]=value;
          ptr = (ptr+1)|0;
        }
  
        aligned_end = (end & -4)|0;
        value4 = value | (value << 8) | (value << 16) | (value << 24);
  
        block_aligned_end = (aligned_end - 64)|0;
  
        while((ptr|0) <= (block_aligned_end|0)) {
          HEAP32[((ptr)>>2)]=value4;
          HEAP32[(((ptr)+(4))>>2)]=value4;
          HEAP32[(((ptr)+(8))>>2)]=value4;
          HEAP32[(((ptr)+(12))>>2)]=value4;
          HEAP32[(((ptr)+(16))>>2)]=value4;
          HEAP32[(((ptr)+(20))>>2)]=value4;
          HEAP32[(((ptr)+(24))>>2)]=value4;
          HEAP32[(((ptr)+(28))>>2)]=value4;
          HEAP32[(((ptr)+(32))>>2)]=value4;
          HEAP32[(((ptr)+(36))>>2)]=value4;
          HEAP32[(((ptr)+(40))>>2)]=value4;
          HEAP32[(((ptr)+(44))>>2)]=value4;
          HEAP32[(((ptr)+(48))>>2)]=value4;
          HEAP32[(((ptr)+(52))>>2)]=value4;
          HEAP32[(((ptr)+(56))>>2)]=value4;
          HEAP32[(((ptr)+(60))>>2)]=value4;
          ptr = (ptr + 64)|0;
        }
  
        while ((ptr|0) < (aligned_end|0) ) {
          HEAP32[((ptr)>>2)]=value4;
          ptr = (ptr+4)|0;
        }
      }
      // The remaining bytes.
      while ((ptr|0) < (end|0)) {
        HEAP8[((ptr)>>0)]=value;
        ptr = (ptr+1)|0;
      }
      return (end-num)|0;
    }

  function _setTempRet0($i) {
      setTempRet0(($i) | 0);
    }

  
  
  
  function _emscripten_set_main_loop_timing(mode, value) {
      Browser.mainLoop.timingMode = mode;
      Browser.mainLoop.timingValue = value;
  
      if (!Browser.mainLoop.func) {
        console.error('emscripten_set_main_loop_timing: Cannot set timing mode for main loop since a main loop does not exist! Call emscripten_set_main_loop first to set one up.');
        return 1; // Return non-zero on failure, can't set timing mode when there is no main loop.
      }
  
      if (mode == 0 /*EM_TIMING_SETTIMEOUT*/) {
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setTimeout() {
          var timeUntilNextTick = Math.max(0, Browser.mainLoop.tickStartTime + value - _emscripten_get_now())|0;
          setTimeout(Browser.mainLoop.runner, timeUntilNextTick); // doing this each time means that on exception, we stop
        };
        Browser.mainLoop.method = 'timeout';
      } else if (mode == 1 /*EM_TIMING_RAF*/) {
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_rAF() {
          Browser.requestAnimationFrame(Browser.mainLoop.runner);
        };
        Browser.mainLoop.method = 'rAF';
      } else if (mode == 2 /*EM_TIMING_SETIMMEDIATE*/) {
        if (typeof setImmediate === 'undefined') {
          // Emulate setImmediate. (note: not a complete polyfill, we don't emulate clearImmediate() to keep code size to minimum, since not needed)
          var setImmediates = [];
          var emscriptenMainLoopMessageId = 'setimmediate';
          var Browser_setImmediate_messageHandler = function(event) {
            // When called in current thread or Worker, the main loop ID is structured slightly different to accommodate for --proxy-to-worker runtime listening to Worker events,
            // so check for both cases.
            if (event.data === emscriptenMainLoopMessageId || event.data.target === emscriptenMainLoopMessageId) {
              event.stopPropagation();
              setImmediates.shift()();
            }
          }
          addEventListener("message", Browser_setImmediate_messageHandler, true);
          setImmediate = function Browser_emulated_setImmediate(func) {
            setImmediates.push(func);
            if (ENVIRONMENT_IS_WORKER) {
              if (Module['setImmediates'] === undefined) Module['setImmediates'] = [];
              Module['setImmediates'].push(func);
              postMessage({target: emscriptenMainLoopMessageId}); // In --proxy-to-worker, route the message via proxyClient.js
            } else postMessage(emscriptenMainLoopMessageId, "*"); // On the main thread, can just send the message to itself.
          }
        }
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setImmediate() {
          setImmediate(Browser.mainLoop.runner);
        };
        Browser.mainLoop.method = 'immediate';
      }
      return 0;
    }
  
  function _emscripten_get_now() { abort() }function _emscripten_set_main_loop(func, fps, simulateInfiniteLoop, arg, noSetTiming) {
      noExitRuntime = true;
  
      assert(!Browser.mainLoop.func, 'emscripten_set_main_loop: there can only be one main loop function at once: call emscripten_cancel_main_loop to cancel the previous one before setting a new one with different parameters.');
  
      Browser.mainLoop.func = func;
      Browser.mainLoop.arg = arg;
  
      var browserIterationFunc;
      if (typeof arg !== 'undefined') {
        browserIterationFunc = function() {
          Module['dynCall_vi'](func, arg);
        };
      } else {
        browserIterationFunc = function() {
          Module['dynCall_v'](func);
        };
      }
  
      var thisMainLoopId = Browser.mainLoop.currentlyRunningMainloop;
  
      Browser.mainLoop.runner = function Browser_mainLoop_runner() {
        if (ABORT) return;
        if (Browser.mainLoop.queue.length > 0) {
          var start = Date.now();
          var blocker = Browser.mainLoop.queue.shift();
          blocker.func(blocker.arg);
          if (Browser.mainLoop.remainingBlockers) {
            var remaining = Browser.mainLoop.remainingBlockers;
            var next = remaining%1 == 0 ? remaining-1 : Math.floor(remaining);
            if (blocker.counted) {
              Browser.mainLoop.remainingBlockers = next;
            } else {
              // not counted, but move the progress along a tiny bit
              next = next + 0.5; // do not steal all the next one's progress
              Browser.mainLoop.remainingBlockers = (8*remaining + next)/9;
            }
          }
          console.log('main loop blocker "' + blocker.name + '" took ' + (Date.now() - start) + ' ms'); //, left: ' + Browser.mainLoop.remainingBlockers);
          Browser.mainLoop.updateStatus();
  
          // catches pause/resume main loop from blocker execution
          if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
  
          setTimeout(Browser.mainLoop.runner, 0);
          return;
        }
  
        // catch pauses from non-main loop sources
        if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
  
        // Implement very basic swap interval control
        Browser.mainLoop.currentFrameNumber = Browser.mainLoop.currentFrameNumber + 1 | 0;
        if (Browser.mainLoop.timingMode == 1/*EM_TIMING_RAF*/ && Browser.mainLoop.timingValue > 1 && Browser.mainLoop.currentFrameNumber % Browser.mainLoop.timingValue != 0) {
          // Not the scheduled time to render this frame - skip.
          Browser.mainLoop.scheduler();
          return;
        } else if (Browser.mainLoop.timingMode == 0/*EM_TIMING_SETTIMEOUT*/) {
          Browser.mainLoop.tickStartTime = _emscripten_get_now();
        }
  
        // Signal GL rendering layer that processing of a new frame is about to start. This helps it optimize
        // VBO double-buffering and reduce GPU stalls.
  
  
  
        if (Browser.mainLoop.method === 'timeout' && Module.ctx) {
          warnOnce('Looks like you are rendering without using requestAnimationFrame for the main loop. You should use 0 for the frame rate in emscripten_set_main_loop in order to use requestAnimationFrame, as that can greatly improve your frame rates!');
          Browser.mainLoop.method = ''; // just warn once per call to set main loop
        }
  
        Browser.mainLoop.runIter(browserIterationFunc);
  
        checkStackCookie();
  
        // catch pauses from the main loop itself
        if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
  
        // Queue new audio data. This is important to be right after the main loop invocation, so that we will immediately be able
        // to queue the newest produced audio samples.
        // TODO: Consider adding pre- and post- rAF callbacks so that GL.newRenderingFrameStarted() and SDL.audio.queueNewAudioData()
        //       do not need to be hardcoded into this function, but can be more generic.
        if (typeof SDL === 'object' && SDL.audio && SDL.audio.queueNewAudioData) SDL.audio.queueNewAudioData();
  
        Browser.mainLoop.scheduler();
      }
  
      if (!noSetTiming) {
        if (fps && fps > 0) _emscripten_set_main_loop_timing(0/*EM_TIMING_SETTIMEOUT*/, 1000.0 / fps);
        else _emscripten_set_main_loop_timing(1/*EM_TIMING_RAF*/, 1); // Do rAF by rendering each frame (no decimating)
  
        Browser.mainLoop.scheduler();
      }
  
      if (simulateInfiniteLoop) {
        throw 'unwind';
      }
    }var Browser={mainLoop:{scheduler:null,method:"",currentlyRunningMainloop:0,func:null,arg:0,timingMode:0,timingValue:0,currentFrameNumber:0,queue:[],pause:function() {
          Browser.mainLoop.scheduler = null;
          Browser.mainLoop.currentlyRunningMainloop++; // Incrementing this signals the previous main loop that it's now become old, and it must return.
        },resume:function() {
          Browser.mainLoop.currentlyRunningMainloop++;
          var timingMode = Browser.mainLoop.timingMode;
          var timingValue = Browser.mainLoop.timingValue;
          var func = Browser.mainLoop.func;
          Browser.mainLoop.func = null;
          _emscripten_set_main_loop(func, 0, false, Browser.mainLoop.arg, true /* do not set timing and call scheduler, we will do it on the next lines */);
          _emscripten_set_main_loop_timing(timingMode, timingValue);
          Browser.mainLoop.scheduler();
        },updateStatus:function() {
          if (Module['setStatus']) {
            var message = Module['statusMessage'] || 'Please wait...';
            var remaining = Browser.mainLoop.remainingBlockers;
            var expected = Browser.mainLoop.expectedBlockers;
            if (remaining) {
              if (remaining < expected) {
                Module['setStatus'](message + ' (' + (expected - remaining) + '/' + expected + ')');
              } else {
                Module['setStatus'](message);
              }
            } else {
              Module['setStatus']('');
            }
          }
        },runIter:function(func) {
          if (ABORT) return;
          if (Module['preMainLoop']) {
            var preRet = Module['preMainLoop']();
            if (preRet === false) {
              return; // |return false| skips a frame
            }
          }
          try {
            func();
          } catch (e) {
            if (e instanceof ExitStatus) {
              return;
            } else {
              if (e && typeof e === 'object' && e.stack) err('exception thrown: ' + [e, e.stack]);
              throw e;
            }
          }
          if (Module['postMainLoop']) Module['postMainLoop']();
        }},isFullscreen:false,pointerLock:false,moduleContextCreatedCallbacks:[],workers:[],init:function() {
        if (!Module["preloadPlugins"]) Module["preloadPlugins"] = []; // needs to exist even in workers
  
        if (Browser.initted) return;
        Browser.initted = true;
  
        try {
          new Blob();
          Browser.hasBlobConstructor = true;
        } catch(e) {
          Browser.hasBlobConstructor = false;
          console.log("warning: no blob constructor, cannot create blobs with mimetypes");
        }
        Browser.BlobBuilder = typeof MozBlobBuilder != "undefined" ? MozBlobBuilder : (typeof WebKitBlobBuilder != "undefined" ? WebKitBlobBuilder : (!Browser.hasBlobConstructor ? console.log("warning: no BlobBuilder") : null));
        Browser.URLObject = typeof window != "undefined" ? (window.URL ? window.URL : window.webkitURL) : undefined;
        if (!Module.noImageDecoding && typeof Browser.URLObject === 'undefined') {
          console.log("warning: Browser does not support creating object URLs. Built-in browser image decoding will not be available.");
          Module.noImageDecoding = true;
        }
  
        // Support for plugins that can process preloaded files. You can add more of these to
        // your app by creating and appending to Module.preloadPlugins.
        //
        // Each plugin is asked if it can handle a file based on the file's name. If it can,
        // it is given the file's raw data. When it is done, it calls a callback with the file's
        // (possibly modified) data. For example, a plugin might decompress a file, or it
        // might create some side data structure for use later (like an Image element, etc.).
  
        var imagePlugin = {};
        imagePlugin['canHandle'] = function imagePlugin_canHandle(name) {
          return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp)$/i.test(name);
        };
        imagePlugin['handle'] = function imagePlugin_handle(byteArray, name, onload, onerror) {
          var b = null;
          if (Browser.hasBlobConstructor) {
            try {
              b = new Blob([byteArray], { type: Browser.getMimetype(name) });
              if (b.size !== byteArray.length) { // Safari bug #118630
                // Safari's Blob can only take an ArrayBuffer
                b = new Blob([(new Uint8Array(byteArray)).buffer], { type: Browser.getMimetype(name) });
              }
            } catch(e) {
              warnOnce('Blob constructor present but fails: ' + e + '; falling back to blob builder');
            }
          }
          if (!b) {
            var bb = new Browser.BlobBuilder();
            bb.append((new Uint8Array(byteArray)).buffer); // we need to pass a buffer, and must copy the array to get the right data range
            b = bb.getBlob();
          }
          var url = Browser.URLObject.createObjectURL(b);
          assert(typeof url == 'string', 'createObjectURL must return a url as a string');
          var img = new Image();
          img.onload = function img_onload() {
            assert(img.complete, 'Image ' + name + ' could not be decoded');
            var canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            Module["preloadedImages"][name] = canvas;
            Browser.URLObject.revokeObjectURL(url);
            if (onload) onload(byteArray);
          };
          img.onerror = function img_onerror(event) {
            console.log('Image ' + url + ' could not be decoded');
            if (onerror) onerror();
          };
          img.src = url;
        };
        Module['preloadPlugins'].push(imagePlugin);
  
        var audioPlugin = {};
        audioPlugin['canHandle'] = function audioPlugin_canHandle(name) {
          return !Module.noAudioDecoding && name.substr(-4) in { '.ogg': 1, '.wav': 1, '.mp3': 1 };
        };
        audioPlugin['handle'] = function audioPlugin_handle(byteArray, name, onload, onerror) {
          var done = false;
          function finish(audio) {
            if (done) return;
            done = true;
            Module["preloadedAudios"][name] = audio;
            if (onload) onload(byteArray);
          }
          function fail() {
            if (done) return;
            done = true;
            Module["preloadedAudios"][name] = new Audio(); // empty shim
            if (onerror) onerror();
          }
          if (Browser.hasBlobConstructor) {
            try {
              var b = new Blob([byteArray], { type: Browser.getMimetype(name) });
            } catch(e) {
              return fail();
            }
            var url = Browser.URLObject.createObjectURL(b); // XXX we never revoke this!
            assert(typeof url == 'string', 'createObjectURL must return a url as a string');
            var audio = new Audio();
            audio.addEventListener('canplaythrough', function() { finish(audio) }, false); // use addEventListener due to chromium bug 124926
            audio.onerror = function audio_onerror(event) {
              if (done) return;
              console.log('warning: browser could not fully decode audio ' + name + ', trying slower base64 approach');
              function encode64(data) {
                var BASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
                var PAD = '=';
                var ret = '';
                var leftchar = 0;
                var leftbits = 0;
                for (var i = 0; i < data.length; i++) {
                  leftchar = (leftchar << 8) | data[i];
                  leftbits += 8;
                  while (leftbits >= 6) {
                    var curr = (leftchar >> (leftbits-6)) & 0x3f;
                    leftbits -= 6;
                    ret += BASE[curr];
                  }
                }
                if (leftbits == 2) {
                  ret += BASE[(leftchar&3) << 4];
                  ret += PAD + PAD;
                } else if (leftbits == 4) {
                  ret += BASE[(leftchar&0xf) << 2];
                  ret += PAD;
                }
                return ret;
              }
              audio.src = 'data:audio/x-' + name.substr(-3) + ';base64,' + encode64(byteArray);
              finish(audio); // we don't wait for confirmation this worked - but it's worth trying
            };
            audio.src = url;
            // workaround for chrome bug 124926 - we do not always get oncanplaythrough or onerror
            Browser.safeSetTimeout(function() {
              finish(audio); // try to use it even though it is not necessarily ready to play
            }, 10000);
          } else {
            return fail();
          }
        };
        Module['preloadPlugins'].push(audioPlugin);
  
  
        // Canvas event setup
  
        function pointerLockChange() {
          Browser.pointerLock = document['pointerLockElement'] === Module['canvas'] ||
                                document['mozPointerLockElement'] === Module['canvas'] ||
                                document['webkitPointerLockElement'] === Module['canvas'] ||
                                document['msPointerLockElement'] === Module['canvas'];
        }
        var canvas = Module['canvas'];
        if (canvas) {
          // forced aspect ratio can be enabled by defining 'forcedAspectRatio' on Module
          // Module['forcedAspectRatio'] = 4 / 3;
  
          canvas.requestPointerLock = canvas['requestPointerLock'] ||
                                      canvas['mozRequestPointerLock'] ||
                                      canvas['webkitRequestPointerLock'] ||
                                      canvas['msRequestPointerLock'] ||
                                      function(){};
          canvas.exitPointerLock = document['exitPointerLock'] ||
                                   document['mozExitPointerLock'] ||
                                   document['webkitExitPointerLock'] ||
                                   document['msExitPointerLock'] ||
                                   function(){}; // no-op if function does not exist
          canvas.exitPointerLock = canvas.exitPointerLock.bind(document);
  
          document.addEventListener('pointerlockchange', pointerLockChange, false);
          document.addEventListener('mozpointerlockchange', pointerLockChange, false);
          document.addEventListener('webkitpointerlockchange', pointerLockChange, false);
          document.addEventListener('mspointerlockchange', pointerLockChange, false);
  
          if (Module['elementPointerLock']) {
            canvas.addEventListener("click", function(ev) {
              if (!Browser.pointerLock && Module['canvas'].requestPointerLock) {
                Module['canvas'].requestPointerLock();
                ev.preventDefault();
              }
            }, false);
          }
        }
      },createContext:function(canvas, useWebGL, setInModule, webGLContextAttributes) {
        if (useWebGL && Module.ctx && canvas == Module.canvas) return Module.ctx; // no need to recreate GL context if it's already been created for this canvas.
  
        var ctx;
        var contextHandle;
        if (useWebGL) {
          // For GLES2/desktop GL compatibility, adjust a few defaults to be different to WebGL defaults, so that they align better with the desktop defaults.
          var contextAttributes = {
            antialias: false,
            alpha: false,
            majorVersion: 1,
          };
  
          if (webGLContextAttributes) {
            for (var attribute in webGLContextAttributes) {
              contextAttributes[attribute] = webGLContextAttributes[attribute];
            }
          }
  
          // This check of existence of GL is here to satisfy Closure compiler, which yells if variable GL is referenced below but GL object is not
          // actually compiled in because application is not doing any GL operations. TODO: Ideally if GL is not being used, this function
          // Browser.createContext() should not even be emitted.
          if (typeof GL !== 'undefined') {
            contextHandle = GL.createContext(canvas, contextAttributes);
            if (contextHandle) {
              ctx = GL.getContext(contextHandle).GLctx;
            }
          }
        } else {
          ctx = canvas.getContext('2d');
        }
  
        if (!ctx) return null;
  
        if (setInModule) {
          if (!useWebGL) assert(typeof GLctx === 'undefined', 'cannot set in module if GLctx is used, but we are a non-GL context that would replace it');
  
          Module.ctx = ctx;
          if (useWebGL) GL.makeContextCurrent(contextHandle);
          Module.useWebGL = useWebGL;
          Browser.moduleContextCreatedCallbacks.forEach(function(callback) { callback() });
          Browser.init();
        }
        return ctx;
      },destroyContext:function(canvas, useWebGL, setInModule) {},fullscreenHandlersInstalled:false,lockPointer:undefined,resizeCanvas:undefined,requestFullscreen:function(lockPointer, resizeCanvas, vrDevice) {
        Browser.lockPointer = lockPointer;
        Browser.resizeCanvas = resizeCanvas;
        Browser.vrDevice = vrDevice;
        if (typeof Browser.lockPointer === 'undefined') Browser.lockPointer = true;
        if (typeof Browser.resizeCanvas === 'undefined') Browser.resizeCanvas = false;
        if (typeof Browser.vrDevice === 'undefined') Browser.vrDevice = null;
  
        var canvas = Module['canvas'];
        function fullscreenChange() {
          Browser.isFullscreen = false;
          var canvasContainer = canvas.parentNode;
          if ((document['fullscreenElement'] || document['mozFullScreenElement'] ||
               document['msFullscreenElement'] || document['webkitFullscreenElement'] ||
               document['webkitCurrentFullScreenElement']) === canvasContainer) {
            canvas.exitFullscreen = Browser.exitFullscreen;
            if (Browser.lockPointer) canvas.requestPointerLock();
            Browser.isFullscreen = true;
            if (Browser.resizeCanvas) {
              Browser.setFullscreenCanvasSize();
            } else {
              Browser.updateCanvasDimensions(canvas);
            }
          } else {
            // remove the full screen specific parent of the canvas again to restore the HTML structure from before going full screen
            canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
            canvasContainer.parentNode.removeChild(canvasContainer);
  
            if (Browser.resizeCanvas) {
              Browser.setWindowedCanvasSize();
            } else {
              Browser.updateCanvasDimensions(canvas);
            }
          }
          if (Module['onFullScreen']) Module['onFullScreen'](Browser.isFullscreen);
          if (Module['onFullscreen']) Module['onFullscreen'](Browser.isFullscreen);
        }
  
        if (!Browser.fullscreenHandlersInstalled) {
          Browser.fullscreenHandlersInstalled = true;
          document.addEventListener('fullscreenchange', fullscreenChange, false);
          document.addEventListener('mozfullscreenchange', fullscreenChange, false);
          document.addEventListener('webkitfullscreenchange', fullscreenChange, false);
          document.addEventListener('MSFullscreenChange', fullscreenChange, false);
        }
  
        // create a new parent to ensure the canvas has no siblings. this allows browsers to optimize full screen performance when its parent is the full screen root
        var canvasContainer = document.createElement("div");
        canvas.parentNode.insertBefore(canvasContainer, canvas);
        canvasContainer.appendChild(canvas);
  
        // use parent of canvas as full screen root to allow aspect ratio correction (Firefox stretches the root to screen size)
        canvasContainer.requestFullscreen = canvasContainer['requestFullscreen'] ||
                                            canvasContainer['mozRequestFullScreen'] ||
                                            canvasContainer['msRequestFullscreen'] ||
                                           (canvasContainer['webkitRequestFullscreen'] ? function() { canvasContainer['webkitRequestFullscreen'](Element['ALLOW_KEYBOARD_INPUT']) } : null) ||
                                           (canvasContainer['webkitRequestFullScreen'] ? function() { canvasContainer['webkitRequestFullScreen'](Element['ALLOW_KEYBOARD_INPUT']) } : null);
  
        if (vrDevice) {
          canvasContainer.requestFullscreen({ vrDisplay: vrDevice });
        } else {
          canvasContainer.requestFullscreen();
        }
      },requestFullScreen:function() {
        abort('Module.requestFullScreen has been replaced by Module.requestFullscreen (without a capital S)');
      },exitFullscreen:function() {
        // This is workaround for chrome. Trying to exit from fullscreen
        // not in fullscreen state will cause "TypeError: Document not active"
        // in chrome. See https://github.com/emscripten-core/emscripten/pull/8236
        if (!Browser.isFullscreen) {
          return false;
        }
  
        var CFS = document['exitFullscreen'] ||
                  document['cancelFullScreen'] ||
                  document['mozCancelFullScreen'] ||
                  document['msExitFullscreen'] ||
                  document['webkitCancelFullScreen'] ||
            (function() {});
        CFS.apply(document, []);
        return true;
      },nextRAF:0,fakeRequestAnimationFrame:function(func) {
        // try to keep 60fps between calls to here
        var now = Date.now();
        if (Browser.nextRAF === 0) {
          Browser.nextRAF = now + 1000/60;
        } else {
          while (now + 2 >= Browser.nextRAF) { // fudge a little, to avoid timer jitter causing us to do lots of delay:0
            Browser.nextRAF += 1000/60;
          }
        }
        var delay = Math.max(Browser.nextRAF - now, 0);
        setTimeout(func, delay);
      },requestAnimationFrame:function(func) {
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(func);
          return;
        }
        var RAF = Browser.fakeRequestAnimationFrame;
        RAF(func);
      },safeCallback:function(func) {
        return function() {
          if (!ABORT) return func.apply(null, arguments);
        };
      },allowAsyncCallbacks:true,queuedAsyncCallbacks:[],pauseAsyncCallbacks:function() {
        Browser.allowAsyncCallbacks = false;
      },resumeAsyncCallbacks:function() { // marks future callbacks as ok to execute, and synchronously runs any remaining ones right now
        Browser.allowAsyncCallbacks = true;
        if (Browser.queuedAsyncCallbacks.length > 0) {
          var callbacks = Browser.queuedAsyncCallbacks;
          Browser.queuedAsyncCallbacks = [];
          callbacks.forEach(function(func) {
            func();
          });
        }
      },safeRequestAnimationFrame:function(func) {
        return Browser.requestAnimationFrame(function() {
          if (ABORT) return;
          if (Browser.allowAsyncCallbacks) {
            func();
          } else {
            Browser.queuedAsyncCallbacks.push(func);
          }
        });
      },safeSetTimeout:function(func, timeout) {
        noExitRuntime = true;
        return setTimeout(function() {
          if (ABORT) return;
          if (Browser.allowAsyncCallbacks) {
            func();
          } else {
            Browser.queuedAsyncCallbacks.push(func);
          }
        }, timeout);
      },safeSetInterval:function(func, timeout) {
        noExitRuntime = true;
        return setInterval(function() {
          if (ABORT) return;
          if (Browser.allowAsyncCallbacks) {
            func();
          } // drop it on the floor otherwise, next interval will kick in
        }, timeout);
      },getMimetype:function(name) {
        return {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'bmp': 'image/bmp',
          'ogg': 'audio/ogg',
          'wav': 'audio/wav',
          'mp3': 'audio/mpeg'
        }[name.substr(name.lastIndexOf('.')+1)];
      },getUserMedia:function(func) {
        if(!window.getUserMedia) {
          window.getUserMedia = navigator['getUserMedia'] ||
                                navigator['mozGetUserMedia'];
        }
        window.getUserMedia(func);
      },getMovementX:function(event) {
        return event['movementX'] ||
               event['mozMovementX'] ||
               event['webkitMovementX'] ||
               0;
      },getMovementY:function(event) {
        return event['movementY'] ||
               event['mozMovementY'] ||
               event['webkitMovementY'] ||
               0;
      },getMouseWheelDelta:function(event) {
        var delta = 0;
        switch (event.type) {
          case 'DOMMouseScroll':
            // 3 lines make up a step
            delta = event.detail / 3;
            break;
          case 'mousewheel':
            // 120 units make up a step
            delta = event.wheelDelta / 120;
            break;
          case 'wheel':
            delta = event.deltaY
            switch(event.deltaMode) {
              case 0:
                // DOM_DELTA_PIXEL: 100 pixels make up a step
                delta /= 100;
                break;
              case 1:
                // DOM_DELTA_LINE: 3 lines make up a step
                delta /= 3;
                break;
              case 2:
                // DOM_DELTA_PAGE: A page makes up 80 steps
                delta *= 80;
                break;
              default:
                throw 'unrecognized mouse wheel delta mode: ' + event.deltaMode;
            }
            break;
          default:
            throw 'unrecognized mouse wheel event: ' + event.type;
        }
        return delta;
      },mouseX:0,mouseY:0,mouseMovementX:0,mouseMovementY:0,touches:{},lastTouches:{},calculateMouseEvent:function(event) { // event should be mousemove, mousedown or mouseup
        if (Browser.pointerLock) {
          // When the pointer is locked, calculate the coordinates
          // based on the movement of the mouse.
          // Workaround for Firefox bug 764498
          if (event.type != 'mousemove' &&
              ('mozMovementX' in event)) {
            Browser.mouseMovementX = Browser.mouseMovementY = 0;
          } else {
            Browser.mouseMovementX = Browser.getMovementX(event);
            Browser.mouseMovementY = Browser.getMovementY(event);
          }
  
          // check if SDL is available
          if (typeof SDL != "undefined") {
            Browser.mouseX = SDL.mouseX + Browser.mouseMovementX;
            Browser.mouseY = SDL.mouseY + Browser.mouseMovementY;
          } else {
            // just add the mouse delta to the current absolut mouse position
            // FIXME: ideally this should be clamped against the canvas size and zero
            Browser.mouseX += Browser.mouseMovementX;
            Browser.mouseY += Browser.mouseMovementY;
          }
        } else {
          // Otherwise, calculate the movement based on the changes
          // in the coordinates.
          var rect = Module["canvas"].getBoundingClientRect();
          var cw = Module["canvas"].width;
          var ch = Module["canvas"].height;
  
          // Neither .scrollX or .pageXOffset are defined in a spec, but
          // we prefer .scrollX because it is currently in a spec draft.
          // (see: http://www.w3.org/TR/2013/WD-cssom-view-20131217/)
          var scrollX = ((typeof window.scrollX !== 'undefined') ? window.scrollX : window.pageXOffset);
          var scrollY = ((typeof window.scrollY !== 'undefined') ? window.scrollY : window.pageYOffset);
          // If this assert lands, it's likely because the browser doesn't support scrollX or pageXOffset
          // and we have no viable fallback.
          assert((typeof scrollX !== 'undefined') && (typeof scrollY !== 'undefined'), 'Unable to retrieve scroll position, mouse positions likely broken.');
  
          if (event.type === 'touchstart' || event.type === 'touchend' || event.type === 'touchmove') {
            var touch = event.touch;
            if (touch === undefined) {
              return; // the "touch" property is only defined in SDL
  
            }
            var adjustedX = touch.pageX - (scrollX + rect.left);
            var adjustedY = touch.pageY - (scrollY + rect.top);
  
            adjustedX = adjustedX * (cw / rect.width);
            adjustedY = adjustedY * (ch / rect.height);
  
            var coords = { x: adjustedX, y: adjustedY };
  
            if (event.type === 'touchstart') {
              Browser.lastTouches[touch.identifier] = coords;
              Browser.touches[touch.identifier] = coords;
            } else if (event.type === 'touchend' || event.type === 'touchmove') {
              var last = Browser.touches[touch.identifier];
              if (!last) last = coords;
              Browser.lastTouches[touch.identifier] = last;
              Browser.touches[touch.identifier] = coords;
            }
            return;
          }
  
          var x = event.pageX - (scrollX + rect.left);
          var y = event.pageY - (scrollY + rect.top);
  
          // the canvas might be CSS-scaled compared to its backbuffer;
          // SDL-using content will want mouse coordinates in terms
          // of backbuffer units.
          x = x * (cw / rect.width);
          y = y * (ch / rect.height);
  
          Browser.mouseMovementX = x - Browser.mouseX;
          Browser.mouseMovementY = y - Browser.mouseY;
          Browser.mouseX = x;
          Browser.mouseY = y;
        }
      },asyncLoad:function(url, onload, onerror, noRunDep) {
        var dep = !noRunDep ? getUniqueRunDependency('al ' + url) : '';
        readAsync(url, function(arrayBuffer) {
          assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
          onload(new Uint8Array(arrayBuffer));
          if (dep) removeRunDependency(dep);
        }, function(event) {
          if (onerror) {
            onerror();
          } else {
            throw 'Loading data file "' + url + '" failed.';
          }
        });
        if (dep) addRunDependency(dep);
      },resizeListeners:[],updateResizeListeners:function() {
        var canvas = Module['canvas'];
        Browser.resizeListeners.forEach(function(listener) {
          listener(canvas.width, canvas.height);
        });
      },setCanvasSize:function(width, height, noUpdates) {
        var canvas = Module['canvas'];
        Browser.updateCanvasDimensions(canvas, width, height);
        if (!noUpdates) Browser.updateResizeListeners();
      },windowedWidth:0,windowedHeight:0,setFullscreenCanvasSize:function() {
        // check if SDL is available
        if (typeof SDL != "undefined") {
          var flags = HEAPU32[((SDL.screen)>>2)];
          flags = flags | 0x00800000; // set SDL_FULLSCREEN flag
          HEAP32[((SDL.screen)>>2)]=flags
        }
        Browser.updateCanvasDimensions(Module['canvas']);
        Browser.updateResizeListeners();
      },setWindowedCanvasSize:function() {
        // check if SDL is available
        if (typeof SDL != "undefined") {
          var flags = HEAPU32[((SDL.screen)>>2)];
          flags = flags & ~0x00800000; // clear SDL_FULLSCREEN flag
          HEAP32[((SDL.screen)>>2)]=flags
        }
        Browser.updateCanvasDimensions(Module['canvas']);
        Browser.updateResizeListeners();
      },updateCanvasDimensions:function(canvas, wNative, hNative) {
        if (wNative && hNative) {
          canvas.widthNative = wNative;
          canvas.heightNative = hNative;
        } else {
          wNative = canvas.widthNative;
          hNative = canvas.heightNative;
        }
        var w = wNative;
        var h = hNative;
        if (Module['forcedAspectRatio'] && Module['forcedAspectRatio'] > 0) {
          if (w/h < Module['forcedAspectRatio']) {
            w = Math.round(h * Module['forcedAspectRatio']);
          } else {
            h = Math.round(w / Module['forcedAspectRatio']);
          }
        }
        if (((document['fullscreenElement'] || document['mozFullScreenElement'] ||
             document['msFullscreenElement'] || document['webkitFullscreenElement'] ||
             document['webkitCurrentFullScreenElement']) === canvas.parentNode) && (typeof screen != 'undefined')) {
           var factor = Math.min(screen.width / w, screen.height / h);
           w = Math.round(w * factor);
           h = Math.round(h * factor);
        }
        if (Browser.resizeCanvas) {
          if (canvas.width  != w) canvas.width  = w;
          if (canvas.height != h) canvas.height = h;
          if (typeof canvas.style != 'undefined') {
            canvas.style.removeProperty( "width");
            canvas.style.removeProperty("height");
          }
        } else {
          if (canvas.width  != wNative) canvas.width  = wNative;
          if (canvas.height != hNative) canvas.height = hNative;
          if (typeof canvas.style != 'undefined') {
            if (w != wNative || h != hNative) {
              canvas.style.setProperty( "width", w + "px", "important");
              canvas.style.setProperty("height", h + "px", "important");
            } else {
              canvas.style.removeProperty( "width");
              canvas.style.removeProperty("height");
            }
          }
        }
      },wgetRequests:{},nextWgetRequestHandle:0,getNextWgetRequestHandle:function() {
        var handle = Browser.nextWgetRequestHandle;
        Browser.nextWgetRequestHandle++;
        return handle;
      }};
  
  function runAndAbortIfError(func) {
      try {
        return func();
      } catch (e) {
        abort(e);
      }
    }var Asyncify={State:{Normal:0,Unwinding:1,Rewinding:2},state:0,StackSize:4096,currData:null,dataInfo:{},handleSleepReturnValue:0,exportCallStack:[],afterUnwind:null,asyncFinalizers:[],sleepCallbacks:[],instrumentWasmImports:function(imports) {
        var ASYNCIFY_IMPORTS = ["env.getchar_js"].map(function(x) {
          return x.split('.')[1];
        });
        for (var x in imports) {
          (function(x) {
            var original = imports[x];
            if (typeof original === 'function') {
              imports[x] = function() {
                var originalAsyncifyState = Asyncify.state;
                try {
                  return original.apply(null, arguments);
                } finally {
                  // Only functions in the list of known relevant imports are allowed to change the state.
                  // Note that invoke_* functions are allowed to change the state if we do not ignore
                  // indirect calls.
                  if (Asyncify.state !== originalAsyncifyState &&
                      ASYNCIFY_IMPORTS.indexOf(x) < 0 &&
                      !(x.startsWith('invoke_') && false)) {
                    throw 'import ' + x + ' was not in ASYNCIFY_IMPORTS, but changed the state';
                  }
                }
              }
            }
          })(x);
        }
      },instrumentWasmExports:function(exports) {
        var ret = {};
        for (var x in exports) {
          (function(x) {
            var original = exports[x];
            if (typeof original === 'function') {
              ret[x] = function() {
                Asyncify.exportCallStack.push(x);
                try {
                  return original.apply(null, arguments);
                } finally {
                  if (ABORT) return;
                  var y = Asyncify.exportCallStack.pop(x);
                  assert(y === x);
                  if (Asyncify.currData &&
                      Asyncify.state === Asyncify.State.Unwinding &&
                      Asyncify.exportCallStack.length === 0) {
                    // We just finished unwinding.
                    Asyncify.state = Asyncify.State.Normal;
                    runAndAbortIfError(Module['_asyncify_stop_unwind']);
                    if (Asyncify.afterUnwind) {
                      Asyncify.afterUnwind();
                      Asyncify.afterUnwind = null;
                    }
                  }
                }
              };
            } else {
              ret[x] = original;
            }
          })(x);
        }
        return ret;
      },allocateData:function() {
        // An asyncify data structure has two fields: the
        // current stack pos, and the max pos.
        var ptr = _malloc(Asyncify.StackSize + 8);
        HEAP32[ptr >> 2] = ptr + 8;
        HEAP32[ptr + 4 >> 2] = ptr + 8 + Asyncify.StackSize;
        var bottomOfCallStack = Asyncify.exportCallStack[0];
        Asyncify.dataInfo[ptr] = {
          bottomOfCallStack: bottomOfCallStack
        };
        return ptr;
      },freeData:function(ptr) {
        _free(ptr);
        Asyncify.dataInfo[ptr] = null;
      },handleSleep:function(startAsync) {
        if (ABORT) return;
        noExitRuntime = true;
        if (Asyncify.state === Asyncify.State.Normal) {
          // Prepare to sleep. Call startAsync, and see what happens:
          // if the code decided to call our callback synchronously,
          // then no async operation was in fact begun, and we don't
          // need to do anything.
          var reachedCallback = false;
          var reachedAfterCallback = false;
          startAsync(function(handleSleepReturnValue) {
            assert(!handleSleepReturnValue || typeof handleSleepReturnValue === 'number'); // old emterpretify API supported other stuff
            if (ABORT) return;
            Asyncify.handleSleepReturnValue = handleSleepReturnValue || 0;
            reachedCallback = true;
            if (!reachedAfterCallback) {
              // We are happening synchronously, so no need for async.
              return;
            }
            Asyncify.state = Asyncify.State.Rewinding;
            runAndAbortIfError(function() { Module['_asyncify_start_rewind'](Asyncify.currData) });
            if (Browser.mainLoop.func) {
              Browser.mainLoop.resume();
            }
            var start = Asyncify.dataInfo[Asyncify.currData].bottomOfCallStack;
            var asyncWasmReturnValue = Module['asm'][start]();
            if (!Asyncify.currData) {
              // All asynchronous execution has finished.
              // `asyncWasmReturnValue` now contains the final
              // return value of the exported async WASM function.
              //
              // Note: `asyncWasmReturnValue` is distinct from
              // `Asyncify.handleSleepReturnValue`.
              // `Asyncify.handleSleepReturnValue` contains the return
              // value of the last C function to have executed
              // `Asyncify.handleSleep()`, where as `asyncWasmReturnValue`
              // contains the return value of the exported WASM function
              // that may have called C functions that
              // call `Asyncify.handleSleep()`.
              var asyncFinalizers = Asyncify.asyncFinalizers;
              Asyncify.asyncFinalizers = [];
              asyncFinalizers.forEach(function(func) {
                func(asyncWasmReturnValue);
              });
            }
          });
          reachedAfterCallback = true;
          if (!reachedCallback) {
            // A true async operation was begun; start a sleep.
            Asyncify.state = Asyncify.State.Unwinding;
            // TODO: reuse, don't alloc/free every sleep
            Asyncify.currData = Asyncify.allocateData();
            runAndAbortIfError(function() { Module['_asyncify_start_unwind'](Asyncify.currData) });
            if (Browser.mainLoop.func) {
              Browser.mainLoop.pause();
            }
          }
        } else if (Asyncify.state === Asyncify.State.Rewinding) {
          // Stop a resume.
          Asyncify.state = Asyncify.State.Normal;
          runAndAbortIfError(Module['_asyncify_stop_rewind']);
          Asyncify.freeData(Asyncify.currData);
          Asyncify.currData = null;
          // Call all sleep callbacks now that the sleep-resume is all done.
          Asyncify.sleepCallbacks.forEach(function(func) {
            func();
          });
        } else {
          abort('invalid state: ' + Asyncify.state);
        }
        return Asyncify.handleSleepReturnValue;
      }};
Module["requestFullscreen"] = function Module_requestFullscreen(lockPointer, resizeCanvas, vrDevice) { Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice) };
  Module["requestFullScreen"] = function Module_requestFullScreen() { Browser.requestFullScreen() };
  Module["requestAnimationFrame"] = function Module_requestAnimationFrame(func) { Browser.requestAnimationFrame(func) };
  Module["setCanvasSize"] = function Module_setCanvasSize(width, height, noUpdates) { Browser.setCanvasSize(width, height, noUpdates) };
  Module["pauseMainLoop"] = function Module_pauseMainLoop() { Browser.mainLoop.pause() };
  Module["resumeMainLoop"] = function Module_resumeMainLoop() { Browser.mainLoop.resume() };
  Module["getUserMedia"] = function Module_getUserMedia() { Browser.getUserMedia() }
  Module["createContext"] = function Module_createContext(canvas, useWebGL, setInModule, webGLContextAttributes) { return Browser.createContext(canvas, useWebGL, setInModule, webGLContextAttributes) };
if (ENVIRONMENT_IS_NODE) {
    _emscripten_get_now = function _emscripten_get_now_actual() {
      var t = process['hrtime']();
      return t[0] * 1e3 + t[1] / 1e6;
    };
  } else if (typeof dateNow !== 'undefined') {
    _emscripten_get_now = dateNow;
  } else _emscripten_get_now = function() { return performance['now'](); };
  ;
var ASSERTIONS = true;

// Copyright 2017 The Emscripten Authors.  All rights reserved.
// Emscripten is available under two separate licenses, the MIT license and the
// University of Illinois/NCSA Open Source License.  Both these licenses can be
// found in the LICENSE file.

/** @type {function(string, boolean=, number=)} */
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      if (ASSERTIONS) {
        assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      }
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}


// Copied from https://github.com/strophe/strophejs/blob/e06d027/src/polyfills.js#L149

// This code was written by Tyler Akins and has been placed in the
// public domain.  It would be nice if you left this header intact.
// Base64 code from Tyler Akins -- http://rumkin.com

/**
 * Decodes a base64 string.
 * @param {String} input The string to decode.
 */
var decodeBase64 = typeof atob === 'function' ? atob : function (input) {
  var keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  var output = '';
  var chr1, chr2, chr3;
  var enc1, enc2, enc3, enc4;
  var i = 0;
  // remove all characters that are not A-Z, a-z, 0-9, +, /, or =
  input = input.replace(/[^A-Za-z0-9\+\/\=]/g, '');
  do {
    enc1 = keyStr.indexOf(input.charAt(i++));
    enc2 = keyStr.indexOf(input.charAt(i++));
    enc3 = keyStr.indexOf(input.charAt(i++));
    enc4 = keyStr.indexOf(input.charAt(i++));

    chr1 = (enc1 << 2) | (enc2 >> 4);
    chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    chr3 = ((enc3 & 3) << 6) | enc4;

    output = output + String.fromCharCode(chr1);

    if (enc3 !== 64) {
      output = output + String.fromCharCode(chr2);
    }
    if (enc4 !== 64) {
      output = output + String.fromCharCode(chr3);
    }
  } while (i < input.length);
  return output;
};

// Converts a string of base64 into a byte array.
// Throws error on invalid input.
function intArrayFromBase64(s) {
  if (typeof ENVIRONMENT_IS_NODE === 'boolean' && ENVIRONMENT_IS_NODE) {
    var buf;
    try {
      buf = Buffer.from(s, 'base64');
    } catch (_) {
      buf = new Buffer(s, 'base64');
    }
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  try {
    var decoded = decodeBase64(s);
    var bytes = new Uint8Array(decoded.length);
    for (var i = 0 ; i < decoded.length ; ++i) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
  } catch (_) {
    throw new Error('Converting base64 string to bytes failed.');
  }
}

// If filename is a base64 data URI, parses and returns data (Buffer on node,
// Uint8Array otherwise). If filename is not a base64 data URI, returns undefined.
function tryParseAsDataURI(filename) {
  if (!isDataURI(filename)) {
    return;
  }

  return intArrayFromBase64(filename.slice(dataURIPrefix.length));
}


// ASM_LIBRARY EXTERN PRIMITIVES: Int8Array,Int32Array

var asmGlobalArg = {};
var asmLibraryArg = { "__handle_stack_overflow": ___handle_stack_overflow, "__lock": ___lock, "__unlock": ___unlock, "emscripten_get_sbrk_ptr": _emscripten_get_sbrk_ptr, "emscripten_memcpy_big": _emscripten_memcpy_big, "emscripten_resize_heap": _emscripten_resize_heap, "fd_write": _fd_write, "getchar_js": getchar_js, "isatty_js": isatty_js, "memory": wasmMemory, "putchar_js": putchar_js, "setTempRet0": _setTempRet0, "startup": startup, "table": wasmTable };
Asyncify.instrumentWasmImports(asmLibraryArg);
var asm = createWasm();
var real____wasm_call_ctors = asm["__wasm_call_ctors"];
asm["__wasm_call_ctors"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____wasm_call_ctors.apply(null, arguments);
};

var real__main = asm["main"];
asm["main"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__main.apply(null, arguments);
};

var real__fflush = asm["fflush"];
asm["fflush"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__fflush.apply(null, arguments);
};

var real____errno_location = asm["__errno_location"];
asm["__errno_location"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____errno_location.apply(null, arguments);
};

var real__setThrew = asm["setThrew"];
asm["setThrew"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__setThrew.apply(null, arguments);
};

var real__malloc = asm["malloc"];
asm["malloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__malloc.apply(null, arguments);
};

var real__free = asm["free"];
asm["free"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__free.apply(null, arguments);
};

var real____set_stack_limit = asm["__set_stack_limit"];
asm["__set_stack_limit"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____set_stack_limit.apply(null, arguments);
};

var real_stackSave = asm["stackSave"];
asm["stackSave"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackSave.apply(null, arguments);
};

var real_stackAlloc = asm["stackAlloc"];
asm["stackAlloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackAlloc.apply(null, arguments);
};

var real_stackRestore = asm["stackRestore"];
asm["stackRestore"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackRestore.apply(null, arguments);
};

var real___growWasmMemory = asm["__growWasmMemory"];
asm["__growWasmMemory"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___growWasmMemory.apply(null, arguments);
};

var real_dynCall_ii = asm["dynCall_ii"];
asm["dynCall_ii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_dynCall_ii.apply(null, arguments);
};

var real_dynCall_iiii = asm["dynCall_iiii"];
asm["dynCall_iiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_dynCall_iiii.apply(null, arguments);
};

var real_dynCall_jiji = asm["dynCall_jiji"];
asm["dynCall_jiji"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_dynCall_jiji.apply(null, arguments);
};

var real_dynCall_iidiiii = asm["dynCall_iidiiii"];
asm["dynCall_iidiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_dynCall_iidiiii.apply(null, arguments);
};

var real_dynCall_vii = asm["dynCall_vii"];
asm["dynCall_vii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_dynCall_vii.apply(null, arguments);
};

var real__asyncify_start_unwind = asm["asyncify_start_unwind"];
asm["asyncify_start_unwind"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__asyncify_start_unwind.apply(null, arguments);
};

var real__asyncify_stop_unwind = asm["asyncify_stop_unwind"];
asm["asyncify_stop_unwind"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__asyncify_stop_unwind.apply(null, arguments);
};

var real__asyncify_start_rewind = asm["asyncify_start_rewind"];
asm["asyncify_start_rewind"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__asyncify_start_rewind.apply(null, arguments);
};

var real__asyncify_stop_rewind = asm["asyncify_stop_rewind"];
asm["asyncify_stop_rewind"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__asyncify_stop_rewind.apply(null, arguments);
};

Module["asm"] = asm;
var ___wasm_call_ctors = Module["___wasm_call_ctors"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__wasm_call_ctors"].apply(null, arguments)
};

var _main = Module["_main"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["main"].apply(null, arguments)
};

var _fflush = Module["_fflush"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["fflush"].apply(null, arguments)
};

var ___errno_location = Module["___errno_location"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__errno_location"].apply(null, arguments)
};

var _setThrew = Module["_setThrew"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["setThrew"].apply(null, arguments)
};

var _malloc = Module["_malloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["malloc"].apply(null, arguments)
};

var _free = Module["_free"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["free"].apply(null, arguments)
};

var ___set_stack_limit = Module["___set_stack_limit"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__set_stack_limit"].apply(null, arguments)
};

var stackSave = Module["stackSave"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["stackSave"].apply(null, arguments)
};

var stackAlloc = Module["stackAlloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["stackAlloc"].apply(null, arguments)
};

var stackRestore = Module["stackRestore"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["stackRestore"].apply(null, arguments)
};

var __growWasmMemory = Module["__growWasmMemory"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__growWasmMemory"].apply(null, arguments)
};

var dynCall_ii = Module["dynCall_ii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_ii"].apply(null, arguments)
};

var dynCall_iiii = Module["dynCall_iiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iiii"].apply(null, arguments)
};

var dynCall_jiji = Module["dynCall_jiji"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_jiji"].apply(null, arguments)
};

var dynCall_iidiiii = Module["dynCall_iidiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iidiiii"].apply(null, arguments)
};

var dynCall_vii = Module["dynCall_vii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_vii"].apply(null, arguments)
};

var _asyncify_start_unwind = Module["_asyncify_start_unwind"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["asyncify_start_unwind"].apply(null, arguments)
};

var _asyncify_stop_unwind = Module["_asyncify_stop_unwind"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["asyncify_stop_unwind"].apply(null, arguments)
};

var _asyncify_start_rewind = Module["_asyncify_start_rewind"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["asyncify_start_rewind"].apply(null, arguments)
};

var _asyncify_stop_rewind = Module["_asyncify_stop_rewind"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["asyncify_stop_rewind"].apply(null, arguments)
};




// === Auto-generated postamble setup entry stuff ===

Module['asm'] = asm;

if (!Object.getOwnPropertyDescriptor(Module, "intArrayFromString")) Module["intArrayFromString"] = function() { abort("'intArrayFromString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "intArrayToString")) Module["intArrayToString"] = function() { abort("'intArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "ccall")) Module["ccall"] = function() { abort("'ccall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "cwrap")) Module["cwrap"] = function() { abort("'cwrap' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setValue")) Module["setValue"] = function() { abort("'setValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getValue")) Module["getValue"] = function() { abort("'getValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "allocate")) Module["allocate"] = function() { abort("'allocate' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getMemory")) Module["getMemory"] = function() { abort("'getMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "AsciiToString")) Module["AsciiToString"] = function() { abort("'AsciiToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToAscii")) Module["stringToAscii"] = function() { abort("'stringToAscii' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UTF8ArrayToString")) Module["UTF8ArrayToString"] = function() { abort("'UTF8ArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UTF8ToString")) Module["UTF8ToString"] = function() { abort("'UTF8ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF8Array")) Module["stringToUTF8Array"] = function() { abort("'stringToUTF8Array' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF8")) Module["stringToUTF8"] = function() { abort("'stringToUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "lengthBytesUTF8")) Module["lengthBytesUTF8"] = function() { abort("'lengthBytesUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UTF16ToString")) Module["UTF16ToString"] = function() { abort("'UTF16ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF16")) Module["stringToUTF16"] = function() { abort("'stringToUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "lengthBytesUTF16")) Module["lengthBytesUTF16"] = function() { abort("'lengthBytesUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UTF32ToString")) Module["UTF32ToString"] = function() { abort("'UTF32ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF32")) Module["stringToUTF32"] = function() { abort("'stringToUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "lengthBytesUTF32")) Module["lengthBytesUTF32"] = function() { abort("'lengthBytesUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "allocateUTF8")) Module["allocateUTF8"] = function() { abort("'allocateUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackTrace")) Module["stackTrace"] = function() { abort("'stackTrace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnPreRun")) Module["addOnPreRun"] = function() { abort("'addOnPreRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnInit")) Module["addOnInit"] = function() { abort("'addOnInit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnPreMain")) Module["addOnPreMain"] = function() { abort("'addOnPreMain' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnExit")) Module["addOnExit"] = function() { abort("'addOnExit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnPostRun")) Module["addOnPostRun"] = function() { abort("'addOnPostRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeStringToMemory")) Module["writeStringToMemory"] = function() { abort("'writeStringToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeArrayToMemory")) Module["writeArrayToMemory"] = function() { abort("'writeArrayToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeAsciiToMemory")) Module["writeAsciiToMemory"] = function() { abort("'writeAsciiToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addRunDependency")) Module["addRunDependency"] = function() { abort("'addRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "removeRunDependency")) Module["removeRunDependency"] = function() { abort("'removeRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "ENV")) Module["ENV"] = function() { abort("'ENV' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "FS")) Module["FS"] = function() { abort("'FS' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createFolder")) Module["FS_createFolder"] = function() { abort("'FS_createFolder' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createPath")) Module["FS_createPath"] = function() { abort("'FS_createPath' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createDataFile")) Module["FS_createDataFile"] = function() { abort("'FS_createDataFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createPreloadedFile")) Module["FS_createPreloadedFile"] = function() { abort("'FS_createPreloadedFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createLazyFile")) Module["FS_createLazyFile"] = function() { abort("'FS_createLazyFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createLink")) Module["FS_createLink"] = function() { abort("'FS_createLink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createDevice")) Module["FS_createDevice"] = function() { abort("'FS_createDevice' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_unlink")) Module["FS_unlink"] = function() { abort("'FS_unlink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "GL")) Module["GL"] = function() { abort("'GL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "dynamicAlloc")) Module["dynamicAlloc"] = function() { abort("'dynamicAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "loadDynamicLibrary")) Module["loadDynamicLibrary"] = function() { abort("'loadDynamicLibrary' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "loadWebAssemblyModule")) Module["loadWebAssemblyModule"] = function() { abort("'loadWebAssemblyModule' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getLEB")) Module["getLEB"] = function() { abort("'getLEB' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getFunctionTables")) Module["getFunctionTables"] = function() { abort("'getFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "alignFunctionTables")) Module["alignFunctionTables"] = function() { abort("'alignFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerFunctions")) Module["registerFunctions"] = function() { abort("'registerFunctions' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addFunction")) Module["addFunction"] = function() { abort("'addFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "removeFunction")) Module["removeFunction"] = function() { abort("'removeFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getFuncWrapper")) Module["getFuncWrapper"] = function() { abort("'getFuncWrapper' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "prettyPrint")) Module["prettyPrint"] = function() { abort("'prettyPrint' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "makeBigInt")) Module["makeBigInt"] = function() { abort("'makeBigInt' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "dynCall")) Module["dynCall"] = function() { abort("'dynCall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getCompilerSetting")) Module["getCompilerSetting"] = function() { abort("'getCompilerSetting' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "print")) Module["print"] = function() { abort("'print' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "printErr")) Module["printErr"] = function() { abort("'printErr' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getTempRet0")) Module["getTempRet0"] = function() { abort("'getTempRet0' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setTempRet0")) Module["setTempRet0"] = function() { abort("'setTempRet0' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
Module["callMain"] = callMain;
if (!Object.getOwnPropertyDescriptor(Module, "abort")) Module["abort"] = function() { abort("'abort' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "warnOnce")) Module["warnOnce"] = function() { abort("'warnOnce' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackSave")) Module["stackSave"] = function() { abort("'stackSave' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackRestore")) Module["stackRestore"] = function() { abort("'stackRestore' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackAlloc")) Module["stackAlloc"] = function() { abort("'stackAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
Module["writeStackCookie"] = writeStackCookie;
Module["checkStackCookie"] = checkStackCookie;
Module["abortStackOverflow"] = abortStackOverflow;
if (!Object.getOwnPropertyDescriptor(Module, "intArrayFromBase64")) Module["intArrayFromBase64"] = function() { abort("'intArrayFromBase64' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "tryParseAsDataURI")) Module["tryParseAsDataURI"] = function() { abort("'tryParseAsDataURI' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };if (!Object.getOwnPropertyDescriptor(Module, "ALLOC_NORMAL")) Object.defineProperty(Module, "ALLOC_NORMAL", { configurable: true, get: function() { abort("'ALLOC_NORMAL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Object.getOwnPropertyDescriptor(Module, "ALLOC_STACK")) Object.defineProperty(Module, "ALLOC_STACK", { configurable: true, get: function() { abort("'ALLOC_STACK' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Object.getOwnPropertyDescriptor(Module, "ALLOC_DYNAMIC")) Object.defineProperty(Module, "ALLOC_DYNAMIC", { configurable: true, get: function() { abort("'ALLOC_DYNAMIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Object.getOwnPropertyDescriptor(Module, "ALLOC_NONE")) Object.defineProperty(Module, "ALLOC_NONE", { configurable: true, get: function() { abort("'ALLOC_NONE' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Object.getOwnPropertyDescriptor(Module, "calledRun")) Object.defineProperty(Module, "calledRun", { configurable: true, get: function() { abort("'calledRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") } });



var calledRun;

// Modularize mode returns a function, which can be called to
// create instances. The instances provide a then() method,
// must like a Promise, that receives a callback. The callback
// is called when the module is ready to run, with the module
// as a parameter. (Like a Promise, it also returns the module
// so you can use the output of .then(..)).
Module['then'] = function(func) {
  // We may already be ready to run code at this time. if
  // so, just queue a call to the callback.
  if (calledRun) {
    func(Module);
  } else {
    // we are not ready to call then() yet. we must call it
    // at the same time we would call onRuntimeInitialized.
    var old = Module['onRuntimeInitialized'];
    Module['onRuntimeInitialized'] = function() {
      if (old) old();
      func(Module);
    };
  }
  return Module;
};

/**
 * @constructor
 * @this {ExitStatus}
 */
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
}

var calledMain = false;


dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!calledRun) run();
  if (!calledRun) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
};

function callMain(args) {
  assert(runDependencies == 0, 'cannot call main when async dependencies remain! (listen on Module["onRuntimeInitialized"])');
  assert(__ATPRERUN__.length == 0, 'cannot call main when preRun functions remain to be called');

  var entryFunction = Module['_main'];


  args = args || [];

  var argc = args.length+1;
  var argv = stackAlloc((argc + 1) * 4);
  HEAP32[argv >> 2] = allocateUTF8OnStack(thisProgram);
  for (var i = 1; i < argc; i++) {
    HEAP32[(argv >> 2) + i] = allocateUTF8OnStack(args[i - 1]);
  }
  HEAP32[(argv >> 2) + argc] = 0;


  try {

    Module['___set_stack_limit'](STACK_MAX);

    var ret = entryFunction(argc, argv);


    // In PROXY_TO_PTHREAD builds, we should never exit the runtime below, as execution is asynchronously handed
    // off to a pthread.
    // if we are saving the stack, then do not call exit, we are not
    // really exiting now, just unwinding the JS stack
    if (!noExitRuntime) {
    // if we're not running an evented main loop, it's time to exit
      exit(ret, /* implicit = */ true);
    }
  }
  catch(e) {
    if (e instanceof ExitStatus) {
      // exit() throws this once it's done to make sure execution
      // has been stopped completely
      return;
    } else if (e == 'unwind') {
      // running an evented main loop, don't immediately exit
      noExitRuntime = true;
      return;
    } else {
      var toLog = e;
      if (e && typeof e === 'object' && e.stack) {
        toLog = [e, e.stack];
      }
      err('exception thrown: ' + toLog);
      quit_(1, e);
    }
  } finally {
    calledMain = true;
  }
}




/** @type {function(Array=)} */
function run(args) {
  args = args || arguments_;

  if (runDependencies > 0) {
    return;
  }

  writeStackCookie();

  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later

  function doRun() {
    // run may have just been called through dependencies being fulfilled just in this very frame,
    // or while the async setStatus time below was happening
    if (calledRun) return;
    calledRun = true;

    if (ABORT) return;

    initRuntime();

    preMain();

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    if (shouldRunNow) callMain(args);

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else
  {
    doRun();
  }
  checkStackCookie();
}
Module['run'] = run;

function checkUnflushedContent() {
  // Compiler settings do not allow exiting the runtime, so flushing
  // the streams is not possible. but in ASSERTIONS mode we check
  // if there was something to flush, and if so tell the user they
  // should request that the runtime be exitable.
  // Normally we would not even include flush() at all, but in ASSERTIONS
  // builds we do so just for this check, and here we see if there is any
  // content to flush, that is, we check if there would have been
  // something a non-ASSERTIONS build would have not seen.
  // How we flush the streams depends on whether we are in SYSCALLS_REQUIRE_FILESYSTEM=0
  // mode (which has its own special function for this; otherwise, all
  // the code is inside libc)
  var print = out;
  var printErr = err;
  var has = false;
  out = err = function(x) {
    has = true;
  }
  try { // it doesn't matter if it fails
    var flush = flush_NO_FILESYSTEM;
    if (flush) flush(0);
  } catch(e) {}
  out = print;
  err = printErr;
  if (has) {
    warnOnce('stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the FAQ), or make sure to emit a newline when you printf etc.');
    warnOnce('(this may also be due to not including full filesystem support - try building with -s FORCE_FILESYSTEM=1)');
  }
}

function exit(status, implicit) {
  checkUnflushedContent();

  // if this is just main exit-ing implicitly, and the status is 0, then we
  // don't need to do anything here and can just leave. if the status is
  // non-zero, though, then we need to report it.
  // (we may have warned about this earlier, if a situation justifies doing so)
  if (implicit && noExitRuntime && status === 0) {
    return;
  }

  if (noExitRuntime) {
    // if exit() was called, we may warn the user if the runtime isn't actually being shut down
    if (!implicit) {
      err('program exited (with status: ' + status + '), but EXIT_RUNTIME is not set, so halting execution but not exiting the runtime or preventing further async execution (build with EXIT_RUNTIME=1, if you want a true shutdown)');
    }
  } else {

    ABORT = true;
    EXITSTATUS = status;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  quit_(status, new ExitStatus(status));
}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

// shouldRunNow refers to calling main(), not run().
var shouldRunNow = false;

if (Module['noInitialRun']) shouldRunNow = false;


  noExitRuntime = true;

run();





// {{MODULE_ADDITIONS}}





  return __CAT
}
);
})();
if (typeof exports === 'object' && typeof module === 'object')
      module.exports = __CAT;
    else if (typeof define === 'function' && define['amd'])
      define([], function() { return __CAT; });
    else if (typeof exports === 'object')
      exports["__CAT"] = __CAT;
    




    var stdinHandler = {};

var process = {
  stdin: {
    pause() {},
    resume() {},
    on(event, fn) {
      if (!stdinHandler[event]) stdinHandler[event] = [];
      stdinHandler[event].push(fn);
    }
  },
  stdout: {
    write(msg) {
      self.postMessage(msg);
    }
  }
};

self.onmessage = msg => {
  msg = msg.data;
  if (msg === 'EOF') {
    for (let i = 0; i < stdinHandler['end'].length; ++i) {
      stdinHandler['end'][i]();
    }
  } else if (msg === 'RUN') {
    __CAT().then(Module => Module.callMain());
  } else {
    const data = new TextEncoder().encode(msg);
    for (let i = 0; i < stdinHandler['data'].length; ++i) {
      stdinHandler['data'][i](data);
    }
  }
};
