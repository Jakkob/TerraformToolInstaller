import DebuggableTaskRunner from '../Common/DebuggableTaskRunner'

let runner: DebuggableTaskRunner = new DebuggableTaskRunner('./main')
runner.setInputVariable('versionSpec', "0.9.1");
runner.setInputVariable('checkLatest', 'false');

runner.run();
