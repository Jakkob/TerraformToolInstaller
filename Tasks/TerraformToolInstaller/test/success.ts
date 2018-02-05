import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'main.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('versionSpec', "0.9.1");
tmr.setInput('checkLatest', 'false');

let cwd = process.cwd();
process.env['AGENT_WORKFOLDER'] = path.join(cwd, '_work');
process.env['AGENT_TEMPDIRECTORY'] = path.join(cwd, '_work', 'temp');
process.env['AGENT_TOOLSDIRECTORY'] = path.join(cwd, '_work', 'tools');

// provide answers for task mock
// let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
//     "which": {
//         "echo": "/mocked/tools/echo"
//     },
//     "exec": {
//         "/mocked/tools/echo Hello, from task!": {
//             "code": 0,
//             "stdout": "atool output here",
//             "stderr": "atool with this stderr output"            
//         }
//     }
// };
// tmr.setAnswers(a);

// mock a specific module function called in task 
// tmr.registerMock('./taskmod', {
//     sayHello: function() {
//         console.log('Hello Mock!');
//     }
// });

tmr.run(true);