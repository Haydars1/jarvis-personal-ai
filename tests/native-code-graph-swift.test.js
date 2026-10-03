import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSwiftFile } from '../scripts/code-graph/native/swift.mjs';
import { fileNodeId } from '../scripts/code-graph/native/ids.mjs';

function edge(result,type){return result.edges.filter(item=>item.type===type);}

test('extracts Swift imports types functions methods and local conformance',()=>{
  const source=`import Foundation\nprotocol Runnable { func run() }\nstruct Worker: Runnable {\n  func run() { helper() }\n}\nfunc helper() {}`;
  const result=analyzeSwiftFile({file:'ios/Worker.swift',source});
  assert.equal(result.nodes.some(node=>node.id===fileNodeId('ios/Worker.swift')),true);
  assert.equal(result.nodes.some(node=>node.kind==='protocol'&&node.name==='Runnable'),true);
  assert.equal(result.nodes.some(node=>node.kind==='struct'&&node.name==='Worker'),true);
  assert.equal(result.nodes.some(node=>node.kind==='method'&&node.name==='run'),true);
  assert.equal(result.nodes.some(node=>node.kind==='function'&&node.name==='helper'),true);
  assert.equal(edge(result,'imports').length,1);
  assert.equal(edge(result,'conforms').length,1);
  assert.equal(edge(result,'calls').some(item=>result.nodes.find(node=>node.id===item.target)?.name==='helper'),true);
});

test('scopes duplicate Swift method names by their containing type',()=>{
  const source=`struct A { func run() {} }\nstruct B { func run() {} }`;
  const result=analyzeSwiftFile({file:'ios/Types.swift',source});
  const methods=result.nodes.filter(node=>node.kind==='method'&&node.name==='run');
  assert.equal(methods.length,2);
  assert.notEqual(methods[0].id,methods[1].id);
});

test('does not invent edges for external inheritance or malformed structure',()=>{
  const source=`class Screen: UIViewController {\n  func open() { unknownCall() }`;
  const result=analyzeSwiftFile({file:'ios/Screen.swift',source});
  assert.equal(edge(result,'inherits').length,0);
  assert.equal(edge(result,'calls').length,0);
  assert.equal(result.diagnostics.some(item=>/external inheritance/i.test(item)),true);
  assert.equal(result.diagnostics.some(item=>/brace/i.test(item)),true);
});
