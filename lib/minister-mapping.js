import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';
import { SAME_AS_GRAPH, PUBLIC_GRAPH } from "../config";
import { sparqlEscapeDateTime } from 'mu';

/**
 * Check all triples mandataris URIs in the given graph and replace it with its
 * Themis mandataris URI
 *
 * @param graph graph to rename the mandataris URIs in
 */
async function renameMinisterMapping(graph) {
  const meetingDate = await getMeetingDate(graph);

  const queryResult = await query(`
    PREFIX prov: <http://www.w3.org/ns/prov#>

    SELECT DISTINCT ?mandatarisUri WHERE {
      GRAPH <${graph}> {
        ?s prov:qualifiedAssociation ?mandatarisUri .
      }
    }
  `);

  for (let binding of queryResult.results.bindings) {
    let themisPersonUri = await getThemisPersonUri(binding["mandatarisUri"].value);
    let themisMandatarisUri = await getThemisMandatarisUri(meetingDate, themisPersonUri);
    await renameMandatarisUri(graph, themisMandatarisUri, binding["mandatarisUri"].value);
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
         ?s prov:qualifiedAssocation <${oldMandatarisUri}> .
      }
    }
    INSERT {
      GRAPH <${graph}> {
         ?s prov:qualifiedAssocation <${themisMandatarisUri}> .
      }
    }
    WHERE {
      GRAPH <${graph}> {
        ?s prov:qualifiedAssocation <${oldMandatarisUri}> .
     }
    }
  `);
}

export {
  renameMinisterMapping
};
