import * as vscode from 'vscode';
import * as cp from 'child_process';

interface LuacheckError {
    filePath: string;
    line: number;
    column: number;
    message: string;
}

export function activate(context: vscode.ExtensionContext) {
    console.log("luacheck extension activated");
    const diagnostics = vscode.languages.createDiagnosticCollection("luacheck");

    let disposable = vscode.commands.registerCommand('extension.easyluacheck', runLuacheck);
    context.subscriptions.push(disposable);

    // Run luacheck whenever a .lua or .luacheckrc file is saved
    vscode.workspace.onDidSaveTextDocument((document) => {
        if (document.languageId === 'lua' || document.fileName.endsWith('.luacheckrc')) {
            runLuacheck();
            console.log("saved file");
        }
    });

    // Run luacheck whenever a .lua or .luacheckrc file is opened
    vscode.workspace.onDidOpenTextDocument((document) => {
        if (document.languageId === 'lua' || document.fileName.endsWith('.luacheckrc')) {
            runLuacheck();
            console.log("opened file");
        }
    });

    runLuacheck();

    function runLuacheck() {
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (workspaceFolders) {
            workspaceFolders.forEach((folder) => {
                const workspacePath = folder.uri.fsPath;

                // Run luacheck on the entire workspace folder
                const luacheck = cp.spawn('luacheck', ['--formatter', 'plain', workspacePath], {
                    cwd: workspacePath
                });

                let output = '';
                console.log("luacheck spawned");

                luacheck.stdout.on('data', (data: Buffer) => {
                    output += data.toString();
                });

                luacheck.on('close', () => {
                    const errors = parseLuacheckOutput(output);
                    const diagnosticMap: Map<string, vscode.Diagnostic[]> = new Map();

                    errors.forEach((error) => {
                        const uri = vscode.Uri.file(error.filePath);
                        const diagnostic = new vscode.Diagnostic(
                            new vscode.Range(
                                new vscode.Position(error.line - 1, error.column - 1),
                                new vscode.Position(error.line - 1, error.column - 1)
                            ),
                            error.message,
                            vscode.DiagnosticSeverity.Warning
                        );                        

                        let diagnosticsArray = diagnosticMap.get(error.filePath) || [];
                        diagnosticsArray.push(diagnostic);
                        diagnosticMap.set(error.filePath, diagnosticsArray);
                    });

                    diagnosticMap.forEach((diags, filePath) => {
                        diagnostics.set(vscode.Uri.file(filePath), diags);
                    });
                });
            });
        }
    }

    function parseLuacheckOutput(output: string): LuacheckError[] {
        const lines = output.trim().split('\n');
        const errors: LuacheckError[] = [];
        
        for (const line of lines) {
            const parts = line.split(':');
            if (parts.length >= 4) {
                const filePath = parts[0];
                const lineNumber = parseInt(parts[1], 10);
                const columnNumber = parseInt(parts[2], 10);
                const message = parts.slice(3).join(':').trim();

                errors.push({
                    filePath,
                    line: lineNumber,
                    column: columnNumber,
                    message
                });
            }
        }
        console.log(errors);
        return errors;
    }
}
