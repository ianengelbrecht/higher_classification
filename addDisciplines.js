//Takes a csv will all higher taxa included and adds the Specify discipline to each
const csv = require('fast-csv')
const path = require('path')

var disciplines = [];
var disciplineFile  = 'SpecifyDisciplines20191019.csv'

//read the disciplines
csv.fromPath(`./${disciplineFile}`, {headers: true})
.on("data", data => {
  disciplines.push(data);
})
.on("error", err =>{
  console.log('error reading disciplines file')
})
.on("end", () => {
  //read the taxa
  let taxonFile = "taxon_names_with_higher_classification_IE20191018.csv"
  let taxa = []
  csv.fromPath(`./${taxonFile}`, {headers: true})
  .on("data", data => {
    taxa.push(data);
  })
  .on("error", err =>{
    console.log('error reading taxon file')
  })
  .on("end", () => {
    
    let disciplineCounts = {}
    
    taxa.forEach(taxon => {
      taxon.specifyDiscipline = null
      for(var discipline of disciplines){
        let disciplineRank = discipline.Rank.toLowerCase().trim()
        let disciplineTaxa = discipline.Taxa.split(',').map(t => t.trim())
        if(taxon[disciplineRank] && disciplineTaxa.includes(taxon[disciplineRank])){
          taxon.specifyDiscipline = discipline.Discipline
          if(disciplineCounts[discipline.Discipline]){
            disciplineCounts[discipline.Discipline]++
          }
          else{
            disciplineCounts[discipline.Discipline] = 1
          }
        }

      }

      //note if we didnt find it
      if(!taxon.specifyDiscipline){
        if(disciplineCounts.none){
          disciplineCounts.none++
        }
        else{
          disciplineCounts.none = 1
        }
      }
    })

    //print some feedback
    if(Object.keys(disciplineCounts).length > 0){
      console.log('Counts per discipline:')
      Object.keys(disciplineCounts).forEach(key =>{
        console.log(key + ': ' + disciplineCounts[key])
      })
    }

    //write out the results.
    //NOTE this scrambles special characters if there is an intermediary .xlsx file
    //in that copy and paste the last column back to the original csv
    let outfile = taxonFile.replace(/\.csv$/, '_disciplines.csv') 
    csv.writeToPath(path.resolve(__dirname, outfile), taxa, {headers: true})
      .on('error', err => console.error(err))
      .on('finish', () => console.log('Done writing out results.'));


  })

})