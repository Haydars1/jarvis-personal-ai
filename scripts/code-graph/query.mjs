import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  validateCodeGraph,
  getCodeGraphStatus,
  findGraphNodes,
  getGraphNeighbors,
  findGraphPath,
  rankImpactedFiles
} from '../../src/lib/code-graph.js';

const args = process.argv.slice(2);
const op = args.shift() || 'status';
const path = process.env.CODE_GRAPH_PATH || resolve('graphify-out/code-graph.json');

let graph;
try {
  graph = JSON.parse(readFileSync(path, 'utf8'));
} catch {
  console.error(`Cannot read code graph: ${path}`);
  process.exit(2);
}

let result;
if (op === 'status') {
  const validation = validateCodeGraph(graph);
  const status = validation.valid ? getCodeGraphStatus(graph, process.env.GITHUB_SHA) : 'invalid';
  result = { validation, status };
  if (!validation.valid || status === 'stale' || status === 'invalid' || status === 'unavailable') process.exitCode = 1;
} else if (op === 'find') {
  result = findGraphNodes(graph, args.join(' '));
} else if (op === 'neighbors') {
  result = getGraphNeighbors(graph, args[0], { direction: args[1] || 'both' });
} else if (op === 'path') {
  result = findGraphPath(graph, args[0], args[1]);
} else if (op === 'impact') {
  result = rankImpactedFiles(graph, args);
} else {
  console.error('Usage: graph:query -- status|find <q>|neighbors <id> [direction]|path <from> <to>|impact <file...>');
  process.exit(2);
}

console.log(JSON.stringify(result, null, 2));
