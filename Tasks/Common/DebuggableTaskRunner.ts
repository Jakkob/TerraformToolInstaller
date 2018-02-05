import * as path from 'path';
import * as mockery from 'mockery';
import { rmRF, mkdirP, exist } from 'vsts-task-lib';
import * as internals from 'vsts-task-lib/internal';

interface EnvironmentVar {
    varName: string;
    varValue: string;
}

export default class DebuggableTaskRunner {
    private taskRequirePath: string;
    private cleanupArtifacts: boolean;
    private hasMocks: boolean;

    private envVars: Array<EnvironmentVar>;
    private registeredMocks: Array<string>;
    private workFolder: string;
    private tempDir: string;
    private toolsDir: string;

    constructor(taskRequirePath: string, cleanupArtifacts: boolean = true) {
        this.taskRequirePath = path.join(module.parent.filename, '..', taskRequirePath);
        this.cleanupArtifacts = cleanupArtifacts;
        this.registeredMocks = [];
        this.hasMocks = false;

        let cwd: string = process.cwd();
        this.workFolder = path.join(cwd, '_work');
        this.tempDir = path.join(cwd, '_work', 'temp');
        this.toolsDir = path.join(cwd, '_work', 'tools');

        this.setAgentVars();
    }

    public setInputVariable(name: string, value: string) {
        name = 'INPUT_' + name.replace(/\.|\s/g, '_').toUpperCase();
        this.envVars.push({varName: name, varValue: value});
    }

    public registerMock(mockName: string, mock: any) {
        mockery.registerMock(mockName, mock);
        this.registeredMocks.push(mockName);
        this.hasMocks = true;
    }

    public async run() {
        this.prepareRunEnvironment();

        if(this.hasMocks) {
            mockery.enable({
                warnOnReplace: true
            });
        }

        // Reload the `vsts-task-lib` module's data before proceeding,
        //   this ensures that the env vars get parsed and set properly.
        internals._loadData();

        // Run the task.
        require(this.taskRequirePath);


        if(this.hasMocks) {
            mockery.disable();
        }
    }

    private prepareRunEnvironment() {
        this.envVars.forEach(element => {
            process.env[element.varName] = element.varValue;
        });

        // Clean out the temp directory if it exists:
        if(exist(this.tempDir)) {
            rmRF(this.tempDir);
        }
        mkdirP(this.tempDir);

        // Create tools directory if it doesn't exist
        if(exist(this.toolsDir)) {
            mkdirP(this.toolsDir);
        }
    }

    private unloadTasklibModules() {
        let tasklibPath: string = path.join(process.cwd(), 'node_modules', 'vsts-task-lib') + '/';
        tasklibPath = tasklibPath.split('\\').join( '/');
        Object.keys(require.cache).forEach((element: string) => {
            if (element.split('\\').join( '/').startsWith(tasklibPath)) {
                delete require.cache[element];
            }
        });
    }

    private setAgentVars() {
        this.envVars = [
            {varName: 'AGENT_WORKFOLDER', varValue: this.workFolder},
            {varName: 'AGENT_TEMPDIRECTORY', varValue: this.tempDir},
            {varName: 'AGENT_TOOLSDIRECTORY', varValue: this.toolsDir}
        ];
    }
}