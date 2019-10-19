const names = require('./names')
const request = require('request-promise-native')
const csv = require('fast-csv')
const path = require('path')


//get the Specify backbone disciplines
var disciplines = [];
var disciplineFile  = 'SpecifyDisciplines20191019.csv'
csv.fromPath(`./${disciplineFile}`, {headers: true})
.on("data", data => {
  disciplines.push(data);
})
.on("error", err =>{
  console.log('error reading disciplines file')
})
.on("end", () => {
  console.log('Finished reading disciplines');
  
  let atomisedNames = getAtomised(names)

  let genera = []
  atomisedNames.forEach(atomisedName => {
    if(!genera.includes(atomisedName.genus)){
      genera.push(atomisedName.genus)
    }
  });


  console.log('fetching higher taxa')
  getHigherRanks(genera).then(higherTaxa => {
    //add the higher taxa back to the original objects
    let higherTaxaAdded = 0;
    let noHigherTaxa = 0;
    let namesWithHigherRanks = []
    let disciplineCounts = {}

    atomisedNames.forEach(atomisedName => {
      //find it's higher taxa
      let higherTaxonNames = higherTaxa[atomisedName.genus]
      if(higherTaxonNames) {
        let allNames = Object.assign({}, higherTaxonNames, atomisedName) //merge them all together
        delete allNames.searchName
        //sometimes the family and genus name end up being the same
        if(allNames.family == allNames.genus){
          allNames.genus = null
          allNames.canonical = null
        }

        //get the discipline
        allNames.specifyDiscipline = null
        for(var discipline of disciplines){
          let disciplineRank = discipline.Rank.toLowerCase().trim()
          let disciplineTaxa = discipline.Taxa.split(',').map(t => t.trim())
          if(allNames[disciplineRank] && disciplineTaxa.includes(allNames[disciplineRank])){
            allNames.specifyDiscipline = discipline.Discipline
            if(disciplineCounts[discipline.Discipline]){
              disciplineCounts[discipline.Discipline]++
            }
            else{
              disciplineCounts[discipline.Discipline] = 1
            }
            break
          }
        }

        if(!allNames.specifyDiscipline){
          if(disciplineCounts.none){
            disciplineCounts.none++
          }
          else{
            disciplineCounts.none = 1
          }
        }

        namesWithHigherRanks.push(allNames) 
        higherTaxaAdded++
      }
      else {
        let blankHigherTaxa = {
          kingdom: null,
          phylym: null,
          class: null,
          order: null,
          family: null
        }

        let allNames = Object.assign({}, blankHigherTaxa, atomisedName)
        allNames.specifyDiscipline = null
        namesWithHigherRanks.push(allNames) //merge them all together
        noHigherTaxa++
        if(disciplineCounts.none){
          disciplineCounts.none++
        }
        else{
          disciplineCounts.none = 1
        }
      }
    })

    //print some output
    if(higherTaxaAdded) {
      console.log('Higher taxa added for ' + higherTaxaAdded + ' names')
    }  

    if(noHigherTaxa){
      console.log('No higher taxa found for ' + noHigherTaxa + ' names')
    }

    if(Object.keys(disciplineCounts).length > 0){
      console.log('Counts per discipline:')
      Object.keys(disciplineCounts).forEach(key =>{
        console.log(key + ': ' + disciplineCounts[key])
      })
    }

    //write out the results. 
    csv.writeToPath(path.resolve(__dirname, 'results.csv'), namesWithHigherRanks, {headers: true})
      .on('error', err => console.error(err))
      .on('finish', () => console.log('Done writing out results.'));

  }).catch(err => {
    console.log("error getting higher taxa: " + err.message)
  })
});





function getAtomised(names) {
  return names.map(nameString => {
    nameString = nameString.replace(/\scf\.?\s/g, " ").replace(/\snr\.?\s/g, " ").replace(/\saff\.?\s/g, "") //identification qualifiers
    nameString = nameString.replace(/\&amp;/g, "&")
    let parts = nameString.trim().replace(/\s+/g, ' ').split(' ')
    let genus = parts[0]
    let subgenus = null
    if (parts[1].includes("(")){
      subgenus =  parts[1].replace("(", "").replace(")", "").trim()
    }
    
    let species = null
    let subspecies = null
    
    let lowerExceptions = ['&', 'van', 'von', 'de', 'der', 'et', 'al.,', 'and', 'in', ',']
    let lowerparts = parts.filter(part => {
      return part == part.toLowerCase() && !/\d+/.test(part) && !part.includes('(') && !lowerExceptions.includes(part) //a lowercase name and all these other criteria
    })
    if (lowerparts.length > 0){
      species = lowerparts[0]
      if(lowerparts.length > 1) {
        lowerparts.shift()
        subspecies = lowerparts.join(' ')
      }
    }
  
    let authority = null
    //get the index of the last lower part
    let lastlowerpart = lowerparts.pop()
    let lastLowerPartIndex = null
    for (let i = parts.length -1; i >= 0; i--){
      if (parts[i] == lastlowerpart){
        lastLowerPartIndex = i
        break
      }
    }
  
    if(lastLowerPartIndex && lastLowerPartIndex < parts.length - 1) {
      authority = parts.slice(lastLowerPartIndex + 1).join(' ')
    }

    //add the canonical name name
    let canonicalName = `${genus} ${subgenus? `(${subgenus})` : "" } ${species? species : ""} ${subspecies? subspecies : ""}`.replace(/\s+/g, ' ').trim()
    

  
    return {
      genus,
      subgenus, 
      species,
      subspecies,
      authority,
      canonical: canonicalName,
      ["dwc:scientificName"]: nameString
    }
     
  })
}

async function getHigherRanks(names){
  let options = {
    method: 'POST', 
    uri: 'http://resolver.globalnames.org/name_resolvers.json', 
    body: {
      names: names.join('|'),
      data_source_ids: "1|11" //CoL and GBIF
    }, 
    json: true
  }
  
  try{
    let response = await request(options)
    let responseData = response.data

    let higherRanks = {}
    names.forEach(name =>{
      let nameresults = responseData.find( rd => rd.is_known_name && rd.supplied_name_string == name)
      if(nameresults){
        //find the first one with classification_path and classification_path_ranks
        let hasRanks = nameresults.results.find(nr => nr.classification_path && nr.classification_path_ranks) //just find the first that has values
        if(hasRanks){
          let final = { }
          let ranks = hasRanks.classification_path_ranks.split('|')
          let ranknames = hasRanks.classification_path.split('|')
          ranks.forEach((rank, index) => {
            final[rank] = ranknames[index]
          })
          higherRanks[name] = final
        }
      }
      else{
        higherRanks[name] = null
      }
    })

    return higherRanks

  }
  catch(err) {
    throw err
  }
}

