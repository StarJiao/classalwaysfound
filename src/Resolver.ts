let vscode = require('vscode');
let builtInClasses = require('./classes');
let naturalSort = require('node-natural-sort');

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
    getPhpClasses(text: string) {
        let phpClasses = this.getExtended(text);

        phpClasses = phpClasses.concat(this.getFromFunctionParameters(text));
        phpClasses = phpClasses.concat(this.getInitializedWithNew(text));
        phpClasses = phpClasses.concat(this.getFromStaticCalls(text));

        return phpClasses.filter((v, i, a) => a.indexOf(v) === i);
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
    async highlightNotImported() {
        let text = vscode.window.activeTextEditor.document.getText();
        let phpClasses = this.getPhpClasses(text);
        let importedPhpClasses = this.getImportedPhpClasses(text);

        // Get phpClasses not present in importedPhpClasses
        let notImported = phpClasses.filter(function (phpClass) {
            return !importedPhpClasses.includes(phpClass);
        });

        // Highlight diff
        let matches;
        let decorationOptions = [];

        for (let i = 0; i < notImported.length; i++) {
            let regex = new RegExp(notImported[i], 'g');

            while (matches = regex.exec(text)) {
                let startPos = vscode.window.activeTextEditor.document.positionAt(matches.index);

                // as js does not support regex look behinds we get results
                // where the object name is in the middle of a string
                // we should drop those
                let textLine = vscode.window.activeTextEditor.document.lineAt(startPos);
                let charBeforeMatch = textLine.text.charAt(startPos.character - 1);

                if (!/\w/.test(charBeforeMatch) && textLine.text.search(/namespace/) === -1) {
                    let endPos = vscode.window.activeTextEditor.document.positionAt(matches.index + matches[0].length);

                    decorationOptions.push({
                        range: new vscode.Range(startPos, endPos),
                        hoverMessage: 'Class is not imported.',
                    });
                }
            }
        }

        // TODO have these in settings
        let decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255,155,0, 0.5)',
            light: {
                borderColor: 'darkblue'
            },
            dark: {
                borderColor: 'lightblue'
            }
        });

        vscode.window.activeTextEditor.setDecorations(decorationType, decorationOptions);
    }

}

module.exports = Resolver;
