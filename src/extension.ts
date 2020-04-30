// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { DiagnosticSeverity } from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

class Resolver {

	//获取被继承的类名
	getExtended(text: string) {
		let regex = /extends ([A-Z][A-Za-z0-9\-\_]*)/gm;
		let matches;
		let phpClasses = [];

		while (matches = regex.exec(text)) {
			phpClasses.push(matches[1]);
		}

		return phpClasses;
	}

	//获取方法参数表中的类名
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

	//获取new关键字创建实例时使用的类名
	getInitializedWithNew(text: string) {
		let regex = /new ([A-Z][A-Za-z0-9\-\_]*)/gm;
		let matches;
		let phpClasses = [];

		while (matches = regex.exec(text)) {
			phpClasses.push(matches[1]);
		}

		return phpClasses;
	}

	//获取用使用类方法的类名
	getFromStaticCalls(text: string) {
		let regex = /([A-Z][A-Za-z0-9\-\_]*)::/gm;
		let matches;
		let phpClasses = [];

		while (matches = regex.exec(text)) {
			phpClasses.push(matches[1]);
		}

		return phpClasses;
	}


	//获取用使用类方法的类名
	getTraitUse(text: string) {
		let regex = /([A-Z][A-Za-z0-9\-\_]*)::/gm;
		let matches;
		let phpClasses = [];

		while (matches = regex.exec(text)) {
			phpClasses.push(matches[1]);
		}

		return phpClasses;
	}

	//获取代码中所有使用到的类名
	getPhpClasses(text: string) {
		let phpClasses = this.getExtended(text);
		phpClasses = phpClasses.concat(this.getFromFunctionParameters(text));
		phpClasses = phpClasses.concat(this.getInitializedWithNew(text));
		phpClasses = phpClasses.concat(this.getFromStaticCalls(text));
		phpClasses = phpClasses.concat(this.getTraitUse(text));

		return phpClasses.filter((value, index, array) => array.indexOf(value) === index);//去重
	}

	//获取被导入的类名
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

	//获取别名
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

	//获取内部定义的类
	getClassDefineInDoc(text: string) {
		let regex = /^[class|trait|interface] +([A-Z][A-Za-z0-9\-\_]*)/gm;
		let matches;
		let innerClasses = [];

		while (matches = regex.exec(text)) {
			let className = matches[1].split('\\').pop();
			console.log(className);
			innerClasses.push(className);
		}

		return innerClasses;
	}

	//同一个文件夹下的类
	getClassesSameFolder(document: vscode.TextDocument) {
		let filepath = path.dirname(document.fileName);
		const files = fs.readdirSync(filepath);
		return files.map((file) => filepath + '/' + file)
			.filter((filefullpath) => fs.statSync(filefullpath).isFile() && path.extname(filefullpath) === '.php')
			.map((name) => path.basename(name, '.php'));
	}

	//计算好所有应该打标记的位置
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
			while (matches = regex.exec(text)) {//所有包含指定类名的位置
				let startPos = document.positionAt(matches.index);

				// as js does not support regex look behinds we get results
				// where the object name is in the middle of a string
				// we should drop those
				let textLine = document.lineAt(startPos);//包含当前类名的这一行的内容
				let charBeforeMatch = textLine.text.charAt(startPos.character - 1);//目标类名的前驱
				let charAfterMatch = textLine.text.charAt(startPos.character + matches[0].length);//目标类名的后继

				if (! /\w/.test(charBeforeMatch) //前驱不是有效字符
					&& ! /\w/.test(charAfterMatch) //后继为空格或换行
					&& textLine.text.search(/namespace/) === -1 // 不是namespace行
					// && textLine.text.search(/^use /) === -1 
					&& textLine.text.search(/^ *\/\//) === -1 //不是单行注释
					&& textLine.text.search(/^ *\/\*/) === -1 //不是多行注释
					&& textLine.text.search(/^ *\*/) === -1 //不是多行注释
				) {
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
