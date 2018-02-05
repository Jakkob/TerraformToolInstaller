import * as path from 'path';
import * as assert from 'assert';
import * as fs from 'fs';
import * as ttm from 'vsts-task-lib/mock-test';

describe('Sample task tests', function () {
    before(() => {

    });

    after(() => {

    });

    it('should succeed with simple inputs', (done: MochaDone) => {
        let tp = path.join(__dirname, 'success');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.warningIssues.length, 0, "should have no warnings");
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        // assert(tr.stdout.indexOf('atool output here') >= 0, "tool stdout");
        // assert(tr.stdout.indexOf('Hello Mock!') >= 0, "task module is called");

        done();
    });
});