import { querySudo as query } from '@lblod/mu-auth-sudo';

import {
  SELECT_BATCH_SIZE
} from '../config';

/**
* Get all the triples from the dataset graph
*
* @public
*/
async function getGraphTriples(graph) {
  let triples = [];
  const count = await countTriples(graph);
  if (count > 0) {
    console.log(`Parsing 0/${count} triples`);
    let offset = 0;
    const query = `
      SELECT * WHERE {
        GRAPH <${graph}> {
          ?subject ?predicate ?object .
        }
      }
      LIMIT ${SELECT_BATCH_SIZE} OFFSET %OFFSET
    `;

    while (offset < count) {
      const result = await parseBatch(query, offset);
      triples.push(...result);
      offset = offset + SELECT_BATCH_SIZE;
      console.log(`Parsed ${offset < count ? offset : count}/${count} triples`);
    }
  }

  return triples;
}

/**
* Count the triples in the dataset graph
*/
async function countTriples(graph) {
  const queryResult = await query(`
        SELECT (COUNT(*) as ?count)
        WHERE {
          GRAPH <${graph}> {
            ?s ?p ?o .
          }
        }
      `);

  return parseInt(queryResult.results.bindings[0].count.value);
}


async function parseBatch(q, offset = 0) {
  const pagedQuery = q.replace('%OFFSET', offset);
  const result = await query(pagedQuery);

  return result.results.bindings.length ? result.results.bindings : null;
}

export {
  getGraphTriples
};
