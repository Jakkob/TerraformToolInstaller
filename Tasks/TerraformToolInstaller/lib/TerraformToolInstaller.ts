import * as toolLib from 'vsts-task-tool-lib/tool';
import * as taskLib from 'vsts-task-lib/task';
import * as httpm from 'typed-rest-client/HttpClient';
import * as path from 'path';
import { HttpClientResponse } from 'typed-rest-client/HttpClient';
import { IRequestOptions } from 'typed-rest-client/Interfaces';

import MachineCharacteristics from './MachineCharacteristics';
import { OperatingSystem, ProcessorArchitecture } from './MachineCharacteristics';

// I got most of this code for this from the "NodeTool" task in the `vsts-tasks` repo on GitHub: 
//     https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/NodeTool

// Response body schema for the Terraform version data request.
interface Build {
	name: string;
	version: string;
	os: OperatingSystem;
	arch: ProcessorArchitecture;
	filename: string;
	url: string;
}
interface TerraformVersionData {
	name: string;
	version: string;
	shasums: string;
	shasums_signature: string;
	builds: Build[];
}

// Set a 5-second timeout for most requests.
const requestOptions: IRequestOptions = {
    socketTimeout: 5000
}

export default class TerraformToolInstaller {
    private readonly toolName: string = 'terraform';

    private readonly osPlat: OperatingSystem;
    private readonly osArch: ProcessorArchitecture;

    constructor() {
        let mc = new MachineCharacteristics();
        this.osPlat = mc.OperatingSystem;
        this.osArch = mc.ProcessorArchitecture;
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
            toolPath = toolLib.findLocalTool(this.toolName, versionSpec);
        }

        if (!toolPath) {
            let version: string;
            if (toolLib.isExplicitVersion(versionSpec)) {
                // version to download
                version = versionSpec;
            }
            else {
                // query the Hashicorp Releases API for a matching version
                version = await this.queryLatestMatch(versionSpec);
                if (!version) {
                    throw new Error(`Unable to find a Terraform version '${versionSpec}' for platform [${this.osPlat}] and architecture [${this.osArch}].`);
                }

                // check cache
                toolPath = toolLib.findLocalTool(this.toolName, version)
            }

            if (!toolPath) {
                // download, extract, cache
                toolPath = await this.acquireTerraform(version);
            }
        }

        //
        // prepend the tools path. instructs the agent to prepend for future tasks
        //
        toolLib.prependPath(toolPath);
    }

    private async queryLatestMatch(versionSpec: string): Promise<string> {
        let versions: string[] = [];
        let dataUrl = "https://releases.hashicorp.com/terraform/index.json";
        let client: httpm.HttpClient = new httpm.HttpClient('vsts-node-tool', null, requestOptions);
        let resp: HttpClientResponse = await client.get(dataUrl);
        let body: any = JSON.parse(await resp.readBody());
        
        versions = Object.keys(body.versions);

        // get the latest version that matches the version spec
        let version: string = toolLib.evaluateVersions(versions, versionSpec);
        return version;
    }

    private async acquireTerraform(version: string): Promise<string> {
        //
        // Download - a tool installer intimately knows how to get the tool (and construct urls)
        //
        version = toolLib.cleanVersion(version);
        let buildsUrl = "https://releases.hashicorp.com/terraform/" + version + "/index.json";
        let client: httpm.HttpClient = new httpm.HttpClient('vsts-node-tool', null, requestOptions);
        let resp: HttpClientResponse = await client.get(buildsUrl);
        let body: TerraformVersionData = JSON.parse(await resp.readBody());

        let build: Build = body.builds.find((item: Build) => {
            return item.os == this.osPlat && item.arch == this.osArch;
        });

        if(!build) {
            throw new Error(`No Terraform build of version '${version}' for platform [${this.osPlat}] and architecture [${this.osArch}] was found!`)
        }

        let fileName: string = build.filename;
        let downloadPath: string = await toolLib.downloadTool(build.url);

        //
        // Extract
        //
        let extPath: string;
        if (this.osPlat == OperatingSystem.Windows) {
            taskLib.assertAgent('2.115.0');
            extPath = taskLib.getVariable('Agent.TempDirectory');
            if (!extPath) {
                throw new Error('Expected Agent.TempDirectory to be set');
            }

            extPath = path.join(extPath, 'n'); // use as short a path as possible due to nested node_modules folders
            extPath = await toolLib.extract7z(downloadPath, extPath);
        }
        else {
            extPath = await toolLib.extractZip(downloadPath);
        }

        //
        // Install into the local tool cache - node extracts with a root folder that matches the fileName downloaded
        //
        let toolRoot = path.join(extPath, fileName);
        return await toolLib.cacheDir(toolRoot, this.toolName, version);
    }
}
