import powerbi from "powerbi-visuals-api";
import DataViewTable = powerbi.DataViewTable

export function get_table_column_index(table:DataViewTable, column_name:string){
	let result = table.columns.findIndex(column_desc => column_desc.roles[column_name])
	if (result===-1){
		throw new Error(`Unable to find the index of the specified column '${column_name}' on the table provided.`)
	}
	return result
}