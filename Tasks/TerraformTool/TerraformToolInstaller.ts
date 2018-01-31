import * as toolLib from 'vsts-task-tool-lib/tool';
import * as taskLib from 'vsts-task-lib/task';
import * as httpm from 'typed-rest-client/HttpClient';
import * as path from 'path';
import MachineCharacteristics from './MachineCharacteristics';
import { HttpClientResponse } from 'typed-rest-client/HttpClient';
import { OperatingSystem } from '../AzureTerraform/models/MachineCharacteristics';

// I got most of this code for this from the "NodeTool" task in the `vsts-tasks` repo on GitHub: 
//     https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/NodeTool

export default class TerraformToolInstaller {
    private mc: MachineCharacteristics;

    constructor() {
        this.mc = new MachineCharacteristics();
    }

    //
    // Basic pattern:
    //      if !checkLatest
    //          toolPath = check cache
    //      if !toolPath
    //          if version is a range
    //              match = query nodejs.org
    //              if !match
    //                  fail
    //              toolPath = check cache
    //          if !toolPath
    //              download, extract, and cache
    //              toolPath = cacheDir
    //      PATH = cacheDir + PATH
    //
    
    public async getTerraform(versionSpec: string, checkLatest: boolean) {
        if (toolLib.isExplicitVersion(versionSpec)) {
            checkLatest = false; // check latest doesn't make sense when explicit version
        }

        // check cache
        let toolPath: string;
        if (!checkLatest) {
            toolPath = toolLib.findLocalTool('terraform', versionSpec);
        }

        if (!toolPath) {
            let version: string;
            if (toolLib.isExplicitVersion(versionSpec)) {
                // version to download
                version = versionSpec;
            }
            else {
                // query the Hashicorp Releases API for a matching version
                version = await queryLatestMatch(versionSpec);
                if (!version) {
                    throw new Error(`Unable to find Terraform version '${versionSpec}' for platform ${osPlat} and architecture ${osArch}.`);
                }

                // check cache
                toolPath = toolLib.findLocalTool('terraform', version)
            }

            if (!toolPath) {
                // download, extract, cache
                toolPath = await acquireTerraform(version);
            }
        }

        //
        // a tool installer initimately knows details about the layout of that tool
        // for example, node binary is in the bin folder after the extract on Mac/Linux.
        // layouts could change by version, by platform etc... but that's the tool installers job
        //
        if (this.mc.OperatingSystem != OperatingSystem.Windows) {
            toolPath = path.join(toolPath, 'bin');
        }

        //
        // prepend the tools path. instructs the agent to prepend for future tasks
        //
        toolLib.prependPath(toolPath);
    }

    async function queryLatestMatch(versionSpec: string): Promise<string> {
        // node offers a json list of versions
        let dataFileName: string;
        switch (this.osPlat) {
            case "linux": dataFileName = "linux-" + this.osArch; break;
            case "darwin": dataFileName = "osx-" + this.osArch + '-tar'; break;
            case "win32": dataFileName = "win-" + this.osArch + '-exe'; break;
            default: throw new Error(`Unexpected OS '${this.osPlat}'`);
        }

        let versions: string[] = [];
        let dataUrl = "https://releases.hashicorp.com/terraform/index.json";
        let client: httpm.HttpClient = new httpm.HttpClient('vsts-node-tool');
        let resp: HttpClientResponse = await client.get(dataUrl);
        let body: any = JSON.parse(await resp.readBody());
        
        versions = Object.keys(body.versions);

        // get the latest version that matches the version spec
        let version: string = toolLib.evaluateVersions(versions, versionSpec);
        return version;
    }

    async function acquireTerraform(version: string): Promise<string> {
        //
        // Download - a tool installer intimately knows how to get the tool (and construct urls)
        //
        version = toolLib.cleanVersion(version);
        
        let stem = 'https://releases.hashicorp.com/terraform/' + version + '/terraform_' + version + '_';        
        let downloadUrl = stem + this.mc.OperatingSystem + '_' + this.mc.ProcessorArchitecture + '.zip'

        let downloadPath: string = await toolLib.downloadTool(downloadUrl);

        //
        // Extract
        //
        let extPath: string;
        if (this.osPlat == 'win32') {
            taskLib.assertAgent('2.115.0');
            extPath = taskLib.getVariable('Agent.TempDirectory');
            if (!extPath) {
                throw new Error('Expected Agent.TempDirectory to be set');
            }

            extPath = path.join(extPath, 'n'); // use as short a path as possible due to nested node_modules folders
            extPath = await toolLib.extract7z(downloadPath, extPath);
        }
        else {
            extPath = await toolLib.extractTar(downloadPath);
        }

        //
        // Install into the local tool cache - node extracts with a root folder that matches the fileName downloaded
        //
        let toolRoot = path.join(extPath, fileName);
        return await toolLib.cacheDir(toolRoot, 'node', version);
    }

    // run();


    async function getLatestTerraformVersion() {
        let httpc: httpm.HttpClient = new httpm.HttpClient('vsts-node-api');
        let versionsResponse: httpm.HttpClientResponse = await httpc.get('https://releases.hashicorp.com/terraform');

        let versions: Array<string> = [];
        let parser = cheerio.load(await versionsResponse.readBody());
        parser('a').each((i, element) => {
            let content: string = parser(element).text();
            if(content.match(/terraform/) && !content.match(/rc|beta/))
                versions.push(content);
        });
        return versions[0].replace('terraform_', '');
    };
}