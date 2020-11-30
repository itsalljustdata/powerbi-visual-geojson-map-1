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
import {get_table_column_index} from "./nicks_pbiviz_utils"
import Geometry from "ol/geom/Geometry";

// See src/.env.example.json
import * as PROCESS_ENV from "./.env.json"

export class Visual implements IVisual {

	private host: IVisualHost;
	private target_element: HTMLElement;
	private map_target_div: HTMLDivElement;

	private map: Map;
	private mapview: View;

	private layer_vector_geojson: VectorLayer;
	private layer_vector_geojson_shadow: VectorLayer;
	private layer_metro_map: TileLayer;
	private layer_osm: TileLayer;

	private ui_use_skyview_checkbox;

	constructor(options: VisualConstructorOptions) {
		let self = this
		this.host = options.host;
		this.target_element = options.element
		this.target_element.style.display = "grid"
		this.target_element.style.height = "100%"
		this.target_element.style.gridTemplateColumns = "auto"

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
		// MAP CONTORL
		//
		// TODO: Abstract style to css
		////////////////////////////////////////////////////////
		let control_container = document.createElement("div")
		control_container.setAttribute("style", 'background-color:rgba(255,255,255,0.5);padding:3px;border:1px solid grey;width:auto;margin-left:60px;display:inline-block;')
		this.ui_use_skyview_checkbox =  document.createElement("input");
		this.ui_use_skyview_checkbox.setAttribute("type", "checkbox")
		this.ui_use_skyview_checkbox.setAttribute("id", "mapshapenick-use-skyview-checkbox")
		let ui_use_skyview_label = document.createElement("label")
		ui_use_skyview_label.innerHTML = "use skyview"
		ui_use_skyview_label.setAttribute("for", "mapshapenick-use-skyview-checkbox")
		control_container.appendChild(ui_use_skyview_label)
		control_container.appendChild(this.ui_use_skyview_checkbox)

		var control_layer_switch = new Control({
			element: control_container,
		});

		this.ui_use_skyview_checkbox.onchange = function (e: Event) {
			let target = e.target as HTMLInputElement
			//console.log(target)
			if (self.ui_use_skyview_checkbox.checked) {
				self.map.removeLayer(self.layer_osm)
				self.map.getLayers().insertAt(0, self.layer_metro_map)
			} else {
				self.map.removeLayer(self.layer_metro_map)
				self.map.getLayers().insertAt(0, self.layer_osm)
			}
		}

		////////////////////////////////////////////////////////
		// LAYER VECTOR GEOJSON
		//
		// TODO: Select less awful colours
		// TODO: Allow user to customise colours somehow
		////////////////////////////////////////////////////////
		this.layer_vector_geojson = new VectorLayer({
			source: new VectorSource(),
			style: (feature, resolution) => {
				//const colors = [ "#e60049", "#0bb4ff", "#50e991", "#e6d800", "#9b19f5", "#ffa300", "#dc0ab4", "#b3d4ff", "#00bfa0", "#f0cccc" ];
				//["#3E485DCC","#544699CC","#782FADCC","#D01FD6CC","#FC2265CC"]
				let color = "red"
				let props = feature.getProperties()
				for (let key in props) {
					if (props[key].name && props[key].name.toUpperCase() == "YEAR") {
						let year = parseFloat(props[key].value)
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
				})
			}
		});

		////////////////////////////////////////////////////////
		// LAYER VECTOR GEOJSON SHADOW
		//
		// Adds a white glow effect behind all lines 
		// and point features to make them 
		// stand out over any background map
		////////////////////////////////////////////////////////
		this.layer_vector_geojson_shadow = new VectorLayer({
			source: new VectorSource(),
			style: (feature, resolution) => {
				return new Style({
					stroke: new Stroke({
						color: 'white',
						width: compute_line_width(resolution) + 6,
					}),
					image: new Circle({
						radius: 8,
						stroke: new Stroke({ color: 'white', width: compute_line_width(resolution) + 6 }),
					}),
				})
			}
		})

		////////////////////////////////////////////////////////
		// LAYER OPEN STREET MAPS
		////////////////////////////////////////////////////////
		this.layer_osm = new TileLayer({ source: new OSM() })
		this.layer_osm.on('prerender', function (event) {
				event.context.filter = "grayscale(80%) contrast(0.8) brightness(1.2)"
		});
		this.layer_osm.on('postrender', function (event) {
			event.context.filter = "none"
		});
		

		////////////////////////////////////////////////////////
		// LAYER IMAGERY
		////////////////////////////////////////////////////////
		this.layer_metro_map = new TileLayer({
			source: new XYZ({
				url: PROCESS_ENV.MAP_SERVICE_URL,
			})
		});
		
		this.layer_metro_map.on('prerender', function (event) {
				event.context.filter = "grayscale(80%) contrast(0.8) brightness(1.2)"
		});
		this.layer_metro_map.on('postrender', function (event) {
			event.context.filter = "none"
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
		})

		////////////////////////////////////////////////////////
		// MAP INTERACTION SELECT
		////////////////////////////////////////////////////////
		var select_interaction = new Select({
			layers: [this.layer_vector_geojson],
			hitTolerance: 3
		})
		select_interaction.on('select', evt => {
			//console.log("selected")
			if (evt.selected.length < 1) return;

			let props = evt.selected[0].getProperties()
			//console.log("got prop", props)
			let out = ""
			let out_count = 0
			for (let key in props) {
				let val = props[key]
				if (key != "geometry") {
					out += "<tr><td>" + escapeHtml(val.name) + "</td><td>" + escapeHtml(String(val.value)) + "</td></tr>";
					out_count++
				}
			}
			if (out_count === 0) {
				popup_content.innerHTML = '<span style="color:grey;">No data in the \'Other Columns\' field-well</span>'
			} else {
				popup_content.innerHTML = '<table><tbody>' + out + '</tbody></table>';
			}
			popup_overlay.setPosition(evt.mapBrowserEvent.coordinate);
		})

		////////////////////////////////////////////////////////
		// MAP 
		////////////////////////////////////////////////////////
		this.map = new Map({
			target: this.map_target_div,
			layers: [
				this.layer_osm,
				//this.layer_vector_geojson_shadow,
				this.layer_vector_geojson
			],
			overlays: [popup_overlay],
			controls:
				ol_control_defaults({
					zoom: true,
					attribution: true,
					rotate: true
				}).extend([control_layer_switch])
			,
			view: this.mapview,
			interactions: ol_interaction_defaults().extend([select_interaction])
		});
	}

	@logExceptions()
	public update(options: VisualUpdateOptions) {
		
		////////////////////////////////////////////////////////
		// REJECT CALLS TO UPDATE IF NOT FULLY CONSTRUCTED
		// OR IF OPTIONS IS NOT POPULATED WITH A TABLE OF DATA 
		////////////////////////////////////////////////////////
		if (!(this.map_target_div && options && options.dataViews && options.dataViews.length!==0 && options.dataViews[0].table))
			return

		let data_view = options.dataViews[0]

		let GEOJSON_COLUMN_INDEX
		try{
			GEOJSON_COLUMN_INDEX = get_table_column_index(data_view.table, "geojson_field")
		}catch(e){
			// TODO: this error indicates an error in the capabilities.json. Send to console.
			//console.log(e)
			return
		}

		let json_row_Feature = []

		data_view.table.rows.forEach((item) => {
			if (item[GEOJSON_COLUMN_INDEX] !== "") {
				try {
					let jsonparsed = JSON.parse(item[GEOJSON_COLUMN_INDEX] as string)
					json_row_Feature.push(jsonparsed)
				} catch (e) {
					// TODO: notify user that JSON.parse() failed for some features.
					//console.log(`json parse failed: tried to parse ${item[data_view.table.columns[GEOJSON_COLUMN_INDEX].displayName]} and got error ${e}`)
				}
			}
		})
		if(json_row_Feature.length===0){
			// TODO: notify the user that no features were parsed
			this.clearVectorLayers()
			return
		}
		let json_FeatureCollection = {
			"type": "FeatureCollection",
			'features': json_row_Feature.map((item, index) => {
				// TODO: inject additional "properties" into each feature if required for styling?
				let new_prop: any = item.properties || data_view.table.columns.reduce((accumulator, column_desc, column_index) => {
					if (column_index == GEOJSON_COLUMN_INDEX) {
						return accumulator
					} else {
						return { ...accumulator, ["column" + column_index]: { name: column_desc.displayName, value: data_view.table.rows[index][column_index] } }
					}
				}, {})
				let result = { ...item, properties: new_prop };
				return result;
			})
		}
		let parsed_features = []
		try {
			// Because the GeoJSON object is not connected to the map, it doesnt know the projection we are using
			// therefore we need to tell it.
			let featureProjection = this.mapview.getProjection()
			let dataProjection = new GeoJSON().readProjection({ "crs": { "type": "EPSG", "properties": { "code": 4326 } } })
			parsed_features = new GeoJSON({ featureProjection, dataProjection }).readFeatures(json_FeatureCollection)
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
		this.setVectorLayerSource(new_vector_source)
		this.mapview.fit(new_vector_source.getExtent())
		


	}

	private clearVectorLayers(){
		this.setVectorLayerSource(new VectorSource())
	}

	private setVectorLayerSource(new_vector_source:VectorSource<Geometry>){
		this.layer_vector_geojson.setSource(new_vector_source)
		this.layer_vector_geojson_shadow.setSource(new_vector_source)
	}
}