"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
var node_1 = require("vscode-languageserver/node");
var vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
var connection = (0, node_1.createConnection)(node_1.ProposedFeatures.all);
// Create a simple text document manager.
var documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
var hasConfigurationCapability = false;
var hasWorkspaceFolderCapability = false;
var hasDiagnosticRelatedInformationCapability = false;
connection.onInitialize(function (params) {
    var capabilities = params.capabilities;
    // Does the client support the `workspace/configuration` request?
    // If not, we fall back using global settings.
    hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
    hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
    hasDiagnosticRelatedInformationCapability = !!(capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation);
    var result = {
        capabilities: {
            textDocumentSync: node_1.TextDocumentSyncKind.Incremental,
            // Tell the client that this server supports code completion.
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['.'],
            },
            diagnosticProvider: {
                interFileDependencies: false,
                workspaceDiagnostics: false
            }
        }
    };
    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true
            }
        };
    }
    return result;
});
connection.onInitialized(function () {
    if (hasConfigurationCapability) {
        // Register for all configuration changes.
        connection.client.register(node_1.DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(function (_event) {
            connection.console.log('Workspace folder change event received.');
        });
    }
});
// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
var defaultSettings = { maxNumberOfProblems: 1000 };
var globalSettings = defaultSettings;
// Cache the settings of all open documents
var documentSettings = new Map();
connection.onDidChangeConfiguration(function (change) {
    if (hasConfigurationCapability) {
        // Reset all cached document settings
        documentSettings.clear();
    }
    else {
        globalSettings = ((change.settings.languageServerExample || defaultSettings));
    }
    // Refresh the diagnostics since the `maxNumberOfProblems` could have changed.
    // We could optimize things here and re-fetch the setting first can compare it
    // to the existing setting, but this is out of scope for this example.
    connection.languages.diagnostics.refresh();
});
function getDocumentSettings(resource) {
    if (!hasConfigurationCapability) {
        return Promise.resolve(globalSettings);
    }
    var result = documentSettings.get(resource);
    if (!result) {
        result = connection.workspace.getConfiguration({
            scopeUri: resource,
            section: 'languageServerExample'
        });
        documentSettings.set(resource, result);
    }
    return result;
}
// Only keep settings for open documents
documents.onDidClose(function (e) {
    documentSettings.delete(e.document.uri);
});
connection.languages.diagnostics.on(function (params) { return __awaiter(void 0, void 0, void 0, function () {
    var document;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                document = documents.get(params.textDocument.uri);
                if (!(document !== undefined)) return [3 /*break*/, 2];
                _a = {
                    kind: node_1.DocumentDiagnosticReportKind.Full
                };
                return [4 /*yield*/, validateTextDocument(document)];
            case 1: return [2 /*return*/, (_a.items = _b.sent(),
                    _a)];
            case 2: 
            // We don't know the document. We can either try to read it from disk
            // or we don't report problems for it.
            return [2 /*return*/, {
                    kind: node_1.DocumentDiagnosticReportKind.Full,
                    items: []
                }];
        }
    });
}); });
// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(function (change) {
    validateTextDocument(change.document);
});
function validateTextDocument(textDocument) {
    return __awaiter(this, void 0, void 0, function () {
        var settings, text, pattern, m, problems, diagnostics, diagnostic;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDocumentSettings(textDocument.uri)];
                case 1:
                    settings = _a.sent();
                    text = textDocument.getText();
                    pattern = /\b[A-Z]{2,}\b/g;
                    problems = 0;
                    diagnostics = [];
                    while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
                        problems++;
                        diagnostic = {
                            severity: node_1.DiagnosticSeverity.Warning,
                            range: {
                                start: textDocument.positionAt(m.index),
                                end: textDocument.positionAt(m.index + m[0].length)
                            },
                            message: "".concat(m[0], " is all uppercase."),
                            source: 'ex'
                        };
                        if (hasDiagnosticRelatedInformationCapability) {
                            diagnostic.relatedInformation = [
                                {
                                    location: {
                                        uri: textDocument.uri,
                                        range: Object.assign({}, diagnostic.range)
                                    },
                                    message: 'Spelling matters'
                                },
                                {
                                    location: {
                                        uri: textDocument.uri,
                                        range: Object.assign({}, diagnostic.range)
                                    },
                                    message: 'Particularly for names'
                                }
                            ];
                        }
                        diagnostics.push(diagnostic);
                    }
                    return [2 /*return*/, diagnostics];
            }
        });
    });
}
connection.onDidChangeWatchedFiles(function (_change) {
    // Monitored files have change in VSCode
    connection.console.log('We received a file change event');
});
// This handler provides the initial list of the completion items.
connection.onCompletion(function (_textDocumentPosition) {
    // The pass parameter contains the position of the text document in
    // which code complete got requested. For the example we ignore this
    // info and always provide the same completion items.
    var document = documents.get(_textDocumentPosition.textDocument.uri);
    if (!document)
        return []; // Ensure the document is available
    // Get the text at the current line up to the cursor position
    var line = document.getText({
        start: { line: _textDocumentPosition.position.line, character: 0 },
        end: _textDocumentPosition.position
    });
    if (/strings\.\s*$/.test(line)) {
        return [
            {
                label: 'has_prefix()',
                kind: node_1.CompletionItemKind.Method,
                data: 1
            },
            {
                label: 'has_suffix()',
                kind: node_1.CompletionItemKind.Method,
                data: 2
            },
            {
                label: 'join()',
                kind: node_1.CompletionItemKind.Method,
                data: 3
            },
            {
                label: 'trim_prefix()',
                kind: node_1.CompletionItemKind.Method,
                data: 4
            },
            {
                label: 'to_lower()',
                kind: node_1.CompletionItemKind.Method,
                data: 5
            },
            {
                label: 'to_upper()',
                kind: node_1.CompletionItemKind.Method,
                data: 6
            },
            {
                label: 'split()',
                kind: node_1.CompletionItemKind.Method,
                data: 7
            }
        ];
    }
    if (/json\.\s*$/.test(line)) {
        return [
            {
                label: 'marshal()',
                kind: node_1.CompletionItemKind.Method,
                data: 1
            },
            {
                label: 'unmarshal()',
                kind: node_1.CompletionItemKind.Method,
                data: 2
            },
        ];
    }
    if (/http\.\s*$/.test(line)) {
        return [
            {
                label: 'get()',
                kind: node_1.CompletionItemKind.Method,
                data: 1
            },
            {
                label: 'request()',
                kind: node_1.CompletionItemKind.Method,
                data: 2
            },
            {
                label: 'post()',
                kind: node_1.CompletionItemKind.Method,
                data: 3
            },
            {
                label: 'client',
                kind: node_1.CompletionItemKind.Field,
                data: 4
            },
            {
                label: 'accept_status_codes',
                kind: node_1.CompletionItemKind.Function,
                data: 5
            }
        ];
    }
    if (/types\.\s*$/.test(line)) {
        return [
            {
                label: 'type_of()',
                kind: node_1.CompletionItemKind.Method,
                data: 1
            },
        ];
    }
    if (/base64\.\s*$/.test(line)) {
        return [
            {
                label: 'encode()',
                kind: node_1.CompletionItemKind.Method,
                data: 1
            },
            {
                label: 'decode()',
                kind: node_1.CompletionItemKind.Method,
                data: 2
            },
            {
                label: 'urlencode()',
                kind: node_1.CompletionItemKind.Method,
                data: 3
            },
            {
                label: 'urldecode()',
                kind: node_1.CompletionItemKind.Method,
                data: 4
            },
        ];
    }
    if (/time\.\s*$/.test(line)) {
        return [
            {
                label: 'now',
                kind: node_1.CompletionItemKind.Field,
                data: 1
            },
            {
                label: 'load()',
                kind: node_1.CompletionItemKind.Method,
                data: 2
            },
            {
                label: 'second',
                kind: node_1.CompletionItemKind.Field,
                data: 3
            },
            {
                label: 'millisecond',
                kind: node_1.CompletionItemKind.Field,
                data: 4
            },
            {
                label: 'nanosecond',
                kind: node_1.CompletionItemKind.Field,
                data: 5
            },
            {
                label: 'microsecond',
                kind: node_1.CompletionItemKind.Field,
                data: 6
            },
            {
                label: 'minute',
                kind: node_1.CompletionItemKind.Field,
                data: 7
            },
            {
                label: 'hour',
                kind: node_1.CompletionItemKind.Field,
                data: 8
            },
        ];
    }
    if (/decimal\.\s*$/.test(line)) {
        return [
            {
                label: 'infinity()',
                kind: node_1.CompletionItemKind.Method,
                data: 1
            },
            {
                label: 'new()',
                kind: node_1.CompletionItemKind.Method,
                data: 2
            },
            {
                label: 'is_nan()',
                kind: node_1.CompletionItemKind.Method,
                data: 3
            },
            {
                label: 'nan',
                kind: node_1.CompletionItemKind.Field,
                data: 4
            },
            {
                label: 'is_infinite()',
                kind: node_1.CompletionItemKind.Method,
                data: 5
            },
            {
                label: 'string',
                kind: node_1.CompletionItemKind.Field,
                data: 6
            },
            {
                label: 'sign',
                kind: node_1.CompletionItemKind.Field,
                data: 7
            },
            {
                label: 'coefficient',
                kind: node_1.CompletionItemKind.Field,
                data: 8
            },
            {
                label: 'exponent',
                kind: node_1.CompletionItemKind.Field,
                data: 9
            },
            {
                label: 'float',
                kind: node_1.CompletionItemKind.Field,
                data: 10
            },
            {
                label: 'is()',
                kind: node_1.CompletionItemKind.Method,
                data: 11
            },
            {
                label: 'is_not()',
                kind: node_1.CompletionItemKind.Method,
                data: 12
            },
            {
                label: 'less_than()',
                kind: node_1.CompletionItemKind.Method,
                data: 13
            },
            {
                label: 'less_than_or_equals()',
                kind: node_1.CompletionItemKind.Method,
                data: 14
            },
            {
                label: 'greater_than()',
                kind: node_1.CompletionItemKind.Method,
                data: 15
            },
            {
                label: 'greater_than_or_equals()',
                kind: node_1.CompletionItemKind.Method,
                data: 16
            },
            {
                label: 'add()',
                kind: node_1.CompletionItemKind.Method,
                data: 17
            },
            {
                label: 'substract()',
                kind: node_1.CompletionItemKind.Method,
                data: 17
            },
            {
                label: 'multiply()',
                kind: node_1.CompletionItemKind.Method,
                data: 18
            },
            {
                label: 'divide()',
                kind: node_1.CompletionItemKind.Method,
                data: 19
            },
            {
                label: 'modulo()',
                kind: node_1.CompletionItemKind.Method,
                data: 20
            },
            {
                label: 'power()',
                kind: node_1.CompletionItemKind.Method,
                data: 21
            },
            {
                label: 'loge()',
                kind: node_1.CompletionItemKind.Method,
                data: 22
            },
            {
                label: 'sqaure_root()',
                kind: node_1.CompletionItemKind.Method,
                data: 23
            },
            {
                label: 'ceiling()',
                kind: node_1.CompletionItemKind.Method,
                data: 24
            },
            {
                label: 'floor()',
                kind: node_1.CompletionItemKind.Method,
                data: 25
            },
            {
                label: 'absolute()',
                kind: node_1.CompletionItemKind.Method,
                data: 26
            },
            {
                label: 'negate()',
                kind: node_1.CompletionItemKind.Method,
                data: 26
            },
        ];
    }
    return [
        {
            label: 'import',
            kind: node_1.CompletionItemKind.Keyword,
            data: 1
        },
        {
            label: 'for',
            kind: node_1.CompletionItemKind.Keyword,
            data: 2
        },
        {
            label: 'as',
            kind: node_1.CompletionItemKind.Keyword,
            data: 3
        },
        {
            label: 'filter',
            kind: node_1.CompletionItemKind.Keyword,
            data: 4
        },
        {
            label: 'if',
            kind: node_1.CompletionItemKind.Keyword,
            data: 5
        },
        {
            label: 'break',
            kind: node_1.CompletionItemKind.Keyword,
            data: 6
        },
        {
            label: 'continue',
            kind: node_1.CompletionItemKind.Keyword,
            data: 7
        },
        {
            label: 'in',
            kind: node_1.CompletionItemKind.Keyword,
            data: 8
        },
        {
            label: 'null',
            kind: node_1.CompletionItemKind.Keyword,
            data: 9
        },
        {
            label: 'rule',
            kind: node_1.CompletionItemKind.Keyword,
            data: 10
        },
        {
            label: 'param',
            kind: node_1.CompletionItemKind.Keyword,
            data: 11
        },
        {
            label: 'default',
            kind: node_1.CompletionItemKind.Keyword,
            data: 12
        },
        {
            label: 'map',
            kind: node_1.CompletionItemKind.Keyword,
            data: 13
        },
        {
            label: 'strings',
            kind: node_1.CompletionItemKind.Keyword,
            data: 14
        },
        {
            label: 'json',
            kind: node_1.CompletionItemKind.Keyword,
            data: 15
        },
        {
            label: 'http',
            kind: node_1.CompletionItemKind.Keyword,
            data: 16
        },
        {
            label: 'types',
            kind: node_1.CompletionItemKind.Keyword,
            data: 17
        },
        {
            label: 'decimal',
            kind: node_1.CompletionItemKind.Keyword,
            data: 18
        },
        {
            label: 'base64',
            kind: node_1.CompletionItemKind.Keyword,
            data: 19
        },
        {
            label: 'time',
            kind: node_1.CompletionItemKind.Keyword,
            data: 20
        },
        {
            label: 'print()',
            kind: node_1.CompletionItemKind.Method,
            data: 21
        },
        {
            label: 'error()',
            kind: node_1.CompletionItemKind.Method,
            data: 22
        },
        {
            label: 'length()',
            kind: node_1.CompletionItemKind.Method,
            data: 23
        },
        {
            label: 'append()',
            kind: node_1.CompletionItemKind.Method,
            data: 24
        },
        {
            label: 'delete()',
            kind: node_1.CompletionItemKind.Method,
            data: 25
        },
        {
            label: 'range()',
            kind: node_1.CompletionItemKind.Method,
            data: 26
        },
        {
            label: 'keys()',
            kind: node_1.CompletionItemKind.Method,
            data: 27
        },
        {
            label: 'values()',
            kind: node_1.CompletionItemKind.Method,
            data: 28
        },
        {
            label: 'int()',
            kind: node_1.CompletionItemKind.Method,
            data: 29
        },
        {
            label: 'string()',
            kind: node_1.CompletionItemKind.Method,
            data: 30
        },
        {
            label: 'float()',
            kind: node_1.CompletionItemKind.Method,
            data: 30
        },
        {
            label: 'bool()',
            kind: node_1.CompletionItemKind.Method,
            data: 31
        },
        {
            label: 'case',
            kind: node_1.CompletionItemKind.Method,
            data: 32
        },
        {
            label: 'when',
            kind: node_1.CompletionItemKind.Method,
            data: 33
        },
        {
            label: 'all',
            kind: node_1.CompletionItemKind.Method,
            data: 34
        },
        {
            label: 'any',
            kind: node_1.CompletionItemKind.Method,
            data: 35
        },
        {
            label: 'func()',
            kind: node_1.CompletionItemKind.Method,
            data: 36
        },
        {
            label: 'return',
            kind: node_1.CompletionItemKind.Keyword,
            data: 37
        },
        {
            label: 'undefined',
            kind: node_1.CompletionItemKind.Keyword,
            data: 37
        }
    ];
});
// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(function (item) {
    if (item.data === 1) {
        item.detail = 'Import plugin or standard library';
        item.documentation = 'Import keyword allow us to import libraries';
    }
    return item;
});
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);
// Listen on the connection
connection.listen();
