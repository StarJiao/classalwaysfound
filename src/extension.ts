// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Resolver } from './resolver';

let diagnosticCollection: vscode.DiagnosticCollection
	= vscode.languages.createDiagnosticCollection('phpclasscheck');
let resolver = new Resolver();

function setDiagnostic(document: vscode.TextDocument) {
	let diagnostics = resolver.diagnosticNotImported(document);
	diagnosticCollection.clear();
	diagnosticCollection.set(document.uri, diagnostics);
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	let disposable1 = vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) => {
		if (event && event.document && event.document.languageId === 'php') {
			setDiagnostic(event.document);
		}
	});
	let disposable2 = vscode.workspace.onDidSaveTextDocument((document) => {
		if (document && document.languageId === 'php') {
			setDiagnostic(document);
		}
	});
	let disposable3 = vscode.workspace.onDidOpenTextDocument((document) => {
		if (document && document.languageId === 'php') {
			setDiagnostic(document);
		}
	});
	let disposable4 = vscode.window.onDidChangeActiveTextEditor((editor) => {
		if (editor && editor.document.languageId === 'php') {
			setDiagnostic(editor.document);
		}
	});

	//window.onDidChangeVisibleTextEditors
	context.subscriptions.push(disposable1, disposable2, disposable3, disposable4);
}

// this method is called when your extension is deactivated
export function deactivate() { }
