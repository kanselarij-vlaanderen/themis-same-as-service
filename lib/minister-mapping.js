import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';
import { SAME_AS_GRAPH, PUBLIC_GRAPH } from "../config";
import { sparqlEscapeDateTime } from 'mu';

/**
 * Check all triples mandataris URIs in the given graph and replace it with its
 * Themis mandataris URI based on the related person and meeting date.
 *
 * The triplestore's same-as graph contains triples like:
 * <themis-person-uri> dct:relation <kaleidos-mandatee-uri>
 *
 * The triplestore's public graph contains Themis mandatee URIs
 * with a start and optional end date.
 *
 * Starting from the kaleidos-mandatee-uri, we get the related themis-person-uri.
 * Based on the meeting date and the themis-person-uri we get
 * the correct themis-mandatee-uri.
 *
 * @param graph graph to rename the mandataris URIs in
 */
async function renameMinisterMapping(graph) {
  const meetingDate = await getMeetingDate(graph);

  if (meetingDate) {
    const queryResult = await query(`
      PREFIX prov: <http://www.w3.org/ns/prov#>

      SELECT DISTINCT ?mandatarisUri WHERE {
        GRAPH <${graph}> {
          ?s prov:qualifiedAssociation ?mandatarisUri .
        }
      }
    `);

    for (let binding of queryResult.results.bindings) {
      const kaleidosMandatarisUri = binding["mandatarisUri"].value;
      const themisPersonUri = await getThemisPersonUri(kaleidosMandatarisUri);
      if (themisPersonUri) {
        const themisMandatarisUri = await getThemisMandatarisUri(meetingDate, themisPersonUri);
        if (themisMandatarisUri) {
          await renameMandatarisUri(graph, themisMandatarisUri, kaleidosMandatarisUri);
        } else {
          console.log(`Didn't find Themis mandatee for person <${themisPersonUri}> and meeting at ${meetingDate}. Unable to map minister <${kaleidosMandatarisUri}>.`);
        }
      } else {
        console.log(`Didn't find related person for Kaleidos mandatee <${kaleidosMandatarisUri}>. Unable to map this minister.`);
      }
    }
  } else {
    console.log(`No meeting date found in graph <${graph}>. Unable to map ministers.`);
  }
}

async function getMeetingDate(graph) {
  const queryResult = await query(`
    PREFIX besluit: <http://data.vlaanderen.be/ns/besluit#>

    SELECT ?meetingDate WHERE {
      GRAPH <${graph}> {
        ?meeting a <http://data.vlaanderen.be/ns/besluit#Vergaderactiviteit> ;
            besluit:geplandeStart ?meetingDate .
      }
    } LIMIT 1
  `);

  if (queryResult.results.bindings.length) {
    return queryResult.results.bindings[0]['meetingDate'].value;
  } else {
    return null;
  }
}

async function getThemisPersonUri(mandatarisUri) {
  const queryResult = await query(`
    PREFIX dct: <http://purl.org/dc/terms/>

    SELECT ?themisPersonUri WHERE {
      GRAPH <${SAME_AS_GRAPH}> {
        ?themisPersonUri dct:relation <${mandatarisUri}> .
      }
    } LIMIT 1
  `);

  if (queryResult.results.bindings.length) {
    return queryResult.results.bindings[0]['themisPersonUri'].value;
  } else {
    return null;
  }
}

async function getThemisMandatarisUri(meetingDate, themisPersonUri) {
  const queryResult = await query(`
    PREFIX besluit: <http://data.vlaanderen.be/ns/besluit#>
    PREFIX prov: <http://www.w3.org/ns/prov#>
    PREFIX mandaat: <http://data.vlaanderen.be/ns/mandaat#>

    SELECT ?themisMandatarisUri WHERE {
      GRAPH <${PUBLIC_GRAPH}> {
        ?themisMandatarisUri a mandaat:Mandataris ;
          mandaat:isBestuurlijkeAliasVan <${themisPersonUri}> ;
          mandaat:start ?start .
        ?bestuursorgaan a besluit:Bestuursorgaan ;
          prov:hadMember ?themisMandatarisUri .
        OPTIONAL { ?themisMandatarisUri mandaat:einde ?einde . }
        FILTER (?start < ${sparqlEscapeDateTime(meetingDate)})
        FILTER (?einde > ${sparqlEscapeDateTime(meetingDate)} || !bound(?einde))
      }
    } LIMIT 1
  `);

  if (queryResult.results.bindings.length) {
    return queryResult.results.bindings[0]['themisMandatarisUri'].value;
  } else {
    return null;
  }
}

/**
 * Rename the triple containing the mandataris
*/
async function renameMandatarisUri(graph, themisMandatarisUri, oldMandatarisUri) {
  await update(`
    PREFIX prov: <http://www.w3.org/ns/prov#>

    DELETE {
      GRAPH <${graph}> {
         ?s prov:qualifiedAssociation <${oldMandatarisUri}> .
      }
    }
    INSERT {
      GRAPH <${graph}> {
         ?s prov:qualifiedAssociation <${themisMandatarisUri}> .
      }
    }
    WHERE {
      GRAPH <${graph}> {
        ?s prov:qualifiedAssociation <${oldMandatarisUri}> .
     }
    }
  `);
}

export {
  renameMinisterMapping
};
