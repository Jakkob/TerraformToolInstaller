import * as httpClient from 'typed-rest-client/HttpClient';
import * as rClient from 'typed-rest-client/RestClient';
import { HttpClientResponse } from 'typed-rest-client/HttpClient';

interface IThing {
    stuff: string;
}

async function run() {
    let client: httpClient.HttpClient = new httpClient.HttpClient('vsts-node-api');
    let resp: HttpClientResponse = await client.get('https://releases.hashicorp.com/terraform/index.json');

    let thing = JSON.parse(await resp.readBody());

    var versions = Array.from(thing.versions, (element) => {
        return element;
    });

    console.log("whatever");
}

run();