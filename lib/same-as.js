import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';
import { SAME_AS_GRAPH, RENAME_DOMAIN } from "../config";
import mu from 'mu';


const KNOWN_DOMAINS = [
  'http://themis.vlaanderen.be',
  'http://data.vlaanderen.be',
  'https://data.vlaanderen.be',
  'http://doris.vlaanderen.be',
  'http://mu.semte.ch/vocabularies',
  'http://nieuwsberichten.vonet.be',
  'http://purl.org',
  'http://vocab.deri.ie',
  'http://www.semanticdesktop.org',
  'http://www.w3.org',
  'http://xmlns.com',
  'share://'
];

/**
 * Takes an array of triples and renames the uris that are not from a known domain
 *
 * @param triples the triples to be renamed
 */
async function renameTriples(triples, source) {
  for (let i = 0; i < triples.length; i++) {
    const triple = triples[i];
    const { subject, object } = triple;

    if (subject.type == 'uri') {
      if (needsToBeRenamed(subject.value)) {
        await ensureSameAsTriple(subject.value);
      }
    }
    if (object.type == 'uri') {
      if (needsToBeRenamed(object.value)) {
        await ensureSameAsTriple(object.value);
      }
    }
  }
  await updateTriples(source);
}



/**
 * Check if an uri needs to be renamed
 *
 * @param uri the uri to check
 */
function needsToBeRenamed(uri) {
  try {
    return KNOWN_DOMAINS.filter(item => uri.startsWith(item)).length === 0;
  } catch (e) {
    return false;
  }
}

/**
 * Check if a same-as triple already exists in the same-as database.
 * If not, add it
 *
 */
async function ensureSameAsTriple(oldUri) {
  const queryResult = await query(`
    PREFIX owl: <http://www.w3.org/2002/07/owl#>

    SELECT ?themisUri WHERE {
      GRAPH <${SAME_AS_GRAPH}> {
        ?themisUri owl:sameAs <${oldUri}> .
      }
    } LIMIT 1
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

async function updateTriples(source) {
  // update subjectUris
  await update(`
    PREFIX owl: <http://www.w3.org/2002/07/owl#>

    DELETE {
      GRAPH <${source}> {
        ?oldSubjectUri ?p ?o .
      }
    } INSERT {
      GRAPH <${source}> {
        ?themisSubjectUri ?p ?o .
      }
    } WHERE {
      GRAPH <${SAME_AS_GRAPH}> {
        ?themisSubjectUri owl:sameAs ?oldSubjectUri .
      }
      GRAPH <${source}> {
        ?oldSubjectUri ?p ?o .
      }
    }
  `);

  // update objectUris
  await update(`
    PREFIX owl: <http://www.w3.org/2002/07/owl#>

    DELETE {
      GRAPH <${source}> {
        ?s ?p ?oldObjectUri .
      }
    } INSERT {
      GRAPH <${source}> {
        ?s ?p ?themisObjectUri .
      }
    } WHERE {
      GRAPH <${SAME_AS_GRAPH}> {
        ?themisObjectUri owl:sameAs ?oldObjectUri .
      }
      GRAPH <${source}> {
        ?s ?p ?oldObjectUri .
      }
    }
  `);
}

export {
  renameTriples
};
