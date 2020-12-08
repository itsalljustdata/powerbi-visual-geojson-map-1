# PowerBI GeoJSON Visual

This is an interactive map PowerBI custom visual for datasets that include a text column consisting of one GeoJSON `{"type":"Feature", ...}` per row.

## But Why?
See my related project which generates the type of data that this visual consumes: https://github.com/thehappycheese/linear_referencing_geocoding_server

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

If you do not have a suitable mapping service URL then I leave it to you to disable this function; start by deleting the following line from `visual.ts`:
```TypeScript
import * as PROCESS_ENV from "./.env.json";
```

## Notes:

Hard coded to look for a "Year" field in the 'other columns' field-well. Uses this to colour the line segments and points according to a pre-determined colour scale:
```javascript
if (year <= 2021) {
	color = "#e6d800DD"
} else if (year <= 2026) {
	color = "#e60049DD"
} else if (year <= 2031) {
	color = "#50e991DD"
} else if (year <= 2036) {
	color = "#9b19f5DD"
} else if (year <= 2041) {
	color = "#0bb4ffDD"
}
```

Experiments with gradient colours revealed that it becomes very hard to distinguish the difference and absolute value of road segments
For example `["#3E485DCC","#544699CC","#782FADCC","#D01FD6CC","#FC2265CC"]` was very bad
This is because adjacent road segments often need resurfacing at a similar time to neighboring segments