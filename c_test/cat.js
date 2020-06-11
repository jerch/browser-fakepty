
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
    STACK_BASE = 5248352,
    STACKTOP = STACK_BASE,
    STACK_MAX = 5472,
    DYNAMIC_BASE = 5248352,
    DYNAMICTOP_PTR = 5312;

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




var wasmBinaryFile = 'data:application/octet-stream;base64,AGFzbQEAAAABpgEYYAF/AX9gA39/fwF/YAF/AGAAAX9gAABgAn9/AGACf38Bf2AGf3x/f39/AX9gA39+fwF+YAN/f38AYAR/fn5/AGAEf39/fwF/YAV/f39/fwF/YAJ+fwF/YAR/f39/AGAFf39/f38AYAZ/f39/f38AYAd/f39/f39/AX9gB39/fH9/f38Bf2ADfn9/AX9gBH9/fn8BfmABfAF+YAJ+fgF8YAJ8fwF8AooCDQNlbnYHc3RhcnR1cAAEA2VudgxmaWxsX3Rlcm1pb3MAEANlbnYKZ2V0Y2hhcl9qcwADA2VudgpwdXRjaGFyX2pzAAAWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQhmZF93cml0ZQALA2VudgZfX2xvY2sAAgNlbnYIX191bmxvY2sAAgNlbnYVZW1zY3JpcHRlbl9tZW1jcHlfYmlnAAEDZW52FmVtc2NyaXB0ZW5fcmVzaXplX2hlYXAAAANlbnYXX19oYW5kbGVfc3RhY2tfb3ZlcmZsb3cABANlbnYLc2V0VGVtcFJldDAAAgNlbnYGbWVtb3J5AgGAAoACA2VudgV0YWJsZQFwAAYDPz4DBAMGAQAIAAIDBAABDBEJAA4PDRMNAQcFFQYDAAYDAQMXAQAKChYBAQAAAgUAAAIDAAIABgsUEgkMAgQCBAYeBX8BQcCpwAILfwBBwCkLfwFBAAt/AUEAC38BQQALB9gCFhFfX3dhc21fY2FsbF9jdG9ycwAMBG1haW4ADgZmZmx1c2gAOBBfX2Vycm5vX2xvY2F0aW9uACYIc2V0VGhyZXcANwZtYWxsb2MANQRmcmVlADYKX19kYXRhX2VuZAMBEV9fc2V0X3N0YWNrX2xpbWl0ADoJc3RhY2tTYXZlADsKc3RhY2tBbGxvYwA8DHN0YWNrUmVzdG9yZQA9EF9fZ3Jvd1dhc21NZW1vcnkAPgpkeW5DYWxsX2lpAD8MZHluQ2FsbF9paWlpAEAMZHluQ2FsbF9qaWppAEQPZHluQ2FsbF9paWRpaWlpAEILZHluQ2FsbF92aWkAQxVhc3luY2lmeV9zdGFydF91bndpbmQARRRhc3luY2lmeV9zdG9wX3Vud2luZABGFWFzeW5jaWZ5X3N0YXJ0X3Jld2luZABHFGFzeW5jaWZ5X3N0b3BfcmV3aW5kAEgJCwEAQQELBRAP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MCGcASCbASCcAWohnQEgnQEhMQJAAkAgMSGeASCeASEzIDMhnwEjAiGgASCfASCgAUkhoQEgoQEEQBAJCwsgMyGiASCiASQACyAvIaMBIKMBDwsBAQEBAQEBAQEBAQEBAQsAAAsAAAALAAshpgECQCMEKAIAIKYBNgIAIwQjBCgCAEEEajYCAAsCQCMEKAIAIaoBIKoBIAA2AgAgqgEgATYCBCCqASACNgIIIKoBIAM2AgwgqgEgBDYCECCqASAFNgIUIKoBIAY2AhggqgEgBzYCHCCqASAINgIgIKoBIAk2AiQgqgEgCjYCKCCqASALNgIsIKoBIAw2AjAgqgEgDTYCNCCqASAONgI4IKoBIA82AjwgqgEgEDYCQCCqASARNgJEIKoBIBI2AkggqgEgEzYCTCCqASAUNgJQIKoBIBU2AlQgqgEgFjYCWCCqASAXNgJcIKoBIBg2AmAgqgEgGTYCZCCqASAaNgJoIKoBIBs2AmwgqgEgHDYCcCCqASAdNgJ0IKoBIB42AnggqgEgHzYCfCCqASAgNgKAASCqASAhNgKEASCqASAiNgKIASCqASAjNgKMASCqASAkNgKQASCqASAlNgKUASCqASAmNgKYASCqASAnNgKcASCqASAoNgKgASCqASApNgKkASCqASAqNgKoASCqASArNgKsASCqASAsNgKwASCqASAtNgK0ASCqASAuNgK4ASCqASAvNgK8ASCqASAwNgLAASCqASAxNgLEASCqASAyNgLIASCqASAzNgLMASCqASA0NgLQASCqASA1NgLUASCqASA2NgLYASCqASA3NgLcASCqASA4NgLgASCqASA5NgLkASCqASA6NgLoASCqASA7NgLsASCqASA8NgLwASCqASA9NgL0ASCqASA+NgL4ASCqASA/NgL8ASCqASBANgKAAiCqASBBNgKEAiCqASBCNgKIAiCqASBDNgKMAiCqASBENgKQAiCqASBFNgKUAiCqASBGNgKYAiCqASBHNgKcAiCqASBINgKgAiCqASBJNgKkAiCqASBKNgKoAiCqASBLNgKsAiCqASBMNgKwAiCqASBNNgK0AiCqASBONgK4AiCqASBPNgK8AiCqASBQNgLAAiCqASBRNgLEAiCqASBSNgLIAiCqASBTNgLMAiCqASBUNgLQAiCqASBVNgLUAiCqASBWNgLYAiCq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BEcEQAALIPYECyFXIFchDkF/IRBBASENIAchWCBYKAJMIVkgWSEBAkAgDiFaIFpFIVsgWw0AIAEhXCBcLQACIV0gXUEkRyFeIF4NACABIV8gXywAASFgIGBBUGohYSBhIRBBASEKQQMhDQsgByFiIAEhYyANIWQgYyBkaiFlIGUhASABIWYgYiBmNgJMQQAhDQJAAkAgASFnIGcsAAAhaCBoIREgESFpIGlBYGohaiBqIQ8gDyFrIGtBH00hbCBsDQAgASFtIG0hDgwBCyABIW4gbiEOIA8hb0EBIG90IXAgcCEPIA8hcSBxQYnRBHEhciByRSFzIHMNAANAIAchdCABIXUgdUEBaiF2IHYhDiAOIXcgdCB3NgJMIA8heCANIXkgeCB5ciF6IHohDSABIXsgeywAASF8IHwhESARIX0gfUFgaiF+IH4hDyAPIX8gf0EfSyGAASCAAQ0BIA4hgQEggQEhASAPIYIBQQEgggF0IYMBIIMBIQ8gDyGEASCEAUGJ0QRxIYUBIIUBDQALCwJAAkAgESGGASCGAUEqRyGHASCHAQ0AAkACQCAOIYgBIIgBLAABIYkBAn8giQEQJyH3BCMDIPQERwRAAAsg9wQLIYoBIIoBRSGLASCLAQ0AIAchjAEgjAEoAkwhjQEgjQEhDiAOIY4BII4BLQACIY8BII8BQSRHIZABIJABDQAgDiGRASCRASwAASGSASCSAUECdCGTASAEIZQBIJMBIJQBaiGVASCVAUHAfmohlgEglgFBCjYCACAOIZcBIJcBQQNqIZgBIJgBIQEgDiGZASCZASwAASGaASCaAUEDdCGbASADIZwBIJsBIJwBaiGdASCdAUGAfWohngEgngEoAgAhnwEgnwEhEkEBIQoMAQsgCiGgASCgAQ0HQQAhCkEAIRICQCAAIaEBIKEBRSGiASCiAQ0AIAIhowEgAiGkASCkASgCACGlASClASEBIAEhpgEgpgFBBGohpwEgowEgpwE2AgAgASGoASCoASgCACGpASCpASESCyAHIaoBIKoBKAJMIasBIKsBQQFqIawBIKwBIQELIAchrQEgASGuASCtASCuATYCTCASIa8BIK8BQX9KIbABILABDQEgEiGxAUEAILEBayGyASCyASESIA0hswEgswFBgMAAciG0ASC0ASENDAELIAchtQEgtQFBzABqIbYB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DAELAkAgAyF3IHdBfGoheCB4IQQgBCF5IAAheiB5IHpPIXsgew0AIAAhfCB8IQIMAQsgACF9IH0hAgNAIAIhfiABIX8gfy0AACGAASB+IIABOgAAIAIhgQEgASGCASCCAS0AASGDASCBASCDAToAASACIYQBIAEhhQEghQEtAAIhhgEghAEghgE6AAIgAiGHASABIYgBIIgBLQADIYkBIIcBIIkBOgADIAEhigEgigFBBGohiwEgiwEhASACIYwBIIwBQQRqIY0BII0BIQIgAiGOASAEIY8BII4BII8BTSGQASCQAQ0ACwsCQCACIZEBIAMhkgEgkQEgkgFPIZMBIJMBDQADQCACIZQBIAEhlQEglQEtAAAhlgEglAEglgE6AAAgASGXASCXAUEBaiGYASCYASEBIAIhmQEgmQFBAWohmgEgmgEhAiACIZsBIAMhnAEgmwEgnAFHIZ0BIJ0BDQALCyAAIZ4BIJ4BIZ8BCyCfASGgASCgAQ8ACwAL9AYCc38KfiMDIXUCQAJAAkAgAiEGIAZFIQcgBw0AIAIhCCAAIQkgCCAJaiEKIAohAyADIQsgC0F/aiEMIAEhDSAMIA06AAAgACEOIAEhDyAOIA86AAAgAiEQIBBBA0khESARDQAgAyESIBJBfmohEyABIRQgEyAUOgAAIAAhFSABIRYgFSAWOgABIAMhFyAXQX1qIRggASEZIBggGToAACAAIRogASEbIBogGzoAAiACIRwgHEEHSSEdIB0NACADIR4gHkF8aiEfIAEhICAfICA6AAAgACEhIAEhIiAhICI6AAMgAiEjICNBCUkhJCAkDQAgACElIAAhJkEAICZrIScgJ0EDcSEoICghBCAEISkgJSApaiEqICohAyADISsgASEsICxB/wFxIS0gLUGBgoQIbCEuIC4hASABIS8gKyAvNgIAIAMhMCACITEgBCEyIDEgMmshMyAzQXxxITQgNCEEIAQhNSAwIDVqITYgNiECIAIhNyA3QXxqITggASE5IDggOTYCACAEITogOkEJSSE7IDsNACADITwgASE9IDwgPTYCCCADIT4gASE/ID4gPzYCBCACIUAgQEF4aiFBIAEhQiBBIEI2AgAgAiFDIENBdGohRCABIUUgRCBFNgIAIAQhRiBGQRlJIUcgRw0AIAMhSCABIUkgSCBJNgIYIAMhSiABIUsg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IHByb2Nlc3MuX19pblN0YXRlLnBvbGwgPSAoKSA9PiB7IGlmIChwcm9jZXNzLl9faW5TdGF0ZS5wb3MgPCBwcm9jZXNzLl9faW5TdGF0ZS5pbnB1dC5sZW5ndGgpIHsgcHJvY2Vzcy5fX2luU3RhdGUucmVzb2x2ZXIocHJvY2Vzcy5fX2luU3RhdGUuaW5wdXRbcHJvY2Vzcy5fX2luU3RhdGUucG9zKytdKTsgcHJvY2Vzcy5fX2luU3RhdGUucmVzb2x2ZXIgPSBudWxsOyB9IGVsc2UgeyBpZiAocHJvY2Vzcy5fX2luU3RhdGUuY2xvc2VkKSB7IHByb2Nlc3MuX19pblN0YXRlLnJlc29sdmVyKC0xKTsgcmV0dXJuOyB9IGlmIChwcm9jZXNzLl9faW5TdGF0ZS5pbnB1dC5sZW5ndGggPiA1KSB7IHByb2Nlc3MuX19pblN0YXRlLmlucHV0ID0gbmV3IFVpbnQ4QXJyYXkoMCk7IHByb2Nlc3MuX19pblN0YXRlLnBvcyA9IDA7IHByb2Nlc3Muc3RkaW4ucmVzdW1lKCk7IH0gc2V0VGltZW91dCgoKSA9PiBwcm9jZXNzLl9faW5TdGF0ZS5wb2xsKCksIDUwKTsgfSB9OyBwcm9jZXNzLnN0ZGluLm9uKCJkYXRhIiwgZnVuY3Rpb24gKGNodW5rKSB7IHByb2Nlc3MuX19pblN0YXRlLmlucHV0ID0gcHJvY2Vzcy5idWZmZXJDb25jYXQocHJvY2Vzcy5fX2luU3RhdGUuaW5wdXQsIGNodW5rKTsgaWYgKHByb2Nlc3MuX19pblN0YXRlLmlucHV0Lmxlbmd0aCA+IDUpIHsgcHJvY2Vzcy5zdGRpbi5wYXVzZSgpOyB9IH0pOyBwcm9jZXNzLnN0ZGluLm9uKCJlbmQiLCBmdW5jdGlvbiAoKSB7IHByb2Nlc3MuX19pblN0YXRlLmNsb3NlZCA9IHRydWU7IH0pOyBwcm9jZXNzLnN0ZGluLnJlc3VtZSgpOyB9AChjaGFyIGMpPDo6PnsgcHJvY2Vzcy5zdGRvdXQud3JpdGUoU3RyaW5nLmZyb21DaGFyQ29kZShjKSk7IH0AKCBzdHJ1Y3QgdGVybWlvcyAqcCwgc2l6ZV90IGJ5dGVzLCB1bnNpZ25lZCBpbnQgKmlmbGFncywgdW5zaWduZWQgaW50ICpvZmxhZ3MsIHVuc2lnbmVkIGludCAqbGZsYWdzLCB1bnNpZ25lZCBjaGFyICpjYyApPDo6PnsgY29uc29sZS5sb2coJ29mZnNldCAmIHNpemU6JywgcCwgYnl0ZXMpOyBjb25zb2xlLmxvZygnYWRyZXNzZXM6JywgaWZsYWdzLCBvZmxhZ3MsIGxmbGFncywgY2MpOyBNb2R1bGUuc2V0VmFsdWUoaWZsYWdzLCAxMjM0NSwgJ2kzMicpOyBNb2R1bGUuc2V0VmFsdWUob2ZsYWdzLCA0NTY3OCwgJ2kzMicpOyBNb2R1bGUuc2V0VmFsdWUobGZsYWdzLCA2NjYsICdpMzInKTsgfQB0ZXJtaW9zIGZpbGxlZDogJWQgJWQgJWQKAHRlcm1pb3Mgc2l6ZTogJWQKAGNjIG9mZnNldDogJWQKAApkb25lIHdpdGggQwoA6AwAAC0rICAgMFgweAAobnVsbCkAAAAAAAAAABEACgAREREAAAAABQAAAAAAAAkAAAAACwAAAAAAAAAAEQAPChEREQMKBwABEwkLCwAACQYLAAALAAYRAAAAERERAAAAAAAAAAAAAAAAAAAAAAsAAAAAAAAAABEACgoREREACgAAAgAJCwAAAAkACwAACwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAAAMAAAAAAwAAAAACQwAAAAAAAwAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgAAAAAAAAAAAAAADQAAAAQNAAAAAAkOAAAAAAAOAAAOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAA8AAAAADwAAAAAJEAAAAAAAEAAAEAAAEgAAABISEgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASAAAAEhISAAAAAAAACQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACwAAAAAAAAAAAAAACgAAAAAKAAAAAAkLAAAAAAALAAALAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAwAAAAADAAAAAAJDAAAAAAADAAADAAAMDEyMzQ1Njc4OUFCQ0RFRi0wWCswWCAwWC0weCsweCAweABpbmYASU5GAG5hbgBOQU4ALgAAQegZC/wCBQAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAMAAAB4DgAAAAQAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAACv////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA6AwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAsBIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQfAcC9AMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
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
function putchar_js(c){ process.stdout.write(String.fromCharCode(c)); }
function startup(){ process.bufferConcat = (a, b) => { var result = new (a.constructor)(a.length + b.length); result.set(a); result.set(b, a.length); return result; }; process.__inState = {input: new Uint8Array(0), pos: 0, resolver: null, closed: false}; process.__inState.poll = () => { if (process.__inState.pos < process.__inState.input.length) { process.__inState.resolver(process.__inState.input[process.__inState.pos++]); process.__inState.resolver = null; } else { if (process.__inState.closed) { process.__inState.resolver(-1); return; } if (process.__inState.input.length > 5) { process.__inState.input = new Uint8Array(0); process.__inState.pos = 0; process.stdin.resume(); } setTimeout(() => process.__inState.poll(), 50); } }; process.stdin.on("data", function (chunk) { process.__inState.input = process.bufferConcat(process.__inState.input, chunk); if (process.__inState.input.length > 5) { process.stdin.pause(); } }); process.stdin.on("end", function () { process.__inState.closed = true; }); process.stdin.resume(); }
function fill_termios(p,bytes,iflags,oflags,lflags,cc){ console.log('offset & size:', p, bytes); console.log('adresses:', iflags, oflags, lflags, cc); Module.setValue(iflags, 12345, 'i32'); Module.setValue(oflags, 45678, 'i32'); Module.setValue(lflags, 666, 'i32'); }
function getchar_js(){ return Asyncify.handleSleep(function(wakeUp) { if (process.__inState.resolver) { wakeUp(-1); } else { new Promise(resolve => { process.__inState.resolver = resolve; process.__inState.poll(); }).then(ret => wakeUp(ret)); } }); }



// STATICTOP = STATIC_BASE + 4448;
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
      return 5312;
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
var asmLibraryArg = { "__handle_stack_overflow": ___handle_stack_overflow, "__lock": ___lock, "__unlock": ___unlock, "emscripten_get_sbrk_ptr": _emscripten_get_sbrk_ptr, "emscripten_memcpy_big": _emscripten_memcpy_big, "emscripten_resize_heap": _emscripten_resize_heap, "fd_write": _fd_write, "fill_termios": fill_termios, "getchar_js": getchar_js, "memory": wasmMemory, "putchar_js": putchar_js, "setTempRet0": _setTempRet0, "startup": startup, "table": wasmTable };
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
Module["setValue"] = setValue;
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
      console.log('out', [msg]);
      self.postMessage(msg);
    }
  }
};

self.onmessage = async msg => {
  msg = msg.data;
  //console.log([msg]);
  if (msg === 'EOF') {
    const handlers = stdinHandler['end'];
    if (handlers)
    for (let i = 0; i < handlers.length; ++i) {
      handlers[i]();
    }
  } else if (msg === 'RUN') {
    //await __CAT().then(Module => Module.callMain());
    const m = await __CAT();
    await m.callMain();
  } else {
    console.log([msg]);
    const data = new TextEncoder().encode(msg);
    const handlers = stdinHandler['data'];
    if (handlers)
    for (let i = 0; i < handlers.length; ++i) {
      handlers[i](data);
    }
  }
};
