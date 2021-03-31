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
import { Map as OpenLayersMap, View } from 'ol';
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

export let map: OpenLayersMap;


export class Visual implements IVisual {

	//private host: IVisualHost;
	private target_element: HTMLElement;
	private map_target_div: HTMLDivElement;

	private mapview: View;

	private layer_visual_data: VectorLayer;
	private layer_metro_map: TileLayer;
	private layer_osm: TileLayer;

	private raster_layer_filter_string:string = "grayscale(80%) contrast(0.8) brightness(1.2)";


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

		////////////////////////////////////////////////////////
		// VERSION DISPLAY
		////////////////////////////////////////////////////////
		let version_display = document.createElement("div");
		version_display.innerHTML = "v2021.03.31 NickMap"
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

		popup_container.appendChild(popup_content);
		popup_container.appendChild(popup_closer);


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
		// LAYER VISUAL DATA
		////////////////////////////////////////////////////////
		this.layer_visual_data = new VectorLayer({
			source: new VectorSource(),
			style: (feature, resolution) => {

				let color = feature.get("__color");
				let line_weight = feature.get("__line_weight")*2;//compute_line_width(resolution,feature.get("__line_weight"));
				let radius = feature.get("__point_diameter");
				let stroke = new Stroke({
					color,
					width: line_weight,
				}); 

				return new Style({
					stroke,
					image: new Circle({radius,stroke}),
				});
			}
		});

		////////////////////////////////////////////////////////
		// LAYER OPEN STREET MAPS
		////////////////////////////////////////////////////////
		this.layer_osm = new TileLayer({ source: new OSM() })
		this.layer_osm.on('prerender', event => {
			event.context.filter = this.raster_layer_filter_string;
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

		this.layer_metro_map.on('prerender', event => {
			event.context.filter = this.raster_layer_filter_string;
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
			let vals = evt.selected?.[0]?.get("__other_columns") ?? [];
			//console.log("got prop", props)
			let out = "";
			let out_count = 0;
			let prop_count = 0;
			for (let key in vals) {
				let val = vals[key];
				// properties that represent columns are added as {name, value} objects.
				prop_count++;
				if (!val.display_name) continue;
				if (!val.value) continue;
				out += "<tr><td>" + escapeHtml(val.display_name) + "</td><td>" + escapeHtml(String(val.value)) + "</td></tr>";
				out_count++;
			}
			if (prop_count==0) {
				popup_content.innerHTML = '<span style="color:grey;">No data in the \'Popup Info\' field-well</span>';
			} else if(out_count==0) {
				popup_content.innerHTML = '<span style="color:grey;">None of the fields in the \'Popup Info\' field well could be displayed. This can happen when fields are "summarised".</span>';
			}else{
				popup_content.innerHTML = '<table><tbody>' + out + '</tbody></table>' + ((out_count!==prop_count)? " not all properties could be displayed.":"");
			}
			popup_overlay.setPosition(evt.mapBrowserEvent.coordinate);
		})

		////////////////////////////////////////////////////////
		// MAP 
		////////////////////////////////////////////////////////
		map = new OpenLayersMap({
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
		
		
		////////////////////////////////////////////////////////
		// REJECT CALLS TO UPDATE IF NOT FULLY CONSTRUCTED
		// OR IF OPTIONS IS NOT POPULATED WITH A TABLE OF DATA 
		////////////////////////////////////////////////////////
		if (!(this.map_target_div && options?.dataViews?.[0]?.categorical)) return;
		

		let data_view = options.dataViews[0]

		this.properties_parser = PropertiesParser.parse<PropertiesParser>(data_view);

		//grayscale(80%) contrast(0.8) brightness(1.2)
		this.raster_layer_filter_string = `invert(${this.properties_parser.OtherMapSettings.background_invert}%) grayscale(${this.properties_parser.OtherMapSettings.background_greyscale}%) contrast(${this.properties_parser.OtherMapSettings.background_contrast}%) brightness(${this.properties_parser.OtherMapSettings.background_brightness}%)`;

		this.set_map_background(this.properties_parser.OtherMapSettings.background_layer)
		layer_state_road_ticks.setVisible(this.properties_parser.StateRoadSettings.show && this.properties_parser.StateRoadSettings.show_slk_ticks);
		layer_state_road.setVisible(this.properties_parser.StateRoadSettings.show && this.properties_parser.StateRoadSettings.show_state_roads);
		layer_other_roads.setVisible(this.properties_parser.StateRoadSettings.show && this.properties_parser.StateRoadSettings.show_local_roads);
		road_network_styles["State Road"].getStroke().setColor(this.properties_parser.StateRoadSettings.state_road_color);
		road_network_styles["Proposed Road"].getStroke().setColor(this.properties_parser.StateRoadSettings.state_road_color);
		road_network_styles["Local Road"].getStroke().setColor(this.properties_parser.StateRoadSettings.local_road_color);
		road_network_styles["DEFAULT"].getStroke().setColor(this.properties_parser.StateRoadSettings.local_road_color);
		road_network_styles["Main Roads Controlled Path"].getStroke().setColor(this.properties_parser.StateRoadSettings.psp_road_color);


		// typescript wont let me use flatMap :(
		let roles: Set<string> = new Set();
		for(let item of data_view.metadata.columns){
			for(let role of Object.keys(item.roles)){
				roles.add(role);
			}
		}

		// Bailout if we have no geometry to draw
		if (!roles.has("geojson_field")){
			return;
		}

		// PREPARE TO HAVE YOUR MIND MELTED
		// BY POWERBI's ULTRA CONVOLUTED DATASTRUCTURES

		// maps "role" to a map which maps "categories index" to "column display name"
		let role_category_index:Map<string, {index:number, display_name:string, category:powerbi.DataViewCategoryColumn}[]> = new Map();
		for (let role of roles){
			let interm:Map<string, number> = data_view.categorical.categories.reduce((accumulator, item, index)=>{
				if(role in item.source.roles){
					accumulator.set(item.source.displayName, index);
				}
				return accumulator;
			},new Map());
			// reverse the mapping again
			let res:{index:number, display_name:string, category:powerbi.DataViewCategoryColumn}[] = [];
			for(let [display_name, index] of interm){
				res.push({
					index,
					display_name,
					category:data_view.categorical.categories[index]
				});
			}
			role_category_index.set(role, res);
		}

		

		let json_row_Features = []

		for(let row_index=0;row_index<role_category_index.get("geojson_field")[0].category.values.length;row_index++){

			let row_values:{[key:string]:{display_name:string, value:any}[]} = {};
			
			// TODO: We have made the assumption that the values in each data_vire.categorical.categories[...].values corespond with eachother.
			// if this is wrong then i am fed up. Seriously powerBI makes this way too flipping hard.


			for (let [role, category_array] of role_category_index){
				row_values[role] = category_array.map(({display_name, category})=>({display_name, value:category.values[row_index]}));
			}
			debugger
			let jsonparsed;

			try {
				jsonparsed = JSON.parse(row_values["geojson_field"][0].value as string)
			} catch (e) {
				return; // TODO: try notify user of fail.
			}

			jsonparsed = {
				...jsonparsed,
				id: this.feature_id_counter++,
				properties: {
					//...jsonparsed.properties,
					__other_columns: row_values?.["other_columns"]?.map(({display_name, value}, index)=>({
						display_name:display_name,
						value:value
					})) ?? [],
					__color: row_values?.["colour_column"]?.[0].value ?? "#FF0000",
					__line_weight: row_values?.["line_weight_column"]?.[0].value ?? 1,
					__point_diameter: row_values?.["point_diameter_column"]?.[0].value ?? 5,
				}
			};
			json_row_Features.push(jsonparsed)
		}

		if (json_row_Features.length === 0) {
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

		if(this.properties_parser.OtherMapSettings.zoom_to_fit_on_update === true){
			this.mapview.fit(new_vector_source.getExtent());
		}

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
		return PropertiesParser.enumerateObjectInstances(this.properties_parser || PropertiesParser.getDefault(), options);
	}
}