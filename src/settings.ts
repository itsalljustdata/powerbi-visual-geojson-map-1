import {dataViewObjectsParser} from "powerbi-visuals-utils-dataviewutils";
export class StateRoadSettings {
    public show: boolean = true;
    public color: string = 'rgb(50, 100, 100)';
    public opacity: number = 0.5;
}
export class BackgroundImageSettings {
    public Metromap: boolean = false;
}
export class VisualSettings extends dataViewObjectsParser.DataViewObjectsParser {
    public state_road = new StateRoadSettings();
    public background_image = new BackgroundImageSettings();
}

// "StateRoadSettings":{
//     "displayName": "State Roads",
//     "properties": {
//         "show":{
//             "displayName": "Show State Roads",
//             "type": {"bool":true}
//         },
//         "color":{
//             "displayName": "State Road Colour",
//             "type": {
//                 "fill": {
//                     "solid": {
//                         "color":true
//                     }
//                 }
//             }
//         },
//         "opacity":{
//             "displayName": "State Road Opacity",
//             "type": {
//                 "numeric": true
//             }
//         }
//     }
// },
// "BackgroundImageSettings":{
//     "displayName": "Background Image",
//     "properties": {
//         "Metromap":{
//             "displayName": "MetroMap",
//             "type":{"bool": true}
//         }
//     }
// }