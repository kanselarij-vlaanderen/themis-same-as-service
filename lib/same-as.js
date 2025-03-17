import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';
import mu, { sparqlEscapeString, sparqlEscapeUri } from 'mu';
import { SAME_AS_GRAPH, RENAME_DOMAIN } from "../config";
import { getGraphTriples } from './graph-helpers';

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
 * Check all triples in the given graph and rename the subject/objects
 * that are not from a known domain.
 *
 * @param graph graph to rename triples in
 */
async function renameTriples(graph) {
  const triples = await getGraphTriples(graph);

  for (let triple of triples) {
    const { subject, object } = triple;

    if (subject.type == 'uri') {
      if (needsToBeRenamed(subject.value)) {
        const themisUri = await ensureSameAsTriple(subject.value);
        triple.renamedSubject = { type: 'uri', value: themisUri };
      }
    }

    if (object.type == 'uri') {
      if (needsToBeRenamed(object.value)) {
        const themisUri = await ensureSameAsTriple(object.value);
        triple.renamedObject = { type: 'uri', value: themisUri };
      }
    }

    if (triple.renamedSubject || triple.renamedObject) {
      await renameTriple(triple, graph);
    }
  }
  console.log(`Done renaming triples.`);
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
 * If not, add it.
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

  if (!queryResult.results.bindings.length) {
    const themisUri = `${RENAME_DOMAIN}${mu.uuid()}`;

    await update(`
    PREFIX owl: <http://www.w3.org/2002/07/owl#>

    INSERT DATA {
      GRAPH <${SAME_AS_GRAPH}> {
        <${themisUri}> owl:sameAs <${oldUri}> .
      }
    }`);

    return themisUri;
  } else {
    return queryResult.results.bindings[0]['themisUri'].value;
  }
}

/**
 * Rename the subject and/or object of a triple in a given graph.
 * Ie. delete the orignal triple and insert a triple
 * with an updated subject and/or object.
*/
async function renameTriple(triple, graph) {
  const renamedSubject = triple.renamedSubject || triple.subject;
  const renamedObject = triple.renamedObject || triple.object;

  await update(`
    PREFIX owl: <http://www.w3.org/2002/07/owl#>

    DELETE DATA {
      GRAPH <${graph}> {
         ${escapeValue(triple.subject)} ${escapeValue(triple.predicate)} ${escapeValue(triple.object)} .
      }
    }

    ;

    INSERT DATA {
      GRAPH <${graph}> {
         ${escapeValue(renamedSubject)} ${escapeValue(triple.predicate)} ${escapeValue(renamedObject)}.
      }
    }
  `);
}

/**
 * Escape the value of given RDF term to be used in a SPARQL query
*/
function escapeValue(rdfTerm) {
  const { type, value, datatype, "xml:lang": lang } = rdfTerm;
  if (type == "uri") {
    return sparqlEscapeUri(value);
  } else if (type == "literal" || type == "typed-literal") {
    if (datatype && datatype != 'http://www.w3.org/2001/XMLSchema#string')
      return `${sparqlEscapeString(value)}^^${sparqlEscapeUri(datatype)}`;
    else if (lang)
      return `${sparqlEscapeString(value)}@${lang}`;
    else
      return `${sparqlEscapeString(value)}`;
  } else
    console.log(`Don't know how to escape type ${type}. Will escape as a string.`);
  return sparqlEscapeString(value);
};

export {
  renameTriples
};
