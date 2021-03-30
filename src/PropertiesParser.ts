import {dataViewObjectsParser} from "powerbi-visuals-utils-dataviewutils";
import powerbi from "powerbi-visuals-api";
import DataView = powerbi.DataView;
import DataViewObjectsParser = dataViewObjectsParser.DataViewObjectsParser;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstanceEnumeration = powerbi.VisualObjectInstanceEnumeration;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;

export class StateRoadSettings {
	public show: boolean = true;
	public show_local_roads:boolean = true;
	public show_state_roads:boolean = true;
	public show_slk_ticks:boolean = true;
	public state_road_color: string = '#326464';
	public psp_road_color:string = '#642864';
	public local_road_color: string = '#32326e';
	
}
export class OtherMapSettings{
	public background_layer:string = "OSM";
	public background_greyscale:number = 80;
	public background_brightness:number = 120;
	public background_contrast:number = 80;
	public background_invert:number = 0;
	public zoom_to_fit_on_update:boolean = true;
}

export class PropertiesParser extends DataViewObjectsParser {
	public StateRoadSettings = new StateRoadSettings();
	public OtherMapSettings = new OtherMapSettings();
	static enumerateObjectInstances(data_view_object_parser: DataViewObjectsParser, options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration{
		let result = super.enumerateObjectInstances(data_view_object_parser,options)
		if((result as VisualObjectInstanceEnumerationObject)?.instances){
			for(let instance of (result as VisualObjectInstanceEnumerationObject).instances){
				for(let prop in instance.properties){
					switch(prop){
						case "background_brightness":
							instance.properties[prop] = Math.round(Math.max(0,Math.min(300, instance.properties[prop] as number)))
							break
						case "background_contrast":
							instance.properties[prop] = Math.round(Math.max(0,Math.min(300, instance.properties[prop] as number)))
							break
						case "background_greyscale":
							instance.properties[prop] = Math.round(Math.max(0,Math.min(100, instance.properties[prop] as number)))
							break
						case "background_invert":
							instance.properties[prop] = Math.round(Math.max(0,Math.min(100, instance.properties[prop] as number)))
							break
					}
				}
			}
		}
		return result;
	}
}