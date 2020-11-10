# PowerBI GeoJSON Visual

An interactive map PowerBI custom visual for datasets that include a single GeoJSON "type":"Feature" per row.



## Requirements
To work on this project the following are needed:
1) Install Node.js
   - Alternatively if you are an admin on your local machien I reccomend https://github.com/coreybutler/nvm-windows which will make it easier to swap out node versions if nessisary
2) Make sure `npm` (node package manager) is installed - Note this happens as part of the Node.js installation process and you should not need to do anything.
3) Open a terminal and install pbiviz `npm install pbiviz`
4) Install the pbiviz certificate `pbiviz --install-cert` following this guide: https://docs.microsoft.com/en-us/power-bi/developer/visuals/create-ssl-certificate
5) Clone or download this repo and open a terminal in the same folder where `package.json` is found
6) run `npm install` to automatically download all dependancies. This should create a folder called `node_modules`
7) Configure 'environments' (see section below)
8) run `pbiviz start`
9) Follow microsoft documentation to preview the developer mode visual https://docs.microsoft.com/en-us/power-bi/developer/visuals/visuals-how-to-debug

## 'Environments'
To hide the mapping service / API key URL used for the satelite imagery layer, the URL is stored in a json file called `.env.json` which is not included in this repository. To compile this project you will need to create this file manually. There is an `.env.example.json` file which describes what content is needed in this file.

If you do not have a suitable mapping service URL then I leave it to disable this function; start by deleting the following line from `visual.ts`:
```TypeScript
import * as PROCESS_ENV from "./.env.json";
```