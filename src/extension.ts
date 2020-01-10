// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { DiagnosticSeverity } from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

class Resolver {

	getExtended(text: string) {
		let regex = /extends ([A-Z][A-Za-z0-9\-\_]*)/gm;
		let matches;
		let phpClasses = [];

		while (matches = regex.exec(text)) {
			phpClasses.push(matches[1]);
		}

		return phpClasses;
	}

	getFromFunctionParameters(text: string) {
		let regex = /function [\S]+\((.*)\)/gm;
		let matches;
		let phpClasses = [];

		while (matches = regex.exec(text)) {
			let parameters = matches[1].split(', ');

			for (let s of parameters) {
				let phpClassName = s.substr(0, s.indexOf(' '));

				// Starts with capital letter
				if (phpClassName && /[A-Z]/.test(phpClassName[0])) {
					phpClasses.push(phpClassName);
				}
			}
		}

		return phpClasses;
	}

	getInitializedWithNew(text: string) {
		let regex = /new ([A-Z][A-Za-z0-9\-\_]*)/gm;
		let matches;
		let phpClasses = [];

		while (matches = regex.exec(text)) {
			phpClasses.push(matches[1]);
		}

		return phpClasses;
	}

	getFromStaticCalls(text: string) {
		let regex = /([A-Z][A-Za-z0-9\-\_]*)::/gm;
		let matches;
		let phpClasses = [];

		while (matches = regex.exec(text)) {
			phpClasses.push(matches[1]);
		}

		return phpClasses;
	}

	getPhpClasses(text: string) {
		let phpClasses = this.getExtended(text);
		phpClasses = phpClasses.concat(this.getFromFunctionParameters(text));
		phpClasses = phpClasses.concat(this.getInitializedWithNew(text));
		phpClasses = phpClasses.concat(this.getFromStaticCalls(text));

		return phpClasses.filter((v, i, a) => a.indexOf(v) === i);
	}

	getImportedPhpClasses(text: string) {
		let regex = /use (.*);/gm;
		let matches;
		let importedPhpClasses = [];

		while (matches = regex.exec(text)) {
			let className = matches[1].split('\\').pop();
			importedPhpClasses.push(className);
		}

		return importedPhpClasses;
	}

	getPhpAliasClasses(text: string) {
		let regex = /as (.*);/gm;
		let matches;
		let importedPhpClasses = [];

		while (matches = regex.exec(text)) {
			let className = matches[1].split('\\').pop();
			importedPhpClasses.push(className);
		}

		return importedPhpClasses;
	}

	getClassDefineInDoc(text: string) {
		let regex = /[class|trait|interface] +([A-Z][A-Za-z0-9\-\_]*)/gm;
		let matches;
		let innerClasses = [];

		while (matches = regex.exec(text)) {
			let className = matches[1].split('\\').pop();
			innerClasses.push(className);
		}

		return innerClasses;
	}

	getClassesSameFolder(document: vscode.TextDocument) {
		let filepath = path.dirname(document.fileName);
		const files = fs.readdirSync(filepath);
		return files.map((file) => filepath + '/' + file).filter((filefullpath) => fs.statSync(filefullpath).isFile() && path.extname(filefullpath) === '.php').map((name) => path.basename(name, '.php'));
	}

	diagnosticNotImported(document: vscode.TextDocument) {
		let text = document.getText();
		let allClasses = this.getPhpClasses(text);
		let importedClasses = this.getImportedPhpClasses(text);
		let aliasClasses = this.getPhpAliasClasses(text);
		let innerClasses = this.getClassDefineInDoc(text);
		let sameFolderClasses = this.getClassesSameFolder(document);

		let allImportedClass = importedClasses.concat(aliasClasses, innerClasses, sameFolderClasses);

		// Get phpClasses not present in importedPhpClasses

		let notImported = allClasses.filter(function (phpClass) {
			return !allImportedClass.includes(phpClass);
		});

		diagnosticCollection.clear();
		let diagnostics: vscode.Diagnostic[] = [];

		for (let i = 0; i < notImported.length; i++) {
			let regex = new RegExp(notImported[i], 'g');
			// Highlight diff
			let matches;
			while (matches = regex.exec(text)) {
				let startPos = document.positionAt(matches.index);

				// as js does not support regex look behinds we get results
				// where the object name is in the middle of a string
				// we should drop those
				let textLine = document.lineAt(startPos);
				let charBeforeMatch = textLine.text.charAt(startPos.character - 1);

				if (!/\w/.test(charBeforeMatch)
					&& textLine.text.search(/namespace/) === -1
					&& textLine.text.search(/^use /) === -1
					&& textLine.text.search(/^ *\/\//) === -1) {
					let endPos = document.positionAt(matches.index + matches[0].length);
					let diagnostic = new vscode.Diagnostic(
						new vscode.Range(startPos, endPos),
						'Can\'t find class "' + notImported[i] + '\"\.',
						DiagnosticSeverity.Error,
					);
					diagnostic.source = 'phpclasscheck';
					diagnostics.push(diagnostic);
				}
			}
		}
		return diagnostics;
	}

}


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
	// let folders = vscode.workspace.workspaceFolders;
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
