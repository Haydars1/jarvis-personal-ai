import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSqlFile } from '../scripts/code-graph/native/sql.mjs';
import { fileNodeId } from '../scripts/code-graph/native/ids.mjs';

function edge(result,type){return result.edges.filter(item=>item.type===type);}

test('extracts D1 tables foreign keys and indexes deterministically',()=>{
  const source=`CREATE TABLE users (\n id INTEGER PRIMARY KEY\n);\nCREATE TABLE posts (\n id INTEGER PRIMARY KEY,\n user_id INTEGER,\n FOREIGN KEY (user_id) REFERENCES users(id)\n);\nCREATE INDEX idx_posts_user ON posts(user_id);`;
  const result=analyzeSqlFile({file:'schema.sql',source});
  assert.equal(result.nodes.some(node=>node.id===fileNodeId('schema.sql')),true);
  assert.equal(result.nodes.some(node=>node.kind==='table'&&node.name==='users'),true);
  assert.equal(result.nodes.some(node=>node.kind==='table'&&node.name==='posts'),true);
  assert.equal(result.nodes.some(node=>node.kind==='index'&&node.name==='idx_posts_user'),true);
  assert.equal(edge(result,'foreign-key').length,1);
  assert.equal(edge(result,'indexes').length,1);
  const fk=edge(result,'foreign-key')[0];
  assert.equal(result.nodes.find(node=>node.id===fk.source)?.name,'posts');
  assert.equal(result.nodes.find(node=>node.id===fk.target)?.name,'users');
});

test('supports inline REFERENCES constraints',()=>{
  const source=`CREATE TABLE parent(id INTEGER PRIMARY KEY);\nCREATE TABLE child(parent_id INTEGER REFERENCES parent(id));`;
  const result=analyzeSqlFile({file:'schema.sql',source});
  assert.equal(edge(result,'foreign-key').length,1);
});

test('does not invent relationships to external missing tables',()=>{
  const source=`CREATE TABLE local(id INTEGER, foreign_id INTEGER REFERENCES missing(id));`;
  const result=analyzeSqlFile({file:'schema.sql',source});
  assert.equal(edge(result,'foreign-key').length,0);
  assert.equal(result.diagnostics.some(item=>/external table/i.test(item)),true);
});

test('malformed supported statements are diagnosed without throwing',()=>{
  const result=analyzeSqlFile({file:'schema.sql',source:`CREATE TABLE ; CREATE INDEX broken ON ;`});
  assert.equal(result.nodes.length,1);
  assert.equal(result.edges.length,0);
  assert.equal(result.diagnostics.some(item=>/malformed/i.test(item)),true);
});
