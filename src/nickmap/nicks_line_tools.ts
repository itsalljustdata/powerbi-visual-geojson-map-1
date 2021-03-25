
//def linestring_measure(linestring: List[Vector2]) -> Tuple[List[Tuple[Vector2, float]], float]:
export function linestring_measure(line_string) {
	// """:returns: ([(point:vector, dist_to_next_point:float), ...], total_length:float)"""
	let result = [];
	let total_length = 0;
	let b;
	for (let i = 0; i < line_string.length - 1; i++) {
		let a = line_string[i];
		b = line_string[i + 1];
		let ab = b.copy().subtract(a);
		let ab_len = ab.len;
		result.push([a, ab_len]);
		total_length += ab_len;
	}
	result.push([b, 0]);
	return [result, total_length];
}

export function linestring_direction(measured_line_string, normalised_distance_along) {
	// returns the direction (as a unit vector) of a linestring segment which contains the point
	let [points, total_length] = measured_line_string;
	let de_normalised_distance_along = total_length * normalised_distance_along;
	let len_so_far = 0;
	let ab_len;
	let ab;
	for (let i = 0; i < points.length - 1; i++) {
		let a;
		[a, ab_len] = points[i];
		let [b, _] = points[i + 1];
		ab = b.copy().subtract(a);
		len_so_far += ab_len;
		if (len_so_far >= de_normalised_distance_along) {
			return ab.copy().scalar_divide(ab_len);
		}
	}
	return ab.copy().scalar_divide(ab_len);
}

export function linestring_ticks(measured_line_string, slk_from, slk_to, minor_interval_km, major_interval_count, x_px, y_px, decimal_figures) {

	// returns the direction (as a unit vector) of a linestring segment which contains the point

	let result = [];
	let [points, length_px] = measured_line_string;

	let length_km = slk_to - slk_from;

	let distance_from_start_to_next_tick = minor_interval_km - (slk_from % minor_interval_km);
	//let distance_from_start_to_last_tick = length_km - (slk_to % minor_interval_km);
	//let distance_from_first_tick_to_last_tick = distance_from_start_to_last_tick - distance_from_start_to_next_tick;

	let distance_from_start_to_next_major_tick = minor_interval_km * major_interval_count - (slk_from % (minor_interval_km * major_interval_count));
	let number_of_ticks_to_first_major_interval = Math.round((distance_from_start_to_next_major_tick - distance_from_start_to_next_tick) / minor_interval_km);

	//let num_ticks = Math.round(distance_from_first_tick_to_last_tick / minor_interval_km);

	let minor_interval_px = minor_interval_km / length_km * length_px;

	let initial_offset_px = distance_from_start_to_next_tick / length_km * length_px
	let offset_multiplier = 0;
	let len_so_far_px = 0;

	let current_offset_px = initial_offset_px;
	let ticks_to_major_interval = number_of_ticks_to_first_major_interval
	for (let i = 0; i < points.length - 1; i++) {
		let a = points[i][0];
		let ab_len = points[i][1];
		let b = points[i + 1][0];
		let ab = b.copy().subtract(a);
		let ab_unit = ab.copy().scalar_divide(ab_len);
		let len_after_segment = len_so_far_px + ab_len;
		while (current_offset_px < len_after_segment) {
			let is_major_tick = (offset_multiplier % major_interval_count) == number_of_ticks_to_first_major_interval
			let tick_length_px = is_major_tick ? 6 : 2;
			let segment_offet = current_offset_px - len_so_far_px
			let base = a.copy().add(ab_unit.copy().scalar(segment_offet));
			if (!(base.x < 0 || base.x > x_px || base.y < 0 || base.y > y_px)) {
				result.push([
					[
						base.copy().add(ab_unit.copy().left().scalar(-tick_length_px)),
						base.copy().add(ab_unit.copy().left().scalar(tick_length_px))
					],
					is_major_tick ? (offset_multiplier * minor_interval_km + distance_from_start_to_next_tick + slk_from).toFixed(decimal_figures) : undefined,
					Math.atan2(ab_unit.y, ab_unit.x)
				]);
			}
			offset_multiplier++;
			if (ticks_to_major_interval == 0) {
				ticks_to_major_interval = major_interval_count;
			}
			ticks_to_major_interval--;
			current_offset_px = offset_multiplier * minor_interval_px + initial_offset_px;
		}
		len_so_far_px = len_after_segment;
	}

	return result;
}
