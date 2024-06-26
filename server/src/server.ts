/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
	DocumentDiagnosticReportKind,
	type DocumentDiagnosticReport
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
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

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// The example settings
interface ExampleSettings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <ExampleSettings>(
			(change.settings.languageServerExample || defaultSettings)
		);
	}
	// Refresh the diagnostics since the `maxNumberOfProblems` could have changed.
	// We could optimize things here and re-fetch the setting first can compare it
	// to the existing setting, but this is out of scope for this example.
	connection.languages.diagnostics.refresh();
});

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
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
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});


connection.languages.diagnostics.on(async (params) => {
	const document = documents.get(params.textDocument.uri);
	if (document !== undefined) {
		return {
			kind: DocumentDiagnosticReportKind.Full,
			items: await validateTextDocument(document)
		} satisfies DocumentDiagnosticReport;
	} else {
		// We don't know the document. We can either try to read it from disk
		// or we don't report problems for it.
		return {
			kind: DocumentDiagnosticReportKind.Full,
			items: []
		} satisfies DocumentDiagnosticReport;
	}
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<Diagnostic[]> {
	// In this simple example we get the settings for every validate run.
	const settings = await getDocumentSettings(textDocument.uri);

	// The validator creates diagnostics for all uppercase words length 2 and more
	const text = textDocument.getText();
	const pattern = /\b[A-Z]{2,}\b/g;
	let m: RegExpExecArray | null;

	let problems = 0;
	const diagnostics: Diagnostic[] = [];
	while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
		problems++;
		const diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Warning,
			range: {
				start: textDocument.positionAt(m.index),
				end: textDocument.positionAt(m.index + m[0].length)
			},
			message: `${m[0]} is all uppercase.`,
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
	return diagnostics;
}

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received a file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		// The pass parameter contains the position of the text document in
		// which code complete got requested. For the example we ignore this
		// info and always provide the same completion items.

		let document = documents.get(_textDocumentPosition.textDocument.uri);
		if (!document) return []; // Ensure the document is available

		// Get the text at the current line up to the cursor position
		let line = document.getText({
			start: { line: _textDocumentPosition.position.line, character: 0 },
			end: _textDocumentPosition.position
		});

		if (/strings\.\s*$/.test(line)) {
			return [
				{
					label: 'has_prefix()',
					kind: CompletionItemKind.Method,
					data: 1
				},
				{
					label: 'has_suffix()',
					kind: CompletionItemKind.Method,
					data: 2
				},
				{
					label: 'join()',
					kind: CompletionItemKind.Method,
					data: 3
				},
				{
					label: 'trim_prefix()',
					kind: CompletionItemKind.Method,
					data: 4
				},
				{
					label: 'to_lower()',
					kind: CompletionItemKind.Method,
					data: 5
				},
				{
					label: 'to_upper()',
					kind: CompletionItemKind.Method,
					data: 6
				},
				{
					label: 'split()',
					kind: CompletionItemKind.Method,
					data: 7
				}
			]
		}

		if (/json\.\s*$/.test(line)) {
			return [
				{
					label: 'marshal()',
					kind: CompletionItemKind.Method,
					data: 1
				},
				{
					label: 'unmarshal()',
					kind: CompletionItemKind.Method,
					data: 2
				},
			]
		}

		if (/http\.\s*$/.test(line)) {
			return [
				{
					label: 'get()',
					kind: CompletionItemKind.Method,
					data: 1
				},
				{
					label: 'request()',
					kind: CompletionItemKind.Method,
					data: 2
				},
				{
					label: 'post()',
					kind: CompletionItemKind.Method,
					data: 3
				},
				{
					label: 'client',
					kind: CompletionItemKind.Field,
					data: 4
				},
				{
					label: 'accept_status_codes',
					kind: CompletionItemKind.Function,
					data: 5
				}
			]
		}

		if (/types\.\s*$/.test(line)) {
			return [
				{
					label: 'type_of()',
					kind: CompletionItemKind.Method,
					data: 1
				},
			]
		}

		if (/base64\.\s*$/.test(line)) {
			return [
				{
					label: 'encode()',
					kind: CompletionItemKind.Method,
					data: 1
				},
				{
					label: 'decode()',
					kind: CompletionItemKind.Method,
					data: 2
				},
				{
					label: 'urlencode()',
					kind: CompletionItemKind.Method,
					data: 3
				},
				{
					label: 'urldecode()',
					kind: CompletionItemKind.Method,
					data: 4
				},
			]
		}

		if (/time\.\s*$/.test(line)) {
			return [
				{
					label: 'now',
					kind: CompletionItemKind.Field,
					data: 1
				},
				{
					label: 'load()',
					kind: CompletionItemKind.Method,
					data: 2
				},
				{
					label: 'second',
					kind: CompletionItemKind.Field,
					data: 3
				},
				{
					label: 'millisecond',
					kind: CompletionItemKind.Field,
					data: 4
				},
				{
					label: 'nanosecond',
					kind: CompletionItemKind.Field,
					data: 5
				},
				{
					label: 'microsecond',
					kind: CompletionItemKind.Field,
					data: 6
				},
				{
					label: 'minute',
					kind: CompletionItemKind.Field,
					data: 7
				},
				{
					label: 'hour',
					kind: CompletionItemKind.Field,
					data: 8
				},
			]
		}

		if (/decimal\.\s*$/.test(line)) {
			return [
				{
					label: 'infinity()',
					kind: CompletionItemKind.Method,
					data: 1
				},
				{
					label: 'new()',
					kind: CompletionItemKind.Method,
					data: 2
				},
				{
					label: 'is_nan()',
					kind: CompletionItemKind.Method,
					data: 3
				},
				{
					label: 'nan',
					kind: CompletionItemKind.Field,
					data: 4
				},
				{
					label: 'is_infinite()',
					kind: CompletionItemKind.Method,
					data: 5
				},
				{
					label: 'string',
					kind: CompletionItemKind.Field,
					data: 6
				},
				{
					label: 'sign',
					kind: CompletionItemKind.Field,
					data: 7
				},
				{
					label: 'coefficient',
					kind: CompletionItemKind.Field,
					data: 8
				},
				{
					label: 'exponent',
					kind: CompletionItemKind.Field,
					data: 9
				},
				{
					label: 'float',
					kind: CompletionItemKind.Field,
					data: 10
				},
				{
					label: 'is()',
					kind: CompletionItemKind.Method,
					data: 11
				},
				{
					label: 'is_not()',
					kind: CompletionItemKind.Method,
					data: 12
				},
				{
					label: 'less_than()',
					kind: CompletionItemKind.Method,
					data: 13
				},
				{
					label: 'less_than_or_equals()',
					kind: CompletionItemKind.Method,
					data: 14
				},
				{
					label: 'greater_than()',
					kind: CompletionItemKind.Method,
					data: 15
				},
				{
					label: 'greater_than_or_equals()',
					kind: CompletionItemKind.Method,
					data: 16
				},
				{
					label: 'add()',
					kind: CompletionItemKind.Method,
					data: 17
				},
				{
					label: 'substract()',
					kind: CompletionItemKind.Method,
					data: 17
				},
				{
					label: 'multiply()',
					kind: CompletionItemKind.Method,
					data: 18
				},
				{
					label: 'divide()',
					kind: CompletionItemKind.Method,
					data: 19
				},
				{
					label: 'modulo()',
					kind: CompletionItemKind.Method,
					data: 20
				},
				{
					label: 'power()',
					kind: CompletionItemKind.Method,
					data: 21
				},
				{
					label: 'loge()',
					kind: CompletionItemKind.Method,
					data: 22
				},
				{
					label: 'sqaure_root()',
					kind: CompletionItemKind.Method,
					data: 23
				},
				{
					label: 'ceiling()',
					kind: CompletionItemKind.Method,
					data: 24
				},
				{
					label: 'floor()',
					kind: CompletionItemKind.Method,
					data: 25
				},
				{
					label: 'absolute()',
					kind: CompletionItemKind.Method,
					data: 26
				},
				{
					label: 'negate()',
					kind: CompletionItemKind.Method,
					data: 26
				},
			]
		}


		return [
			{
				label: 'import',
				kind: CompletionItemKind.Keyword,
				data: 1
			},
			{
				label: 'for',
				kind: CompletionItemKind.Keyword,
				data: 2
			},
			{
				label: 'as',
				kind: CompletionItemKind.Keyword,
				data: 3
			},
			{
				label: 'filter',
				kind: CompletionItemKind.Keyword,
				data: 4
			},
			{
				label: 'if',
				kind: CompletionItemKind.Keyword,
				data: 5
			},
			{
				label: 'break',
				kind: CompletionItemKind.Keyword,
				data: 6
			},
			{
				label: 'continue',
				kind: CompletionItemKind.Keyword,
				data: 7
			},
			{
				label: 'in',
				kind: CompletionItemKind.Keyword,
				data: 8
			},
			{
				label: 'null',
				kind: CompletionItemKind.Keyword,
				data: 9
			},
			{
				label: 'rule',
				kind: CompletionItemKind.Keyword,
				data: 10
			},
			{
				label: 'param',
				kind: CompletionItemKind.Keyword,
				data: 11
			},
			{
				label: 'default',
				kind: CompletionItemKind.Keyword,
				data: 12
			},
			{
				label: 'map',
				kind: CompletionItemKind.Keyword,
				data: 13
			},
			{
				label: 'strings',
				kind: CompletionItemKind.Keyword,
				data: 14
			},
			{
				label: 'json',
				kind: CompletionItemKind.Keyword,
				data: 15
			},
			{
				label: 'http',
				kind: CompletionItemKind.Keyword,
				data: 16
			},
			{
				label: 'types',
				kind: CompletionItemKind.Keyword,
				data: 17
			},
			{
				label: 'decimal',
				kind: CompletionItemKind.Keyword,
				data: 18
			},
			{
				label: 'base64',
				kind: CompletionItemKind.Keyword,
				data: 19
			},
			{
				label: 'time',
				kind: CompletionItemKind.Keyword,
				data: 20
			},
			{
				label: 'print()',
				kind: CompletionItemKind.Method,
				data: 21
			},
			{
				label: 'error()',
				kind: CompletionItemKind.Method,
				data: 22
			},
			{
				label: 'length()',
				kind: CompletionItemKind.Method,
				data: 23
			}, 
			{
				label: 'append()',
				kind: CompletionItemKind.Method,
				data: 24 
			},
			{
				label: 'delete()',
				kind: CompletionItemKind.Method,
				data: 25
			},
			{
				label: 'range()',
				kind: CompletionItemKind.Method,
				data: 26
			},
			{
				label: 'keys()',
				kind: CompletionItemKind.Method,
				data: 27
			},
			{
				label: 'values()',
				kind: CompletionItemKind.Method,
				data: 28
			},
			{
				label: 'int()',
				kind: CompletionItemKind.Method,
				data: 29
			},
			{
				label: 'string()',
				kind: CompletionItemKind.Method,
				data: 30
			},
			{
				label: 'float()',
				kind: CompletionItemKind.Method,
				data: 30
			},
			{
				label: 'bool()',
				kind: CompletionItemKind.Method,
				data: 31
			},
			{
				label: 'case',
				kind: CompletionItemKind.Method,
				data: 32
			},
			{
				label: 'when',
				kind: CompletionItemKind.Method,
				data: 33
			},
			{
				label: 'all',
				kind: CompletionItemKind.Method,
				data: 34
			},
			{
				label: 'any',
				kind: CompletionItemKind.Method,
				data: 35
			},
			{
				label: 'func()',
				kind: CompletionItemKind.Method,
				data: 36
			},
			{
				label: 'return',
				kind: CompletionItemKind.Keyword,
				data: 37
			},
			{
				label: 'undefined',
				kind: CompletionItemKind.Keyword,
				data: 37
			}
		];
	}
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		if (item.data === 1) {
			item.detail = 'Import plugin or standard library';
			item.documentation = 'Import keyword allow us to import libraries';
		}
		return item;
	}
);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();