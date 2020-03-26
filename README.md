A simple utility to add higher taxonomy to a set of species or subspecies names from [globalnames.org](globalnames.org).
Also separates out the taxon authority for those names that include it.

Instructions:
-You need Node.js V8 or higher installed. 
-add the list of names in the names.js file (they must all be quoted and be separated by commas)

-open a command window and cd to the directory where the files for this utility are located. Then on the command line type:

node index.js

-the results will be in results.csv. Open this file in Excel (taking care to specify the character encoding as UTF8), to see the results and make edits.

-to add Specify disciplines to an excel file, save it as csv in this folder. Edit the taxonFile variable in addDisciplines.js so that it is the name of the file you want to process. Then in a command window run:

node addDisciplines.js

-the result will have the same file name with '_disciplines' appended at the end. 