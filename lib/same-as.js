import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';
import { SAME_AS_GRAPH, RENAME_DOMAIN } from "../config";
import mu from 'mu';


const KNOWN_DOMAINS = [
  'themis.vlaanderen.be',
  'data.vlaanderen.be',
  'data.vlaanderen.be',
  'doris.vlaanderen.be',
  'mu.semte.ch/vocabularies',
  'nieuwsberichten.vonet.be',
  'purl.org',
  'vocab.deri.ie',
  'www.semanticdesktop.org',
  'www.w3.org',
  'xmlns.com',
  'share://'
];

const PROTOCOLS_TO_RENAME = [
  'http:',
  'https:',
  'ftp:',
  'ftps:'
];

/**
 * Takes an array of triples and renames the uris that are not from a known domain
 *
 * @param triples the triples to be renamed
 */
async function renameTriples(triples) {
  const renamedTriples = [];
  for (let i = 0; i < triples.length; i++) {
    const triple = triples[i];
    const { subject, predicate, object } = triple;
    const renamedTriple = {};

    renamedTriple.subject = subject;
    renamedTriple.predicate = predicate;
    renamedTriple.object = object;

    if (subject.type == 'uri') {
      if (needsToBeRenamed(subject.value)) {
        await checkSameAsTriple(subject.value);
        renamedTriples.push(renamedTriple);
      }
    }
    if (object.type == 'uri') {
      if (needsToBeRenamed(object.value)) {
        await checkSameAsTriple(object.value);
        renamedTriples.push(renamedTriple);
      }
    }
  }
  return renamedTriples;
}

/**
 * Check if an uri needs to be renamed
 *
 * @param uri the uri to check
 */
function needsToBeRenamed(uri) {
  try {
    const { hostname, protocol } = new URL(uri);
    return hostname && protocol && PROTOCOLS_TO_RENAME.includes(protocol) && !KNOWN_DOMAINS.includes(hostname);
  } catch (e) {
    return false;
  }
}

/**
 * Check if a same-as triple already exists in the same-as database.
 * If not, add it
 * 
 */
async function checkSameAsTriple(oldUri) {
  const queryResult = await query(`
    PREFIX owl: <http://www.w3.org/2002/07/owl#>

    SELECT ?themisUri WHERE {
      GRAPH <${SAME_AS_GRAPH}> {
        ?themisUri owl:sameAs <${oldUri}> .
      } 
    }
  `);

  if (!queryResult.results.bindings[0]) {
    const themisUri = `${RENAME_DOMAIN}${mu.uuid()}`;

    await update(`
    PREFIX owl: <http://www.w3.org/2002/07/owl#>

    INSERT DATA {
      GRAPH <${SAME_AS_GRAPH}> {
        <${themisUri}> owl:sameAs <${oldUri}> .
      } 
    }
  `);
  }
}

export {
  renameTriples
};