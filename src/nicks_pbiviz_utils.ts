import powerbi from "powerbi-visuals-api";
import DataViewTable = powerbi.DataViewTable
/***
 * @returns -1 if not found.
 */
export function get_table_column_index(table:DataViewTable, column_name:string):number{
	let result = table.columns.findIndex(column_desc => column_desc.roles[column_name])
	return result
}