const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');
const { PassThrough } = require('stream');
const { createDelegationEnvelope, evaluateDelegationRequest, capabilityForClaudeTool } = require('../lib/company/delegation-envelope');
const { createRunStore } = require('../lib/company/run-store');
const { createWorkStore } = require('../lib/company/work-store');
const { createApprovalBroker } = require('../lib/company/approval-broker');
const { createRunOrchestrator } = require('../lib/company/run-orchestrator');
const { createCompanyService } = require('../lib/company/company-service');
const { createClaudeAgentSdkRuntime } = require('../lib/company/runtime/claude-agent-sdk');
const { createCodexAppServerRuntime } = require('../lib/company/runtime/codex-app-server');

function tmp(prefix) { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }
async function collect(iterable) { const out=[]; for await (const event of iterable) out.push(event); return out; }

test('Delegation Envelope keeps network, git push, and destructive shell outside ordinary shell authority', () => {
  const envelope = createDelegationEnvelope({ allow: ['workspace.read','workspace.write','shell.execute'], deny: ['git.push'] });
  assert.equal(evaluateDelegationRequest(envelope,{capability:'workspace.write'}).decision,'allow');
  assert.equal(evaluateDelegationRequest(envelope,{capability:'network.access'}).decision,'ask');
  assert.equal(evaluateDelegationRequest(envelope,{capability:'git.push'}).decision,'deny');
  assert.equal(capabilityForClaudeTool('Bash',{command:'npm test'}),'shell.execute');
  assert.equal(capabilityForClaudeTool('Bash',{command:'git push origin main'}),'git.push');
  assert.equal(capabilityForClaudeTool('Bash',{command:'npm install x'}),'network.access');
  assert.equal(capabilityForClaudeTool('Bash',{command:'rm -rf build'}),'filesystem.destructive');
});

test('Run state is canonical while provider session and append-only events stay separate', () => {
  const rootDir=tmp('lucubro-run-');
  const store=createRunStore({rootDir,now:()=> '2026-08-08T00:00:00.000Z'});
  store.create({id:'run_1',workId:'work_1',employeeId:'ben',runtime:'claude-code'});
  store.update('run_1',{status:'running',providerSessionId:'claude_session_9'});
  store.appendEvent('run_1',{type:'run.started',providerSessionId:'claude_session_9'});
  store.appendEvent('run_1',{type:'message.delta',text:'Working'});
  const reloaded=createRunStore({rootDir});
  assert.equal(reloaded.get('run_1').id,'run_1');
  assert.notEqual(reloaded.get('run_1').id,reloaded.get('run_1').providerSessionId);
  assert.deepEqual(reloaded.readEvents('run_1').map(e=>e.seq),[1,2]);
});

test('out-of-envelope capability becomes a resolvable Needs You item', async () => {
  const store=createRunStore({rootDir:tmp('lucubro-approval-')});
  store.create({id:'run_a',workId:'work_a',employeeId:'ben',runtime:'codex'});
  const broker=createApprovalBroker({runStore:store,createId:()=> 'approval_1'});
  const pending=broker.request({runId:'run_a',envelope:{allow:['workspace.read']},request:{capability:'network.access',reason:'Need network'}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(broker.listPending('run_a')[0].state,'needs-you');
  broker.resolve({runId:'run_a',approvalId:'approval_1',decision:'allow'});
  assert.equal(await pending,'allow');
  assert.equal(store.readEvents('run_a').at(-1).type,'approval.resolved');
});

test('orchestrator preserves Lucubro Run identity and publishes review evidence before completion', async () => {
  const store=createRunStore({rootDir:tmp('lucubro-orch-')});
  const approvals=createApprovalBroker({runStore:store});
  const runtime={async *run(){yield {type:'run.started',providerSessionId:'provider_abc'};yield {type:'run.completed',summary:'Fixed'};}};
  const orchestrator=createRunOrchestrator({runStore:store,approvalBroker:approvals,runtimeRegistry:new Map([['fake',runtime]]),worktreeManager:{async create(){return {cwd:'/tmp/wt',branch:'lucubro/run'};},async inspect(){return {diff:'diff --git a/a b/a',changedFiles:['a']};}},createId:()=> 'run_local'});
  const run=await orchestrator.start({workId:'work_9',employeeId:'ben',runtime:'fake',repoDir:'/repo',prompt:'Fix it',delegationEnvelope:{allow:['workspace.read']}});
  await orchestrator.wait(run.id);
  assert.equal(store.get(run.id).providerSessionId,'provider_abc');
  assert.equal(store.get(run.id).status,'completed');
  const eventTypes=store.readEvents(run.id).map(e=>e.type);
  assert.equal(eventTypes.includes('artifact.produced'),true);
  assert.equal(eventTypes.at(-1),'run.completed');
  assert.ok(eventTypes.indexOf('artifact.produced') < eventTypes.lastIndexOf('run.completed'));
});

test('Claude adapter projects text/tools but never raw thinking', async () => {
  const runtime=createClaudeAgentSdkRuntime({queryImpl:({options})=>(async function*(){const p=await options.canUseTool('Bash',{command:'npm test'},{});assert.equal(p.behavior,'allow');yield {type:'system',subtype:'init',session_id:'claude_1'};yield {type:'assistant',message:{content:[{type:'thinking',thinking:'private reasoning'},{type:'text',text:'Found it.'}]}};yield {type:'result',subtype:'success',session_id:'claude_1',result:'Done'};})()});
  const events=await collect(runtime.run({runId:'run_c',cwd:'/repo',prompt:'Fix',requestApproval:async()=> 'allow'}));
  assert.equal(JSON.stringify(events).includes('private reasoning'),false);
  assert.equal(events[0].providerSessionId,'claude_1');
  assert.equal(events.at(-1).type,'run.completed');
});

function fakeCodex(onMessage){const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();child.killed=false;child.kill=()=>{child.killed=true;};let buffer='';child.stdin.on('data',chunk=>{buffer+=chunk.toString();let i;while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i).trim();buffer=buffer.slice(i+1);if(line)onMessage(JSON.parse(line),child);}});return child;}
const send=(child,message)=>child.stdout.write(`${JSON.stringify(message)}\n`);

test('Codex app-server adapter handshakes, routes approval, and projects diff without reasoning', async () => {
  let approval=null;
  const runtime=createCodexAppServerRuntime({spawnImpl(command,args){assert.equal(command,'codex');assert.deepEqual(args,['app-server']);return fakeCodex((message,child)=>{if(message.method==='initialize')send(child,{id:message.id,result:{}});else if(message.method==='thread/start')send(child,{id:message.id,result:{thread:{id:'thr_1'}}});else if(message.method==='turn/start'){send(child,{id:message.id,result:{turn:{id:'turn_1',status:'inProgress'}}});send(child,{id:9,method:'item/commandExecution/requestApproval',params:{command:['npm','test'],cwd:'/repo'}});}else if(message.id===9){approval=message.result;send(child,{method:'turn/diff/updated',params:{diff:'diff --git a/a b/a'}});send(child,{method:'turn/completed',params:{turn:{status:'completed'}}});process.nextTick(()=>child.emit('close',0));}});}});
  const events=await collect(runtime.run({runId:'run_x',cwd:'/repo',prompt:'Fix',delegationEnvelope:{allow:['shell.execute']},requestApproval:async()=> 'allow'}));
  assert.deepEqual(approval,{decision:'accept'});
  assert.equal(events.some(e=>e.type==='run.started'&&e.providerSessionId==='thr_1'),true);
  assert.equal(events.some(e=>e.type==='artifact.updated'),true);
  assert.equal(events.at(-1).type,'run.completed');
});

test('Company Work moves to review and CEO acceptance becomes durable state', async () => {
  const rootDir=tmp('lucubro-work-');const workStore=createWorkStore({rootDir});const runStore=createRunStore({rootDir});
  workStore.create({id:'work_review',brief:'Fix review flow',assignedEmployeeId:'ben',status:'review',activeRunId:'run_review'});
  const company=createCompanyService({workStore,runStore,runOrchestrator:{start(){},wait(){}}});
  assert.equal(company.decideWork({workId:'work_review',decision:'accept'}).status,'accepted');
  assert.throws(()=>company.decideWork({workId:'work_review',decision:'rework'}),/not ready for review/);
});
