
import { Style, Stroke, Text, Fill } from 'ol/style';
import { RenderFunction } from 'ol/style/Style';
import { Vector as VectorLayer } from 'ol/layer';
import { toContext } from 'ol/render'
import LineString from 'ol/geom/LineString'

import { esri_vector_source } from './esri_vector_layer_loader';
import * as SECRETS from '../.secrets.json';


import { map } from '../visual';
import { linestring_measure, linestring_ticks } from './nicks_line_tools';
import { Vector } from './Vector';

export const road_network_styles = {
	'Main Roads Controlled Path': new Style({
		stroke: new Stroke({
			color: 'rgba(100, 40, 100)',
			width: 1.5,
		}),
	}),
	'State Road': new Style({
		stroke: new Stroke({
			color: 'rgb(50, 100, 100)',
			width: 1.5,
		}),
	}),
	'Proposed Road': new Style({
		stroke: new Stroke({
			color: 'rgb(50, 100, 100)',
			width: 1.3,
			lineDash: [10, 10]
		}),
		//renderer: custom_renderer_with_SLK_ticks
	}),
	'Local Road': new Style({
		stroke: new Stroke({
			color: 'rgba(50, 50, 110, 255)',
			width: 1,
		}),
	}),
	'DEFAULT': new Style({
		stroke: new Stroke({
			color: 'rgba(40, 40, 80, 255)',
			width: 1,
		}),
	})
};




let road_name_text_style = new Text({
	font: "bold 13px sans-serif",
	placement: 'line',
	textBaseline: 'bottom',
	fill: new Fill({
		color: "#000"
	}),
	stroke: new Stroke({
		color: '#fff',
		width: 1,
	}),
});





let state_road_only_vector_source = new esri_vector_source({
	...SECRETS.ROAD_NETWORK_LAYER,
	sql_filter: "NETWORK_TYPE in ('Main Roads Controlled Path', 'State Road', 'Proposed Road')",
	tile_size: 256
});

let other_road_only_vector_source = new esri_vector_source({
	...SECRETS.ROAD_NETWORK_LAYER,
	sql_filter: "NETWORK_TYPE not in ('Main Roads Controlled Path', 'State Road', 'Proposed Road')",
	tile_size: 128
});

/////////////////////////////////////////
// LAYER: State Road
////////////////////////////////////////


function state_road_vector_layer_style_function(feature, resolution) {
	let result = road_network_styles[feature.get("NETWORK_TYPE")] ?? road_network_styles["DEFAULT"];
	if (resolution < 0.8) {
		let stl = road_name_text_style.clone();
		stl.setText(feature.get("ROAD") + " - " + feature.get("ROAD_NAME"));
		result = result.clone();
		result.setText(stl);
	} else if (resolution < 3) {
		let stl = road_name_text_style.clone();
		stl.setText(feature.get("ROAD"));
		result = result.clone();
		result.setText(stl);
	}
	return result;
}


function other_road_vector_layer_style_function(feature, resolution) {
	let result =  road_network_styles[feature.get("NETWORK_TYPE")] ?? road_network_styles["DEFAULT"];
	if (resolution < 0.8) {
		let stl = road_name_text_style.clone();
		stl.setText(feature.get("ROAD_NAME"))
		result = result.clone()
		result.setText(stl)
	}
	return result;
}


export let layer_state_road = new VectorLayer({
	source: state_road_only_vector_source,
	style: state_road_vector_layer_style_function,
	minZoom: 8,
});


export let layer_other_roads = new VectorLayer({
	source: other_road_only_vector_source,
	style: other_road_vector_layer_style_function,
	minZoom: 15,
});


let custom_render_tick_text = new Text({
	text: "hey",
	font: "bold 16px sans-serif",
	textAlign: "left",
	fill: new Fill({
		color: "#000"
	}),
	stroke: new Stroke({
		color: '#fff',
		width: 1,
	}),
})


let custom_renderer_with_SLK_ticks: RenderFunction = (pixelCoordinates, state) => {
	// There are a lot of bugs when the pixle ratio is not 1
	let pixle_ratio = window.devicePixelRatio ?? 1;
	var context = state.context;

	let canvas_size_x = context.canvas.width / pixle_ratio;
	let canvas_size_y = context.canvas.height / pixle_ratio;

	let coords = state.geometry.getCoordinates().map(item => map.getPixelFromCoordinateInternal(item));
	var network_type = state.feature.get("NETWORK_TYPE");


	var slk_from = state.feature.get('START_SLK');
	var slk_to = state.feature.get('END_SLK');
	let mls = linestring_measure(coords.map(item => new Vector(...(item as [number, number]))));
	let ticks;
	let decimal_figures;

	if (network_type === "Main Roads Controlled Path" && state.resolution > 4) {
		return;
	}

	if (state.resolution < 0.3) {
		decimal_figures = 2
		//ticks = linestring_ticks(mls, slk_from, slk_to, 0.001, 10, canvas_size_x/pixle_ratio, canvas_size_y/pixle_ratio);
		ticks = linestring_ticks(mls, slk_from, slk_to, 0.001, 10, canvas_size_x, canvas_size_y, decimal_figures);
	} else if (state.resolution < 1.4) {
		decimal_figures = 1
		//ticks = linestring_ticks(mls, slk_from, slk_to, 0.01, 10, canvas_size_x/pixle_ratio, canvas_size_y/pixle_ratio);
		ticks = linestring_ticks(mls, slk_from, slk_to, 0.01, 10, canvas_size_x, canvas_size_y, decimal_figures);
	} else if (state.resolution < 4) {
		decimal_figures = 0
		//ticks = linestring_ticks(mls, slk_from, slk_to, 0.1, 10, canvas_size_x/pixle_ratio, canvas_size_y/pixle_ratio);
		ticks = linestring_ticks(mls, slk_from, slk_to, 0.1, 10, canvas_size_x, canvas_size_y, decimal_figures);
	} else {
		decimal_figures = 0
		//ticks = linestring_ticks(mls, slk_from, slk_to, 0.1, 10, canvas_size_x/pixle_ratio, canvas_size_y/pixle_ratio);
		ticks = linestring_ticks(mls, slk_from, slk_to, 1, 1, canvas_size_x, canvas_size_y, decimal_figures);
	}
	let tickmarks = ticks.map(item => [
		[
			[item[0][0].x, item[0][0].y],
			[item[0][1].x, item[0][1].y]
		],
		item[1],
		item[2]
	]);
	context.save();
	var renderContext = toContext(context);
	(renderContext as any).extent_ = [0, 0, canvas_size_x, canvas_size_y];  // manual ovveride extent calculation to fix problems when devicePixleRatio is not == 1
	renderContext.setFillStrokeStyle(
		road_network_styles[network_type].getFill(),
		road_network_styles[network_type].getStroke()
	);
	var geometry: LineString = state.geometry.clone() as LineString;
	for (let [item, label, label_rotation] of tickmarks) {
		label_rotation += Math.PI / 2;
		geometry.setCoordinates(item)
		renderContext.drawGeometry(geometry);
		if (label && state.feature.get("CWY") != "Right") {
			let text_style = custom_render_tick_text.clone()
			text_style.setText(label)
			if (Math.abs(label_rotation) > Math.PI / 2) {
				label_rotation += Math.PI;
				text_style.setTextAlign("right");
			}
			text_style.setRotation(label_rotation);
			renderContext.setTextStyle(text_style);
			(renderContext as any).drawText_(item[1], 0, 2, 2);
			renderContext.setTextStyle(null);
		}
	}
	context.restore();
}

export let layer_state_road_ticks = new VectorLayer({
	source: state_road_only_vector_source,
	style: new Style({
		renderer: custom_renderer_with_SLK_ticks
	}),
	minZoom: 12
});