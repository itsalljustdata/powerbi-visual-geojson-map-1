import {dataViewObjectsParser} from "powerbi-visuals-utils-dataviewutils";
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
}

export class PropertiesParser extends dataViewObjectsParser.DataViewObjectsParser {
    public StateRoadSettings = new StateRoadSettings();
    public OtherMapSettings = new OtherMapSettings();
}
