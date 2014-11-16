
(function (factory) {
    var framework = factory(typeof require !== 'undefined' ? require : null);
    if (typeof module === "object" && typeof module.exports === "object") { //node module
        module.exports = framework;
    } else {
        vomit = framework;
    }

    if (typeof define === 'function' && define.amd) { //amd module loader
        define([], function () {
            return framework;
        });
    }

}(function (originalRequire) {
    /*
     * A small implementation of amd module loader, used in the built file
     */
    var require, define;
    (function () {
        "use strict";
        /*jshint -W020 */ //redefine require
        var STRING_TYPE = '[object String]';
        var defined = {};
        var waiting = {};

        var hasOwn = Object.prototype.hasOwnProperty;
        var hasProp = function (obj, prop) {
            return hasOwn.call(obj, prop);
        };
        define = function (name, deps, callback) {
            if (hasProp(defined, name) || hasProp(waiting, name)) {
                throw new Error('Already defined: ' + name);
            }
            waiting[name] = [deps, callback];
        };

        var loadTree = function (name) {
            var w, deps, args, i;
            if (hasProp(defined, name)) {
                return;
            }
            if (hasProp(waiting, name)) {
                w = waiting[name];
                deps = w[0];
                args = [];
                for (i = 0; i < deps.length; ++i) {
                    loadTree(deps[i]);
                    args[i] = defined[deps[i]];
                }
                defined[name] = w[1].apply({}, args);
            }
        };

        require = function (deps, callback) {
            var i = 0, n, modules = [], global = (function () {
                return this;
            })();
            if (Object.prototype.toString.call(deps) === STRING_TYPE) {
                deps = [deps];
            }
            for (n = deps.length; i < n; ++i) {
                loadTree(deps[i]);
                modules[i] = defined[deps[i]];
            }
            if (callback) {
                callback.apply(global, modules);
            } else {
                return defined[deps[0]];
            }

        };
    })();

    define('m1', [], function () {
        var entityMap = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': '&quot;',
            "'": '&#39;',
            "/": '&#x2F;'
        };

        return {
            escape: function (string) {
                return String(string).replace(/[&<>"'\/]/g, function (s) {
                    return entityMap[s];
                });
            },

            forEach:function(container, handler){
                if(container.forEach){
                    container.forEach(handler);
                }else{
                    var type=Object.prototype.toString.call(container);
                    if(type==='[object Array]'){
                        for(var i=0;i<container.length;i++){
                            handler(container[i]);
                        }
                    }else if(type==='[object Object]'){
                        for(var i in container){
                            if(container.hasOwnProperty(i)) {
                                handler(container[i]);
                            }
                        }
                    }
                }
            }
        };
    });
    define('m2', ['m1'], function (Helpers) {
        function Result() {
        }

        Result.skipAttrs = {};

        Result.prototype = [];
        Result.prototype.add = function (text) {
            this.push(text);
        };
        Result.prototype.addWrite = function (text, isCode) {
            if (isCode) {
                text = '__w(' + text + ');';
            } else {
                text = text.replace(/\n/g, '\\n');
                text = text.replace(/'/g, '\\\'');
                text = '__w(\'' + text + '\');';
            }
            this.push(text);
        };
        Result.prototype.addWriteEscaped = function (text) {
            text = text.replace(/\n/g, '\\n');
            text = text.replace(/'/g, '\\\'');
            text = '__w(vomit.helpers.escape(' + text + '));';
            this.push(text);
        };
        Result.prototype.addOpen = function (node) {
            this.addWrite('<' + node.tagName.toLowerCase() + attrs(node) + '>');
        };

        Result.prototype.addClose = function (node) {
            this.addWrite('</' + node.tagName.toLowerCase() + '>');
        };

        Result.prototype.addVoid = function (node) {
            this.addWrite('<' + node.tagName.toLowerCase() + attrs(node) + '/>');
        };

        Result.prototype.addDoctype = function (doctype) {
            this.addWrite('<!DOCTYPE '
            + doctype.name
            + (doctype.publicId ? ' PUBLIC "' + doctype.publicId + '"' : '')
            + (!doctype.publicId && doctype.systemId ? ' SYSTEM' : '')
            + (doctype.systemId ? ' "' + doctype.systemId + '"' : '')
            + '>');
        };

        function attrs(node) {
            var result = '';
            for (var i = 0; i < node.attributes.length; i++) {
                var attr = node.attributes[i];
                if (!Result.skipAttrs[attr.name]) {
                    result += ' ' + attr.name + (attr.value ? '="' + Helpers.escape(attr.value) + '"' : '');
                }
            }
            return result;
        }

        return Result;

    });
    define('m3', ['m2'], function (Result) {

        var commandsByPrecedence = [];
        var commands = Result.skipAttrs = {};

        function split(str) {
            var spl = str.split(':');
            return [spl[0].trim(), spl.slice(1).join(':').trim()];
        }


        function addCommand(precedence, name, events) {
            events = events || {};
            function empty() {
            }

            var normalizedEvents = {
                before: events.before || empty,
                after: events.after || empty,
                addNode: events.addNode || empty,
                addInner: events.addInner || empty
            };
            if (commands[name]) {
                throw new Error('duplicated name');
            }
            if (!commandsByPrecedence[precedence]) {
                commandsByPrecedence[precedence] = [];
            }
            commandsByPrecedence[precedence].push(name);
            commands[name] = normalizedEvents;
        }

        addCommand(1, 'v-remove', {
            before: function () {
                return false;
            }
        });

        addCommand(1, 'v-onerror', {
            before: function () {
                this.add('try{');
            },
            after: function (value) {
                this.add('}catch(error){' + value + '}');
            }
        });
        addCommand(2, 'v-if', {
            before: function (value) {
                this.add('if(' + value + '){');
            },
            after: function () {
                this.add('}');
            }
        });
        addCommand(3, 'v-foreach', {
            before: function (value) {
                var spl = split(value);
                var variable = spl[0];
                var expr = spl[1];
                if (variable.indexOf(',') !== -1) {
                    var index = variable.split(',')[0].trim();
                    variable = variable.split(',')[1].trim();
                }

                this.add('forEach(' + expr + ', function(' + variable + (index ? ', ' + index : '') + '){', true);
            },
            after: function () {
                this.add('});', true);
            }
        });
        addCommand(4, 'v-removeouter', {
            addNode: function () {
                return false;
            }
        });
        addCommand(4, 'v-code', {
            addNode: function (value) {
                this.add(value, true);
            }
        });
        addCommand(5, 'v-removeinner', {
            addInner: function () {
                return false;
            }
        });
        addCommand(5, 'v-html', {
            addInner: function (value) {
                this.addWrite(value, true);
                return false;
            }
        });
        addCommand(5, 'v-text', {
            addInner: function (value) {
                this.addWriteEscaped(value, true);
                return false;
            }
        });
        addCommand(5, 'v-include', {
            addInner: function (value) {
                var spl = split(value);
                var name = spl[0];
                var ctx = spl[1];
                ctx = ctx || '{}';
                this.addWrite('vomit.fromFileRelative(__d,' + name + ')(' + ctx + ')', true);
            }
        });

        return {
            getCommandsByPrecedence: function () {
                var i, j, commandList, commandName,
                    result = [];
                for (i = 0; i < commandsByPrecedence.length; i++) {
                    commandList = commandsByPrecedence[i];
                    if (!commandList) {
                        continue;
                    }
                    for (j = 0; j < commandList.length; j++) {
                        commandName = commandList[j];
                        result.push(commandName);
                    }
                }
                return result;
            },
            getCommand: function (name) {
                return commands[name];
            },
            addCommand: addCommand
        }
    });
    define('m4', ['m2', 'm3', 'm1'], function (Result, Commands, Helpers) {
        var conf = {
            prefix: '',
            suffix: '.html'
        };

        function parse(html) {
            if (typeof document === 'object') {
                return (new DOMParser()).parseFromString(html, 'text/html');
            } else {
                return originalRequire('jsdom').jsdom(html);
            }
        }

        function findRoot(node) {
            if (!node.tagName) {
                return;
            }
            if (node.hasAttribute('v-root')) {
                return node;
            }
            for (var i = 0; i < node.childNodes.length; i++) {
                var root = findRoot(node.childNodes[i]);
                if (root) {
                    return root;
                }
            }
        }

        function compile(src, html) {
            var document = parse(html);
            var result = new Result(); //TODO no root?
            result.add('return function(__c){\n' +
            'var __r=[];\n' +
            'var __w=function(x){__r.push(x);};\n' +
            'with(vomit.helpers){with(__c){');
            var root = findRoot(document.documentElement);
            if (!root) {
                root = document.documentElement;
                if (document.doctype) {
                    result.addDoctype(document.doctype);
                }
            }
            compileNode(result, root);
            result.add('\n' +
            '}\n' +
            '}\n' +
            'return __r.join(\'\')\n' +
            '};');
            var resultJoin = result.join('\n');
            try {
                return new Function('vomit,__d', resultJoin)(compile, originalRequire('path').dirname(src)); //pass vomit
            } catch (e) {
                if (typeof JSHINT !== 'undefined') {
                    JSLINT(resultJoin);
                    for (var i = 0; i < JSLINT.errors.length; i++) {
                        var error = JSLINT.errors[i];
                        if (error.reason != "Unnecessary semicolon.") {
                            error.line++;
                            var err = new Error();
                            err.lineNumber = error.line;
                            err.message = error.reason;
//                        if(options.view)
//                            e.fileName = options.view;
                            throw err;
                        }
                    }
                } else {
                    throw e;
                }
            }
        }

        function compileNode(result, node) {
            var i, commandList, commandName, command, value, isVoid,
                addNode = true,
                addInner = true,
                commandsProcessed = [];

            if (!node.tagName) { //Text node
                result.addWrite(node.textContent);
                return;
            }

            isVoid = node.ownerDocument.createElement(node.tagName).outerHTML.length === node.tagName.length + 2;

            commandList = Commands.getCommandsByPrecedence();

            for (i = 0; i < commandList.length; i++) {
                commandName = commandList[i];
                if (node.hasAttribute(commandName)) {
                    command = Commands.getCommand(commandName);
                    value = node.getAttribute(commandName);
                    commandsProcessed.push({
                        callEvent: (function (command, value) {
                            return function (event) {
                                return command[event].call(result, value);
                            }
                        })(command, value)
                    });
                }
            }

            for (i = 0; i < commandsProcessed.length; i++) {
                if (commandsProcessed[i].callEvent('before') === false) {
                    return;
                }
            }

            for (i = 0; i < commandsProcessed.length; i++) {
                if (commandsProcessed[i].callEvent('addNode') === false) {
                    addNode = false;
                }
            }

            if (addNode) {
                if (isVoid) {
                    result.addVoid(node);
                } else
                    result.addOpen(node);
            }

            for (i = 0; i < commandsProcessed.length; i++) {
                if (commandsProcessed[i].callEvent('addInner') === false) {
                    addInner = false;
                }
            }
            if (addInner) {
                for (i = 0; i < node.childNodes.length; i++) {
                    compileNode(result, node.childNodes[i]);
                }
            }
            if (addNode) {
                if (!isVoid) {
                    result.addClose(node);
                }
            }

            for (i = commandsProcessed.length - 1; i >= 0; i--) {
                commandsProcessed[i].callEvent('after');
            }
        }

        var fileCache = {};

        function fromFile(src, callback) {
            return fromFileNoPrefix(conf.prefix + src + conf.suffix, callback);
        }

        function fromFileRelative(dir, src, callback) {
            return fromFileNoPrefix(dir + '/' + src, callback);
        }

        function fromFileNoPrefix(src, callback) {
            var result;
            if (fileCache[src]) {
                result = fileCache[src];
            } else {
                if (callback) {
                    loadFile(src, function (content) {
                        result = compile(src, content);
                        callback(result);
                    });
                } else {
                    result = compile(src, loadFile(src));
                    fileCache[src] = result;
                }
            }
            return result;
        }

        var loadFile;

        if (typeof XMLHttpRequest !== 'undefined') {
            loadFile = function (src, callback) {
                var xhr = new XMLHttpRequest();
                xhr.open("GET", src, callback ? true : false);
                xhr.send(null);
                if (callback) {
                    callback(xhr.responseText);
                } else {
                    return xhr.responseText;
                }
            }
        } else {
            loadFile = function (src, callback) {
                if (callback) {
                    originalRequire('fs').readFile(src, 'utf-8', function (result) {
                        callback(result);
                    });
                } else {
                    return originalRequire('fs').readFileSync(src, 'utf-8');
                }
            }
        }

        function config(opts) {
            for (var i in opts) {
                conf[i] = opts[i];
            }
        }

        function express(filePath, options, callback) {
            return callback(null, fromFileNoPrefix(filePath)(options));
        }

        compile.addCommand = Commands.addCommand;

        compile.fromFile = fromFile;

        compile.fromFileRelative = fromFileRelative;

        compile.config = config;

        compile.helpers = Helpers;

        compile.express = express;

        return compile;
    });
    return require('m4');
}));
