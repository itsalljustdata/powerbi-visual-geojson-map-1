/*
*  Power BI Visual CLI
*
*  Copyright (c) Microsoft Corporation
*  All rights reserved.
*  MIT License
*
*  Permission is hereby granted, free of charge, to any person obtaining a copy
*  of this software and associated documentation files (the ""Software""), to deal
*  in the Software without restriction, including without limitation the rights
*  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
*  copies of the Software, and to permit persons to whom the Software is
*  furnished to do so, subject to the following conditions:
*
*  The above copyright notice and this permission notice shall be included in
*  all copies or substantial portions of the Software.
*
*  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
*  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
*  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
*  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
*  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
*  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
*  THE SOFTWARE.
*/
"use strict";

import "core-js/stable";
import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost

import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import DataView = powerbi.DataView;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;


import { dataViewObjects } from "powerbi-visuals-utils-dataviewutils";

import VisualObjectInstanceEnumeration = powerbi.VisualObjectInstanceEnumeration;
import { PropertiesParser } from "./PropertiesParser";

import 'ol/ol.css';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import { Style, Stroke, Circle } from 'ol/style';


import GeoJSON from 'ol/format/GeoJSON';
import Control from 'ol/control/Control';
import { defaults as ol_control_defaults } from 'ol/control';
import { defaults as ol_interaction_defaults } from 'ol/interaction';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Overlay from 'ol/Overlay';
import Select from 'ol/interaction/Select';
import { compute_line_width, escapeHtml, logExceptions } from "./util";
import { get_table_column_index } from "./nicks_pbiviz_utils";
import Geometry from "ol/geom/Geometry";

// See src/.env.example.json
import * as SECRETS from "./.secrets.json";

import { layer_state_road_ticks, layer_state_road, layer_other_roads, road_network_styles } from './nickmap/layer_road_network';

export let map: Map;


export class Visual implements IVisual {

	//private host: IVisualHost;
	private target_element: HTMLElement;
	private map_target_div: HTMLDivElement;

	private mapview: View;

	private layer_visual_data: VectorLayer;
	private layer_metro_map: TileLayer;
	private layer_osm: TileLayer;


	private properties_parser: PropertiesParser;

	private feature_id_counter = 0; // IDs must be manually added to ensure that certain open layers features work as expected. The selection interaction for example may rely on the feature ID being unique.

	constructor(options: VisualConstructorOptions) {

		//this.host = options.host;
		this.target_element = options.element;
		this.target_element.style.display = "grid";
		this.target_element.style.height = "100%";
		this.target_element.style.gridTemplateColumns = "auto";

		// disable user selection of the visual
		this.target_element.style.userSelect = "none";

		// version display
		let version_display = document.createElement("div");
		version_display.innerHTML = "v2021.03.25"
		version_display.setAttribute("style", 'padding:2px;position:fixed;top:2px;right:10px;display:inline-block;font-size:80%;color:grey;');
		var control_version_display = new Control({
			element: version_display,
		});

		////////////////////////////////////////////////////////
		// POPUP OVERLAY
		////////////////////////////////////////////////////////
		var popup_container = document.createElement("div")
		var popup_content = document.createElement("div")
		var popup_closer = document.createElement("a")
		popup_closer.setAttribute("href", "#")
		popup_closer.onclick = function () {
			popup_overlay.setPosition(undefined);
			popup_closer.blur();
			return false;
		};

		popup_container.appendChild(popup_content)
		popup_container.appendChild(popup_closer)
		popup_content.innerHTML = "hehehe"


		popup_container.className = "ol-popup"
		popup_closer.className = "ol-popup-closer"
		var popup_overlay = new Overlay({
			element: popup_container,
			autoPan: false,
			autoPanAnimation: {
				duration: 250,
			},
		});


	

		////////////////////////////////////////////////////////
		// LAYER VECTOR GEOJSON
		//
		// TODO: Select less awful colours
		// TODO: Allow user to customise colours somehow
		////////////////////////////////////////////////////////
		this.layer_visual_data = new VectorLayer({
			source: new VectorSource(),
			style: (feature, resolution) => {

				//const colors = [ "#e60049", "#0bb4ff", "#50e991", "#e6d800", "#9b19f5", "#ffa300", "#dc0ab4", "#b3d4ff", "#00bfa0", "#f0cccc" ];
				// 
				// https://learnui.design/tools/data-color-picker.html#palette ["#003f5c", "#58508d", "#bc5090", "#ff6361", "#ffa600"]


				// default colour:
				let color = "red"

				let feature_props = feature.getProperties();

				if (feature_props["__pbi_columns"]) {
					let column_props = feature_props["__pbi_columns"];
					for (let key in column_props) {
						if (column_props[key].name && column_props[key].name.toUpperCase() == "YEAR") {
							let year = parseFloat(column_props[key].value);
							if (year <= 2021) {
								color = "#e6d800DD";
							} else if (year <= 2026) {
								color = "#e60049DD";
							} else if (year <= 2031) {
								color = "#50e991DD";
							} else if (year <= 2036) {
								color = "#9b19f5DD";
							} else if (year <= 2041) {
								color = "#0bb4ffDD";
							}
						}
					}
				}

				return new Style({
					stroke: new Stroke({
						color: color,
						width: compute_line_width(resolution),
					}),
					image: new Circle({
						radius: 8,
						stroke: new Stroke({ color: color, width: compute_line_width(resolution) }),
					}),
				});
			}
		});

		////////////////////////////////////////////////////////
		// LAYER OPEN STREET MAPS
		////////////////////////////////////////////////////////
		this.layer_osm = new TileLayer({ source: new OSM() })
		this.layer_osm.on('prerender', function (event) {
			event.context.filter = "grayscale(80%) contrast(0.8) brightness(1.2)";
		});
		this.layer_osm.on('postrender', function (event) {
			event.context.filter = "none";
		});


		////////////////////////////////////////////////////////
		// LAYER IMAGERY
		////////////////////////////////////////////////////////
		this.layer_metro_map = new TileLayer({
			source: new XYZ({
				url: SECRETS.MAP_SERVICE_URL,
			})
		});

		this.layer_metro_map.on('prerender', function (event) {
			event.context.filter = "grayscale(80%) contrast(0.8) brightness(1.2)";
		});
		this.layer_metro_map.on('postrender', function (event) {
			event.context.filter = "none";
		});

		////////////////////////////////////////////////////////
		// MAP CONTAINER DIV
		////////////////////////////////////////////////////////
		this.map_target_div = document.createElement("div")
		this.target_element.appendChild(this.map_target_div);

		////////////////////////////////////////////////////////
		// MAP VIEW
		//
		// 'EPSG:4326' is also called WGS84 and is the GeoJSON specification default ("shall be") crs https://cran.r-project.org/web/packages/geojsonio/vignettes/geojson_spec.html
		// 'EPSG:4326' is the projection  that the IRIS road data comes in.
		////////////////////////////////////////////////////////
		this.mapview = new View({
			//projection: 'EPSG:3857', // 'EPSG:3857' is the Default OpenLayers projection. There is no need to specify the default.
			center: [0, 0],
			zoom: 0
		});

		////////////////////////////////////////////////////////
		// MAP INTERACTION SELECT
		////////////////////////////////////////////////////////
		var select_interaction = new Select({
			layers: [this.layer_visual_data],
			hitTolerance: 3
		});

		select_interaction.on('select', evt => {
			//console.log("selected")
			if (evt.selected.length < 1) return;
			debugger
			let props = evt.selected[0].getProperties();
			//console.log("got prop", props)
			let out = "";
			let out_count = 0;
			if (props["__pbi_columns"]) {
				for (let key in props["__pbi_columns"]) {
					let val = props["__pbi_columns"][key];
					// properties that represent columns are added as {name, value} objects.
					if (!val["name"]) continue;
					if (!val["value"]) continue;
					out += "<tr><td>" + escapeHtml(val.name) + "</td><td>" + escapeHtml(String(val.value)) + "</td></tr>";
					out_count++;
				}
			}
			if (out_count === 0) {
				popup_content.innerHTML = '<span style="color:grey;">No data in the \'Popup Info\' field-well</span>';
			} else {
				popup_content.innerHTML = '<table><tbody>' + out + '</tbody></table>';
			}
			popup_overlay.setPosition(evt.mapBrowserEvent.coordinate);
		})

		////////////////////////////////////////////////////////
		// MAP 
		////////////////////////////////////////////////////////
		map = new Map({
			target: this.map_target_div,
			layers: [
				this.layer_osm,
				layer_state_road_ticks,
				layer_state_road,
				layer_other_roads,
				this.layer_visual_data
			],
			overlays: [popup_overlay],
			controls:
				ol_control_defaults({
					zoom: true,
					attribution: true,
					rotate: true
				}).extend([control_version_display])
			,
			view: this.mapview,
			interactions: ol_interaction_defaults().extend([select_interaction])
		});
	}

	public set_map_background(bgname:string){
		if (bgname=="Metromap") {
			map.removeLayer(this.layer_osm);
			try{
				map.getLayers().insertAt(0, this.layer_metro_map);
			}catch(e){}
		} else if(bgname=="OSM"){
			map.removeLayer(this.layer_metro_map);
			try{
				map.getLayers().insertAt(0, this.layer_osm);
			}catch(e){}
		}else{
			console.warn("Invalid layer name recieved by Visual.set_map_background")
		}
	}

	@logExceptions()
	public update(options: VisualUpdateOptions) {
		
		this.properties_parser = PropertiesParser.parse<PropertiesParser>(options.dataViews[0]);

		this.set_map_background(this.properties_parser.OtherMapSettings.background_layer)
		layer_state_road_ticks.setVisible(this.properties_parser.StateRoadSettings.show && this.properties_parser.StateRoadSettings.show_slk_ticks);
		layer_state_road.setVisible(this.properties_parser.StateRoadSettings.show && this.properties_parser.StateRoadSettings.show_state_roads);
		layer_other_roads.setVisible(this.properties_parser.StateRoadSettings.show && this.properties_parser.StateRoadSettings.show_local_roads);
		road_network_styles["State Road"].getStroke().setColor(this.properties_parser.StateRoadSettings.state_road_color);
		road_network_styles["Proposed Road"].getStroke().setColor(this.properties_parser.StateRoadSettings.state_road_color);
		road_network_styles["Local Road"].getStroke().setColor(this.properties_parser.StateRoadSettings.local_road_color);
		road_network_styles["DEFAULT"].getStroke().setColor(this.properties_parser.StateRoadSettings.local_road_color);
		road_network_styles["Main Roads Controlled Path"].getStroke().setColor(this.properties_parser.StateRoadSettings.psp_road_color);

		////////////////////////////////////////////////////////
		// REJECT CALLS TO UPDATE IF NOT FULLY CONSTRUCTED
		// OR IF OPTIONS IS NOT POPULATED WITH A TABLE OF DATA 
		////////////////////////////////////////////////////////
		if (!(this.map_target_div && options && options.dataViews && options.dataViews.length !== 0 && options.dataViews[0].table))
			return;

		let data_view = options.dataViews[0]
		//this.visual_settings = VisualSettings.parse<VisualSettings>(data_view);
		

		let GEOJSON_COLUMN_INDEX = data_view.table.columns.findIndex(column_desc => column_desc.roles["geojson_field"]);
		let COLOUR_COLUMN_INDEX = data_view.table.columns.findIndex(column_desc => column_desc.roles["colour_column"]);
		let LINE_WEIGHT_COLUMN_INDEX = data_view.table.columns.findIndex(column_desc => column_desc.roles["line_weight_column"]);


		let json_row_Features = []

		// Loop over each data row and update the content of the map data_layer
		data_view.table.rows.forEach((data_view_table_row) => {
			debugger;
			if (!data_view_table_row[GEOJSON_COLUMN_INDEX]) return; // TODO: what is the actual null value for item?.[GEOJSON_COLUMN_INDEX]?
			
			
			
			// TODO: inject additional "properties" into each feature if required for styling?

			for (let key in data_view.table.columns){
				let column = data_view.table.columns[key];
				
			}
			


			let geojson_column_value: any = data_view_table_row.find((value, index) => data_view.table.columns[index].roles["geojson_field"])
			let other_column_values: any = data_view_table_row
				.filter((value, index) => data_view.table.columns[index].roles["other_columns"])
				.map((item,index)=>{return {index, name:data_view.table.columns[index].displayName, value:item}});
			let colour_column_value: any = data_view_table_row.find((value, index) => data_view.table.columns[index].roles["colour_column"]);
			let line_weight_column_value: any = data_view_table_row.find((value, index) => data_view.table.columns[index].roles["line_weight_column"]);
			console.log(geojson_column_value,other_column_values,colour_column_value,line_weight_column_value)
			

			let jsonparsed;

			try {
				jsonparsed = JSON.parse(geojson_column_value as string)
			} catch (e) {
				// TODO: notify user that JSON.parse() failed for some features.
				//console.log(`json parse failed: tried to parse ${item[data_view.table.columns[GEOJSON_COLUMN_INDEX].displayName]} and got error ${e}`)
			}
			
			// Duplicate feature but with new properties.
			// Apparently the use of elipses to expand null or undefined values is permitted so there is no need to check.
			jsonparsed = { ...jsonparsed, id: this.feature_id_counter++, properties: { ...jsonparsed.properties, __pbi_columns: other_column_values } };
			json_row_Features.push(jsonparsed)



				
			
		})
		if (json_row_Features.length === 0) {
			// TODO: notify the user that no features were parsed
			this.clearVectorLayers()
			return
		}

		let parsed_features = [];
		try {
			// Because the GeoJSON object is not connected to the map, it doesnt know the projection we are using
			// therefore we need to tell it.
			let featureProjection = this.mapview.getProjection()
			let dataProjection = new GeoJSON().readProjection({ "crs": { "type": "EPSG", "properties": { "code": 4326 } } })
			parsed_features = new GeoJSON({ featureProjection, dataProjection }).readFeatures({
				"type": "FeatureCollection",
				"features": json_row_Features
			});
		} catch (e) {
			// TODO: notify user that readFeatures failed.
			//console.log("Error: While all GeoJSON text was successfully parsed into JSON, OpenLayers was unabled to parse the resulting JSON: new ol.GeoJSON().readFeatures(...) failed. Is the input data valid GeoJSON with coordinates in EPSG:4326 ?")
			this.clearVectorLayers()
			return
		}
		if (parsed_features.length === 0) {
			// TODO: notify user that readFeatures failed. This seems unlikely to happen.
			//console.log("Error: While all GeoJSON text was successfully parsed into JSON and OpenLayers successfully called ol.GeoJSON().readFeatures(...), an empty list of OpenLayers features was returned despite a non-empty list of input GeoJSON features.")
			this.clearVectorLayers()
			return
		}
		let new_vector_source = new VectorSource({
			features: parsed_features
		})

		this.setVectorLayerSource(new_vector_source);

		this.mapview.fit(new_vector_source.getExtent());

	}

	private clearVectorLayers() {
		this.setVectorLayerSource(new VectorSource());
	}

	private setVectorLayerSource(new_vector_source: VectorSource<Geometry>) {
		this.layer_visual_data.setSource(new_vector_source);
	}

	// I found this snippet on the internet to describe what enumerateObjectInstances does 
	//     "This function returns the values to be displayed in the property pane for each object.
	//     Usually it is a bind pass of what the property pane gave you
	//     but sometimes you may want to do validation and return other values/defaults"
	// I think by 'bind pass' this person meant that it sends the 'model' back out to the 'view']
	
	// Here we use the utilities provided in powerbi-visuals-utils-dataviewutils to simplify this task https://docs.microsoft.com/en-us/power-bi/developer/visuals/utils-dataview
	//  this appears to be the idiomatic way of doing it, and hopefully good enough if we dont need fancy behaviour.
	public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
		console.log(options.objectName);
		return PropertiesParser.enumerateObjectInstances(this.properties_parser, options);
	}
}